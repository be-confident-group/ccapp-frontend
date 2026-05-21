package com.radzi.app.tracking

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        TrackingLogger.shared.log(TrackingLogger.Level.info, "BootCompletedReceiver: device booted — scheduling stale trip check")
        // Schedule a one-shot worker to recover any stale active trip.
        val work = OneTimeWorkRequestBuilder<BackgroundSyncWorker>().build()
        WorkManager.getInstance(context).enqueue(work)
    }
}
