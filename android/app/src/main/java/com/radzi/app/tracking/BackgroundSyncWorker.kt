package com.radzi.app.tracking

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/**
 * Mirrors BackgroundSyncTask.swift (BGTaskScheduler).
 * Wakes the app process every 15 min so the JS sync service can run on next foreground.
 * Also checks for stale native trips on each wake (boot/forced recovery path).
 */
class BackgroundSyncWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        TrackingLogger.shared.log(TrackingLogger.Level.info, "BackgroundSyncWorker: wake")

        // Watchdog: if tracking was enabled (prefs flag) but the foreground service died
        // (e.g. OEM battery killer), restart it so motion/location events resume.
        val prefs = applicationContext.getSharedPreferences("radzi_tracking", android.content.Context.MODE_PRIVATE)
        if (prefs.getBoolean("tracking_enabled", false) && MotionMonitor.shared == null) {
            TrackingLogger.shared.log(TrackingLogger.Level.warn, "BackgroundSyncWorker: watchdog — tracking_enabled but no live stack; restarting service")
            TrackingForegroundService.start(applicationContext)
        }

        // If the DB is available, check for stale trips (force-quit recovery).
        if (TrackingDatabase.isInitialized()) {
            try {
                var stale = TrackingDatabase.shared.findStaleRecordingTrip()
                while (stale != null) {
                    if (MotionMonitor.shared == null) {
                        // No live tracking stack owns this trip — nothing will ever end
                        // it, so close it here. Stats are computed by endTrip(); the
                        // trip syncs via the normal unsynced sweep on next JS launch.
                        TrackingDatabase.shared.endTrip(stale.id, stale.lastUpdate)
                        TrackingLogger.shared.log(
                            TrackingLogger.Level.warn,
                            "BackgroundSyncWorker: recovered stale trip ${stale.id} (ended at last update)"
                        )
                        stale = TrackingDatabase.shared.findStaleRecordingTrip()
                    } else {
                        // A live stack exists; it (or recoverStaleTrip on JS launch)
                        // is responsible for ending trips.
                        TrackingLogger.shared.log(
                            TrackingLogger.Level.warn,
                            "BackgroundSyncWorker: found stale trip ${stale.id} — live stack present, deferring recovery"
                        )
                        break
                    }
                }
            } catch (e: Exception) {
                TrackingLogger.shared.log(TrackingLogger.Level.error, "BackgroundSyncWorker: stale check failed — $e")
            }
        }
        Result.success()
    }

    companion object {
        private const val WORK_NAME = "radzi_bg_sync"

        fun enqueue(context: Context) {
            val req = PeriodicWorkRequestBuilder<BackgroundSyncWorker>(15, TimeUnit.MINUTES).build()
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, req)
        }
    }
}
