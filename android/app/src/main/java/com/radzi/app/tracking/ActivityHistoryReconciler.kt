package com.radzi.app.tracking

/**
 * Android port of ActivityHistoryReconciler.swift.
 * iOS uses CMMotionActivityManager history; Android has no equivalent.
 * We read from the `motion_segments` rows we've persisted locally instead.
 */
class ActivityHistoryReconciler(
    private val motionSource: MotionHistorySource,
    private val pedometerSource: PedometerDistanceSource
) {

    private val minSegmentMs = 90_000L   // 90 s minimum segment

    data class SynthesizedSubTrip(
        val startMs: Long,
        val endMs: Long,
        val activity: MotionMonitor.Activity,
        val distanceM: Double?
    )

    fun reconcile(
        nowMs: Long,
        lookbackMinutes: Int,
        alreadyCovered: List<Pair<Long, Long>>
    ): List<SynthesizedSubTrip> {
        val fromMs = nowMs - lookbackMinutes * 60_000L
        val entries = motionSource.queryActivities(fromMs, nowMs)
        val segments = collapseAdjacent(entries, endMs = nowMs)
        val results = mutableListOf<SynthesizedSubTrip>()

        for (seg in segments) {
            if (seg.activity != MotionMonitor.Activity.WALKING && seg.activity != MotionMonitor.Activity.CYCLING) continue
            if (seg.endMs - seg.startMs < minSegmentMs) continue
            if (isCovered(seg, alreadyCovered)) continue

            val distanceM: Double? = if (seg.activity == MotionMonitor.Activity.WALKING)
                pedometerSource.distanceMeters(seg.startMs, seg.endMs)
            else null

            results.add(SynthesizedSubTrip(seg.startMs, seg.endMs, seg.activity, distanceM))
        }
        return results
    }

    private data class Segment(val startMs: Long, val endMs: Long, val activity: MotionMonitor.Activity)

    private fun collapseAdjacent(entries: List<MotionEntry>, endMs: Long): List<Segment> {
        if (entries.isEmpty()) return emptyList()
        val out = mutableListOf<Segment>()
        var currentStart = entries[0].timestampMs
        var currentActivity = entries[0].activity
        for (i in 1 until entries.size) {
            val kind = entries[i].activity
            if (kind != currentActivity) {
                out.add(Segment(currentStart, entries[i].timestampMs, currentActivity))
                currentStart = entries[i].timestampMs
                currentActivity = kind
            }
        }
        out.add(Segment(currentStart, endMs, currentActivity))
        return out
    }

    private fun isCovered(seg: Segment, covered: List<Pair<Long, Long>>): Boolean =
        covered.any { (cStart, cEnd) -> seg.startMs < cEnd && cStart < seg.endMs }
}

// Shared entry type for both production and test paths
data class MotionEntry(val timestampMs: Long, val activity: MotionMonitor.Activity)

// Interfaces for injection (production and test)
interface MotionHistorySource {
    fun queryActivities(fromMs: Long, toMs: Long): List<MotionEntry>
}

interface PedometerDistanceSource {
    fun distanceMeters(fromMs: Long, toMs: Long): Double?
}

/** Production: reads from motion_segments rows we wrote during recording. */
class DbMotionHistorySource : MotionHistorySource {
    override fun queryActivities(fromMs: Long, toMs: Long): List<MotionEntry> {
        if (!TrackingDatabase.isInitialized()) return emptyList()
        return try {
            val rawDb = TrackingDatabase.shared.rawSQLiteDb()
            rawDb.rawQuery(
                "SELECT t_start, activity FROM motion_segments WHERE t_start >= ? AND t_start <= ? ORDER BY t_start ASC",
                arrayOf(fromMs.toString(), toMs.toString())
            ).use { c ->
                val result = mutableListOf<MotionEntry>()
                while (c.moveToNext()) {
                    val tsMs = c.getLong(0)
                    val activityRaw = c.getString(1)
                    val activity = activityFromRaw(activityRaw)
                    result.add(MotionEntry(tsMs, activity))
                }
                result
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun activityFromRaw(raw: String): MotionMonitor.Activity = when (raw) {
        "walking"    -> MotionMonitor.Activity.WALKING
        "running"    -> MotionMonitor.Activity.RUNNING
        "cycling"    -> MotionMonitor.Activity.CYCLING
        "automotive" -> MotionMonitor.Activity.AUTOMOTIVE
        "stationary" -> MotionMonitor.Activity.STATIONARY
        else         -> MotionMonitor.Activity.UNKNOWN
    }
}

/** Production: Android step counter has no history query → returns null (distance unknown). */
class AndroidPedometerDistanceSource : PedometerDistanceSource {
    override fun distanceMeters(fromMs: Long, toMs: Long): Double? = null
}
