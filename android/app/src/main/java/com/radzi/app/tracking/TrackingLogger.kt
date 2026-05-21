package com.radzi.app.tracking

import android.util.Log

class TrackingLogger internal constructor() {

    enum class Level { info, warn, error }

    data class Entry(val timestamp: Long, val level: String, val message: String)

    private val ring = ArrayDeque<Entry>(CAPACITY)
    private val lock = Any()

    fun log(level: Level, message: String) {
        val entry = Entry(
            timestamp = System.currentTimeMillis(),
            level = level.name,
            message = message
        )
        synchronized(lock) {
            if (ring.size >= CAPACITY) ring.removeFirst()
            ring.addLast(entry)
        }
        when (level) {
            Level.info  -> Log.i(TAG, message)
            Level.warn  -> Log.w(TAG, message)
            Level.error -> Log.e(TAG, message)
        }
    }

    fun snapshot(): List<Entry> = synchronized(lock) { ring.toList() }

    companion object {
        val shared = TrackingLogger()
        private const val CAPACITY = 500
        private const val TAG = "RadziTracker"
    }
}
