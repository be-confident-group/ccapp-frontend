package com.radzi.app.tracking

import android.os.Handler
import android.os.Looper
import java.util.concurrent.Executors

interface TripStateMachineDelegate {
    fun onTransitionTo(state: TripStateMachine.State, from: TripStateMachine.State)
    fun onStartTrip(tripId: String, startTime: Long, backfillStart: Long)
    fun onEndTrip(tripId: String, endTime: Long)
    fun onLocationStored(tripId: String, lat: Double, lng: Double, accuracy: Double, speed: Double, timestamp: Long)
    fun requestAccuracyMode(mode: LocationSession.AccuracyMode)
    fun requestImuRunning(running: Boolean, tripId: String?)
}

class TripStateMachine {

    enum class State(val raw: String) {
        IDLE("idle"),
        DETECTING("detecting"),
        RECORDING("recording"),
        COOLDOWN("cooldown"),
        ENDING("ending")
    }

    data class Config(
        var detectionSustainSeconds: Double = 8.0,
        var detectingMinDurationSeconds: Double = 60.0,
        var detectingMinDisplacementMeters: Double = 30.0,
        var falseStartGpsDisplacementMeters: Double = 15.0,
        var detectingAccuracyThresholdM: Double = 20.0,
        var recordingAccuracyThresholdM: Double = 65.0,
        var detectingMinPedometerSteps: Int = 40,
        var cooldownEnterSeconds: Double = 30.0,
        var cooldownEndSeconds: Double = 180.0,
        var multiWindowVoteSec: Double = 20.0,
        var allowLowConfidenceWalking: Boolean = true
    )

    var delegate: TripStateMachineDelegate? = null
    var state: State = State.IDLE
        private set
    var currentTripId: String? = null
        private set
    var currentStagingId: String? = null
        private set
    var config = Config()

    private val handler = Handler(Looper.getMainLooper())
    private val bgExecutor = Executors.newSingleThreadExecutor()

    private var detectingStartMs: Long? = null
    private var stationaryStartMs: Long? = null
    private var cooldownEnteredMs: Long? = null
    private var lastMotionActivity: MotionMonitor.Activity = MotionMonitor.Activity.UNKNOWN
    private var motionMonitorRef: MotionMonitor? = null

    // Multi-window vote state
    private data class VoteEntry(val type: String, val weight: Int)
    private val voteBuffer = mutableListOf<VoteEntry>()
    private var voteRunnable: Runnable? = null

    // Detecting pedometer state
    private var detectingPedometerSteps: Int = 0
    private var detectingPedometerQueried = false

    // Stationary check timer
    private var stationaryCheckRunnable: Runnable? = null
    private val STATIONARY_CHECK_INTERVAL_MS = 10_000L

    private val altimeter: AltimeterMonitor? = null  // set from module after init
    private var altimeterRef: AltimeterMonitor? = null
    private var pedometerRef: PedometerSource? = null

    private val reconciler: ActivityHistoryReconciler = ActivityHistoryReconciler(
        DbMotionHistorySource(),
        AndroidPedometerDistanceSource()
    )

    fun bind(motion: MotionMonitor) {
        this.motionMonitorRef = motion
    }

    fun bindSensors(altimeter: AltimeterMonitor, pedometer: PedometerSource) {
        this.altimeterRef = altimeter
        this.pedometerRef = pedometer
    }

    // MARK: - Inputs

    fun onMotionActivity(activity: MotionMonitor.Activity, confidence: MotionMonitor.Confidence) {
        handleMotionUpdate(activity, confidence)
        lastMotionActivity = activity
        when (state) {
            State.IDLE -> { /* sustain handled by MotionMonitor.watchSustain */ }
            State.DETECTING -> { /* tolerance via checkDetectingPromotion */ }
            State.RECORDING -> {
                if (isMoving(activity)) {
                    stationaryStartMs = null
                    cancelStationaryCheckTimer()
                } else {
                    if (stationaryStartMs == null) {
                        stationaryStartMs = System.currentTimeMillis()
                        scheduleStationaryCheckTimer()
                    }
                    checkRecordingStationaryThreshold()
                }
            }
            State.COOLDOWN -> {
                if (isMoving(activity)) {
                    transitionCooldownToRecording()
                } else {
                    checkCooldownEndingThreshold()
                }
            }
            State.ENDING -> { /* noop */ }
        }
    }

    fun onSustainedMotion(activity: MotionMonitor.Activity) {
        if (state == State.IDLE && isMoving(activity)) {
            transitionIdleToDetecting()
        }
    }

    fun onLocation(lat: Double, lng: Double, accuracy: Double, speed: Double, timestamp: Long) {
        when (state) {
            State.IDLE, State.ENDING -> return
            State.DETECTING -> {
                if (accuracy > config.detectingAccuracyThresholdM) {
                    TrackingLogger.shared.log(TrackingLogger.Level.info,
                        "TripStateMachine: detecting — dropped low-accuracy fix (${accuracy.toInt()}m)")
                    return
                }
                val stagingId = currentStagingId ?: return
                try {
                    TrackingDatabase.shared.insertStagingLocation(
                        stagingId, lat, lng, accuracy, speed, timestamp
                    )
                } catch (e: Exception) {
                    TrackingLogger.shared.log(TrackingLogger.Level.error, "TripStateMachine: staging insert failed — $e")
                }
                checkDetectingPromotion()
            }
            State.RECORDING -> {
                if (accuracy > config.recordingAccuracyThresholdM) {
                    TrackingLogger.shared.log(TrackingLogger.Level.info,
                        "TripStateMachine: recording — dropped low-accuracy fix (${accuracy.toInt()}m)")
                    return
                }
                val tripId = currentTripId ?: return
                try {
                    TrackingDatabase.shared.insertLocation(
                        tripId, lat, lng, accuracy, speed, null, null, timestamp, "best"
                    )
                    TrackingDatabase.shared.updateTripUpdatedAt(tripId, timestamp)
                } catch (e: Exception) {
                    TrackingLogger.shared.log(TrackingLogger.Level.error, "TripStateMachine: location insert failed — $e")
                }
                delegate?.onLocationStored(tripId, lat, lng, accuracy, speed, timestamp)
            }
            State.COOLDOWN -> { /* B.10: skip GPS during cooldown */ }
        }
    }

    // MARK: - Multi-window vote

    private fun handleMotionUpdate(activity: MotionMonitor.Activity, confidence: MotionMonitor.Confidence) {
        if (state != State.IDLE) return

        val isLowConfWalking = confidence == MotionMonitor.Confidence.LOW &&
                activity == MotionMonitor.Activity.WALKING && config.allowLowConfidenceWalking
        if (confidence == MotionMonitor.Confidence.LOW && !isLowConfWalking) return

        val type = when (activity) {
            MotionMonitor.Activity.WALKING    -> "walk"
            MotionMonitor.Activity.RUNNING    -> "run"
            MotionMonitor.Activity.CYCLING    -> "cycle"
            MotionMonitor.Activity.AUTOMOTIVE -> "drive"
            else -> return
        }

        if (confidence == MotionMonitor.Confidence.HIGH) {
            cancelVoteTimer()
            voteBuffer.clear()
            immediateStartTrip(type, "apple_motion")
            return
        }

        val weight = if (confidence == MotionMonitor.Confidence.MEDIUM) 2 else 1
        voteBuffer.add(VoteEntry(type, weight))

        if (voteRunnable == null) {
            scheduleVoteTimer()
        }
    }

    private fun scheduleVoteTimer() {
        val r = Runnable { commitVote() }
        voteRunnable = r
        handler.postDelayed(r, (config.multiWindowVoteSec * 1000).toLong())
    }

    private fun cancelVoteTimer() {
        voteRunnable?.let { handler.removeCallbacks(it) }
        voteRunnable = null
        voteBuffer.clear()
    }

    private fun commitVote() {
        val buffer = voteBuffer.toList()
        voteBuffer.clear()
        voteRunnable = null
        if (state != State.IDLE || buffer.isEmpty()) return
        val scores = mutableMapOf<String, Int>()
        for (entry in buffer) scores[entry.type] = (scores[entry.type] ?: 0) + entry.weight
        val winner = scores.maxByOrNull { it.value }?.key ?: return
        immediateStartTrip(winner, "apple_motion")
    }

    // MARK: - Immediate start

    private fun immediateStartTrip(type: String, classificationSource: String) {
        val now = System.currentTimeMillis()
        val tripId = "trip_${now}_${(1000..9999).random()}"
        try {
            TrackingDatabase.shared.createTrip(tripId, now, now, type, classificationSource)
            currentTripId = tripId
            transition(State.RECORDING)
            delegate?.onStartTrip(tripId, now, now)
            delegate?.requestAccuracyMode(LocationSession.AccuracyMode.BEST)
            delegate?.requestImuRunning(true, tripId)
            altimeterRef?.start()
        } catch (e: Exception) {
            TrackingLogger.shared.log(TrackingLogger.Level.error, "TripStateMachine: immediateStartTrip failed — $e")
        }
    }

    // MARK: - Force start/stop

    fun forceStart(): String {
        if (state != State.IDLE) error("Cannot force-start: not idle (state=${state.raw})")
        val now = System.currentTimeMillis()
        val tripId = "trip_${now}_${(1000..9999).random()}"
        TrackingDatabase.shared.createTrip(tripId, now, now)
        currentTripId = tripId
        transition(State.RECORDING)
        altimeterRef?.start()
        delegate?.onStartTrip(tripId, now, now)
        delegate?.requestAccuracyMode(LocationSession.AccuracyMode.BEST)
        delegate?.requestImuRunning(true, tripId)
        return tripId
    }

    fun forceStop() {
        if (state == State.RECORDING || state == State.COOLDOWN) {
            transitionCooldownToEnding()
        }
    }

    // MARK: - Transitions

    private fun transitionIdleToDetecting() {
        cancelVoteTimer()
        val stagingId = "staging_${System.currentTimeMillis()}"
        currentStagingId = stagingId
        detectingStartMs = System.currentTimeMillis()
        detectingPedometerSteps = 0
        detectingPedometerQueried = false
        transition(State.DETECTING)
        delegate?.requestAccuracyMode(LocationSession.AccuracyMode.BEST)
    }

    private fun transitionDetectingToIdle(reason: String) {
        currentStagingId?.let {
            try { TrackingDatabase.shared.discardStaging(it) } catch (_: Exception) {}
        }
        currentStagingId = null
        detectingStartMs = null
        detectingPedometerSteps = 0
        detectingPedometerQueried = false
        transition(State.IDLE)
        delegate?.requestAccuracyMode(LocationSession.AccuracyMode.OFF)
        TrackingLogger.shared.log(TrackingLogger.Level.info, "TripStateMachine: detecting→idle ($reason)")
    }

    private fun checkDetectingPromotion() {
        val startMs = detectingStartMs ?: return
        val stagingId = currentStagingId ?: return
        val elapsedSec = (System.currentTimeMillis() - startMs) / 1000.0
        val displacement = try { TrackingDatabase.shared.stagingDisplacementMeters(stagingId) } catch (_: Exception) { 0.0 }

        if (elapsedSec < config.detectingMinDurationSeconds) return

        if (displacement >= config.detectingMinDisplacementMeters) {
            transitionDetectingToRecording()
            return
        }

        // Pedometer corroboration (Android: synchronous estimate from step counter)
        if (!detectingPedometerQueried) {
            detectingPedometerQueried = true
            detectingPedometerSteps = pedometerRef?.stepsSince(startMs) ?: 0
            TrackingLogger.shared.log(TrackingLogger.Level.info,
                "TripStateMachine: pedometer steps in detecting window: $detectingPedometerSteps")
        }

        if (detectingPedometerSteps >= config.detectingMinPedometerSteps) {
            transitionDetectingToRecording()
            return
        }

        if (displacement < config.falseStartGpsDisplacementMeters && detectingPedometerSteps < config.detectingMinPedometerSteps) {
            transitionDetectingToIdle("GPS <${config.falseStartGpsDisplacementMeters.toInt()}m, steps=$detectingPedometerSteps after ${elapsedSec.toInt()}s")
        }
    }

    private fun transitionDetectingToRecording() {
        val stagingId = currentStagingId ?: return

        val stagingFirstTs = try { TrackingDatabase.shared.stagingFirstTimestamp(stagingId) } catch (_: Exception) { null }
            ?: System.currentTimeMillis()
        val tripId = "trip_${stagingFirstTs}_${(1000..9999).random()}"
        var backfillStart = stagingFirstTs

        // Check for earlier activity history
        val recentActivities = motionMonitorRef?.queryRecentActivities(15 * 60.0) ?: emptyList()
        val earliest = recentActivities.firstOrNull { it.first in listOf("walking", "cycling", "running", "automotive") }
        if (earliest != null && earliest.third < backfillStart) {
            backfillStart = earliest.third
        }

        try {
            TrackingDatabase.shared.createTrip(tripId, stagingFirstTs, backfillStart)
            TrackingDatabase.shared.promoteStagingToTrip(stagingId, tripId)
            // Update backfill if earlier activity was found
            if (backfillStart < stagingFirstTs) {
                TrackingDatabase.shared.updateTripBackfillStart(tripId, backfillStart)
            }
            currentTripId = tripId
            currentStagingId = null
            detectingStartMs = null
            transition(State.RECORDING)
            altimeterRef?.start()
            delegate?.onStartTrip(tripId, stagingFirstTs, backfillStart)
            delegate?.requestAccuracyMode(LocationSession.AccuracyMode.BEST)
            delegate?.requestImuRunning(true, tripId)
        } catch (e: Exception) {
            TrackingLogger.shared.log(TrackingLogger.Level.error, "TripStateMachine: failed to promote staging — $e")
            transitionDetectingToIdle("DB error")
        }
    }

    private fun transitionRecordingToCooldown() {
        cancelStationaryCheckTimer()
        drainAltimeter()
        transition(State.COOLDOWN)
        cooldownEnteredMs = System.currentTimeMillis()
        delegate?.requestAccuracyMode(LocationSession.AccuracyMode.HUNDRED)
        delegate?.requestImuRunning(false, currentTripId)
        scheduleStationaryCheckTimer()
    }

    private fun transitionCooldownToRecording() {
        stationaryStartMs = null
        cooldownEnteredMs = null
        cancelStationaryCheckTimer()
        transition(State.RECORDING)
        altimeterRef?.start()
        delegate?.requestAccuracyMode(LocationSession.AccuracyMode.BEST)
        delegate?.requestImuRunning(true, currentTripId)
    }

    private fun transitionCooldownToEnding() {
        val tripId = currentTripId ?: return
        cancelStationaryCheckTimer()
        cooldownEnteredMs = null
        val now = System.currentTimeMillis()
        val endStats = try { TrackingDatabase.shared.endTrip(tripId, now) } catch (_: Exception) { null }
        transition(State.ENDING)
        delegate?.requestAccuracyMode(LocationSession.AccuracyMode.OFF)
        delegate?.requestImuRunning(false, null)

        // Drain altimeter
        val drained = altimeterRef?.stopAndDrain() ?: emptyList()
        drained.forEach { (ts, alt) ->
            try { TrackingDatabase.shared.insertAltitudeSample(tripId, ts, alt) } catch (_: Exception) {}
        }
        try {
            val allSamples = TrackingDatabase.shared.loadAltitudeSamples(tripId)
            val agg = AltimeterMonitor.aggregate(allSamples)
            TrackingDatabase.shared.updateTripElevation(tripId, agg.gainMeters, agg.lossMeters)
        } catch (_: Exception) {}

        val distanceM = endStats?.distanceMeters ?: 0.0
        val locationCount = endStats?.locationCount ?: 0
        val durationSec = endStats?.durationSec ?: 0L
        val shouldCheckPedometer = distanceM < 50.0 && locationCount < 3

        if (shouldCheckPedometer) {
            val stepsSince = pedometerRef?.stepsSince(now - durationSec * 1000) ?: 0
            if (stepsSince >= config.detectingMinPedometerSteps || distanceM >= 50.0) {
                TrackingLogger.shared.log(TrackingLogger.Level.info,
                    "TripStateMachine: kept short trip $tripId via pedometer (steps=$stepsSince, dist=${distanceM.toInt()}m)")
                finishEndingTrip(tripId, now)
            } else {
                TrackingLogger.shared.log(TrackingLogger.Level.info,
                    "TripStateMachine: cancelled 0m trip $tripId (steps=$stepsSince, dist=${distanceM.toInt()}m, locs=$locationCount)")
                TrackingDatabase.shared.cancelTrip(tripId, "0m rejection: steps=$stepsSince, dist=${distanceM.toInt()}m")
                finishEndingNoNotify()
            }
        } else {
            finishEndingTrip(tripId, now)
        }
    }

    private fun finishEndingTrip(tripId: String, endTime: Long) {
        bgExecutor.execute {
            val nowMs = System.currentTimeMillis()
            val coveredWindows = try { TrackingDatabase.shared.recentTripWindows(35 * 60 * 1000L, nowMs) } catch (_: Exception) { emptyList() }
            val synthesized = reconciler.reconcile(nowMs, 35, coveredWindows)
            for (syn in synthesized) {
                val dist = syn.distanceM
                if (dist == null || dist <= 0) {
                    TrackingLogger.shared.log(TrackingLogger.Level.info,
                        "TripStateMachine: skipping 0-distance synthesized trip (pedometer nil)")
                    continue
                }
                val id = "syn_${syn.startMs / 1000}"
                try {
                    TrackingDatabase.shared.insertSynthesizedTrip(
                        id, syn.startMs, syn.endMs,
                        if (syn.activity == MotionMonitor.Activity.WALKING) "walk" else "cycle",
                        dist, "apple_motion"
                    )
                } catch (_: Exception) {}
            }
            handler.post {
                delegate?.onEndTrip(tripId, endTime)
            }
        }
    }

    private fun finishEndingNoNotify() {
        cancelStationaryCheckTimer()
        currentTripId = null
        stationaryStartMs = null
        cooldownEnteredMs = null
        transition(State.IDLE)
    }

    fun onFinalizationComplete() {
        cancelStationaryCheckTimer()
        currentTripId = null
        stationaryStartMs = null
        cooldownEnteredMs = null
        transition(State.IDLE)
    }

    // MARK: - Stationary check timer

    private fun scheduleStationaryCheckTimer() {
        cancelStationaryCheckTimer()
        val r = object : Runnable {
            override fun run() {
                onStationaryCheckTick()
                if (state == State.RECORDING || state == State.COOLDOWN) {
                    handler.postDelayed(this, STATIONARY_CHECK_INTERVAL_MS)
                }
            }
        }
        stationaryCheckRunnable = r
        handler.postDelayed(r, STATIONARY_CHECK_INTERVAL_MS)
    }

    private fun cancelStationaryCheckTimer() {
        stationaryCheckRunnable?.let { handler.removeCallbacks(it) }
        stationaryCheckRunnable = null
    }

    private fun onStationaryCheckTick() {
        when (state) {
            State.RECORDING -> checkRecordingStationaryThreshold()
            State.COOLDOWN  -> checkCooldownEndingThreshold()
            else             -> cancelStationaryCheckTimer()
        }
    }

    private fun checkRecordingStationaryThreshold() {
        val s = stationaryStartMs ?: return
        if ((System.currentTimeMillis() - s) / 1000.0 >= config.cooldownEnterSeconds) {
            transitionRecordingToCooldown()
        }
    }

    private fun checkCooldownEndingThreshold() {
        val s = cooldownEnteredMs ?: return
        if ((System.currentTimeMillis() - s) / 1000.0 >= config.cooldownEndSeconds) {
            transitionCooldownToEnding()
        }
    }

    // MARK: - Backfill (called from module init and SLC-analog wake)

    fun reconcilerBackfill(nowMs: Long, coveredWindows: List<Pair<Long, Long>>): List<ActivityHistoryReconciler.SynthesizedSubTrip> =
        reconciler.reconcile(nowMs, 35, coveredWindows)

    // MARK: - Rehydration

    fun rehydrateIfNeeded() {
        val stale = try { TrackingDatabase.shared.findStaleRecordingTrip(staleAfterMs = 0) } catch (_: Exception) { null } ?: return
        currentTripId = stale.id
        transition(State.RECORDING)
        altimeterRef?.start()
        TrackingLogger.shared.log(TrackingLogger.Level.info, "TripStateMachine: rehydrated trip ${stale.id}")
        delegate?.onStartTrip(stale.id, stale.lastUpdate, stale.lastUpdate)
        delegate?.requestAccuracyMode(LocationSession.AccuracyMode.BEST)
        delegate?.requestImuRunning(true, stale.id)
    }

    // MARK: - Helpers

    private fun transition(newState: State) {
        val previous = state
        state = newState
        delegate?.onTransitionTo(newState, previous)
        TrackingLogger.shared.log(TrackingLogger.Level.info, "TripStateMachine: ${previous.raw} → ${newState.raw}")
    }

    private fun drainAltimeter() {
        val tripId = currentTripId ?: return
        val drained = altimeterRef?.stopAndDrain() ?: return
        drained.forEach { (ts, alt) ->
            try { TrackingDatabase.shared.insertAltitudeSample(tripId, ts, alt) } catch (_: Exception) {}
        }
    }

    private fun isMoving(a: MotionMonitor.Activity): Boolean =
        a == MotionMonitor.Activity.WALKING || a == MotionMonitor.Activity.RUNNING ||
        a == MotionMonitor.Activity.CYCLING || a == MotionMonitor.Activity.AUTOMOTIVE
}
