package com.radzi.app.tracking

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.Future
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Writes to the same SQLite file that expo-sqlite reads from.
 * expo-sqlite stores its databases at <filesDir>/SQLite/<name>.db on Android.
 * We open the same path so JS reads and native writes see the same file via WAL.
 * Schema is assumed to exist (created by JS expo-sqlite migrations, version 10).
 */
class TrackingDatabase private constructor(context: Context) {

    private val db: SQLiteDatabase
    private val writeExecutor: ExecutorService = Executors.newSingleThreadExecutor()

    init {
        val dbDir = File(context.filesDir, "SQLite")
        dbDir.mkdirs()
        val dbPath = File(dbDir, "radzi.db").absolutePath
        db = SQLiteDatabase.openOrCreateDatabase(dbPath, null)
        db.rawQuery("PRAGMA journal_mode=WAL", null).use { it.moveToFirst() }
        TrackingLogger.shared.log(TrackingLogger.Level.info, "TrackingDatabase: opened at $dbPath")
    }

    // MARK: - Write serialization

    private fun <T> write(block: () -> T): T {
        val future: Future<T> = writeExecutor.submit(block)
        return future.get()
    }

    // MARK: - Trip operations

    fun createTrip(
        id: String,
        startTime: Long,
        backfillStart: Long,
        type: String = "walk",
        classificationSource: String = "speed"
    ) {
        write {
            db.execSQL(
                """INSERT INTO trips (id, user_id, type, status, start_time, created_at, updated_at,
                   engine, backfill_start, detection_state, classification_source)
                   VALUES (?, 'current_user', ?, 'active', ?, ?, ?, 'native', ?, 'recording', ?)""",
                arrayOf(id, type, startTime, startTime, startTime, backfillStart, classificationSource)
            )
        }
    }

    fun updateTripUpdatedAt(tripId: String, updatedAt: Long) {
        write { db.execSQL("UPDATE trips SET updated_at = ? WHERE id = ?", arrayOf(updatedAt, tripId)) }
    }

    fun updateTripBackfillStart(tripId: String, backfillStart: Long) {
        write { db.execSQL("UPDATE trips SET backfill_start = ? WHERE id = ?", arrayOf(backfillStart, tripId)) }
    }

    fun cancelTrip(tripId: String, reason: String) {
        val now = System.currentTimeMillis()
        write { db.execSQL("UPDATE trips SET status = 'cancelled', updated_at = ? WHERE id = ?", arrayOf(now, tripId)) }
        TrackingLogger.shared.log(TrackingLogger.Level.info, "TrackingDatabase: cancelTrip $tripId — $reason")
    }

    data class TripEndStats(
        val distanceMeters: Double,
        val locationCount: Int,
        val durationSec: Long,
        val maxSpeedKmh: Double
    )

    fun endTrip(tripId: String, endTime: Long): TripEndStats {
        val stats = computeTripStats(tripId)
        val locationCount = db.rawQuery(
            "SELECT COUNT(*) FROM locations WHERE trip_id = ?", arrayOf(tripId)
        ).use { c -> if (c.moveToFirst()) c.getInt(0) else 0 }

        val avgSpeedKmh = if (stats.durationSec > 0)
            (stats.distanceMeters / 1000.0) / (stats.durationSec.toDouble() / 3600.0)
        else 0.0

        write {
            db.execSQL(
                """UPDATE trips SET status = 'completed', end_time = ?, updated_at = ?,
                   detection_state = 'ending', distance = ?, duration = ?,
                   avg_speed = ?, max_speed = ?, route_data = ?
                   WHERE id = ?""",
                arrayOf(endTime, endTime, stats.distanceMeters, stats.durationSec,
                    avgSpeedKmh, stats.maxSpeedKmh, stats.routeDataJson, tripId)
            )
        }
        TrackingLogger.shared.log(
            TrackingLogger.Level.info,
            "TrackingDatabase: endTrip $tripId — ${"%.0f".format(stats.distanceMeters)}m, " +
                "locs=$locationCount, ${stats.durationSec}s, " +
                "avg=${"%.1f".format(avgSpeedKmh)} km/h, max=${"%.1f".format(stats.maxSpeedKmh)} km/h"
        )

        val filteredMax = computeFilteredMaxSpeed(tripId)
        write { db.execSQL("UPDATE trips SET max_speed_filtered_kmh = ? WHERE id = ?", arrayOf(filteredMax, tripId)) }

        val movingStats = computeMovingStats(tripId)
        write {
            db.execSQL(
                "UPDATE trips SET moving_duration_s = ?, moving_avg_speed_kmh = ? WHERE id = ?",
                arrayOf(movingStats.movingDurationS, movingStats.movingAvgSpeedKmh, tripId)
            )
        }

        return TripEndStats(stats.distanceMeters, locationCount, stats.durationSec, stats.maxSpeedKmh)
    }

    private data class TripStats(
        val distanceMeters: Double,
        val durationSec: Long,
        val maxSpeedKmh: Double,
        val routeDataJson: String?
    )

    private fun computeTripStats(tripId: String): TripStats {
        data class LocRow(val lat: Double, val lng: Double, val ts: Long, val speed: Double?)

        val isoFmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }

        try {
            val rows = mutableListOf<LocRow>()
            db.rawQuery(
                "SELECT latitude, longitude, timestamp, speed FROM locations WHERE trip_id = ? ORDER BY timestamp ASC",
                arrayOf(tripId)
            ).use { c ->
                while (c.moveToNext()) {
                    rows.add(
                        LocRow(
                            lat   = c.getDouble(0),
                            lng   = c.getDouble(1),
                            ts    = c.getLong(2),
                            speed = if (c.isNull(3)) null else c.getDouble(3)
                        )
                    )
                }
            }
            if (rows.size < 2) return TripStats(0.0, 0L, 0.0, null)

            var totalMeters = 0.0
            var maxSpeedMps = 0.0
            val routeArray = JSONArray()

            for (i in rows.indices) {
                val r = rows[i]
                if (i > 0) {
                    val prev = rows[i - 1]
                    totalMeters += haversineMeters(prev.lat, prev.lng, r.lat, r.lng)
                }
                r.speed?.let { if (it > maxSpeedMps) maxSpeedMps = it }

                val date = Date(r.ts)
                val latRound = (r.lat * 1_000_000).roundToInt() / 1_000_000.0
                val lngRound = (r.lng * 1_000_000).roundToInt() / 1_000_000.0
                routeArray.put(
                    JSONObject().apply {
                        put("lat", latRound)
                        put("lng", lngRound)
                        put("timestamp", isoFmt.format(date))
                    }
                )
            }

            val durationSec = (rows.last().ts - rows.first().ts) / 1000L
            val maxSpeedKmh = maxSpeedMps * 3.6

            return TripStats(totalMeters, durationSec, maxSpeedKmh, routeArray.toString())
        } catch (e: Exception) {
            TrackingLogger.shared.log(TrackingLogger.Level.error, "TrackingDatabase: computeTripStats failed — $e")
            return TripStats(0.0, 0L, 0.0, null)
        }
    }

    private fun computeFilteredMaxSpeed(tripId: String): Double? {
        try {
            val speedsKmh = mutableListOf<Double>()
            val accuracies = mutableListOf<Double>()
            db.rawQuery(
                "SELECT speed, accuracy FROM locations WHERE trip_id = ? AND speed IS NOT NULL ORDER BY timestamp ASC",
                arrayOf(tripId)
            ).use { c ->
                while (c.moveToNext()) {
                    speedsKmh.add(c.getDouble(0) * 3.6)
                    accuracies.add(c.getDouble(1))
                }
            }
            if (speedsKmh.size < 5) return null
            return SpeedFilter.maxSpeed(speedsKmh, accuracies, FilterableActivity.CYCLING)
        } catch (e: Exception) {
            TrackingLogger.shared.log(TrackingLogger.Level.error, "TrackingDatabase: computeFilteredMaxSpeed failed — $e")
            return null
        }
    }

    private fun computeMovingStats(tripId: String): MovingStats.Result {
        try {
            data class LocRow(val ts: Long, val lat: Double, val lng: Double)

            val rows = mutableListOf<LocRow>()
            db.rawQuery(
                "SELECT timestamp, latitude, longitude FROM locations WHERE trip_id = ? ORDER BY timestamp ASC",
                arrayOf(tripId)
            ).use { c ->
                while (c.moveToNext()) {
                    rows.add(LocRow(c.getLong(0), c.getDouble(1), c.getDouble(2)))
                }
            }
            if (rows.size < 2) return MovingStats.compute(emptyList())

            val intervals = mutableListOf<Pair<Double, Double>>()
            for (i in 1 until rows.size) {
                val d = haversineMeters(rows[i - 1].lat, rows[i - 1].lng, rows[i].lat, rows[i].lng)
                val dt = (rows[i].ts - rows[i - 1].ts) / 1000.0
                if (dt > 0) intervals.add(Pair(d, dt))
            }
            return MovingStats.compute(intervals)
        } catch (e: Exception) {
            TrackingLogger.shared.log(TrackingLogger.Level.error, "TrackingDatabase: computeMovingStats failed — $e")
            return MovingStats.compute(emptyList())
        }
    }

    // MARK: - Location operations

    fun insertLocation(
        tripId: String, lat: Double, lng: Double,
        accuracy: Double?, speed: Double?, heading: Double?, altitude: Double?,
        timestamp: Long, accuracyMode: String
    ) {
        write {
            db.execSQL(
                """INSERT INTO locations (trip_id, latitude, longitude, accuracy, speed, heading, altitude,
                   timestamp, gps_accuracy_mode, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)""",
                arrayOf(tripId, lat, lng, accuracy, speed, heading, altitude, timestamp, accuracyMode)
            )
        }
    }

    // MARK: - Staging operations

    fun insertStagingLocation(
        stagingId: String, lat: Double, lng: Double,
        accuracy: Double?, speed: Double?, timestamp: Long
    ) {
        write {
            db.execSQL(
                "INSERT INTO staging_locations (staging_id, latitude, longitude, accuracy, speed, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
                arrayOf(stagingId, lat, lng, accuracy, speed, timestamp)
            )
        }
    }

    fun promoteStagingToTrip(stagingId: String, tripId: String) {
        write {
            db.execSQL(
                """INSERT INTO locations (trip_id, latitude, longitude, accuracy, speed, timestamp, gps_accuracy_mode, synced)
                   SELECT ?, latitude, longitude, accuracy, speed, timestamp, 'hundred', 0
                   FROM staging_locations WHERE staging_id = ? ORDER BY timestamp ASC""",
                arrayOf(tripId, stagingId)
            )
            db.execSQL("DELETE FROM staging_locations WHERE staging_id = ?", arrayOf(stagingId))
        }
    }

    fun discardStaging(stagingId: String) {
        write { db.execSQL("DELETE FROM staging_locations WHERE staging_id = ?", arrayOf(stagingId)) }
    }

    fun stagingDisplacementMeters(stagingId: String): Double {
        val rows = mutableListOf<Pair<Double, Double>>()
        db.rawQuery(
            "SELECT latitude, longitude FROM staging_locations WHERE staging_id = ? ORDER BY timestamp ASC",
            arrayOf(stagingId)
        ).use { c ->
            while (c.moveToNext()) rows.add(Pair(c.getDouble(0), c.getDouble(1)))
        }
        if (rows.size < 2) return 0.0
        return haversineMeters(rows.first().first, rows.first().second, rows.last().first, rows.last().second)
    }

    fun stagingFirstTimestamp(stagingId: String): Long? {
        db.rawQuery("SELECT MIN(timestamp) FROM staging_locations WHERE staging_id = ?", arrayOf(stagingId))
            .use { c -> return if (c.moveToFirst() && !c.isNull(0)) c.getLong(0) else null }
    }

    // MARK: - Motion segments

    fun updateLastMotionSegmentEnd(tripId: String, tEnd: Long) {
        write {
            db.execSQL(
                """UPDATE motion_segments SET t_end = ? WHERE trip_id = ? AND id = (
                   SELECT MAX(id) FROM motion_segments WHERE trip_id = ?)""",
                arrayOf(tEnd, tripId, tripId)
            )
        }
    }

    fun insertMotionSegment(
        tripId: String, tStart: Long, tEnd: Long,
        activity: String, confidence: String, source: String
    ) {
        write {
            db.execSQL(
                "INSERT INTO motion_segments (trip_id, t_start, t_end, activity, confidence, source) VALUES (?, ?, ?, ?, ?, ?)",
                arrayOf(tripId, tStart, tEnd, activity, confidence, source)
            )
        }
    }

    // MARK: - Sensor batches (DORMANT)

    fun insertSensorBatch(tripId: String, seq: Int, payloadJson: String) {
        write {
            db.execSQL(
                "INSERT INTO sensor_batches (trip_id, seq, payload_json, synced) VALUES (?, ?, ?, 0)",
                arrayOf(tripId, seq, payloadJson)
            )
        }
    }

    // MARK: - Recovery

    data class StaleTrip(val id: String, val lastUpdate: Long)

    fun findStaleRecordingTrip(staleAfterMs: Long = 10L * 60 * 1000): StaleTrip? {
        val cutoff = System.currentTimeMillis() - staleAfterMs
        db.rawQuery(
            "SELECT id, updated_at FROM trips WHERE engine = 'native' AND status = 'active' AND updated_at < ? ORDER BY updated_at DESC LIMIT 1",
            arrayOf(cutoff.toString())
        ).use { c ->
            return if (c.moveToFirst()) StaleTrip(c.getString(0), c.getLong(1)) else null
        }
    }

    fun loadTripType(tripId: String): String? {
        db.rawQuery("SELECT type FROM trips WHERE id = ?", arrayOf(tripId))
            .use { c -> return if (c.moveToFirst()) c.getString(0) else null }
    }

    // MARK: - Reconciler helpers

    /** Returns (startMs, endMs) pairs for recently completed native trips. */
    fun recentTripWindows(withinMs: Long, ofMs: Long = System.currentTimeMillis()): List<Pair<Long, Long>> {
        val cutoff = ofMs - withinMs
        val result = mutableListOf<Pair<Long, Long>>()
        db.rawQuery(
            "SELECT start_time, end_time FROM trips WHERE end_time IS NOT NULL AND end_time >= ? AND engine = 'native' ORDER BY start_time ASC",
            arrayOf(cutoff.toString())
        ).use { c ->
            while (c.moveToNext()) result.add(Pair(c.getLong(0), c.getLong(1)))
        }
        return result
    }

    fun insertSynthesizedTrip(
        id: String, startMs: Long, endMs: Long, type: String,
        distanceM: Double?, classificationSource: String
    ) {
        val durationSec = (endMs - startMs) / 1000L
        val dist = distanceM ?: 0.0
        write {
            db.execSQL(
                """INSERT OR IGNORE INTO trips (id, user_id, type, status, start_time, end_time, distance, duration,
                   created_at, updated_at, engine, synced, classification_source)
                   VALUES (?, 'current_user', ?, 'completed', ?, ?, ?, ?, ?, ?, 'native', 0, ?)""",
                arrayOf(id, type, startMs, endMs, dist, durationSec, startMs, startMs, classificationSource)
            )
        }
    }

    // MARK: - Altitude samples

    fun insertAltitudeSample(tripId: String, timestampMs: Long, altitudeM: Double) {
        write {
            db.execSQL(
                "INSERT OR REPLACE INTO trip_altitude_samples (trip_id, timestamp, relative_altitude_m) VALUES (?, ?, ?)",
                arrayOf(tripId, timestampMs, altitudeM)
            )
        }
    }

    fun loadAltitudeSamples(tripId: String): List<Pair<Long, Double>> {
        val result = mutableListOf<Pair<Long, Double>>()
        db.rawQuery(
            "SELECT timestamp, relative_altitude_m FROM trip_altitude_samples WHERE trip_id = ? ORDER BY timestamp ASC",
            arrayOf(tripId)
        ).use { c ->
            while (c.moveToNext()) result.add(Pair(c.getLong(0), c.getDouble(1)))
        }
        return result
    }

    fun updateTripElevation(tripId: String, gainM: Double?, lossM: Double?) {
        if (gainM == null && lossM == null) return
        write {
            db.execSQL(
                "UPDATE trips SET elevation_gain = ?, elevation_loss_m = ? WHERE id = ?",
                arrayOf(gainM ?: 0.0, lossM, tripId)
            )
        }
    }

    fun updateTripFilteredMaxSpeed(tripId: String, filteredMaxKmh: Double?) {
        write { db.execSQL("UPDATE trips SET max_speed_filtered_kmh = ? WHERE id = ?", arrayOf(filteredMaxKmh, tripId)) }
    }

    fun updateTripMovingStats(tripId: String, movingDurationS: Int, movingAvgSpeedKmh: Double?) {
        write {
            db.execSQL(
                "UPDATE trips SET moving_duration_s = ?, moving_avg_speed_kmh = ? WHERE id = ?",
                arrayOf(movingDurationS, movingAvgSpeedKmh, tripId)
            )
        }
    }

    // MARK: - Singleton

    /** Exposes raw SQLiteDatabase handle for internal use only (MotionMonitor queries). */
    internal fun rawSQLiteDb(): SQLiteDatabase = db

    companion object {
        @Volatile private var instance: TrackingDatabase? = null

        val shared: TrackingDatabase
            get() = instance ?: error("TrackingDatabase.init(context) not called")

        fun isInitialized(): Boolean = instance != null

        fun init(context: Context) {
            if (instance == null) {
                synchronized(this) {
                    if (instance == null) {
                        instance = TrackingDatabase(context.applicationContext)
                    }
                }
            }
        }

        // For tests only — create a fresh instance against a custom path.
        internal fun forTest(context: Context): TrackingDatabase = TrackingDatabase(context)
    }
}

// MARK: - Haversine

private fun haversineMeters(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
    val R = 6_371_000.0
    val dLat = Math.toRadians(lat2 - lat1)
    val dLng = Math.toRadians(lng2 - lng1)
    val a = sin(dLat / 2) * sin(dLat / 2) +
            cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
            sin(dLng / 2) * sin(dLng / 2)
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))
}
