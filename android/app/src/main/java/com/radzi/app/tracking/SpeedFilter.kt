package com.radzi.app.tracking

enum class FilterableActivity {
    WALKING, RUNNING, CYCLING;

    val ceilingKmh: Double get() = when (this) {
        WALKING  -> 12.0
        RUNNING  -> 30.0
        CYCLING  -> 60.0
    }
}

object SpeedFilter {
    const val ACCURACY_THRESHOLD_M = 20.0

    /**
     * Returns the highest legitimate speed after:
     * 1. Drop points with horizontal accuracy > 20 m
     * 2. Drop points above the activity ceiling
     * 3. Drop spikes > 1.5× the local 95th percentile (±5-point window)
     * Returns null if fewer than 5 valid points remain.
     */
    fun maxSpeed(
        speedsKmh: List<Double>,
        horizontalAccuraciesM: List<Double>,
        activity: FilterableActivity
    ): Double? {
        require(speedsKmh.size == horizontalAccuraciesM.size)

        val accurate = speedsKmh.zip(horizontalAccuraciesM)
            .filter { (s, a) -> a <= ACCURACY_THRESHOLD_M && s <= activity.ceilingKmh }
            .map { (s, _) -> s }

        if (accurate.size < 5) return null

        val kept = mutableListOf<Double>()
        for (i in accurate.indices) {
            val lo = maxOf(0, i - 5)
            val hi = minOf(accurate.size - 1, i + 5)
            val window = accurate.subList(lo, hi + 1).sorted()
            val p95idx = ((window.size - 1) * 0.95).toInt()
            val p95 = window[p95idx]
            if (accurate[i] <= 1.5 * p95) {
                kept.add(accurate[i])
            }
        }

        if (kept.size < 5) return null
        return kept.max()
    }
}
