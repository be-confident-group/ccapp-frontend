package com.radzi.app.tracking

import android.app.Application
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30], application = Application::class)
class TripStateMachineRehydrateTest {

    private lateinit var db: TrackingDatabase

    @Before
    fun setup() {
        val ctx = RuntimeEnvironment.getApplication()
        db = TrackingDatabase.forTest(ctx)
        db.rawExecForTest(
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
               )"""
        )
        installShared(db)
    }

    @After
    fun teardown() {
        installShared(null)
    }

    @Test
    fun `rehydrate adopts trip updated recently`() {
        val fresh = System.currentTimeMillis() - 60_000L // 1 min ago
        db.createTrip("fresh-trip", fresh, fresh)

        val machine = TripStateMachine()
        machine.rehydrateIfNeeded()

        assertEquals(TripStateMachine.State.RECORDING, machine.state)
        assertEquals("fresh-trip", machine.currentTripId)
    }

    @Test
    fun `rehydrate refuses trip idle beyond stale threshold`() {
        val old = System.currentTimeMillis() - 15 * 60 * 1000L // 15 min ago
        db.createTrip("zombie-trip", old, old)

        val machine = TripStateMachine()
        machine.rehydrateIfNeeded()

        // The dead trip must stay un-adopted so recoverStaleTrip()/the background
        // worker can end it — adopting it would refresh updated_at and make it
        // permanently unrecoverable.
        assertEquals(TripStateMachine.State.IDLE, machine.state)
        assertNull(machine.currentTripId)
    }

    private fun installShared(value: TrackingDatabase?) {
        val field = TrackingDatabase::class.java.getDeclaredField("instance")
        field.isAccessible = true
        field.set(null, value)
    }
}
