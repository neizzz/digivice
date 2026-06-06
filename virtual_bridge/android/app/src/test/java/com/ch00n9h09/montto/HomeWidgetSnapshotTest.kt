package com.ch00n9h09.montto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeWidgetSnapshotTest {
    @Test
    fun `temporary widget status icons are filtered out`() {
        val icons = HomeWidgetSnapshot.sanitizeVisibleStatusIconsForWidget(
            characterState = "idle",
            iconNames = listOf("sick", "discover", "happy", "sleeping", "sick"),
        )

        assertEquals(listOf("sick", "sleeping"), icons)
    }

    @Test
    fun `dead widget status icons are cleared`() {
        val icons = HomeWidgetSnapshot.sanitizeVisibleStatusIconsForWidget(
            characterState = "dead",
            iconNames = listOf("sick", "discover"),
        )

        assertEquals(emptyList<String>(), icons)
    }

    @Test
    fun `mature egg snapshot is detected for authoritative refresh`() {
        val nowMs = 10_000L
        val snapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 0, nowMs = nowMs).copy(
            eggHatchTimeMs = nowMs - 1L,
            eggHatchDurationMs = 30_000L,
            eggCrackStage = 3,
        )

        assertTrue(HomeWidgetSnapshotFactory.isEggMaturedPastHatchTime(snapshot, nowMs))
    }

    @Test
    fun `future hatch egg snapshot does not request authoritative refresh yet`() {
        val nowMs = 10_000L
        val snapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 0, nowMs = nowMs).copy(
            eggHatchTimeMs = nowMs + 60_000L,
            eggHatchDurationMs = 60_000L,
            eggCrackStage = 1,
        )

        assertFalse(HomeWidgetSnapshotFactory.isEggMaturedPastHatchTime(snapshot, nowMs))
    }



    @Test
    fun `stale non egg authoritative snapshot requests native refresh`() {
        val nowMs = 20 * 60 * 1000L
        val snapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 1, nowMs = nowMs).copy(
            snapshotKind = "authoritativeAppState",
            snapshotComputedAtMs = nowMs -
                (HomeWidgetConstants.PERIODIC_REFRESH_INTERVAL_MINUTES * 60 * 1000L),
            updatedAtMs = nowMs -
                (HomeWidgetConstants.PERIODIC_REFRESH_INTERVAL_MINUTES * 60 * 1000L),
        )

        assertTrue(HomeWidgetSnapshotFactory.isAuthoritativeSnapshotStale(snapshot, nowMs))
        assertTrue(
            HomeWidgetSnapshotFactory.requiresAuthoritativeRefresh(
                currentSnapshot = snapshot.copy(snapshotKind = "widgetProgressed"),
                authoritativeSnapshot = snapshot,
                nowMs = nowMs,
            ),
        )
    }

    @Test
    fun `fresh non egg authoritative snapshot stays on progress only path`() {
        val nowMs = 20 * 60 * 1000L
        val snapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 1, nowMs = nowMs).copy(
            snapshotKind = "authoritativeAppState",
            snapshotComputedAtMs = nowMs,
            updatedAtMs = nowMs,
        )

        assertFalse(HomeWidgetSnapshotFactory.isAuthoritativeSnapshotStale(snapshot, nowMs))
        assertFalse(
            HomeWidgetSnapshotFactory.requiresAuthoritativeRefresh(
                currentSnapshot = snapshot.copy(snapshotKind = "widgetProgressed"),
                authoritativeSnapshot = snapshot,
                nowMs = nowMs,
            ),
        )
    }

    @Test
    fun `resolved authoritative character snapshot suppresses hidden refresh request`() {
        val nowMs = 10_000L
        val currentSnapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 0, nowMs = nowMs).copy(
            eggHatchTimeMs = nowMs - 1L,
            eggHatchDurationMs = 30_000L,
            eggCrackStage = 3,
        )
        val authoritativeSnapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 1, nowMs = nowMs).copy(
            snapshotKind = "authoritativeAppState",
            snapshotComputedAtMs = nowMs,
            updatedAtMs = nowMs,
        )

        assertFalse(
            HomeWidgetSnapshotFactory.requiresAuthoritativeRefresh(
                currentSnapshot = currentSnapshot,
                authoritativeSnapshot = authoritativeSnapshot,
                nowMs = nowMs,
            ),
        )
    }
}
