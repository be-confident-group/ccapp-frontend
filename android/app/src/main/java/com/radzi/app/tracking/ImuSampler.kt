package com.radzi.app.tracking

// DORMANT — DATA COLLECTION ONLY. NOT IN LIVE CLASSIFICATION PATH.
//
// Samples accelerometer + gyroscope at ~50 Hz using SensorManager during
// active trip recording. Batches 60 s of raw IMU data and flushes each batch
// into the sensor_batches table via TrackingDatabase.
//
// This data is training input for the XGBoost model and is NOT consumed
// during live trip classification. Trip type is determined by Activity
// Recognition (ActivityRecognitionClient) via MotionMonitor / TripStateMachine.

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.HandlerThread
import org.json.JSONArray
import org.json.JSONObject

class ImuSampler(context: Context) {

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val accelSensor: Sensor? = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private val gyroSensor:  Sensor? = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)

    private val bufferLock = Any()
    private val bufferAcc  = mutableListOf<LongArray>()  // [t, ax*1e6, ay*1e6, az*1e6]
    private val bufferGyro = mutableListOf<LongArray>()  // [t, gx*1e6, gy*1e6, gz*1e6]

    private var batchSeq = 0
    private var tripId: String? = null
    var isRunning = false
        private set

    private val sensorThread = HandlerThread("imu-sampler").also { it.start() }
    private val sensorHandler = Handler(sensorThread.looper)
    private val flushHandler  = Handler(sensorThread.looper)
    private var flushRunnable: Runnable? = null

    private val accelListener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
            val t = System.currentTimeMillis()
            synchronized(bufferLock) {
                bufferAcc.add(longArrayOf(t,
                    (event.values[0] * 1e6).toLong(),
                    (event.values[1] * 1e6).toLong(),
                    (event.values[2] * 1e6).toLong()))
            }
        }
        override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) {}
    }

    private val gyroListener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
            val t = System.currentTimeMillis()
            synchronized(bufferLock) {
                bufferGyro.add(longArrayOf(t,
                    (event.values[0] * 1e6).toLong(),
                    (event.values[1] * 1e6).toLong(),
                    (event.values[2] * 1e6).toLong()))
            }
        }
        override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) {}
    }

    fun attach(tripId: String) {
        this.tripId = tripId
        this.batchSeq = 0
    }

    fun start() {
        if (isRunning || accelSensor == null || gyroSensor == null) {
            TrackingLogger.shared.log(TrackingLogger.Level.warn, "ImuSampler: sensors unavailable")
            return
        }
        isRunning = true
        sensorManager.registerListener(accelListener, accelSensor, SensorManager.SENSOR_DELAY_GAME, sensorHandler)
        sensorManager.registerListener(gyroListener,  gyroSensor,  SensorManager.SENSOR_DELAY_GAME, sensorHandler)
        scheduleFlush()
        TrackingLogger.shared.log(TrackingLogger.Level.info, "ImuSampler: started @ ~50 Hz")
    }

    fun pause() {
        if (!isRunning) return
        sensorManager.unregisterListener(accelListener)
        sensorManager.unregisterListener(gyroListener)
        flushRunnable?.let { flushHandler.removeCallbacks(it) }
        flushRunnable = null
        isRunning = false
        flush()
        TrackingLogger.shared.log(TrackingLogger.Level.info, "ImuSampler: paused")
    }

    private fun scheduleFlush() {
        val r = Runnable {
            flush()
            scheduleFlush()
        }
        flushRunnable = r
        flushHandler.postDelayed(r, 60_000L)
    }

    private fun flush() {
        val accSnap: List<LongArray>
        val gyroSnap: List<LongArray>
        synchronized(bufferLock) {
            accSnap  = bufferAcc.toList()
            gyroSnap = bufferGyro.toList()
            bufferAcc.clear()
            bufferGyro.clear()
        }
        val id = tripId ?: return
        if (accSnap.isEmpty() && gyroSnap.isEmpty()) return

        val interleaved = JSONArray()
        var gi = 0
        for (a in accSnap) {
            while (gi + 1 < gyroSnap.size) {
                val gNext = gyroSnap[gi + 1][0]
                val gCur  = gyroSnap[gi][0]
                if (Math.abs(gNext - a[0]) <= Math.abs(gCur - a[0])) gi++ else break
            }
            val g = if (gi < gyroSnap.size) gyroSnap[gi] else longArrayOf(a[0], 0, 0, 0)
            interleaved.put(JSONObject().apply {
                put("t",  a[0])
                put("ax", a[1] / 1e6); put("ay", a[2] / 1e6); put("az", a[3] / 1e6)
                put("gx", g[1] / 1e6); put("gy", g[2] / 1e6); put("gz", g[3] / 1e6)
            })
        }

        try {
            val payload = JSONObject().put("data", interleaved).toString()
            TrackingDatabase.shared.insertSensorBatch(id, batchSeq, payload)
            batchSeq++
        } catch (e: Exception) {
            TrackingLogger.shared.log(TrackingLogger.Level.error, "ImuSampler: flush failed — $e")
        }
    }

    companion object {
        const val sampleRateHz: Double = 50.0
    }
}
