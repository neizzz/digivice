package com.ch00n9h09.montto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeWidgetSpriteRendererTest {
    @Test
    fun `egg representative frame visible bounds are trimmed`() {
        val pixels = alphaMask(
            width = 8,
            height = 8,
            opaquePoints = buildRectPoints(left = 2, top = 1, right = 4, bottom = 5),
        )

        val bounds = HomeWidgetSpriteRenderer.resolveVisibleBounds(
            width = 8,
            height = 8,
            pixels = pixels,
        )

        assertNotNull(bounds)
        assertEquals(2, bounds?.left)
        assertEquals(1, bounds?.top)
        assertEquals(4, bounds?.right)
        assertEquals(5, bounds?.bottom)
        assertEquals(3, bounds?.width)
        assertEquals(5, bounds?.height)
    }

    @Test
    fun `monster idle representative frame visible bounds are trimmed`() {
        val pixels = alphaMask(
            width = 10,
            height = 10,
            opaquePoints = buildRectPoints(left = 3, top = 4, right = 7, bottom = 8),
        )

        val bounds = HomeWidgetSpriteRenderer.resolveVisibleBounds(
            width = 10,
            height = 10,
            pixels = pixels,
        )

        assertNotNull(bounds)
        assertEquals(5, bounds?.width)
        assertEquals(5, bounds?.height)
    }

    @Test
    fun `scaled width is calculated from target visible width`() {
        val scaleMultiplier = HomeWidgetSpriteRenderer.resolveScaleMultiplier(
            referenceVisibleWidthPx = 15,
            targetVisibleWidthPx = 54,
        )

        val scaledVisibleWidth = HomeWidgetSpriteRenderer.resolveScaledDimension(
            sizePx = 15,
            scaleMultiplier = scaleMultiplier,
        )
        val scaledFrameWidth = HomeWidgetSpriteRenderer.resolveScaledDimension(
            sizePx = 19,
            scaleMultiplier = scaleMultiplier,
        )

        assertEquals(54, scaledVisibleWidth)
        assertEquals(69, scaledFrameWidth)
    }

    @Test
    fun `loop frames reuse the same scale multiplier`() {
        val sharedScaleMultiplier = HomeWidgetSpriteRenderer.resolveScaleMultiplier(
            referenceVisibleWidthPx = 17,
            targetVisibleWidthPx = 54,
        )

        val idle0Width = HomeWidgetSpriteRenderer.resolveScaledDimension(
            sizePx = 17,
            scaleMultiplier = sharedScaleMultiplier,
        )
        val idle1Width = HomeWidgetSpriteRenderer.resolveScaledDimension(
            sizePx = 16,
            scaleMultiplier = sharedScaleMultiplier,
        )

        assertEquals(54, idle0Width)
        assertEquals(51, idle1Width)
    }

    @Test
    fun `scale multiplier does not shrink frames already above minimum visible width`() {
        val scaleMultiplier = HomeWidgetSpriteRenderer.resolveScaleMultiplier(
            referenceVisibleWidthPx = 70,
            targetVisibleWidthPx = 54,
        )

        assertEquals(1f, scaleMultiplier)
    }

    @Test
    fun `sick sleeping widget snapshot renders as single sick frame`() {
        val snapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 4, nowMs = 10_000L)
            .copy(displayState = "sleep")

        assertEquals("sleeping", snapshot.characterState)
        assertEquals(listOf("sick", "sleeping"), snapshot.visibleStatusIcons)
        assertEquals(1, HomeWidgetSpriteRenderer.resolveFrameCount(snapshot))
    }

    @Test
    fun `egg crack overlay applies only to egg stages above zero`() {
        assertFalse(HomeWidgetSpriteRenderer.shouldApplyEggCrackOverlay("egg", 0))
        assertTrue(HomeWidgetSpriteRenderer.shouldApplyEggCrackOverlay("egg", 1))
        assertTrue(HomeWidgetSpriteRenderer.shouldApplyEggCrackOverlay("egg", 2))
        assertTrue(HomeWidgetSpriteRenderer.shouldApplyEggCrackOverlay("egg", 3))
        assertFalse(HomeWidgetSpriteRenderer.shouldApplyEggCrackOverlay("idle", 3))
    }

    @Test
    fun `egg crack pixels stay empty at stage zero and expand with later stages`() {
        val stage0 = HomeWidgetSpriteRenderer.resolveEggCrackPixels(width = 32, height = 32, stage = 0)
        val stage1 = HomeWidgetSpriteRenderer.resolveEggCrackPixels(width = 32, height = 32, stage = 1)
        val stage2 = HomeWidgetSpriteRenderer.resolveEggCrackPixels(width = 32, height = 32, stage = 2)
        val stage3 = HomeWidgetSpriteRenderer.resolveEggCrackPixels(width = 32, height = 32, stage = 3)

        assertTrue(stage0.isEmpty())
        assertEquals(6, stage1.size)
        assertEquals(15, stage2.size)
        assertEquals(40, stage3.size)
        assertTrue(stage2.containsAll(stage1))
        assertTrue(stage3.containsAll(stage2))
    }

    @Test
    fun `stage 3 crack pixels match app rounding semantics at representative branches`() {
        val stage3 = HomeWidgetSpriteRenderer.resolveEggCrackPixels(width = 32, height = 32, stage = 3)

        listOf(
            15 to 15,
            16 to 16,
            21 to 12,
            12 to 19,
            16 to 10,
            10 to 24,
        ).forEach { pixel ->
            assertTrue("missing app pixel $pixel", stage3.contains(pixel))
        }

        listOf(
            16 to 17,
            18 to 13,
            15 to 10,
        ).forEach { pixel ->
            assertFalse("unexpected truncated pixel $pixel", stage3.contains(pixel))
        }
    }

    private fun alphaMask(
        width: Int,
        height: Int,
        opaquePoints: Set<Pair<Int, Int>>,
    ): IntArray {
        return IntArray(width * height) { index ->
            val x = index % width
            val y = index / width
            if ((x to y) in opaquePoints) {
                0xFF000000.toInt()
            } else {
                0x00000000
            }
        }
    }

    private fun buildRectPoints(
        left: Int,
        top: Int,
        right: Int,
        bottom: Int,
    ): Set<Pair<Int, Int>> {
        return buildSet {
            for (y in top..bottom) {
                for (x in left..right) {
                    add(x to y)
                }
            }
        }
    }
}
