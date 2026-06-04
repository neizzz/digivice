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
                renderMode = WidgetRenderMode.LIVE_WIDGET,
            ),
        )
    }

    @Test
    fun `1x1 live widget path prefers actual widget options over picker preview override`() {
        assertEquals(
            74,
            HomeWidgetLayoutSizing.resolveWidgetDimensionDp(
                minDp = 74,
                maxDp = 70,
                fallbackDp = 90,
                renderMode = WidgetRenderMode.LIVE_WIDGET,
                previewOverrideDp = 60,
            ),
        )
    }

    @Test
    fun `1x1 picker preview path uses fixed 74dp width without widget options`() {
        assertEquals(
            74,
            HomeWidgetLayoutSizing.resolveWidgetDimensionDp(
                minDp = 0,
                maxDp = 0,
                fallbackDp = 90,
                renderMode = WidgetRenderMode.PICKER_PREVIEW,
                previewOverrideDp = 74,
            ),
        )
    }

    @Test
    fun `1x1 picker preview egg target visible width uses live 1x1 baseline`() {
        val widgetWidthPx = HomeWidgetLayoutSizing.resolveOneByOneCharacterReferenceWidthPx(
            renderMode = WidgetRenderMode.PICKER_PREVIEW,
            characterState = "egg",
            liveWidgetMinWidthPx = 50,
            resolvedWidgetWidthPx = 74,
        )

        assertEquals(
            30,
            HomeWidgetLayoutSizing.resolveOneByOneCharacterTargetVisibleWidthPx(widgetWidthPx),
        )
    }

    @Test
    fun `1x1 picker preview non egg target visible width keeps 74px preview width`() {
        val widgetWidthPx = HomeWidgetLayoutSizing.resolveOneByOneCharacterReferenceWidthPx(
            renderMode = WidgetRenderMode.PICKER_PREVIEW,
            characterState = "idle",
            liveWidgetMinWidthPx = 50,
            resolvedWidgetWidthPx = 74,
        )

        assertEquals(
            45,
            HomeWidgetLayoutSizing.resolveOneByOneCharacterTargetVisibleWidthPx(widgetWidthPx),
        )
    }

    @Test
    fun `1x1 live widget path keeps resolved width even for egg state`() {
        val widgetWidthPx = HomeWidgetLayoutSizing.resolveOneByOneCharacterReferenceWidthPx(
            renderMode = WidgetRenderMode.LIVE_WIDGET,
            characterState = "egg",
            liveWidgetMinWidthPx = 50,
            resolvedWidgetWidthPx = 74,
        )

        assertEquals(
            45,
            HomeWidgetLayoutSizing.resolveOneByOneCharacterTargetVisibleWidthPx(widgetWidthPx),
        )
    }

    @Test
    fun `2x1 picker preview path keeps existing fallback sizing`() {
        assertEquals(
            180,
            HomeWidgetLayoutSizing.resolveWidgetDimensionDp(
                minDp = 0,
                maxDp = 0,
                fallbackDp = 180,
                renderMode = WidgetRenderMode.PICKER_PREVIEW,
            ),
        )
    }
}
