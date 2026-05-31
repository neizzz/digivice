package com.ch00n9h09.montto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
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
    fun `egg crack pixel size scales with enlarged widget bitmap`() {
        assertEquals(
            2,
            HomeWidgetSpriteRenderer.resolveEggCrackPixelSize(
                width = 54,
                height = 68,
            ),
        )
    }

    @Test
    fun `egg crack pixel size stays at one for base size bitmap`() {
        assertEquals(
            1,
            HomeWidgetSpriteRenderer.resolveEggCrackPixelSize(
                width = 32,
                height = 32,
            ),
        )
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
