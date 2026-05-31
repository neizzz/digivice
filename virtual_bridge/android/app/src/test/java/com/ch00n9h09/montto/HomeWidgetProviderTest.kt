package com.ch00n9h09.montto

import org.junit.Assert.assertEquals
import org.junit.Test

class HomeWidgetProviderTest {
    @Test
    fun `live action disables override and updates widgets`() {
        val events = mutableListOf<String>()

        val handled = HomeWidgetBroadcastActionHandler.handle(
            action = HomeWidgetConstants.ACTION_DEBUG_PRESET_LIVE,
            onRefresh = {
                events += "refresh"
            },
            onAdvancePreset = { step ->
                events += "advance:$step"
            },
            onDisableOverride = {
                events += "disable"
            },
            onUpdateAllWidgets = {
                events += "update"
            },
        )

        assertEquals(true, handled)
        assertEquals(listOf("disable", "update"), events)
    }

    @Test
    fun `1x1 target visible width resolves to 54px for 90px widget width`() {
        assertEquals(
            54,
            HomeWidgetLayoutSizing.resolveOneByOneCharacterTargetVisibleWidthPx(90),
        )
    }

    @Test
    fun `1x1 target visible width keeps 60 percent ratio for larger width`() {
        assertEquals(
            72,
            HomeWidgetLayoutSizing.resolveOneByOneCharacterTargetVisibleWidthPx(120),
        )
    }

    @Test
    fun `widget dimension falls back to 90dp when widget options are absent`() {
        assertEquals(
            90,
            HomeWidgetLayoutSizing.resolveWidgetDimensionDp(
                minDp = 0,
                maxDp = 0,
                fallbackDp = 90,
            ),
        )
    }

    @Test
    fun `widget dimension prefers actual widget options over larger fallback`() {
        assertEquals(
            74,
            HomeWidgetLayoutSizing.resolveWidgetDimensionDp(
                minDp = 74,
                maxDp = 74,
                fallbackDp = 90,
            ),
        )
    }
}
