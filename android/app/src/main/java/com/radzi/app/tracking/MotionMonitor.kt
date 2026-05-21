package com.radzi.app.tracking

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityRecognitionResult
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity

interface MotionMonitorDelegate {
    fun onActivityChanged(activity: MotionMonitor.Activity, confidence: MotionMonitor.Confidence, timestampMs: Long)
    fun onSustainedActivity(activity: MotionMonitor.Activity, forSeconds: Double)
}

class MotionMonitor(private val ctx: Context) {

    enum class Activity(val raw: String) {
        STATIONARY("stationary"),
        WALKING("walking"),
        RUNNING("running"),
        CYCLING("cycling"),
        AUTOMOTIVE("automotive"),
        UNKNOWN("unknown");
    }

    enum class Confidence(val raw: String) {
        LOW("low"), MEDIUM("medium"), HIGH("high");
    }

    var delegate: MotionMonitorDelegate? = null

    var currentActivity: Activity = Activity.UNKNOWN
        private set
    var currentConfidence: Confidence = Confidence.LOW
        private set

    private var currentSinceMs: Long? = null
    private val activityFirstSeenMs = mutableMapOf<String, Long>()
    private val activityLastSeenMs  = mutableMapOf<String, Long>()
    private val GAP_TOLERANCE_MS    = 15_000L

    private data class SustainTarget(val activity: Activity, val seconds: Double)
    private val sustainTargets = mutableListOf<SustainTarget>()
    private val handler = Handler(Looper.getMainLooper())
    private var sustainRunnable: Runnable? = null

    private var arPendingIntent: PendingIntent? = null
    private var transitionPendingIntent: PendingIntent? = null

    // MARK: - Public API

    fun start() {
        registerActivityRecognition()
        TrackingLogger.shared.log(TrackingLogger.Level.info, "MotionMonitor: started")
    }

    fun stop() {
        arPendingIntent?.let { ActivityRecognition.getClient(ctx).removeActivityUpdates(it) }
        transitionPendingIntent?.let { ActivityRecognition.getClient(ctx).removeActivityTransitionUpdates(it) }
        sustainRunnable?.let { handler.removeCallbacks(it) }
        sustainRunnable = null
        activityFirstSeenMs.clear()
        activityLastSeenMs.clear()
        TrackingLogger.shared.log(TrackingLogger.Level.info, "MotionMonitor: stopped")
    }

    fun watchSustain(activity: Activity, seconds: Double) {
        sustainTargets.removeAll { it.activity == activity }
        sustainTargets.add(SustainTarget(activity, seconds))
        rescheduleSustainTimer()
    }

    /**
     * Android has no CMMotionActivityManager history query — we read back from
     * motion_segments we wrote ourselves (same data, slight delay lag).
     * Returns list of (activityRaw, confidenceRaw, timestampMs) triples.
     */
    fun queryRecentActivities(lookbackSeconds: Double): List<Triple<String, String, Long>> {
        if (!TrackingDatabase.isInitialized()) return emptyList()
        val cutoff = System.currentTimeMillis() - (lookbackSeconds * 1000).toLong()
        return try {
            val db = TrackingDatabase.shared
            // Query motion_segments for any trip in the lookback window
            val rawDb = db.rawSQLiteDb()
            rawDb.rawQuery(
                "SELECT activity, confidence, t_start FROM motion_segments WHERE t_start >= ? ORDER BY t_start ASC",
                arrayOf(cutoff.toString())
            ).use { c ->
                val result = mutableListOf<Triple<String, String, Long>>()
                while (c.moveToNext()) {
                    result.add(Triple(c.getString(0), c.getString(1), c.getLong(2)))
                }
                result
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    // MARK: - AR result processing (called by ActivityRecognitionReceiver)

    internal fun onActivityResult(result: ActivityRecognitionResult) {
        val most = result.mostProbableActivity
        val activity = classifyDetectedActivity(most.type)
        val confidence = mapConfidence(most.confidence)

        val isLowConfWalking = confidence == Confidence.LOW && activity == Activity.WALKING
        if (confidence == Confidence.LOW && activity != Activity.STATIONARY && !isLowConfWalking) {
            TrackingLogger.shared.log(TrackingLogger.Level.info, "MotionMonitor: low-confidence ignored (${activity.raw})")
            return
        }

        handleActivityChange(activity, confidence, System.currentTimeMillis())
    }

    internal fun onTransitionResult(result: ActivityTransitionResult) {
        for (event in result.transitionEvents) {
            TrackingLogger.shared.log(
                TrackingLogger.Level.info,
                "MotionMonitor: transition ${event.activityType} enter=${event.transitionType == ActivityTransition.ACTIVITY_TRANSITION_ENTER}"
            )
        }
    }

    // MARK: - Private

    private fun handleActivityChange(new: Activity, conf: Confidence, nowMs: Long) {
        val prev = currentActivity
        if (new != prev) {
            activityLastSeenMs[prev.raw] = nowMs

            currentActivity = new
            currentConfidence = conf

            val firstSeen = activityFirstSeenMs[new.raw]
            val lastSeen  = activityLastSeenMs[new.raw]
            currentSinceMs = if (firstSeen != null && lastSeen != null && nowMs - lastSeen < GAP_TOLERANCE_MS) {
                firstSeen
            } else {
                activityFirstSeenMs[new.raw] = nowMs
                nowMs
            }

            handler.post {
                delegate?.onActivityChanged(new, conf, nowMs)
            }
            rescheduleSustainTimer()
        } else {
            currentConfidence = conf
        }
    }

    private fun rescheduleSustainTimer() {
        sustainRunnable?.let { handler.removeCallbacks(it) }
        val nowMs   = System.currentTimeMillis()
        val sinceMs = currentSinceMs ?: nowMs
        var nextFireMs = Long.MAX_VALUE

        for (target in sustainTargets) {
            if (target.activity != currentActivity) continue
            val elapsed = (nowMs - sinceMs) / 1000.0
            val remaining = target.seconds - elapsed
            if (remaining <= 0) {
                activityFirstSeenMs.remove(target.activity.raw)
                activityLastSeenMs.remove(target.activity.raw)
                delegate?.onSustainedActivity(target.activity, target.seconds)
            } else {
                val fireMs = (remaining * 1000).toLong()
                if (fireMs < nextFireMs) nextFireMs = fireMs
            }
        }

        if (nextFireMs != Long.MAX_VALUE) {
            val r = Runnable { rescheduleSustainTimer() }
            sustainRunnable = r
            handler.postDelayed(r, nextFireMs)
        }
    }

    @Suppress("MissingPermission")
    private fun registerActivityRecognition() {
        val arIntent = Intent(ctx, ActivityRecognitionReceiver::class.java)
        arPendingIntent = PendingIntent.getBroadcast(
            ctx, 0, arIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        ActivityRecognition.getClient(ctx)
            .requestActivityUpdates(5_000L, arPendingIntent!!)
            .addOnFailureListener { e ->
                TrackingLogger.shared.log(TrackingLogger.Level.error, "MotionMonitor: AR register failed — $e")
            }

        val transitions = listOf(
            ActivityTransition.Builder()
                .setActivityType(DetectedActivity.STILL)
                .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_EXIT)
                .build(),
            ActivityTransition.Builder()
                .setActivityType(DetectedActivity.WALKING)
                .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                .build(),
            ActivityTransition.Builder()
                .setActivityType(DetectedActivity.IN_VEHICLE)
                .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                .build(),
            ActivityTransition.Builder()
                .setActivityType(DetectedActivity.ON_BICYCLE)
                .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                .build(),
        )
        val transIntent = Intent(ctx, ActivityTransitionReceiver::class.java)
        transitionPendingIntent = PendingIntent.getBroadcast(
            ctx, 1, transIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        ActivityRecognition.getClient(ctx)
            .requestActivityTransitionUpdates(ActivityTransitionRequest(transitions), transitionPendingIntent!!)
            .addOnFailureListener { e ->
                TrackingLogger.shared.log(TrackingLogger.Level.error, "MotionMonitor: transition register failed — $e")
            }
    }

    // MARK: - Test helpers

    internal fun testSimulate(activity: Activity, confidence: Confidence) {
        val isLowConfWalking = confidence == Confidence.LOW && activity == Activity.WALKING
        if (confidence == Confidence.LOW && activity != Activity.STATIONARY && !isLowConfWalking) {
            TrackingLogger.shared.log(TrackingLogger.Level.info, "MotionMonitor: low-confidence ignored (${activity.raw})")
            return
        }
        handleActivityChange(activity, confidence, System.currentTimeMillis())
    }

    companion object {
        // Static ref so BroadcastReceivers can dispatch without holding a Context chain.
        @Volatile var shared: MotionMonitor? = null

        private fun classifyDetectedActivity(type: Int): Activity = when (type) {
            DetectedActivity.STILL       -> Activity.STATIONARY
            DetectedActivity.WALKING     -> Activity.WALKING
            DetectedActivity.ON_FOOT     -> Activity.WALKING
            DetectedActivity.RUNNING     -> Activity.RUNNING
            DetectedActivity.ON_BICYCLE  -> Activity.CYCLING
            DetectedActivity.IN_VEHICLE  -> Activity.AUTOMOTIVE
            else                         -> Activity.UNKNOWN
        }

        private fun mapConfidence(confidence: Int): Confidence = when {
            confidence >= 75 -> Confidence.HIGH
            confidence >= 50 -> Confidence.MEDIUM
            else             -> Confidence.LOW
        }
    }
}
