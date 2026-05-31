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
}
