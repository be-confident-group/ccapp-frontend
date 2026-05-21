package com.radzi.app.tracking

import org.junit.Assert.*
import org.junit.Test

class MovingStatsTest {

    @Test
    fun `excludes stationary gaps from moving duration`() {
        val intervals = listOf(
            Pair(5.0, 1.0), Pair(5.0, 1.0), Pair(5.0, 1.0),
            Pair(0.1, 1000.0), // stationary gap
            Pair(5.0, 1.0), Pair(5.0, 1.0)
        )
        val stats = MovingStats.compute(intervals)
        assertEquals(5, stats.movingDurationS)
        assertEquals(25.1, stats.totalDistanceM, 0.001)
        assertEquals(18.07, stats.movingAvgSpeedKmh ?: 0.0, 0.1)
    }

    @Test
    fun `returns null avg when no movement`() {
        val intervals = listOf(Pair(0.1, 100.0), Pair(0.1, 100.0))
        val stats = MovingStats.compute(intervals)
        assertNull(stats.movingAvgSpeedKmh)
        assertEquals(0, stats.movingDurationS)
    }
}
