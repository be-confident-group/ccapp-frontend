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
        // If the DB is available, check for stale trips (force-quit recovery).
        if (TrackingDatabase.isInitialized()) {
            try {
                val stale = TrackingDatabase.shared.findStaleRecordingTrip()
                if (stale != null) {
                    TrackingLogger.shared.log(
                        TrackingLogger.Level.warn,
                        "BackgroundSyncWorker: found stale trip ${stale.id} — will be recovered on next JS launch"
                    )
                    // The stale trip will be recovered by recoverStaleTrip() when JS calls it.
                    // We only close it explicitly if the module is live.
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
