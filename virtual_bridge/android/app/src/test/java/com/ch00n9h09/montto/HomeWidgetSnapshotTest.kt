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
    fun `sick status takes display priority over sleeping when loading snapshot`() {
        val rawSnapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 4, nowMs = 10_000L)
            .copy(displayState = "sleep")
            .toJsonString()

        val snapshot = HomeWidgetSnapshot.fromJson(rawSnapshot)

        assertEquals("sleeping", snapshot?.characterState)
        assertEquals(listOf("sick", "sleeping"), snapshot?.visibleStatusIcons)
        assertEquals("sick", snapshot?.displayState)
    }

    @Test
    fun `mature egg snapshot is detected for authoritative refresh`() {
        val nowMs = 10_000L
        val snapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 0, nowMs = nowMs).copy(
            eggHatchTimeMs = nowMs - 1L,
            eggHatchDurationMs = 30_000L,
            eggCrackStage = 3,
        )

        assertTrue(WorldDataSnapshotFactory.isEggMaturedPastHatchTime(snapshot, nowMs))
    }

    @Test
    fun `future hatch egg snapshot does not request authoritative refresh yet`() {
        val nowMs = 10_000L
        val snapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 0, nowMs = nowMs).copy(
            eggHatchTimeMs = nowMs + 60_000L,
            eggHatchDurationMs = 60_000L,
            eggCrackStage = 1,
        )

        assertFalse(WorldDataSnapshotFactory.isEggMaturedPastHatchTime(snapshot, nowMs))
    }

    @Test
    fun `native projection accumulates stamina elapsed and animation frame without authoritative mutation`() {
        val nowMs = 1_000_000L
        val authoritativeSnapshot =
            HomeWidgetDebugPresets.resolveSnapshot(index = 1, nowMs = nowMs).copy(
                snapshotKind = "authoritativeAppState",
                characterKey = 1,
                stamina = 8.0,
                staminaPercent = 0.8,
                staminaLevel = "green",
                updatedAtMs = nowMs,
                snapshotComputedAtMs = nowMs,
                projectedElapsedMs = 0L,
                staminaTimerMs = 0.0,
            )

        val progressed = WorldDataSnapshotFactory.progressSnapshot(
            authoritativeSnapshot,
            nowMs + 24 * 60 * 1000L,
        )

        checkNotNull(progressed)
        assertEquals("widgetProgressed", progressed.snapshotKind)
        assertEquals(24 * 60 * 1000L, progressed.projectedElapsedMs)
        assertEquals(7.5, progressed.stamina, 0.0001)
        assertEquals("green", progressed.staminaLevel)
        assertEquals(
            ((progressed.updatedAtMs / 1000L) + 1L).mod(4L).toInt(),
            progressed.animationFrameIndex,
        )
        assertEquals("authoritativeAppState", authoritativeSnapshot.snapshotKind)
        assertEquals(0L, authoritativeSnapshot.projectedElapsedMs)
        assertEquals(8.0, authoritativeSnapshot.stamina, 0.0001)
    }

    @Test
    fun `native egg projection advances crack stage but keeps Flutter hatch authority`() {
        val nowMs = 1_000_000L
        val authoritativeEgg =
            HomeWidgetDebugPresets.resolveSnapshot(index = 0, nowMs = nowMs).copy(
                snapshotKind = "authoritativeAppState",
                characterState = "egg",
                eggTextureKey = 517,
                eggHatchTimeMs = nowMs + 40 * 60 * 1000L,
                eggHatchDurationMs = 40 * 60 * 1000L,
                eggCrackStage = 0,
                updatedAtMs = nowMs,
                snapshotComputedAtMs = nowMs,
                projectedElapsedMs = 0L,
            )

        val beforeHatch = WorldDataSnapshotFactory.progressSnapshot(
            authoritativeEgg,
            nowMs + 20 * 60 * 1000L,
        )
        checkNotNull(beforeHatch)
        val afterHatchTime = WorldDataSnapshotFactory.progressSnapshot(
            beforeHatch,
            nowMs + 41 * 60 * 1000L,
        )

        assertEquals("egg", beforeHatch.characterState)
        assertEquals(2, beforeHatch.eggCrackStage)
        assertFalse(
            WorldDataSnapshotFactory.isEggMaturedPastHatchTime(
                beforeHatch,
                nowMs + 20 * 60 * 1000L,
            ),
        )
        checkNotNull(afterHatchTime)
        assertEquals("egg", afterHatchTime.characterState)
        assertEquals(3, afterHatchTime.eggCrackStage)
        assertEquals(41 * 60 * 1000L, afterHatchTime.projectedElapsedMs)
        assertTrue(
            WorldDataSnapshotFactory.isEggMaturedPastHatchTime(
                afterHatchTime,
                nowMs + 41 * 60 * 1000L,
            ),
        )
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

        assertTrue(WorldDataSnapshotFactory.isAuthoritativeSnapshotStale(snapshot, nowMs))
        assertTrue(
            WorldDataSnapshotFactory.requiresAuthoritativeRefresh(
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

        assertFalse(WorldDataSnapshotFactory.isAuthoritativeSnapshotStale(snapshot, nowMs))
        assertFalse(
            WorldDataSnapshotFactory.requiresAuthoritativeRefresh(
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
            WorldDataSnapshotFactory.requiresAuthoritativeRefresh(
                currentSnapshot = currentSnapshot,
                authoritativeSnapshot = authoritativeSnapshot,
                nowMs = nowMs,
            ),
        )
    }
}
