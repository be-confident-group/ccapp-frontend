package com.radzi.app.tracking

import android.Manifest
import android.content.pm.PackageManager
import android.location.Location
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.Executors

class RadziTrackerModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx),
    MotionMonitorDelegate,
    LocationSessionDelegate,
    TripStateMachineDelegate {

    override fun getName(): String = "RadziTracker"

    // Required by RN for event emitter on Android
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    private val motion     = MotionMonitor(ctx)
    private val location   = LocationSession(ctx)
    private val imu        = ImuSampler(ctx)
    private val altimeter  = AltimeterMonitor(ctx)
    private val pedometer  = PedometerSource(ctx)
    private val stateMachine = TripStateMachine()
    private val bgExecutor = Executors.newSingleThreadExecutor()

    init {
        // Hand off from any standalone stack the foreground service may have started
        // while the app was backgrounded, before we take ownership.
        TrackingForegroundService.tearDownStandalone()

        // Wire up delegates
        motion.delegate = this
        location.delegate = this
        stateMachine.delegate = this
        stateMachine.bind(motion)
        stateMachine.bindSensors(altimeter, pedometer)
        MotionMonitor.shared = motion

        // Set sustain watches
        motion.watchSustain(MotionMonitor.Activity.WALKING,    stateMachine.config.detectionSustainSeconds)
        motion.watchSustain(MotionMonitor.Activity.RUNNING,    stateMachine.config.detectionSustainSeconds)
        motion.watchSustain(MotionMonitor.Activity.CYCLING,    stateMachine.config.detectionSustainSeconds)
        motion.watchSustain(MotionMonitor.Activity.AUTOMOTIVE, stateMachine.config.detectionSustainSeconds)

        // Initialize DB
        TrackingDatabase.init(ctx)

        // Backfill any trips missed while the app was not running
        bgExecutor.execute {
            val nowMs = System.currentTimeMillis()
            val covered = try { TrackingDatabase.shared.recentTripWindows(35 * 60 * 1000L, nowMs) } catch (_: Exception) { emptyList() }
            val synthesized = stateMachine.reconcilerBackfill(nowMs, covered)
            for (syn in synthesized) {
                val dist = syn.distanceM
                if (dist == null || dist <= 0) {
                    TrackingLogger.shared.log(TrackingLogger.Level.info,
                        "RadziTrackerModule: skipping 0-distance synthesized trip (pedometer nil)")
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
        }

        stateMachine.rehydrateIfNeeded()

        // Schedule background sync
        BackgroundSyncWorker.enqueue(ctx)
    }

    // MARK: - Event emission helper

    private fun emit(name: String, params: WritableMap) {
        ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(name, params)
    }

    // MARK: - MotionMonitorDelegate

    override fun onActivityChanged(activity: MotionMonitor.Activity, confidence: MotionMonitor.Confidence, timestampMs: Long) {
        stateMachine.onMotionActivity(activity, confidence)

        emit("activityChanged", Arguments.createMap().apply {
            putString("activity", activity.raw)
            putString("confidence", confidence.raw)
            putDouble("timestamp", timestampMs.toDouble())
        })

        val tripId = stateMachine.currentTripId
        if (tripId != null) {
            val ts = timestampMs
            try {
                TrackingDatabase.shared.updateLastMotionSegmentEnd(tripId, ts)
                TrackingDatabase.shared.insertMotionSegment(tripId, ts, ts, activity.raw, confidence.raw, "cmma")
            } catch (_: Exception) {}
        }
    }

    override fun onSustainedActivity(activity: MotionMonitor.Activity, forSeconds: Double) {
        stateMachine.onSustainedMotion(activity)
    }

    override fun onPermissionMissing(permission: String) {
        val params = Arguments.createMap().apply {
            putString("permission", permission)
        }
        emit("trackingPermissionMissing", params)
    }

    // MARK: - LocationSessionDelegate

    override fun onLocationReceived(loc: Location, mode: LocationSession.AccuracyMode) {
        val ts = loc.time
        stateMachine.onLocation(
            lat = loc.latitude,
            lng = loc.longitude,
            accuracy = loc.accuracy.toDouble(),
            speed = maxOf(loc.speed.toDouble(), 0.0),
            timestamp = ts
        )
    }

    override fun onAuthorizationChanged(status: String) {
        TrackingLogger.shared.log(TrackingLogger.Level.info, "Location authorization changed: $status")
    }

    override fun onError(throwable: Throwable) {
        TrackingLogger.shared.log(TrackingLogger.Level.error, "Location error: $throwable")
    }

    // MARK: - TripStateMachineDelegate

    override fun onTransitionTo(state: TripStateMachine.State, from: TripStateMachine.State) {
        emit("stateChanged", Arguments.createMap().apply {
            putString("state", state.raw)
            putString("previousState", from.raw)
            putDouble("timestamp", System.currentTimeMillis().toDouble())
        })
    }

    override fun onStartTrip(tripId: String, startTime: Long, backfillStart: Long) {
        emit("tripStarted", Arguments.createMap().apply {
            putString("tripId", tripId)
            putDouble("startTime", startTime.toDouble())
            putDouble("backfillStart", backfillStart.toDouble())
        })
    }

    override fun onEndTrip(tripId: String, endTime: Long) {
        emit("tripEnded", Arguments.createMap().apply {
            putString("tripId", tripId)
            putDouble("endTime", endTime.toDouble())
        })
    }

    override fun onLocationStored(tripId: String, lat: Double, lng: Double, accuracy: Double, speed: Double, timestamp: Long) {
        emit("locationStored", Arguments.createMap().apply {
            putString("tripId", tripId)
            putDouble("lat", lat)
            putDouble("lng", lng)
            putDouble("accuracy", accuracy)
            putDouble("speed", speed)
            putDouble("timestamp", timestamp.toDouble())
        })
    }

    override fun requestAccuracyMode(mode: LocationSession.AccuracyMode) {
        location.setMode(mode)
    }

    override fun requestImuRunning(running: Boolean, tripId: String?) {
        if (running) {
            if (tripId != null) imu.attach(tripId)
            imu.start()
        } else {
            imu.pause()
        }
    }

    // MARK: - Bridge API methods

    @ReactMethod
    fun start(promise: Promise) {
        motion.start()
        pedometer.start()
        promise.resolve(null)
    }

    @ReactMethod
    fun stop(promise: Promise) {
        motion.stop()
        location.setMode(LocationSession.AccuracyMode.OFF)
        imu.pause()
        pedometer.stop()
        promise.resolve(null)
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        promise.resolve(Arguments.createMap().apply {
            putString("state", stateMachine.state.raw)
            putString("activity", motion.currentActivity.raw)
            stateMachine.currentTripId?.let { putString("tripId", it) }
                ?: putNull("tripId")
            stateMachine.currentStagingId?.let { putString("stagingId", it) }
                ?: putNull("stagingId")
            putString("gpsAccuracyMode", location.currentMode.raw)
            putNull("lastLocationTimestamp")
        })
    }

    @ReactMethod
    fun forceStartTrip(promise: Promise) {
        try {
            val tripId = stateMachine.forceStart()
            promise.resolve(Arguments.createMap().apply { putString("tripId", tripId) })
        } catch (e: Exception) {
            promise.reject("force_start_failed", e.message, e)
        }
    }

    @ReactMethod
    fun forceStopTrip(promise: Promise) {
        try {
            stateMachine.forceStop()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("force_stop_failed", e.message, e)
        }
    }

    @ReactMethod
    fun checkPermissions(promise: Promise) {
        val locStatus = location.currentAuthorization()
        val motionGranted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACTIVITY_RECOGNITION) ==
                PackageManager.PERMISSION_GRANTED
        promise.resolve(Arguments.createMap().apply {
            putString("location", locStatus)
            putString("motion", if (motionGranted) "granted" else "denied")
        })
    }

    @ReactMethod
    fun setConfig(config: ReadableMap, promise: Promise) {
        val cfg = stateMachine.config
        if (config.hasKey("detectionSustainSeconds"))    { val v = config.getDouble("detectionSustainSeconds");    if (v > 0 && v < 120)  { cfg.detectionSustainSeconds = v } }
        if (config.hasKey("detectingMinDurationSeconds")){ val v = config.getDouble("detectingMinDurationSeconds");if (v > 0 && v < 300)  { cfg.detectingMinDurationSeconds = v } }
        if (config.hasKey("detectingMinDisplacementMeters")) { val v = config.getDouble("detectingMinDisplacementMeters"); if (v > 0 && v < 500) { cfg.detectingMinDisplacementMeters = v } }
        if (config.hasKey("falseStartGpsDisplacementMeters")) { val v = config.getDouble("falseStartGpsDisplacementMeters"); if (v > 0 && v < 200) { cfg.falseStartGpsDisplacementMeters = v } }
        if (config.hasKey("detectingAccuracyThresholdM")) { val v = config.getDouble("detectingAccuracyThresholdM"); if (v > 0 && v < 500) { cfg.detectingAccuracyThresholdM = v } }
        if (config.hasKey("recordingAccuracyThresholdM")) { val v = config.getDouble("recordingAccuracyThresholdM"); if (v > 0 && v < 500) { cfg.recordingAccuracyThresholdM = v } }
        // Back-compat: legacy key updates only detecting threshold
        if (config.hasKey("locationAccuracyThresholdM")) { val v = config.getDouble("locationAccuracyThresholdM"); if (v > 0 && v < 500) { cfg.detectingAccuracyThresholdM = v } }
        if (config.hasKey("detectingMinPedometerSteps")) { val v = config.getDouble("detectingMinPedometerSteps"); if (v > 0 && v < 500) { cfg.detectingMinPedometerSteps = v.toInt() } }
        if (config.hasKey("cooldownEnterSeconds"))  { val v = config.getDouble("cooldownEnterSeconds");  if (v > 0 && v < 600)  { cfg.cooldownEnterSeconds = v } }
        if (config.hasKey("cooldownEndSeconds"))    { val v = config.getDouble("cooldownEndSeconds");    if (v > 0 && v < 1800) { cfg.cooldownEndSeconds = v } }
        if (config.hasKey("multiWindowVoteSec"))    { val v = config.getDouble("multiWindowVoteSec");    if (v > 0 && v < 120)  { cfg.multiWindowVoteSec = v } }
        if (config.hasKey("allowLowConfidenceWalking")) { cfg.allowLowConfidenceWalking = config.getBoolean("allowLowConfidenceWalking") }

        // Re-apply sustain watches with updated duration
        motion.watchSustain(MotionMonitor.Activity.WALKING,    cfg.detectionSustainSeconds)
        motion.watchSustain(MotionMonitor.Activity.RUNNING,    cfg.detectionSustainSeconds)
        motion.watchSustain(MotionMonitor.Activity.CYCLING,    cfg.detectionSustainSeconds)
        motion.watchSustain(MotionMonitor.Activity.AUTOMOTIVE, cfg.detectionSustainSeconds)

        promise.resolve(null)
    }

    @ReactMethod
    fun getConfig(promise: Promise) {
        val cfg = stateMachine.config
        promise.resolve(Arguments.createMap().apply {
            putDouble("detectionSustainSeconds",         cfg.detectionSustainSeconds)
            putDouble("detectingMinDurationSeconds",     cfg.detectingMinDurationSeconds)
            putDouble("detectingMinDisplacementMeters",  cfg.detectingMinDisplacementMeters)
            putDouble("falseStartGpsDisplacementMeters", cfg.falseStartGpsDisplacementMeters)
            putDouble("detectingAccuracyThresholdM",     cfg.detectingAccuracyThresholdM)
            putDouble("recordingAccuracyThresholdM",     cfg.recordingAccuracyThresholdM)
            putDouble("detectingMinPedometerSteps",      cfg.detectingMinPedometerSteps.toDouble())
            putDouble("cooldownEnterSeconds",            cfg.cooldownEnterSeconds)
            putDouble("cooldownEndSeconds",              cfg.cooldownEndSeconds)
            putDouble("multiWindowVoteSec",              cfg.multiWindowVoteSec)
            putBoolean("allowLowConfidenceWalking",      cfg.allowLowConfidenceWalking)
            putDouble("imuSampleRateHz",                 ImuSampler.sampleRateHz)
        })
    }

    @ReactMethod
    fun recoverStaleTrip(promise: Promise) {
        try {
            val stale = TrackingDatabase.shared.findStaleRecordingTrip()
            if (stale != null) {
                TrackingDatabase.shared.endTrip(stale.id, stale.lastUpdate)
                emit("tripEnded", Arguments.createMap().apply {
                    putString("tripId", stale.id)
                    putDouble("endTime", stale.lastUpdate.toDouble())
                    putBoolean("recovered", true)
                })
                promise.resolve(Arguments.createMap().apply { putString("recovered", stale.id) })
            } else {
                promise.resolve(Arguments.createMap().apply { putNull("recovered") })
            }
        } catch (e: Exception) {
            promise.reject("recover_failed", e.message, e)
        }
    }

    @ReactMethod
    fun notifyFinalizationComplete(promise: Promise) {
        stateMachine.onFinalizationComplete()
        promise.resolve(null)
    }

    @ReactMethod
    fun getLogs(promise: Promise) {
        val entries = Arguments.createArray()
        TrackingLogger.shared.snapshot().forEach { e ->
            entries.pushMap(Arguments.createMap().apply {
                putDouble("timestamp", e.timestamp.toDouble())
                putString("level", e.level)
                putString("message", e.message)
            })
        }
        promise.resolve(entries)
    }
}
