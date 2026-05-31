package com.ch00n9h09.montto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeWidgetPeriodicRefreshWorkerTest {
    @Test
    fun `runner cancels schedule when widgets are absent`() {
        val events = mutableListOf<String>()

        val updated = HomeWidgetPeriodicRefreshRunner.run(
            hasAnyWidgets = { false },
            onNoWidgets = {
                events += "cancel"
            },
            progressSnapshot = {
                events += "progress"
                null
            },
            notifySnapshotUpdated = { reason ->
                events += "notify:$reason"
            },
        )

        assertFalse(updated)
        assertEquals(listOf("cancel"), events)
    }

    @Test
    fun `runner progresses snapshot and notifies when widgets are present`() {
        val events = mutableListOf<String>()

        val updated = HomeWidgetPeriodicRefreshRunner.run(
            hasAnyWidgets = { true },
            onNoWidgets = {
                events += "cancel"
            },
            progressSnapshot = {
                events += "progress"
                HomeWidgetDebugPresets.resolveSnapshot(index = 1, nowMs = 10_000L)
            },
            notifySnapshotUpdated = { reason ->
                events += "notify:$reason"
            },
        )

        assertTrue(updated)
        assertEquals(
            listOf(
                "progress",
                "notify:${HomeWidgetConstants.PERIODIC_REFRESH_REASON}",
            ),
            events,
        )
    }

    @Test
    fun `hasAnyWidgets returns true when either size exists`() {
        assertTrue(
            HomeWidgetPeriodicRefreshScheduler.hasAnyWidgets(
                homeWidgetIds = intArrayOf(),
                homeWidget1x1Ids = intArrayOf(101),
            ),
        )
        assertTrue(
            HomeWidgetPeriodicRefreshScheduler.hasAnyWidgets(
                homeWidgetIds = intArrayOf(7),
                homeWidget1x1Ids = intArrayOf(),
            ),
        )
        assertFalse(
            HomeWidgetPeriodicRefreshScheduler.hasAnyWidgets(
                homeWidgetIds = intArrayOf(),
                homeWidget1x1Ids = intArrayOf(),
            ),
        )
    }
}
