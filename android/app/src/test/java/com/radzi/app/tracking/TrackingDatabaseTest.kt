package com.radzi.app.tracking

import android.app.Application
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30], application = Application::class)
class TrackingDatabaseTest {

    private lateinit var db: TrackingDatabase

    // Minimal v10 schema (same tables native module touches) — matches schema.ts
    private val TEST_SCHEMA = listOf(
        """CREATE TABLE IF NOT EXISTS trips (
              id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
              type TEXT DEFAULT 'walk', status TEXT DEFAULT 'active',
              is_manual INTEGER DEFAULT 0, start_time INTEGER NOT NULL,
              end_time INTEGER, distance REAL DEFAULT 0, duration INTEGER DEFAULT 0,
              avg_speed REAL DEFAULT 0, max_speed REAL DEFAULT 0,
              elevation_gain REAL DEFAULT 0, calories INTEGER DEFAULT 0,
              co2_saved REAL DEFAULT 0, notes TEXT, route_data TEXT,
              created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
              synced INTEGER DEFAULT 0, backend_id INTEGER,
              ml_activity_type TEXT, ml_confidence REAL,
              classification_method TEXT DEFAULT 'speed',
              engine TEXT DEFAULT 'legacy', backfill_start INTEGER,
              detection_state TEXT, user_note TEXT, validation_log TEXT,
              user_note_dirty INTEGER NOT NULL DEFAULT 0,
              type_dirty INTEGER NOT NULL DEFAULT 0,
              classification_source TEXT, moving_duration_s INTEGER,
              moving_avg_speed_kmh REAL, max_speed_filtered_kmh REAL,
              elevation_loss_m REAL, backend_avg_speed_kmh REAL,
              visible INTEGER NOT NULL DEFAULT 1
           )""",
        """CREATE TABLE IF NOT EXISTS locations (
              id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id TEXT NOT NULL,
              latitude REAL NOT NULL, longitude REAL NOT NULL,
              altitude REAL, accuracy REAL, speed REAL, heading REAL,
              timestamp INTEGER NOT NULL, activity_type TEXT,
              activity_confidence REAL, synced INTEGER DEFAULT 0,
              gps_accuracy_mode TEXT DEFAULT 'best'
           )""",
        """CREATE TABLE IF NOT EXISTS staging_locations (
              id INTEGER PRIMARY KEY AUTOINCREMENT, staging_id TEXT NOT NULL,
              latitude REAL NOT NULL, longitude REAL NOT NULL,
              accuracy REAL, speed REAL, timestamp INTEGER NOT NULL
           )""",
        """CREATE TABLE IF NOT EXISTS motion_segments (
              id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id TEXT NOT NULL,
              t_start INTEGER NOT NULL, t_end INTEGER NOT NULL,
              activity TEXT NOT NULL, confidence TEXT NOT NULL, source TEXT NOT NULL
           )""",
        """CREATE TABLE IF NOT EXISTS sensor_batches (
              id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id TEXT NOT NULL,
              seq INTEGER NOT NULL, payload_json TEXT NOT NULL,
              synced INTEGER DEFAULT 0,
              created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
           )""",
        """CREATE TABLE IF NOT EXISTS trip_altitude_samples (
              trip_id TEXT NOT NULL, timestamp INTEGER NOT NULL,
              relative_altitude_m REAL NOT NULL, PRIMARY KEY (trip_id, timestamp)
           )"""
    )

    @Before
    fun setup() {
        val ctx = RuntimeEnvironment.getApplication()
        db = TrackingDatabase.forTest(ctx)
        TEST_SCHEMA.forEach { db.rawExecForTest(it) }
    }

    @Test
    fun `createTrip inserts row with active status`() {
        val t = 1_000_000L
        db.createTrip("t1", t, t)
        val status = db.loadTripStatus("t1")
        assertEquals("active", status)
    }

    @Test
    fun `endTrip computes distance from locations`() {
        val start = 1_700_000_000_000L
        db.createTrip("t2", start, start)

        // Two points ~111 m apart (1 arc-second of latitude ≈ 30.9 m at equator scale,
        // but actually at equator 0.001° ≈ 111 m — use simple known distance).
        // London to 0.001° north: lat diff = 0.001° ≈ 111.19 m
        db.insertLocation("t2", 51.500000, -0.120000, 5.0, 1.4, null, null, start, "best")
        db.insertLocation("t2", 51.501000, -0.120000, 5.0, 1.4, null, null, start + 80_000, "best")

        val stats = db.endTrip("t2", start + 80_000)
        assertTrue("distance should be ~111 m, got ${stats.distanceMeters}", stats.distanceMeters in 100.0..120.0)
        assertEquals(80L, stats.durationSec)
        assertEquals(2, stats.locationCount)
    }

    @Test
    fun `findStaleRecordingTrip returns null for fresh trip`() {
        val now = System.currentTimeMillis()
        db.createTrip("fresh", now, now)
        assertNull(db.findStaleRecordingTrip(10 * 60 * 1000L))
    }

    @Test
    fun `findStaleRecordingTrip returns stale active trip`() {
        val old = System.currentTimeMillis() - 15 * 60 * 1000L
        db.createTrip("stale", old, old)
        // staleAfterMs = 10 min, trip updated 15 min ago → should be found
        val stale = db.findStaleRecordingTrip(10 * 60 * 1000L)
        assertNotNull(stale)
        assertEquals("stale", stale!!.id)
    }

    @Test
    fun `findStaleRecordingTrip skips excluded trip`() {
        val old = System.currentTimeMillis() - 15 * 60 * 1000L
        db.createTrip("held-by-machine", old, old)
        assertNull(db.findStaleRecordingTrip(10 * 60 * 1000L, excludeId = "held-by-machine"))

        // A second stale trip is still found when the first is excluded
        val older = System.currentTimeMillis() - 30 * 60 * 1000L
        db.createTrip("orphan", older, older)
        val stale = db.findStaleRecordingTrip(10 * 60 * 1000L, excludeId = "held-by-machine")
        assertNotNull(stale)
        assertEquals("orphan", stale!!.id)
    }

    @Test
    fun `endTrip on stale trip makes it invisible to findStaleRecordingTrip`() {
        val old = System.currentTimeMillis() - 15 * 60 * 1000L
        db.createTrip("zombie", old, old)
        db.endTrip("zombie", old)
        assertNull(db.findStaleRecordingTrip(10 * 60 * 1000L))
        assertEquals("completed", db.loadTripStatus("zombie"))
    }

    @Test
    fun `stagingDisplacementMeters returns haversine distance`() {
        val t = 1_000_000L
        db.insertStagingLocation("s1", 51.500000, -0.120000, 5.0, 1.0, t)
        db.insertStagingLocation("s1", 51.501000, -0.120000, 5.0, 1.0, t + 10_000)
        val dist = db.stagingDisplacementMeters("s1")
        assertTrue("should be ~111 m, got $dist", dist in 100.0..120.0)
    }

    @Test
    fun `recentTripWindows returns native completed trips only`() {
        val now = System.currentTimeMillis()
        val start = now - 30 * 60 * 1000L
        db.insertSynthesizedTrip("syn1", start, now, "walk", 500.0, "apple_motion")
        val windows = db.recentTripWindows(withinMs = 35 * 60 * 1000L, ofMs = now)
        assertTrue(windows.isNotEmpty())
        assertEquals(start, windows[0].first)
        assertEquals(now, windows[0].second)
    }
}

// Test helpers — expose internal SQLite access without polluting the real API
internal fun TrackingDatabase.rawExecForTest(sql: String) {
    val field = TrackingDatabase::class.java.getDeclaredField("db")
    field.isAccessible = true
    val sqliteDb = field.get(this) as android.database.sqlite.SQLiteDatabase
    sqliteDb.execSQL(sql)
}

internal fun TrackingDatabase.loadTripStatus(tripId: String): String? {
    val field = TrackingDatabase::class.java.getDeclaredField("db")
    field.isAccessible = true
    val sqliteDb = field.get(this) as android.database.sqlite.SQLiteDatabase
    return sqliteDb.rawQuery("SELECT status FROM trips WHERE id = ?", arrayOf(tripId)).use { c ->
        if (c.moveToFirst()) c.getString(0) else null
    }
}
