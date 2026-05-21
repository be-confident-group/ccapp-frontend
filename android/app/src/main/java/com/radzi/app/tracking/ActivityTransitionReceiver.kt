package com.radzi.app.tracking

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.google.android.gms.location.ActivityTransitionResult

/**
 * Receives STILL→MOVING transition events registered by MotionMonitor.
 * Wakes the process from cold start (SLC analog) to trigger backfill reconciliation.
 */
class ActivityTransitionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (!ActivityTransitionResult.hasResult(intent)) return
        val result = ActivityTransitionResult.extractResult(intent) ?: return
        TrackingLogger.shared.log(
            TrackingLogger.Level.info,
            "ActivityTransitionReceiver: ${result.transitionEvents.size} transition(s)"
        )
        // If the module is already running, deliver to MotionMonitor.
        // If we were cold-started by the transition, RadziTrackerModule.init()
        // will run and trigger reconcilerBackfill itself.
        MotionMonitor.shared?.onTransitionResult(result)
    }
}
