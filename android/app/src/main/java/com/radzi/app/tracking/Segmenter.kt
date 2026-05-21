package com.radzi.app.tracking

// DORMANT — DATA COLLECTION ONLY. Ported from iOS Segmenter.swift for parity.
// Not consumed by live classification on Android (same as iOS).
object Segmenter {

    enum class SegmentKind { ACTIVE, TRANSIT }

    enum class SegmentActivity {
        WALKING, RUNNING, CYCLING, AUTOMOTIVE, STATIONARY, UNKNOWN;

        val isActive: Boolean get() = this == WALKING || this == RUNNING || this == CYCLING
    }

    data class TimelinePoint(
        val timestampMs: Long,
        val activity: SegmentActivity,
        val speedKmh: Double?
    )

    data class Segment(
        val startMs: Long,
        val endMs: Long,
        val kind: SegmentKind,
        val activity: SegmentActivity
    )

    private const val TRANSIT_WINDOW_MS = 60_000L
    private const val TRANSIT_SPEED_THRESHOLD_KMH = 25.0
    private const val TRANSIT_SPEED_MIN_DURATION_MS = 30_000L

    fun split(timeline: List<TimelinePoint>): List<Segment> {
        if (timeline.size < 2) return emptyList()

        val segments = mutableListOf<Segment>()
        var windowStart = timeline[0].timestampMs
        var windowActivity = timeline[0].activity
        var windowPoints = mutableListOf(timeline[0])

        fun flush(toMs: Long) {
            if (windowStart >= toMs) return
            val durationMs = toMs - windowStart
            val isTransit = if (windowActivity.isActive) {
                false
            } else {
                durationMs >= TRANSIT_WINDOW_MS
            }

            val finalActivity: SegmentActivity
            if (windowActivity == SegmentActivity.UNKNOWN && windowPoints.size >= 2) {
                var sustainedHighSpeedMs = 0L
                for (i in 1 until windowPoints.size) {
                    val prev = windowPoints[i - 1]
                    val curr = windowPoints[i]
                    if ((prev.speedKmh ?: 0.0) > TRANSIT_SPEED_THRESHOLD_KMH &&
                        (curr.speedKmh ?: 0.0) > TRANSIT_SPEED_THRESHOLD_KMH
                    ) {
                        sustainedHighSpeedMs += curr.timestampMs - prev.timestampMs
                    }
                }
                finalActivity = if (sustainedHighSpeedMs >= TRANSIT_SPEED_MIN_DURATION_MS)
                    SegmentActivity.AUTOMOTIVE else SegmentActivity.UNKNOWN
            } else {
                finalActivity = windowActivity
            }

            segments.add(
                Segment(windowStart, toMs, if (isTransit) SegmentKind.TRANSIT else SegmentKind.ACTIVE, finalActivity)
            )
        }

        for (i in 1 until timeline.size) {
            val pt = timeline[i]
            if (pt.activity != windowActivity) {
                flush(pt.timestampMs)
                windowStart = pt.timestampMs
                windowActivity = pt.activity
                windowPoints = mutableListOf(pt)
            } else {
                windowPoints.add(pt)
            }
        }
        flush(timeline.last().timestampMs)
        return segments
    }
}
