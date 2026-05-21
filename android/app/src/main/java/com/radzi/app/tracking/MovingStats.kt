package com.radzi.app.tracking

object MovingStats {
    const val STATIONARY_THRESHOLD_MPS = 0.5

    data class Result(
        val totalDistanceM: Double,
        val movingDurationS: Int,
        val movingAvgSpeedKmh: Double?
    )

    fun compute(intervals: List<Pair<Double, Double>>): Result {
        var totalDistance = 0.0
        var movingSeconds = 0.0
        for ((distanceM, seconds) in intervals) {
            totalDistance += distanceM
            if (seconds > 0) {
                val speed = distanceM / seconds
                if (speed > STATIONARY_THRESHOLD_MPS) {
                    movingSeconds += seconds
                }
            }
        }
        val avg: Double? = if (movingSeconds > 0) (totalDistance / movingSeconds) * 3.6 else null
        return Result(
            totalDistanceM = totalDistance,
            movingDurationS = movingSeconds.roundToInt(),
            movingAvgSpeedKmh = avg
        )
    }

    private fun Double.roundToInt(): Int = kotlin.math.round(this).toInt()
}
