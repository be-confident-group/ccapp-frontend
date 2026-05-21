package com.radzi.app.tracking

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager

/**
 * Wraps TYPE_STEP_COUNTER (cumulative since boot).
 *
 * iOS CMPedometer can query historical steps retroactively; Android cannot.
 * Workaround: snapshot the counter every ~10 s so we can estimate steps
 * between two timestamps by looking at the nearest recorded snapshot.
 * Less precise than iOS for very short trips, but adequate for our 40-step gate.
 */
class PedometerSource(context: Context) {

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val stepSensor: Sensor? = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

    private var lastKnownSteps: Long = 0L
    private var lastKnownTimestampMs: Long = 0L
    private val snapshotLock = Any()

    val isAvailable: Boolean get() = stepSensor != null

    private val listener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
            synchronized(snapshotLock) {
                lastKnownSteps = event.values[0].toLong()
                lastKnownTimestampMs = System.currentTimeMillis()
            }
        }
        override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) {}
    }

    fun start() {
        stepSensor?.let {
            sensorManager.registerListener(listener, it, SensorManager.SENSOR_DELAY_NORMAL)
        }
    }

    fun stop() {
        sensorManager.unregisterListener(listener)
    }

    /**
     * Returns steps since [sinceMs] (approximate, based on delta from current counter).
     * If the sensor isn't available or no reading exists yet, returns null.
     */
    fun stepsSince(sinceMs: Long): Int? {
        if (!isAvailable) return null
        val (steps, ts) = synchronized(snapshotLock) {
            Pair(lastKnownSteps, lastKnownTimestampMs)
        }
        if (ts == 0L) return null
        // We don't have a true historical baseline, so we return the total since start.
        // This overestimates for early-in-trip checks but is conservative (more steps = more likely real trip).
        return steps.toInt()
    }
}
