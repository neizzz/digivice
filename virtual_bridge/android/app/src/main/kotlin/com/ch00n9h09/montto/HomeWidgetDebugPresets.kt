package com.ch00n9h09.montto

import android.content.Context

private const val DEBUG_PRESET_SCHEMA_VERSION = 2
private const val DEBUG_PRESET_MAX_STAMINA = 10.0
private const val DEBUG_PRESET_PROJECTION_VERSION = 1

data class HomeWidgetDebugPreset(
    val key: String,
    val monsterName: String,
    val characterKey: Int?,
    val characterState: String,
    val displayState: String,
    val timeOfDay: String,
    val stamina: Double,
    val staminaLevel: String,
    val animationFrameIndex: Int,
    val hasUrgentStatus: Boolean,
    val visibleStatusIcons: List<String>,
) {
    fun toSnapshot(nowMs: Long): HomeWidgetSnapshot {
        val normalizedStamina = stamina.coerceIn(0.0, DEBUG_PRESET_MAX_STAMINA)
        return HomeWidgetSnapshot(
            schemaVersion = DEBUG_PRESET_SCHEMA_VERSION,
            snapshotKind = "debugPreset",
            monsterName = monsterName,
            characterKey = characterKey,
            characterState = characterState,
            displayState = displayState,
            timeOfDay = timeOfDay,
            stamina = normalizedStamina,
            maxStamina = DEBUG_PRESET_MAX_STAMINA,
            staminaPercent = (normalizedStamina / DEBUG_PRESET_MAX_STAMINA).coerceIn(0.0, 1.0),
            staminaLevel = staminaLevel,
            useLocalTime = false,
            animationFrameIndex = animationFrameIndex.mod(4),
            updatedAtMs = nowMs,
            snapshotComputedAtMs = nowMs,
            lastActiveTimeMs = nowMs,
            baseLastActiveTimeMs = nowMs,
            projectedElapsedMs = 0L,
            projectionVersion = DEBUG_PRESET_PROJECTION_VERSION,
            staminaTimerMs = 0.0,
            hasUrgentStatus = hasUrgentStatus,
            visibleStatusIcons = visibleStatusIcons,
        )
    }
}

object HomeWidgetDebugPresets {
    private val presets = listOf(
        HomeWidgetDebugPreset(
            key = "egg",
            monsterName = "Debug Egg",
            characterKey = 1,
            characterState = "egg",
            displayState = "idle",
            timeOfDay = "day",
            stamina = 10.0,
            staminaLevel = "green",
            animationFrameIndex = 0,
            hasUrgentStatus = false,
            visibleStatusIcons = emptyList(),
        ),
        HomeWidgetDebugPreset(
            key = "normal_lv1",
            monsterName = "Debug Lv1",
            characterKey = 1,
            characterState = "idle",
            displayState = "idle",
            timeOfDay = "day",
            stamina = 8.0,
            staminaLevel = "green",
            animationFrameIndex = 1,
            hasUrgentStatus = false,
            visibleStatusIcons = emptyList(),
        ),
        HomeWidgetDebugPreset(
            key = "sleep",
            monsterName = "Debug Sleep",
            characterKey = 2,
            characterState = "sleeping",
            displayState = "sleep",
            timeOfDay = "night",
            stamina = 6.0,
            staminaLevel = "orange",
            animationFrameIndex = 0,
            hasUrgentStatus = false,
            visibleStatusIcons = listOf("sleeping"),
        ),
        HomeWidgetDebugPreset(
            key = "sick",
            monsterName = "Debug Sick",
            characterKey = 7,
            characterState = "sick",
            displayState = "sick",
            timeOfDay = "day",
            stamina = 4.0,
            staminaLevel = "orange",
            animationFrameIndex = 0,
            hasUrgentStatus = false,
            visibleStatusIcons = listOf("sick"),
        ),
        HomeWidgetDebugPreset(
            key = "sick_sleep",
            monsterName = "Debug Sick + Sleep",
            characterKey = 7,
            characterState = "sleeping",
            displayState = "sleep",
            timeOfDay = "night",
            stamina = 3.5,
            staminaLevel = "orange",
            animationFrameIndex = 1,
            hasUrgentStatus = false,
            visibleStatusIcons = listOf("sick", "sleeping"),
        ),
        HomeWidgetDebugPreset(
            key = "eating",
            monsterName = "Debug Eating",
            characterKey = 18,
            characterState = "eating",
            displayState = "idle",
            timeOfDay = "day",
            stamina = 5.5,
            staminaLevel = "orange",
            animationFrameIndex = 1,
            hasUrgentStatus = false,
            visibleStatusIcons = emptyList(),
        ),
        HomeWidgetDebugPreset(
            key = "dead",
            monsterName = "Debug Dead",
            characterKey = 29,
            characterState = "dead",
            displayState = "idle",
            timeOfDay = "night",
            stamina = 0.0,
            staminaLevel = "red",
            animationFrameIndex = 0,
            hasUrgentStatus = false,
            visibleStatusIcons = emptyList(),
        ),
        HomeWidgetDebugPreset(
            key = "urgent",
            monsterName = "Debug Urgent",
            characterKey = 30,
            characterState = "idle",
            displayState = "idle",
            timeOfDay = "sunset",
            stamina = 6.0,
            staminaLevel = "orange",
            animationFrameIndex = 1,
            hasUrgentStatus = true,
            visibleStatusIcons = emptyList(),
        ),
        HomeWidgetDebugPreset(
            key = "low_stamina",
            monsterName = "Debug Low Stamina",
            characterKey = 24,
            characterState = "idle",
            displayState = "idle",
            timeOfDay = "day",
            stamina = 2.0,
            staminaLevel = "red",
            animationFrameIndex = 0,
            hasUrgentStatus = false,
            visibleStatusIcons = emptyList(),
        ),
    )

    val count: Int
        get() = presets.size

    fun resolvePreset(index: Int): HomeWidgetDebugPreset = presets[normalizeIndex(index)]

    fun resolvePresetByKey(key: String): HomeWidgetDebugPreset? = presets.firstOrNull { it.key == key }

    fun resolveSnapshot(index: Int, nowMs: Long = System.currentTimeMillis()): HomeWidgetSnapshot {
        return resolvePreset(index).toSnapshot(nowMs)
    }

    fun wrapIndex(currentIndex: Int, step: Int): Int {
        return normalizeIndex(currentIndex + step)
    }

    private fun normalizeIndex(index: Int): Int {
        if (presets.isEmpty()) {
            return 0
        }

        return ((index % presets.size) + presets.size) % presets.size
    }
}

object HomeWidgetDebugPresetStore {
    fun isNativeDebugModeEnabled(): Boolean {
        return BuildConfig.DEBUG || BuildConfig.NATIVE_FEATURE_DEBUG_MODE
    }

    fun resolveOverrideSnapshot(
        context: Context,
        nowMs: Long = System.currentTimeMillis(),
    ): HomeWidgetSnapshot? {
        if (!isNativeDebugModeEnabled() || !isOverrideEnabled(context)) {
            return null
        }

        return HomeWidgetDebugPresets.resolveSnapshot(loadPresetIndex(context), nowMs)
    }

    fun advancePreset(context: Context, step: Int): Int? {
        if (!isNativeDebugModeEnabled()) {
            return null
        }

        val nextIndex = HomeWidgetDebugPresets.wrapIndex(loadPresetIndex(context), step)
        prefs(context).edit()
            .putBoolean(HomeWidgetConstants.DEBUG_PRESET_OVERRIDE_ENABLED_KEY, true)
            .putInt(HomeWidgetConstants.DEBUG_PRESET_INDEX_KEY, nextIndex)
            .apply()
        return nextIndex
    }

    private fun isOverrideEnabled(context: Context): Boolean {
        return prefs(context).getBoolean(HomeWidgetConstants.DEBUG_PRESET_OVERRIDE_ENABLED_KEY, false)
    }

    private fun loadPresetIndex(context: Context): Int {
        return prefs(context).getInt(HomeWidgetConstants.DEBUG_PRESET_INDEX_KEY, 0)
    }

    private fun prefs(context: Context) = context.getSharedPreferences(
        HomeWidgetConstants.STORAGE_NAME,
        Context.MODE_PRIVATE,
    )
}

object HomeWidgetSnapshotSelector {
    fun select(
        debugModeEnabled: Boolean,
        debugOverrideSnapshot: HomeWidgetSnapshot?,
        currentSnapshot: HomeWidgetSnapshot?,
        authoritativeSnapshot: HomeWidgetSnapshot?,
        worldDataFallback: () -> HomeWidgetSnapshot?,
    ): HomeWidgetSnapshot? {
        val debugSnapshot = if (debugModeEnabled) debugOverrideSnapshot else null
        return debugSnapshot ?: currentSnapshot ?: authoritativeSnapshot ?: worldDataFallback()
    }
}
