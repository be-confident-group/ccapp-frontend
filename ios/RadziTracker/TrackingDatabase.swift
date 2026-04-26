import Foundation
import GRDB

/// Writes to the same SQLite file that expo-sqlite reads from.
/// Path: <Documents>/SQLite/radzi.db (must match expo-sqlite's path).
final class TrackingDatabase {
  static let shared = TrackingDatabase()

  private let queue: DatabaseQueue
  private let writeQueue = DispatchQueue(label: "com.radzi.tracker.db.write", qos: .utility)

  private init() {
    let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    let dbDir = docs.appendingPathComponent("SQLite", isDirectory: true)
    try? FileManager.default.createDirectory(at: dbDir, withIntermediateDirectories: true)
    let dbPath = dbDir.appendingPathComponent("radzi.db").path
    do {
      var config = Configuration()
      config.prepareDatabase { db in
        try db.execute(sql: "PRAGMA journal_mode=WAL")
      }
      self.queue = try DatabaseQueue(path: dbPath, configuration: config)
    } catch {
      fatalError("[TrackingDatabase] Failed to open SQLite: \(error)")
    }
  }

  // MARK: - Trip operations

  func createTrip(id: String, startTime: Int64, backfillStart: Int64) throws {
    try writeQueue.sync {
      try queue.write { db in
        try db.execute(sql: """
          INSERT INTO trips (id, user_id, status, start_time, created_at, updated_at, engine, backfill_start, detection_state)
          VALUES (?, 'current_user', 'active', ?, ?, ?, 'native', ?, 'recording')
        """, arguments: [id, startTime, startTime, startTime, backfillStart])
      }
    }
  }

  func updateTripUpdatedAt(tripId: String, updatedAt: Int64) throws {
    try writeQueue.sync {
      try queue.write { db in
        try db.execute(sql: "UPDATE trips SET updated_at = ? WHERE id = ?",
                       arguments: [updatedAt, tripId])
      }
    }
  }

  func updateTripBackfillStart(tripId: String, backfillStart: Int64) throws {
    try writeQueue.sync {
      try queue.write { db in
        try db.execute(sql: "UPDATE trips SET backfill_start = ? WHERE id = ?",
                       arguments: [backfillStart, tripId])
      }
    }
  }

  func endTrip(tripId: String, endTime: Int64) throws {
    try writeQueue.sync {
      try queue.write { db in
        try db.execute(sql: """
          UPDATE trips SET status = 'completed', end_time = ?, updated_at = ?, detection_state = 'ending'
          WHERE id = ?
        """, arguments: [endTime, endTime, tripId])
      }
    }
  }

  // MARK: - Location operations

  func insertLocation(tripId: String, lat: Double, lng: Double, accuracy: Double?,
                      speed: Double?, heading: Double?, altitude: Double?,
                      timestamp: Int64, accuracyMode: String) throws {
    try writeQueue.sync {
      try queue.write { db in
        try db.execute(sql: """
          INSERT INTO locations (trip_id, latitude, longitude, accuracy, speed, heading, altitude, timestamp, gps_accuracy_mode, synced)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        """, arguments: [tripId, lat, lng, accuracy, speed, heading, altitude, timestamp, accuracyMode])
      }
    }
  }

  // MARK: - Staging operations

  func insertStagingLocation(stagingId: String, lat: Double, lng: Double,
                              accuracy: Double?, speed: Double?, timestamp: Int64) throws {
    try writeQueue.sync {
      try queue.write { db in
        try db.execute(sql: """
          INSERT INTO staging_locations (staging_id, latitude, longitude, accuracy, speed, timestamp)
          VALUES (?, ?, ?, ?, ?, ?)
        """, arguments: [stagingId, lat, lng, accuracy, speed, timestamp])
      }
    }
  }

  func promoteStagingToTrip(stagingId: String, tripId: String) throws {
    try writeQueue.sync {
      try queue.write { db in
        try db.execute(sql: """
          INSERT INTO locations (trip_id, latitude, longitude, accuracy, speed, timestamp, gps_accuracy_mode, synced)
          SELECT ?, latitude, longitude, accuracy, speed, timestamp, 'hundred', 0
          FROM staging_locations WHERE staging_id = ?
          ORDER BY timestamp ASC
        """, arguments: [tripId, stagingId])
        try db.execute(sql: "DELETE FROM staging_locations WHERE staging_id = ?",
                       arguments: [stagingId])
      }
    }
  }

  func discardStaging(stagingId: String) throws {
    try writeQueue.sync {
      try queue.write { db in
        try db.execute(sql: "DELETE FROM staging_locations WHERE staging_id = ?",
                       arguments: [stagingId])
      }
    }
  }

  func stagingDisplacementMeters(stagingId: String) throws -> Double {
    try queue.read { db in
      let rows = try Row.fetchAll(db, sql: """
        SELECT latitude, longitude FROM staging_locations
        WHERE staging_id = ? ORDER BY timestamp ASC
      """, arguments: [stagingId])
      guard rows.count >= 2 else { return 0 }
      let first = rows.first!
      let last = rows.last!
      return haversineMeters(
        lat1: first["latitude"], lng1: first["longitude"],
        lat2: last["latitude"], lng2: last["longitude"]
      )
    }
  }

  func stagingFirstTimestamp(stagingId: String) throws -> Int64? {
    try queue.read { db in
      try Int64.fetchOne(db, sql: "SELECT MIN(timestamp) FROM staging_locations WHERE staging_id = ?",
                          arguments: [stagingId])
    }
  }

  // MARK: - Motion segments

  func updateLastMotionSegmentEnd(tripId: String, tEnd: Int64) throws {
    try writeQueue.sync {
      try queue.write { db in
        try db.execute(sql: """
          UPDATE motion_segments SET t_end = ?
          WHERE trip_id = ? AND id = (
            SELECT MAX(id) FROM motion_segments WHERE trip_id = ?
          )
        """, arguments: [tEnd, tripId, tripId])
      }
    }
  }

  func insertMotionSegment(tripId: String, tStart: Int64, tEnd: Int64,
                            activity: String, confidence: String, source: String) throws {
    try writeQueue.sync {
      try queue.write { db in
        try db.execute(sql: """
          INSERT INTO motion_segments (trip_id, t_start, t_end, activity, confidence, source)
          VALUES (?, ?, ?, ?, ?, ?)
        """, arguments: [tripId, tStart, tEnd, activity, confidence, source])
      }
    }
  }

  // MARK: - Sensor batches

  func insertSensorBatch(tripId: String, seq: Int, payloadJson: String) throws {
    try writeQueue.sync {
      try queue.write { db in
        try db.execute(sql: """
          INSERT INTO sensor_batches (trip_id, seq, payload_json, synced)
          VALUES (?, ?, ?, 0)
        """, arguments: [tripId, seq, payloadJson])
      }
    }
  }

  // MARK: - Recovery

  struct StaleTrip {
    let id: String
    let lastUpdate: Int64
  }

  func findStaleRecordingTrip(staleAfterMs: Int64 = 10 * 60 * 1000) throws -> StaleTrip? {
    let cutoff = Int64(Date().timeIntervalSince1970 * 1000) - staleAfterMs
    return try queue.read { db in
      if let row = try Row.fetchOne(db, sql: """
        SELECT id, updated_at FROM trips
        WHERE engine = 'native' AND status = 'active' AND updated_at < ?
        ORDER BY updated_at DESC LIMIT 1
      """, arguments: [cutoff]) {
        return StaleTrip(id: row["id"], lastUpdate: row["updated_at"])
      }
      return nil
    }
  }
}

// MARK: - Helpers

private func haversineMeters(lat1: Double, lng1: Double, lat2: Double, lng2: Double) -> Double {
  let R = 6_371_000.0
  let dLat = (lat2 - lat1) * .pi / 180
  let dLng = (lng2 - lng1) * .pi / 180
  let a = sin(dLat / 2) * sin(dLat / 2)
        + cos(lat1 * .pi / 180) * cos(lat2 * .pi / 180)
        * sin(dLng / 2) * sin(dLng / 2)
  return R * 2 * atan2(sqrt(a), sqrt(1 - a))
}
