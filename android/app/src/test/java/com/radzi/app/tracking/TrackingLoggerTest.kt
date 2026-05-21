package com.radzi.app.tracking

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30], application = android.app.Application::class)

class TrackingLoggerTest {

    private lateinit var logger: TrackingLogger

    @Before
    fun setup() {
        logger = TrackingLogger()
    }

    @Test
    fun `ring buffer caps at 500 entries`() {
        repeat(600) { i -> logger.log(TrackingLogger.Level.info, "msg $i") }
        val snap = logger.snapshot()
        assertEquals(500, snap.size)
    }

    @Test
    fun `oldest entries are evicted first`() {
        repeat(600) { i -> logger.log(TrackingLogger.Level.info, "msg $i") }
        val snap = logger.snapshot()
        assertEquals("msg 100", snap.first().message)
        assertEquals("msg 599", snap.last().message)
    }

    @Test
    fun `snapshot below capacity returns all entries`() {
        repeat(10) { logger.log(TrackingLogger.Level.warn, "w") }
        assertEquals(10, logger.snapshot().size)
    }

    @Test
    fun `level is recorded correctly`() {
        logger.log(TrackingLogger.Level.error, "boom")
        val entry = logger.snapshot().first()
        assertEquals("error", entry.level)
        assertEquals("boom", entry.message)
        assertTrue(entry.timestamp > 0)
    }
}
