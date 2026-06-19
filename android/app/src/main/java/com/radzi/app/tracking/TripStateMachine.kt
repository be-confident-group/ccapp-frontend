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
        var allowLowConfidenceWalking: Boolean = true,
        var modeChangeEndSeconds: Double = 120.0,        // sustained automotive during a non-drive trip ends it
        var cooldownResumeWindowSeconds: Double = 60.0   // 2nd moving event must arrive within this to resume from cooldown
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

    companion object {
        /** Max idle age for a trip to be re-adopted on restart; must not exceed the
         *  staleness threshold in TrackingDatabase.findStaleRecordingTrip(). */
        const val REHYDRATE_MAX_IDLE_MS = 10L * 60 * 1000
    }

    private var detectingStartMs: Long? = null
    private var stationaryStartMs: Long? = null
    private var cooldownEnteredMs: Long? = null
    private var lastMotionActivity: MotionMonitor.Activity = MotionMonitor.Activity.UNKNOWN
    private var motionMonitorRef: MotionMonitor? = null

    /** Type the current trip was started with (immediate-start path); null for detecting-path trips. */
    private var currentTripType: String? = null

    // Sustained-automotive detection — ends a non-drive trip when the user boards a vehicle.
    private var automotiveSinceMs: Long? = null

    // Cooldown resume hysteresis — a single motion blip must not resume a trip.
    private var cooldownFirstMovingMs: Long? = null

    // Urban-canyon diagnostics for the detecting phase.
    private var detectingDroppedFixCount = 0
    private var detectingDroppedAccuracySum = 0.0

    // Multi-window vote state
    private data class VoteEntry(val type: String, val weight: Int)
    private val voteBuffer = mutableListOf<VoteEntry>()
    private var voteRunnable: Runnable? = null

    // Detecting pedometer state
    private var detectingPedometerSteps: Int = 0
    private var detectingPedometerQueried = false

    // Pre-trip GPS ring buffer: accumulates fixes during the vote/warm-up window so the
    // route starts from where movement began, not where the trip was confirmed.
    private data class PreBufferFix(val lat: Double, val lng: Double, val accuracy: Double, val speed: Double, val timestamp: Long)
    private val preTripBuffer = mutableListOf<PreBufferFix>()
    private val PRE_BUFFER_MAX_COUNT = 300
    private val PRE_BUFFER_MAX_AGE_MS = 5L * 60 * 1000
    private var gpsWarmUpRequested = false

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
                // Sustained automotive during a non-drive trip means the user boarded a
                // vehicle — end the trip so the walk and the ride don't merge into one
                // record. Stationary blips (train stopping at a station) don't reset the
                // run; only a different moving activity does.
                if (activity == MotionMonitor.Activity.AUTOMOTIVE && currentTripType != "drive") {
                    val since = automotiveSinceMs ?: System.currentTimeMillis().also { automotiveSinceMs = it }
                    if ((System.currentTimeMillis() - since) / 1000.0 >= config.modeChangeEndSeconds) {
                        TrackingLogger.shared.log(TrackingLogger.Level.info,
                            "TripStateMachine: sustained automotive ${config.modeChangeEndSeconds.toInt()}s during ${currentTripType ?: "untyped"} trip — ending trip")
                        automotiveSinceMs = null
                        transitionRecordingToCooldown()
                        transitionCooldownToEnding()
                        return
                    }
                } else if (isMoving(activity)) {
                    automotiveSinceMs = null
                }

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
                    // Hysteresis: high-confidence motion resumes immediately; medium/low
                    // needs a second moving event within the resume window. Indoor AR
                    // flapping fires lone events minutes apart — those must not resume the
                    // trip and reset the 180 s end timer.
                    val now = System.currentTimeMillis()
                    val first = cooldownFirstMovingMs
                    if (confidence == MotionMonitor.Confidence.HIGH ||
                        (first != null && (now - first) / 1000.0 <= config.cooldownResumeWindowSeconds)) {
                        cooldownFirstMovingMs = null
                        transitionCooldownToRecording()
                    } else {
                        cooldownFirstMovingMs = now
                        TrackingLogger.shared.log(TrackingLogger.Level.info,
                            "TripStateMachine: cooldown — lone ${confidence.raw} moving event, awaiting corroboration")
                        checkCooldownEndingThreshold()
                    }
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
            State.ENDING -> return
            State.IDLE -> {
                if (gpsWarmUpRequested) {
                    preTripBuffer.add(PreBufferFix(lat, lng, accuracy, speed, timestamp))
                    val cutoff = timestamp - PRE_BUFFER_MAX_AGE_MS
                    preTripBuffer.removeAll { it.timestamp < cutoff }
                    if (preTripBuffer.size > PRE_BUFFER_MAX_COUNT) {
                        preTripBuffer.subList(0, preTripBuffer.size - PRE_BUFFER_MAX_COUNT).clear()
                    }
                }
                return
            }
            State.DETECTING -> {
                if (accuracy > config.detectingAccuracyThresholdM) {
                    detectingDroppedFixCount++
                    detectingDroppedAccuracySum += accuracy
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

        // GPS warm-up: start balanced-accuracy GPS as soon as a moving event arrives in idle.
        if (!gpsWarmUpRequested) {
            gpsWarmUpRequested = true
            delegate?.requestAccuracyMode(LocationSession.AccuracyMode.HUNDRED)
        }

        if (confidence == MotionMonitor.Confidence.HIGH) {
            cancelVoteTimer()
            voteBuffer.clear()
            immediateStartTrip(type, "android_motion")
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
        if (state != State.IDLE || buffer.isEmpty()) {
            if (state == State.IDLE && gpsWarmUpRequested) {
                gpsWarmUpRequested = false
                preTripBuffer.clear()
                delegate?.requestAccuracyMode(LocationSession.AccuracyMode.OFF)
            }
            return
        }
        val scores = mutableMapOf<String, Int>()
        for (entry in buffer) scores[entry.type] = (scores[entry.type] ?: 0) + entry.weight
        val winner = scores.maxByOrNull { it.value }?.key ?: return
        immediateStartTrip(winner, "android_motion")
    }

    // MARK: - Immediate start

    private fun immediateStartTrip(type: String, classificationSource: String) {
        val now = System.currentTimeMillis()
        val tripId = "trip_${now}_${(1000..9999).random()}"
        val bufferCutoff = now - PRE_BUFFER_MAX_AGE_MS
        val qualifying = preTripBuffer.filter { it.accuracy <= config.detectingAccuracyThresholdM && it.timestamp >= bufferCutoff }
        val backfillStart = qualifying.firstOrNull()?.timestamp ?: now
        try {
            TrackingDatabase.shared.createTrip(tripId, now, backfillStart, type, classificationSource)
            for (fix in qualifying) {
                try { TrackingDatabase.shared.insertLocation(tripId, fix.lat, fix.lng, fix.accuracy, fix.speed, null, null, fix.timestamp, "best") } catch (_: Exception) {}
            }
            if (qualifying.isNotEmpty()) {
                TrackingLogger.shared.log(TrackingLogger.Level.info, "TripStateMachine: pre-buffer flushed ${qualifying.size} fixes into trip $tripId (backfill ${now - backfillStart}ms)")
            }
            preTripBuffer.clear()
            gpsWarmUpRequested = false
            currentTripId = tripId
            currentTripType = type
            transition(State.RECORDING)
            delegate?.onStartTrip(tripId, now, backfillStart)
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
        // Flush pre-trip buffer into staging so the route starts from where motion began.
        val now = System.currentTimeMillis()
        val bufferCutoff = now - PRE_BUFFER_MAX_AGE_MS
        val qualifying = preTripBuffer.filter { it.accuracy <= config.detectingAccuracyThresholdM && it.timestamp >= bufferCutoff }
        for (fix in qualifying) {
            try { TrackingDatabase.shared.insertStagingLocation(stagingId, fix.lat, fix.lng, fix.accuracy, fix.speed, fix.timestamp) } catch (_: Exception) {}
        }
        if (qualifying.isNotEmpty()) {
            TrackingLogger.shared.log(TrackingLogger.Level.info, "TripStateMachine: pre-buffer flushed ${qualifying.size} fixes into staging $stagingId")
        }
        preTripBuffer.clear()
        gpsWarmUpRequested = false
        detectingStartMs = System.currentTimeMillis()
        detectingPedometerSteps = 0
        detectingPedometerQueried = false
        detectingDroppedFixCount = 0
        detectingDroppedAccuracySum = 0.0
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
        preTripBuffer.clear()
        gpsWarmUpRequested = false
        transition(State.IDLE)
        delegate?.requestAccuracyMode(LocationSession.AccuracyMode.OFF)
        // Urban-canyon diagnostic: if GPS accuracy starved the detecting phase, say so
        // explicitly — this is the signature of a missed walk between tall buildings.
        if (detectingDroppedFixCount > 0) {
            val avg = (detectingDroppedAccuracySum / detectingDroppedFixCount).toInt()
            TrackingLogger.shared.log(TrackingLogger.Level.warn,
                "TripStateMachine: detecting→idle ($reason) — urban-canyon suspect: dropped $detectingDroppedFixCount fixes above ${config.detectingAccuracyThresholdM.toInt()}m gate (avg ${avg}m)")
        } else {
            TrackingLogger.shared.log(TrackingLogger.Level.info, "TripStateMachine: detecting→idle ($reason)")
        }
        detectingDroppedFixCount = 0
        detectingDroppedAccuracySum = 0.0
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
        cooldownFirstMovingMs = null
        automotiveSinceMs = null
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
        cooldownFirstMovingMs = null
        automotiveSinceMs = null
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

        // Store step count for pedometer cross-check in TripValidationService.
        val tripStartMs = if (durationSec > 0) now - durationSec * 1000 else now - 300_000L
        val steps = pedometerRef?.stepsSince(tripStartMs) ?: 0
        if (steps > 0) {
            try { TrackingDatabase.shared.updateTripStepCount(tripId, steps) } catch (_: Exception) {}
            TrackingLogger.shared.log(TrackingLogger.Level.info, "TripStateMachine: stored $steps steps for trip $tripId")
        }

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
                        dist, "android_motion"
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
        currentTripType = null
        stationaryStartMs = null
        cooldownEnteredMs = null
        cooldownFirstMovingMs = null
        automotiveSinceMs = null
        preTripBuffer.clear()
        gpsWarmUpRequested = false
        transition(State.IDLE)
    }

    fun onFinalizationComplete() {
        cancelStationaryCheckTimer()
        currentTripId = null
        currentTripType = null
        stationaryStartMs = null
        cooldownEnteredMs = null
        cooldownFirstMovingMs = null
        automotiveSinceMs = null
        preTripBuffer.clear()
        gpsWarmUpRequested = false
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
        val active = try { TrackingDatabase.shared.findStaleRecordingTrip(staleAfterMs = 0) } catch (_: Exception) { null } ?: return
        // Only re-adopt trips that were updated recently — i.e. plausibly still in
        // progress across a process restart. Anything older is a dead trip that must
        // go through recoverStaleTrip()/BackgroundSyncWorker instead: adopting it
        // here would resume GPS, refresh updated_at, and make the trip permanently
        // unrecoverable (it never looks stale again, but nothing can ever end it).
        val idleMs = System.currentTimeMillis() - active.lastUpdate
        if (idleMs >= REHYDRATE_MAX_IDLE_MS) {
            TrackingLogger.shared.log(TrackingLogger.Level.warn,
                "TripStateMachine: not rehydrating trip ${active.id} (idle ${idleMs / 60000}min) — leaving for stale recovery")
            return
        }
        currentTripId = active.id
        currentTripType = try { TrackingDatabase.shared.loadTripType(active.id) } catch (_: Exception) { null }
        transition(State.RECORDING)
        altimeterRef?.start()
        TrackingLogger.shared.log(TrackingLogger.Level.info, "TripStateMachine: rehydrated trip ${active.id}")
        delegate?.onStartTrip(active.id, active.lastUpdate, active.lastUpdate)
        delegate?.requestAccuracyMode(LocationSession.AccuracyMode.BEST)
        delegate?.requestImuRunning(true, active.id)
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
