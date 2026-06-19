package com.radzi.app.tracking

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager

class AltimeterMonitor(context: Context) {

    data class Aggregate(val gainMeters: Double?, val lossMeters: Double?)

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val pressureSensor: Sensor? = sensorManager.getDefaultSensor(Sensor.TYPE_PRESSURE)

    private val samples = mutableListOf<Pair<Long, Float>>() // (timestampMs, pressure hPa)
    private val lock = Any()
    private var baselineAltitudeM: Float? = null

    val isAvailable: Boolean get() = pressureSensor != null

    private val listener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
            val pressureHpa = event.values[0]
            val altM = SensorManager.getAltitude(SensorManager.PRESSURE_STANDARD_ATMOSPHERE, pressureHpa)
            synchronized(lock) {
                if (baselineAltitudeM == null) baselineAltitudeM = altM
                val relative = altM - (baselineAltitudeM ?: altM)
                samples.add(Pair(System.currentTimeMillis(), relative))
            }
        }
        override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) {}
    }

    fun start() {
        if (!isAvailable) return
        baselineAltitudeM = null
        pressureSensor?.let { sensorManager.registerListener(listener, it, SensorManager.SENSOR_DELAY_NORMAL) }
    }

    fun stopAndDrain(): List<Pair<Long, Double>> {
        sensorManager.unregisterListener(listener)
        return synchronized(lock) {
            val drained = samples.map { (ts, alt) -> Pair(ts, alt.toDouble()) }
            samples.clear()
            baselineAltitudeM = null
            drained
        }
    }

    companion object {
        /** 3 m dead-band: only commit gain/loss once altitude moves >= 3 m from the
         *  last baseline. The pressure sensor at SENSOR_DELAY_NORMAL produces thousands
         *  of +-1-4 m jitter samples per trip; a naive delta sum accumulates them into
         *  absurd totals (observed: 17,149 m gain on a 533 m walk). */
        private const val DEAD_BAND_M = 3.0

        fun aggregate(samples: List<Pair<Long, Double>>): Aggregate {
            if (samples.size < 3) return Aggregate(null, null)
            var gain = 0.0
            var loss = 0.0
            var baseline = samples[0].second
            for (i in 1 until samples.size) {
                val diff = samples[i].second - baseline
                if (diff >= DEAD_BAND_M) {
                    gain += diff
                    baseline = samples[i].second
                } else if (diff <= -DEAD_BAND_M) {
                    loss += -diff
                    baseline = samples[i].second
                }
            }
            return Aggregate(gain, loss)
        }
    }
}
