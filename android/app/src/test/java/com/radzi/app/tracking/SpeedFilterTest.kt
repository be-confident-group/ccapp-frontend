package com.radzi.app.tracking

import org.junit.Assert.*
import org.junit.Test

class SpeedFilterTest {

    @Test
    fun `drops spike and preserves real peak for cycling`() {
        val speeds = listOf(12.0, 14.0, 15.0, 16.0, 14.0, 509.8, 18.0, 17.0, 16.0, 15.0, 14.0, 13.0)
        val accs   = List(12) { 5.0 }
        val result = SpeedFilter.maxSpeed(speeds, accs, FilterableActivity.CYCLING)
        assertNotNull(result)
        assertTrue("spike should be rejected — result was $result", result!! < 25.0)
        assertTrue("real peak should be preserved — result was $result", result > 16.0)
    }

    @Test
    fun `returns null with fewer than 5 valid points`() {
        val result = SpeedFilter.maxSpeed(
            listOf(10.0, 12.0, 11.0), listOf(5.0, 5.0, 5.0), FilterableActivity.WALKING
        )
        assertNull(result)
    }

    @Test
    fun `returns null when all speeds exceed ceiling`() {
        val speeds = List(10) { 80.0 }
        val accs   = List(10) { 5.0 }
        val result = SpeedFilter.maxSpeed(speeds, accs, FilterableActivity.CYCLING)
        assertNull(result) // 80 > 60 ceiling
    }

    @Test
    fun `drops bad-accuracy outlier`() {
        val speeds    = listOf(12.0, 14.0, 15.0, 80.0, 14.0, 13.0, 12.0, 11.0, 10.0, 9.0)
        val accuracies = listOf(5.0,  5.0,  5.0, 50.0,  5.0,  5.0,  5.0,  5.0,  5.0, 5.0)
        val result = SpeedFilter.maxSpeed(speeds, accuracies, FilterableActivity.CYCLING)
        assertNotNull(result)
        assertTrue("high-accuracy outlier should be dropped — result was $result", result!! < 20.0)
    }
}
