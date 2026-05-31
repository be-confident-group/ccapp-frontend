package com.radzi.app.tracking

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionResult

/**
 * Receives STILL→MOVING transition events registered by MotionMonitor.
 * Wakes the process from cold start (SLC analog) to start tracking and trigger backfill.
 */
class ActivityTransitionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (!ActivityTransitionResult.hasResult(intent)) return
        val result = ActivityTransitionResult.extractResult(intent) ?: return

        val hasEnter = result.transitionEvents.any {
            it.transitionType == ActivityTransition.ACTIVITY_TRANSITION_ENTER
        }
        TrackingLogger.shared.log(
            TrackingLogger.Level.info,
            "ActivityTransitionReceiver: ${result.transitionEvents.size} transition(s), hasEnter=$hasEnter"
        )

        if (hasEnter) {
            // Start (or keep alive) the foreground service so tracking can initialize.
            // On cold start MotionMonitor.shared is null — TrackingForegroundService.onCreate()
            // detects this and initializes the full standalone tracking stack.
            TrackingForegroundService.start(context)
        }

        // If the RN module is already running, deliver transitions to its MotionMonitor.
        MotionMonitor.shared?.onTransitionResult(result)
    }
}
