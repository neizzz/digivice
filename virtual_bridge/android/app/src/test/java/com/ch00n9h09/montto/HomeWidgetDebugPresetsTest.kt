package com.ch00n9h09.montto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeWidgetDebugPresetsTest {
    @Test
    fun `next from zero advances to one`() {
        assertEquals(1, HomeWidgetDebugPresets.wrapIndex(currentIndex = 0, step = 1))
    }

    @Test
    fun `next from last wraps to first`() {
        assertEquals(
            0,
            HomeWidgetDebugPresets.wrapIndex(
                currentIndex = HomeWidgetDebugPresets.count - 1,
                step = 1,
            ),
        )
    }

    @Test
    fun `prev from zero wraps to last`() {
        assertEquals(
            HomeWidgetDebugPresets.count - 1,
            HomeWidgetDebugPresets.wrapIndex(currentIndex = 0, step = -1),
        )
    }

    @Test
    fun `debug override is ignored when debug mode is off`() {
        val nowMs = 1_717_171_717L
        val debugSnapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 6, nowMs = nowMs)
        val currentSnapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 1, nowMs = nowMs)

        val selected = HomeWidgetSnapshotSelector.select(
            debugModeEnabled = false,
            debugOverrideSnapshot = debugSnapshot,
            currentSnapshot = currentSnapshot,
            authoritativeSnapshot = null,
            worldDataFallback = { null },
        )

        assertEquals(currentSnapshot, selected)
    }

    @Test
    fun `preset background variants follow character phase`() {
        val expectations = listOf(
            0 to HomeWidgetBackgroundVariant.BROWN,
            1 to HomeWidgetBackgroundVariant.BROWN,
            2 to HomeWidgetBackgroundVariant.BLUE,
            3 to HomeWidgetBackgroundVariant.GREEN,
            4 to HomeWidgetBackgroundVariant.GREEN,
            5 to HomeWidgetBackgroundVariant.GREEN,
            6 to HomeWidgetBackgroundVariant.RED,
            7 to HomeWidgetBackgroundVariant.RED,
            8 to HomeWidgetBackgroundVariant.BLUE,
        )

        expectations.forEach { (index, expectedVariant) ->
            val snapshot = HomeWidgetDebugPresets.resolveSnapshot(index = index, nowMs = 1000L)
            assertNotNull(snapshot)
            assertEquals(expectedVariant, snapshot.resolveBackgroundVariant())
        }
    }

    @Test
    fun `sick sleep preset contains multiple status icons`() {
        val preset = HomeWidgetDebugPresets.resolvePresetByKey("sick_sleep")
        assertNotNull(preset)
        assertEquals(listOf("sick", "sleeping"), preset?.visibleStatusIcons)
        assertEquals("sleep", preset?.displayState)
    }

    @Test
    fun `urgent preset no longer uses discover icon`() {
        val preset = HomeWidgetDebugPresets.resolvePresetByKey("urgent")
        assertNotNull(preset)
        assertTrue(preset?.hasUrgentStatus == true)
        assertFalse(preset?.visibleStatusIcons?.contains("discover") == true)
    }
}
