package com.ch00n9h09.montto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
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
    fun `legacy snapshot without stamina level treats threshold stamina as orange`() {
        val snapshot = HomeWidgetSnapshot.fromJson(
            """
            {
              "stamina": 3.0,
              "maxStamina": 10.0,
              "staminaPercent": 0.3,
              "characterState": "idle"
            }
            """.trimIndent(),
        )

        assertEquals("orange", snapshot?.staminaLevel)
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
                authoritativeSnapshot = snapshot,
                nowMs = nowMs,
            ),
        )
    }

    @Test
    fun `fresh non egg authoritative snapshot does not request refresh`() {
        val nowMs = 20 * 60 * 1000L
        val snapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 1, nowMs = nowMs).copy(
            snapshotKind = "authoritativeAppState",
            snapshotComputedAtMs = nowMs,
            updatedAtMs = nowMs,
        )

        assertFalse(WorldDataSnapshotFactory.isAuthoritativeSnapshotStale(snapshot, nowMs))
        assertFalse(
            WorldDataSnapshotFactory.requiresAuthoritativeRefresh(
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
                authoritativeSnapshot = authoritativeSnapshot,
                nowMs = nowMs,
            ),
        )
    }

    @Test
    fun `newer Flutter authoritative non egg snapshot wins over stale native egg`() {
        val nativeSnapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 0, nowMs = 1_000L).copy(
            snapshotKind = "authoritativeAppState",
            characterState = "egg",
            snapshotComputedAtMs = 1_000L,
            updatedAtMs = 1_000L,
        )
        val flutterSnapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 1, nowMs = 2_000L).copy(
            snapshotKind = "authoritativeAppState",
            characterState = "idle",
            snapshotComputedAtMs = 2_000L,
            updatedAtMs = 2_000L,
        )

        val selection = HomeWidgetSnapshot.selectAuthoritativeSnapshot(
            nativeSnapshot = nativeSnapshot,
            flutterSnapshot = flutterSnapshot,
        )

        assertEquals(HOME_WIDGET_FLUTTER_SNAPSHOT_SOURCE, selection.source)
        assertEquals("idle", selection.snapshot?.characterState)
        assertEquals(2_000L, selection.snapshot?.snapshotComputedAtMs)
    }

    @Test
    fun `newer native authoritative snapshot wins over stale Flutter egg`() {
        val nativeSnapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 1, nowMs = 3_000L).copy(
            snapshotKind = "authoritativeAppState",
            characterState = "idle",
            snapshotComputedAtMs = 3_000L,
            updatedAtMs = 3_000L,
        )
        val flutterSnapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 0, nowMs = 2_000L).copy(
            snapshotKind = "authoritativeAppState",
            characterState = "egg",
            snapshotComputedAtMs = 2_000L,
            updatedAtMs = 2_000L,
        )

        val selection = HomeWidgetSnapshot.selectAuthoritativeSnapshot(
            nativeSnapshot = nativeSnapshot,
            flutterSnapshot = flutterSnapshot,
        )

        assertEquals(HOME_WIDGET_NATIVE_SNAPSHOT_SOURCE, selection.source)
        assertEquals("idle", selection.snapshot?.characterState)
        assertEquals(3_000L, selection.snapshot?.snapshotComputedAtMs)
    }

    @Test
    fun `equal or missing authoritative timestamps keep native first fallback`() {
        val equalNativeSnapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 1, nowMs = 4_000L)
            .copy(snapshotComputedAtMs = 4_000L, updatedAtMs = 4_000L)
        val equalFlutterSnapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 2, nowMs = 4_000L)
            .copy(snapshotComputedAtMs = 4_000L, updatedAtMs = 4_000L)
        val missingNativeSnapshot = equalNativeSnapshot.copy(
            snapshotComputedAtMs = 0L,
            updatedAtMs = 0L,
        )
        val knownFlutterSnapshot = equalFlutterSnapshot.copy(
            snapshotComputedAtMs = 5_000L,
            updatedAtMs = 5_000L,
        )

        val equalSelection = HomeWidgetSnapshot.selectAuthoritativeSnapshot(
            nativeSnapshot = equalNativeSnapshot,
            flutterSnapshot = equalFlutterSnapshot,
        )
        val missingSelection = HomeWidgetSnapshot.selectAuthoritativeSnapshot(
            nativeSnapshot = missingNativeSnapshot,
            flutterSnapshot = knownFlutterSnapshot,
        )
        val emptySelection = HomeWidgetSnapshot.selectAuthoritativeSnapshot(
            nativeSnapshot = null,
            flutterSnapshot = null,
        )

        assertEquals(HOME_WIDGET_NATIVE_SNAPSHOT_SOURCE, equalSelection.source)
        assertEquals(equalNativeSnapshot.characterKey, equalSelection.snapshot?.characterKey)
        assertEquals(HOME_WIDGET_NATIVE_SNAPSHOT_SOURCE, missingSelection.source)
        assertEquals(missingNativeSnapshot.characterKey, missingSelection.snapshot?.characterKey)
        assertNull(emptySelection.source)
        assertNull(emptySelection.snapshot)
    }
}
