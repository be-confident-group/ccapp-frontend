import Foundation
import GRDB

/// Writes to the same SQLite file that expo-sqlite reads from.
/// expo-sqlite stores its databases at <Documents>/SQLite/<name>.db
/// (confirmed from expo-sqlite iOS source: appContext.config.documentDirectory + "SQLite").
/// GRDB must open the same path so JS reads and native writes see the same file.
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
      TrackingLogger.shared.log(.info, "TrackingDatabase: opened at \(dbPath)")
    } catch {
      fatalError("[TrackingDatabase] Failed to open SQLite at \(dbPath): \(error)")
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
    // Compute distance and duration from stored location points while we still
    // have full WAL visibility.  The JS finalization pipeline reads from
    // expo-sqlite which uses a different WAL reader and cannot see GRDB writes,
    // so we must persist stats into the trips row before handing off.
    let stats = computeTripStats(tripId: tripId)
    // avg_speed in km/h = (meters / 1000) / (seconds / 3600)
    let avgSpeedKmh = stats.durationSec > 0
      ? (stats.distanceMeters / 1000.0) / (Double(stats.durationSec) / 3600.0)
      : 0.0

    try writeQueue.sync {
      try queue.write { db in
        try db.execute(sql: """
          UPDATE trips
          SET status = 'completed',
              end_time = ?,
              updated_at = ?,
              detection_state = 'ending',
              distance = ?,
              duration = ?,
              avg_speed = ?,
              max_speed = ?,
              route_data = ?
          WHERE id = ?
        """, arguments: [
          endTime, endTime, stats.distanceMeters, stats.durationSec,
          avgSpeedKmh, stats.maxSpeedKmh, stats.routeDataJson, tripId
        ])
      }
    }
    TrackingLogger.shared.log(.info, "TrackingDatabase: endTrip \(tripId) — \(String(format: "%.0f", stats.distanceMeters))m, \(stats.durationSec)s, avg: \(String(format: "%.1f", avgSpeedKmh)) km/h, max: \(String(format: "%.1f", stats.maxSpeedKmh)) km/h")

    let filteredMax = computeFilteredMaxSpeed(tripId: tripId)
    try writeQueue.sync {
      try queue.write { db in
        try db.execute(sql: "UPDATE trips SET max_speed_filtered_kmh = ? WHERE id = ?",
                       arguments: [filteredMax, tripId])
      }
    }

    let movingStats = computeMovingStats(tripId: tripId)
    try writeQueue.sync {
      try queue.write { db in
        try db.execute(sql: """
          UPDATE trips SET moving_duration_s = ?, moving_avg_speed_kmh = ? WHERE id = ?
        """, arguments: [movingStats.movingDurationS, movingStats.movingAvgSpeedKmh, tripId])
      }
    }
  }

  /// Reads all location rows for the trip and returns total haversine distance
  /// in **meters** (matching the DB convention used by the legacy JS engine),
  /// duration (seconds), max speed (km/h), and JSON serialized route_data.
  /// Called from endTrip() so stats are committed atomically.
  private func computeTripStats(tripId: String) -> (distanceMeters: Double, durationSec: Int64, maxSpeedKmh: Double, routeDataJson: String?) {
    struct LocRow {
      let lat: Double; let lng: Double; let ts: Int64; let speed: Double?
    }
    do {
      let rows = try queue.read { db -> [LocRow] in
        let rawRows = try Row.fetchAll(db,
          sql: "SELECT latitude, longitude, timestamp, speed FROM locations WHERE trip_id = ? ORDER BY timestamp ASC",
          arguments: [tripId])
        return rawRows.map { LocRow(lat: $0["latitude"], lng: $0["longitude"], ts: $0["timestamp"], speed: $0["speed"]) }
      }
      guard rows.count >= 2 else { return (0, 0, 0, nil) }
      
      var totalMeters = 0.0
      var maxSpeedMps = 0.0
      var routeDicts: [[String: Any]] = []

      let isoFormatter = ISO8601DateFormatter()
      isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

      for i in 0 ..< rows.count {
        let r = rows[i]
        if i > 0 {
          let prev = rows[i-1]
          totalMeters += haversineMeters(lat1: prev.lat, lng1: prev.lng, lat2: r.lat, lng2: r.lng)
        }
        if let s = r.speed, s > maxSpeedMps {
          maxSpeedMps = s
        }

        let date = Date(timeIntervalSince1970: TimeInterval(r.ts) / 1000.0)
        let latRound = (r.lat * 1_000_000).rounded() / 1_000_000
        let lngRound = (r.lng * 1_000_000).rounded() / 1_000_000
        routeDicts.append([
          "lat": latRound,
          "lng": lngRound,
          "timestamp": isoFormatter.string(from: date)
        ])
      }
      
      let durationSec = (rows.last!.ts - rows.first!.ts) / 1000
      let maxSpeedKmh = maxSpeedMps * 3.6
      let routeDataData = try? JSONSerialization.data(withJSONObject: routeDicts, options: [])
      let routeDataJson = routeDataData.flatMap { String(data: $0, encoding: .utf8) }
      
      // Return distance in METERS (not km) — the DB convention used everywhere else.
      return (totalMeters, durationSec, maxSpeedKmh, routeDataJson)
    } catch {
      TrackingLogger.shared.log(.error, "TrackingDatabase: computeTripStats failed — \(error)")
      return (0, 0, 0, nil)
    }
  }

  // MARK: - Enhanced trip stats

  private func computeFilteredMaxSpeed(tripId: String) -> Double? {
    do {
      let rows = try queue.read { db in
        try Row.fetchAll(db,
          sql: "SELECT speed, accuracy FROM locations WHERE trip_id = ? AND speed IS NOT NULL ORDER BY timestamp ASC",
          arguments: [tripId])
      }
      guard rows.count >= 5 else { return nil }
      let speedsKmh = rows.compactMap { row -> Double? in
        guard let s = row["speed"] as? Double else { return nil }
        return s * 3.6 // m/s → km/h
      }
      let accuracies = rows.compactMap { row -> Double? in
        row["accuracy"] as? Double
      }
      guard speedsKmh.count == accuracies.count, speedsKmh.count >= 5 else { return nil }
      // Default to cycling ceiling — conservative (highest ceiling)
      return SpeedFilter.maxSpeed(speedsKmh: speedsKmh, horizontalAccuraciesM: accuracies, activity: .cycling)
    } catch {
      TrackingLogger.shared.log(.error, "TrackingDatabase: computeFilteredMaxSpeed failed — \(error)")
      return nil
    }
  }

  private func computeMovingStats(tripId: String) -> MovingStats.Result {
    do {
      struct LocRow { let ts: Int64; let lat: Double; let lng: Double }
      let rows = try queue.read { db -> [LocRow] in
        try Row.fetchAll(db,
          sql: "SELECT timestamp, latitude, longitude FROM locations WHERE trip_id = ? ORDER BY timestamp ASC",
          arguments: [tripId]).map { LocRow(ts: $0["timestamp"], lat: $0["latitude"], lng: $0["longitude"]) }
      }
      guard rows.count >= 2 else { return MovingStats.compute(intervals: []) }

      var intervals: [(distanceM: Double, seconds: Double)] = []
      for i in 1..<rows.count {
        let d = haversineMeters(lat1: rows[i-1].lat, lng1: rows[i-1].lng,
                                lat2: rows[i].lat,   lng2: rows[i].lng)
        let dt = Double(rows[i].ts - rows[i-1].ts) / 1000.0
        if dt > 0 { intervals.append((d, dt)) }
      }
      return MovingStats.compute(intervals: intervals)
    } catch {
      TrackingLogger.shared.log(.error, "TrackingDatabase: computeMovingStats failed — \(error)")
      return MovingStats.compute(intervals: [])
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

// MARK: - Altitude samples

extension TrackingDatabase {
  func insertAltitudeSample(tripId: String, timestamp: Date, altitudeM: Double) throws {
    let tsMs = Int64(timestamp.timeIntervalSince1970 * 1000)
    try writeQueue.sync {
      try queue.write { db in
        try db.execute(sql: """
          INSERT OR REPLACE INTO trip_altitude_samples (trip_id, timestamp, relative_altitude_m)
          VALUES (?, ?, ?)
        """, arguments: [tripId, tsMs, altitudeM])
      }
    }
  }

  func loadAltitudeSamples(tripId: String) throws -> [(Date, Double)] {
    try queue.read { db in
      try Row.fetchAll(db, sql: """
        SELECT timestamp, relative_altitude_m FROM trip_altitude_samples
        WHERE trip_id = ? ORDER BY timestamp ASC
      """, arguments: [tripId]).map { row -> (Date, Double) in
        let tsMs = row["timestamp"] as Int64
        return (Date(timeIntervalSince1970: TimeInterval(tsMs) / 1000.0), row["relative_altitude_m"])
      }
    }
  }

  func updateTripElevation(tripId: String, gainM: Double?, lossM: Double?) throws {
    guard gainM != nil || lossM != nil else { return }
    try writeQueue.sync {
      try queue.write { db in
        try db.execute(sql: """
          UPDATE trips SET elevation_gain = ?, elevation_loss_m = ? WHERE id = ?
        """, arguments: [gainM ?? 0.0, lossM, tripId])
      }
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
