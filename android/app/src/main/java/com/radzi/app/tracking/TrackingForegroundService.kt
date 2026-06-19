package com.radzi.app.tracking

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.location.Location
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.lifecycle.LifecycleService

class TrackingForegroundService : LifecycleService() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, buildNotification(), android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(NOTIFICATION_ID, buildNotification())
        }
        TrackingLogger.shared.log(TrackingLogger.Level.info, "TrackingForegroundService: started")

        // If no RN module has initialized the tracking stack yet, run one standalone so that
        // background wakes (activity transition receiver, system restart) track correctly.
        if (MotionMonitor.shared == null && standaloneMotion == null) {
            initStandaloneStack()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        // START_STICKY: if the OS kills the service for resources, restart it with a null intent.
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        stopForeground(STOP_FOREGROUND_REMOVE)
        tearDownStandaloneInternal()
        TrackingLogger.shared.log(TrackingLogger.Level.info, "TrackingForegroundService: stopped")
    }

    // MARK: - Standalone stack

    private fun initStandaloneStack() {
        TrackingLogger.shared.log(TrackingLogger.Level.info, "TrackingForegroundService: initializing standalone tracking stack")
        val ctx = applicationContext
        TrackingDatabase.init(ctx)

        val motion = MotionMonitor(ctx)
        val location = LocationSession(ctx)
        val altimeter = AltimeterMonitor(ctx)
        val pedometer = PedometerSource(ctx)
        val stateMachine = TripStateMachine()

        stateMachine.delegate = object : TripStateMachineDelegate {
            override fun requestAccuracyMode(mode: LocationSession.AccuracyMode) = location.setMode(mode)
            override fun requestImuRunning(running: Boolean, tripId: String?) {}
            override fun onTransitionTo(state: TripStateMachine.State, from: TripStateMachine.State) {
                TrackingLogger.shared.log(TrackingLogger.Level.info, "Standalone state: ${from.raw} → ${state.raw}")
            }
            override fun onStartTrip(tripId: String, startTime: Long, backfillStart: Long) {
                TrackingLogger.shared.log(TrackingLogger.Level.info, "Standalone trip started: $tripId")
            }
            override fun onEndTrip(tripId: String, endTime: Long) {
                TrackingLogger.shared.log(TrackingLogger.Level.info, "Standalone trip ended: $tripId")
            }
            override fun onLocationStored(tripId: String, lat: Double, lng: Double, accuracy: Double, speed: Double, timestamp: Long) {}
        }

        motion.delegate = object : MotionMonitorDelegate {
            override fun onActivityChanged(activity: MotionMonitor.Activity, confidence: MotionMonitor.Confidence, timestampMs: Long) {
                stateMachine.onMotionActivity(activity, confidence)
            }
            override fun onSustainedActivity(activity: MotionMonitor.Activity, forSeconds: Double) {
                stateMachine.onSustainedMotion(activity)
            }
            override fun onPermissionMissing(permission: String) {
                TrackingLogger.shared.log(TrackingLogger.Level.warn, "Standalone: missing permission $permission")
            }
        }

        location.delegate = object : LocationSessionDelegate {
            override fun onLocationReceived(loc: Location, mode: LocationSession.AccuracyMode) {
                stateMachine.onLocation(
                    loc.latitude, loc.longitude,
                    loc.accuracy.toDouble(), maxOf(loc.speed.toDouble(), 0.0), loc.time
                )
            }
            override fun onAuthorizationChanged(status: String) {}
            override fun onError(throwable: Throwable) {
                TrackingLogger.shared.log(TrackingLogger.Level.error, "Standalone location error: $throwable")
            }
        }

        val sustain = stateMachine.config.detectionSustainSeconds
        stateMachine.bind(motion)
        // Without the pedometer bound, detecting-state promotion has no step
        // corroboration and silently falls back to GPS-only (20 m accuracy gate) —
        // cold-start detection then fails whenever GPS is degraded.
        stateMachine.bindSensors(altimeter, pedometer)
        motion.watchSustain(MotionMonitor.Activity.WALKING,    sustain)
        motion.watchSustain(MotionMonitor.Activity.RUNNING,    sustain)
        motion.watchSustain(MotionMonitor.Activity.CYCLING,    sustain)
        motion.watchSustain(MotionMonitor.Activity.AUTOMOTIVE, sustain)

        standaloneMotion    = motion
        standaloneLocation  = location
        standalonePedometer = pedometer
        MotionMonitor.shared = motion

        motion.start()
        pedometer.start()
        stateMachine.rehydrateIfNeeded()

        Thread {
            try {
                val nowMs = System.currentTimeMillis()
                val covered = TrackingDatabase.shared.recentTripWindows(35 * 60 * 1000L, nowMs)
                val synthesized = stateMachine.reconcilerBackfill(nowMs, covered)
                for (syn in synthesized) {
                    val dist = syn.distanceM ?: continue
                    if (dist <= 0.0) continue
                    val id = "syn_${syn.startMs / 1000}"
                    TrackingDatabase.shared.insertSynthesizedTrip(
                        id, syn.startMs, syn.endMs,
                        if (syn.activity == MotionMonitor.Activity.WALKING) "walk" else "cycle",
                        dist, "gms_activity"
                    )
                }
            } catch (e: Exception) {
                TrackingLogger.shared.log(TrackingLogger.Level.error, "Standalone backfill failed: $e")
            }
        }.start()
    }

    private fun tearDownStandaloneInternal() = tearDownStandalone()

    // MARK: - Notification

    private fun createNotificationChannel() {
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Activity Tracking", NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Used while tracking your activity in the background"
                setShowBadge(false)
            }
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Tracking active")
            .setContentText("Radzi is recording your activity")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setSilent(true)
            .build()

    companion object {
        private const val CHANNEL_ID      = "radzi_tracking"
        private const val NOTIFICATION_ID = 1001

        @Volatile private var standaloneMotion:    MotionMonitor?   = null
        @Volatile private var standaloneLocation:  LocationSession? = null
        @Volatile private var standalonePedometer: PedometerSource? = null

        /**
         * Called by RadziTrackerModule.init() before it sets up its own stack, so the
         * standalone stack doesn't conflict with (or duplicate) the RN-managed one.
         * Note: any trip the standalone stack was recording stays 'active' in the DB —
         * the module's rehydrateIfNeeded() adopts it (it is fresh) and carries it on.
         */
        fun tearDownStandalone() {
            val motion = standaloneMotion ?: return
            motion.stop()
            standaloneLocation?.stopUpdatesOnly()
            standalonePedometer?.stop()
            if (MotionMonitor.shared === motion) MotionMonitor.shared = null
            standaloneMotion    = null
            standaloneLocation  = null
            standalonePedometer = null
        }

        fun start(context: Context) {
            context.startForegroundService(Intent(context, TrackingForegroundService::class.java))
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, TrackingForegroundService::class.java))
        }
    }
}
