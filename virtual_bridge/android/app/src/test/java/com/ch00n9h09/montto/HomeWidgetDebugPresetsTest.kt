package com.ch00n9h09.montto

import android.content.SharedPreferences
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
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

        assertNull(selected)
    }

    @Test
    fun `advance preset enables override snapshot`() {
        val prefs = FakeSharedPreferences()
        val nowMs = 1_717_171_717L

        val nextIndex = HomeWidgetDebugPresetStore.advancePreset(
            prefs = prefs,
            step = 1,
            debugModeEnabled = true,
        )
        val snapshot = HomeWidgetDebugPresetStore.resolveOverrideSnapshot(
            prefs = prefs,
            nowMs = nowMs,
            debugModeEnabled = true,
        )

        assertEquals(1, nextIndex)
        assertTrue(HomeWidgetDebugPresetStore.isOverrideEnabled(prefs))
        assertEquals(nextIndex, HomeWidgetDebugPresetStore.loadPresetIndex(prefs))
        assertEquals(HomeWidgetDebugPresets.resolveSnapshot(index = 1, nowMs = nowMs), snapshot)
    }

    @Test
    fun `disable override keeps preset index and clears override snapshot`() {
        val prefs = FakeSharedPreferences()
        HomeWidgetDebugPresetStore.advancePreset(
            prefs = prefs,
            step = 1,
            debugModeEnabled = true,
        )

        HomeWidgetDebugPresetStore.disableOverride(prefs)
        val snapshot = HomeWidgetDebugPresetStore.resolveOverrideSnapshot(
            prefs = prefs,
            nowMs = 1_717_171_717L,
            debugModeEnabled = true,
        )

        assertFalse(HomeWidgetDebugPresetStore.isOverrideEnabled(prefs))
        assertEquals(1, HomeWidgetDebugPresetStore.loadPresetIndex(prefs))
        assertNull(snapshot)
    }

    @Test
    fun `selector falls back to live snapshot after override is disabled`() {
        val prefs = FakeSharedPreferences()
        val nowMs = 1_717_171_717L
        val currentSnapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 2, nowMs = nowMs)
        HomeWidgetDebugPresetStore.advancePreset(
            prefs = prefs,
            step = 1,
            debugModeEnabled = true,
        )

        val selectedWithOverride = HomeWidgetSnapshotSelector.select(
            debugModeEnabled = true,
            debugOverrideSnapshot = HomeWidgetDebugPresetStore.resolveOverrideSnapshot(
                prefs = prefs,
                nowMs = nowMs,
                debugModeEnabled = true,
            ),
            currentSnapshot = currentSnapshot,
            authoritativeSnapshot = null,
            worldDataFallback = { null },
        )

        HomeWidgetDebugPresetStore.disableOverride(prefs)
        val selectedAfterDisable = HomeWidgetSnapshotSelector.select(
            debugModeEnabled = true,
            debugOverrideSnapshot = HomeWidgetDebugPresetStore.resolveOverrideSnapshot(
                prefs = prefs,
                nowMs = nowMs,
                debugModeEnabled = true,
            ),
            currentSnapshot = currentSnapshot,
            authoritativeSnapshot = null,
            worldDataFallback = { null },
        )

        assertEquals(HomeWidgetDebugPresets.resolveSnapshot(index = 1, nowMs = nowMs), selectedWithOverride)
        assertNull(selectedAfterDisable)
    }

    @Test
    fun `selector prefers authoritative snapshot when character state changed`() {
        val nowMs = 1_717_171_717L
        val currentSnapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 1, nowMs = nowMs)!!
        val authoritativeSnapshot = currentSnapshot.copy(
            snapshotKind = "authoritativeAppState",
            characterState = "egg",
            eggTextureKey = 517,
        )

        val selected = HomeWidgetSnapshotSelector.select(
            debugModeEnabled = false,
            debugOverrideSnapshot = null,
            currentSnapshot = currentSnapshot,
            authoritativeSnapshot = authoritativeSnapshot,
            worldDataFallback = { null },
        )

        assertEquals(authoritativeSnapshot, selected)
    }

    @Test
    fun `selector ignores non-authoritative current snapshot when authoritative fallback exists`() {
        val nowMs = 1_717_171_717L
        val currentSnapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 1, nowMs = nowMs)!!
        val staleFallbackSnapshot = currentSnapshot.copy(
            snapshotKind = "authoritativeAppState",
            characterState = "sleeping",
            displayState = "sleep",
            visibleStatusIcons = listOf("sick", "sleeping"),
        )
        var fallbackCalled = false

        val selected = HomeWidgetSnapshotSelector.select(
            debugModeEnabled = false,
            debugOverrideSnapshot = null,
            currentSnapshot = currentSnapshot,
            authoritativeSnapshot = null,
            worldDataFallback = {
                fallbackCalled = true
                staleFallbackSnapshot
            },
        )

        assertEquals(staleFallbackSnapshot, selected)
        assertTrue(fallbackCalled)
    }

    @Test
    fun `selector prefers authoritative snapshot over progressed current snapshot`() {
        val nowMs = 1_717_171_717L
        val authoritativeSnapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 1, nowMs = nowMs)!!
        val currentSnapshot = authoritativeSnapshot.copy(
            snapshotKind = "widgetProgressed",
            stamina = 7.5,
            staminaPercent = 0.75,
            updatedAtMs = nowMs + 10_000,
            snapshotComputedAtMs = nowMs + 10_000,
            projectedElapsedMs = 10_000,
        )

        val selected = HomeWidgetSnapshotSelector.select(
            debugModeEnabled = false,
            debugOverrideSnapshot = null,
            currentSnapshot = currentSnapshot,
            authoritativeSnapshot = authoritativeSnapshot,
            worldDataFallback = { authoritativeSnapshot },
        )

        assertEquals(authoritativeSnapshot, selected)
    }

    @Test
    fun `selector prefers authoritative egg snapshot when hatch timing baseline changed`() {
        val nowMs = 1_717_171_717L
        val authoritativeSnapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 0, nowMs = nowMs)!!.copy(
            snapshotKind = "authoritativeAppState",
            characterState = "egg",
            eggTextureKey = 517,
            eggHatchTimeMs = nowMs + 120_000,
            eggHatchDurationMs = 180_000,
            eggCrackStage = 0,
            displayState = "idle",
            baseLastActiveTimeMs = nowMs - 5_000,
            updatedAtMs = nowMs,
            snapshotComputedAtMs = nowMs,
            projectedElapsedMs = 0,
        )
        val currentSnapshot = authoritativeSnapshot.copy(
            snapshotKind = "widgetProgressed",
            eggHatchTimeMs = authoritativeSnapshot.eggHatchTimeMs!! - 30_000,
            eggCrackStage = 2,
            updatedAtMs = nowMs + 30_000,
            snapshotComputedAtMs = nowMs + 30_000,
            projectedElapsedMs = 30_000,
        )

        val selected = HomeWidgetSnapshotSelector.select(
            debugModeEnabled = false,
            debugOverrideSnapshot = null,
            currentSnapshot = currentSnapshot,
            authoritativeSnapshot = authoritativeSnapshot,
            worldDataFallback = { authoritativeSnapshot },
        )

        assertEquals(authoritativeSnapshot, selected)
    }

    @Test
    fun `selector prefers authoritative egg snapshot over progressed current snapshot`() {
        val nowMs = 1_717_171_717L
        val authoritativeSnapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 0, nowMs = nowMs)!!.copy(
            snapshotKind = "authoritativeAppState",
            characterState = "egg",
            eggTextureKey = 517,
            eggHatchTimeMs = nowMs + 120_000,
            eggHatchDurationMs = 180_000,
            eggCrackStage = 0,
            displayState = "idle",
            baseLastActiveTimeMs = nowMs - 5_000,
            updatedAtMs = nowMs,
            snapshotComputedAtMs = nowMs,
            projectedElapsedMs = 0,
        )
        val currentSnapshot = authoritativeSnapshot.copy(
            snapshotKind = "widgetProgressed",
            eggCrackStage = 2,
            updatedAtMs = nowMs + 30_000,
            snapshotComputedAtMs = nowMs + 30_000,
            projectedElapsedMs = 30_000,
        )

        val selected = HomeWidgetSnapshotSelector.select(
            debugModeEnabled = false,
            debugOverrideSnapshot = null,
            currentSnapshot = currentSnapshot,
            authoritativeSnapshot = authoritativeSnapshot,
            worldDataFallback = { authoritativeSnapshot },
        )

        assertEquals(authoritativeSnapshot, selected)
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
        assertEquals("sick", preset?.displayState)
    }

    @Test
    fun `urgent preset no longer uses discover icon`() {
        val preset = HomeWidgetDebugPresets.resolvePresetByKey("urgent")
        assertNotNull(preset)
        assertTrue(preset?.hasUrgentStatus == true)
        assertFalse(preset?.visibleStatusIcons?.contains("discover") == true)
    }

    private class FakeSharedPreferences : SharedPreferences {
        private val values = linkedMapOf<String, Any?>()

        override fun getAll(): MutableMap<String, *> = values.toMutableMap()

        override fun getString(key: String?, defValue: String?): String? {
            return values[key] as? String ?: defValue
        }

        @Suppress("UNCHECKED_CAST")
        override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? {
            val stored = values[key] as? Set<String>
            return stored?.toMutableSet() ?: defValues
        }

        override fun getInt(key: String?, defValue: Int): Int {
            return values[key] as? Int ?: defValue
        }

        override fun getLong(key: String?, defValue: Long): Long {
            return values[key] as? Long ?: defValue
        }

        override fun getFloat(key: String?, defValue: Float): Float {
            return values[key] as? Float ?: defValue
        }

        override fun getBoolean(key: String?, defValue: Boolean): Boolean {
            return values[key] as? Boolean ?: defValue
        }

        override fun contains(key: String?): Boolean {
            return values.containsKey(key)
        }

        override fun edit(): SharedPreferences.Editor = Editor(values)

        override fun registerOnSharedPreferenceChangeListener(
            listener: SharedPreferences.OnSharedPreferenceChangeListener?,
        ) = Unit

        override fun unregisterOnSharedPreferenceChangeListener(
            listener: SharedPreferences.OnSharedPreferenceChangeListener?,
        ) = Unit
    }

    private class Editor(
        private val values: MutableMap<String, Any?>,
    ) : SharedPreferences.Editor {
        private val pending = linkedMapOf<String, Any?>()
        private var clearRequested = false

        override fun putString(key: String?, value: String?): SharedPreferences.Editor = apply {
            pending[key.orEmpty()] = value
        }

        override fun putStringSet(
            key: String?,
            values: MutableSet<String>?,
        ): SharedPreferences.Editor = apply {
            pending[key.orEmpty()] = values?.toSet()
        }

        override fun putInt(key: String?, value: Int): SharedPreferences.Editor = apply {
            pending[key.orEmpty()] = value
        }

        override fun putLong(key: String?, value: Long): SharedPreferences.Editor = apply {
            pending[key.orEmpty()] = value
        }

        override fun putFloat(key: String?, value: Float): SharedPreferences.Editor = apply {
            pending[key.orEmpty()] = value
        }

        override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor = apply {
            pending[key.orEmpty()] = value
        }

        override fun remove(key: String?): SharedPreferences.Editor = apply {
            pending[key.orEmpty()] = null
        }

        override fun clear(): SharedPreferences.Editor = apply {
            clearRequested = true
            pending.clear()
        }

        override fun commit(): Boolean {
            apply()
            return true
        }

        override fun apply() {
            if (clearRequested) {
                values.clear()
                clearRequested = false
            }
            pending.forEach { (key, value) ->
                if (value == null) {
                    values.remove(key)
                } else {
                    values[key] = value
                }
            }
            pending.clear()
        }
    }
}
