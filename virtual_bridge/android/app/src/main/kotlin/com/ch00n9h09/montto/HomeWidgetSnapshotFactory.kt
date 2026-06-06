package com.ch00n9h09.montto

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import java.util.TimeZone
import kotlin.math.roundToInt

object HomeWidgetSnapshotFactory {
    private const val CHARACTER_OBJECT_TYPE = 1
    private const val EGG_TEXTURE_KEY_START = 500
    private const val EGG_TEXTURE_KEY_END = 529
    private const val DEFAULT_EGG_HATCH_DURATION_MS = 30 * 60 * 1000L
    private const val CHARACTER_STATE_EGG = 0
    private const val CHARACTER_STATE_IDLE = 1
    private const val CHARACTER_STATE_MOVING = 2
    private const val CHARACTER_STATE_SLEEPING = 3
    private const val CHARACTER_STATE_SICK = 4
    private const val CHARACTER_STATE_EATING = 5
    private const val CHARACTER_STATE_DEAD = 6

    private const val CHARACTER_STATUS_URGENT = 2
    private const val CHARACTER_STATUS_SICK = 3
    private const val CHARACTER_STATUS_HAPPY = 4
    private const val CHARACTER_STATUS_DISCOVER = 5

    private const val MAX_STAMINA = 10.0
    private const val LOW_STAMINA_THRESHOLD = 3.0
    private const val BOOSTED_STAMINA_THRESHOLD = 7.0
    private const val ANIMATION_FRAME_COUNT = 4

    private const val STAMINA_DECREASE_INTERVAL_MS = 12 * 60 * 1000.0
    private const val STAMINA_DECREASE_AMOUNT = 0.25
    private const val HIGH_STAMINA_DECAY_MULTIPLIER = 1.3
    private const val LOW_STAMINA_DECAY_MULTIPLIER = 0.7
    private const val SLEEPING_STAMINA_DECAY_MULTIPLIER = 0.2
    private const val PROJECTION_VERSION = 1

    private data class ResolvedEggHatchTiming(
        val hatchTimeMs: Long,
        val hatchDurationMs: Long,
        val progress: Double,
    )

    fun refreshFromWorldData(context: Context): HomeWidgetSnapshot? {
        val worldData = context
            .getSharedPreferences(HomeWidgetConstants.FLUTTER_STORAGE_NAME, Context.MODE_PRIVATE)
            .getString(HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY, null)
        val snapshot = buildFromWorldDataJson(worldData, System.currentTimeMillis())
        persistAuthoritativeSnapshot(context, snapshot)
        return snapshot
    }

    fun progressSnapshot(context: Context, nowMs: Long = System.currentTimeMillis()): HomeWidgetSnapshot? {
        val sourceSnapshot = HomeWidgetSnapshot.load(context)
            ?: HomeWidgetSnapshot.loadAuthoritative(context)
            ?: refreshFromWorldData(context)
            ?: return null
        val progressedSnapshot = progressSnapshot(sourceSnapshot, nowMs) ?: return null
        persistCurrentSnapshot(context, progressedSnapshot)
        return progressedSnapshot
    }

    internal fun requiresAuthoritativeRefresh(
        currentSnapshot: HomeWidgetSnapshot?,
        authoritativeSnapshot: HomeWidgetSnapshot?,
        nowMs: Long,
    ): Boolean {
        if (authoritativeSnapshot?.characterState != null &&
            authoritativeSnapshot.characterState != "egg"
        ) {
            return isAuthoritativeSnapshotStale(authoritativeSnapshot, nowMs)
        }

        return isEggMaturedPastHatchTime(currentSnapshot, nowMs) ||
            isEggMaturedPastHatchTime(authoritativeSnapshot, nowMs)
    }

    internal fun isAuthoritativeSnapshotStale(
        snapshot: HomeWidgetSnapshot,
        nowMs: Long,
    ): Boolean {
        if (snapshot.characterState == "egg") {
            return false
        }

        val completedAtMs = snapshot.snapshotComputedAtMs
            .takeIf { it > 0L }
            ?: snapshot.updatedAtMs.takeIf { it > 0L }
            ?: return true
        val staleAfterMs = HomeWidgetConstants.PERIODIC_REFRESH_INTERVAL_MINUTES *
            60 * 1000L

        return nowMs - completedAtMs >= staleAfterMs
    }

    internal fun isEggMaturedPastHatchTime(
        snapshot: HomeWidgetSnapshot?,
        nowMs: Long,
    ): Boolean {
        return snapshot?.characterState == "egg" &&
            snapshot.eggHatchTimeMs?.let { it <= nowMs } == true
    }

    fun persistAuthoritativeSnapshot(context: Context, snapshot: HomeWidgetSnapshot?) {
        val snapshotJson = snapshot?.toJsonString()
        val nativePrefs = context.getSharedPreferences(
            HomeWidgetConstants.STORAGE_NAME,
            Context.MODE_PRIVATE,
        )
        nativePrefs.edit().apply {
            if (snapshotJson.isNullOrEmpty()) {
                remove(HomeWidgetConstants.SNAPSHOT_KEY)
                remove(HomeWidgetConstants.AUTHORITATIVE_SNAPSHOT_KEY)
            } else {
                putString(HomeWidgetConstants.SNAPSHOT_KEY, snapshotJson)
                putString(HomeWidgetConstants.AUTHORITATIVE_SNAPSHOT_KEY, snapshotJson)
            }
        }.apply()

        context.getSharedPreferences(
            HomeWidgetConstants.FLUTTER_STORAGE_NAME,
            Context.MODE_PRIVATE,
        ).edit().apply {
            if (snapshotJson.isNullOrEmpty()) {
                remove(HomeWidgetConstants.FLUTTER_SNAPSHOT_KEY)
                remove(HomeWidgetConstants.FLUTTER_AUTHORITATIVE_SNAPSHOT_KEY)
            } else {
                putString(HomeWidgetConstants.FLUTTER_SNAPSHOT_KEY, snapshotJson)
                putString(HomeWidgetConstants.FLUTTER_AUTHORITATIVE_SNAPSHOT_KEY, snapshotJson)
            }
        }.apply()
    }

    fun persistCurrentSnapshot(context: Context, snapshot: HomeWidgetSnapshot?) {
        val snapshotJson = snapshot?.toJsonString()
        context.getSharedPreferences(HomeWidgetConstants.STORAGE_NAME, Context.MODE_PRIVATE)
            .edit()
            .apply {
                if (snapshotJson.isNullOrEmpty()) {
                    remove(HomeWidgetConstants.SNAPSHOT_KEY)
                } else {
                    putString(HomeWidgetConstants.SNAPSHOT_KEY, snapshotJson)
                }
            }
            .apply()

        context.getSharedPreferences(
            HomeWidgetConstants.FLUTTER_STORAGE_NAME,
            Context.MODE_PRIVATE,
        ).edit().apply {
            if (snapshotJson.isNullOrEmpty()) {
                remove(HomeWidgetConstants.FLUTTER_SNAPSHOT_KEY)
            } else {
                putString(HomeWidgetConstants.FLUTTER_SNAPSHOT_KEY, snapshotJson)
            }
        }.apply()
    }

    fun buildFromWorldDataJson(rawWorldData: String?, nowMs: Long): HomeWidgetSnapshot? {
        if (rawWorldData.isNullOrBlank()) {
            return null
        }

        return runCatching {
            val worldData = JSONObject(rawWorldData)
            val worldMetadata = worldData.optJSONObject("world_metadata") ?: JSONObject()
            val appState = worldMetadata.optJSONObject("app_state") ?: JSONObject()
            val entities = worldData.optJSONArray("entities") ?: JSONArray()
            val source = findMainCharacter(entities) ?: return@runCatching null
            val characterState = resolveCharacterState(source.state)
            val visibleStatusIcons = resolveVisibleStatusIcons(characterState, source.statuses)
            val hasUrgentStatus = source.statuses.contains(CHARACTER_STATUS_URGENT)
            val displayState = resolveDisplayState(characterState, visibleStatusIcons)
            val stamina = (source.stamina ?: 0.0).coerceIn(0.0, MAX_STAMINA)
            val updatedAtMs = nowMs
            val eggHatchTiming = resolveEggHatchTiming(
                nowMs = nowMs,
                characterState = characterState,
                hatchTimeMs = source.eggHatchTimeMs,
                hatchDurationMs = source.eggHatchDurationMs,
            )
            val lastActiveTimeMs = appState.optLong("last_active_time").takeIf {
                appState.has("last_active_time")
            }

            HomeWidgetSnapshot(
                schemaVersion = 2,
                snapshotKind = "authoritativeAppState",
                monsterName = worldMetadata.optString("monster_name").ifBlank { null },
                characterKey = source.characterKey,
                eggTextureKey = resolveEggTextureKey(
                    characterState = characterState,
                    rawTextureKey = source.textureKey,
                ),
                eggHatchTimeMs = eggHatchTiming?.hatchTimeMs,
                eggHatchDurationMs = eggHatchTiming?.hatchDurationMs,
                eggCrackStage = resolveEggCrackStage(
                    characterState = characterState,
                    timing = eggHatchTiming,
                ),
                characterState = characterState,
                displayState = displayState,
                timeOfDay = resolveTimeOfDay(
                    nowMs = nowMs,
                    useLocalTime = appState.optBoolean("use_local_time", true),
                    appState = appState,
                ),
                stamina = stamina,
                maxStamina = MAX_STAMINA,
                staminaPercent = (stamina / MAX_STAMINA).coerceIn(0.0, 1.0),
                staminaLevel = resolveStaminaLevel(stamina),
                useLocalTime = appState.optBoolean("use_local_time", true),
                animationFrameIndex = (((updatedAtMs / 1000L) + (source.characterKey ?: 0)) %
                    ANIMATION_FRAME_COUNT).toInt(),
                updatedAtMs = updatedAtMs,
                snapshotComputedAtMs = updatedAtMs,
                lastActiveTimeMs = lastActiveTimeMs,
                baseLastActiveTimeMs = lastActiveTimeMs,
                projectedElapsedMs = 0L,
                projectionVersion = PROJECTION_VERSION,
                staminaTimerMs = 0.0,
                hasUrgentStatus = hasUrgentStatus,
                visibleStatusIcons = visibleStatusIcons,
            )
        }.getOrNull()
    }

    private fun progressSnapshot(snapshot: HomeWidgetSnapshot, nowMs: Long): HomeWidgetSnapshot? {
        val elapsedMs = (nowMs - snapshot.snapshotComputedAtMs).coerceAtLeast(0L)
        val tickSizeMs = resolveSimulationTickSizeMs(elapsedMs)
        val totalTicks = if (tickSizeMs > 0L) elapsedMs / tickSizeMs else 0L
        val remainingMs = if (tickSizeMs > 0L) elapsedMs % tickSizeMs else 0L

        var stamina = snapshot.stamina
        var staminaTimerMs = snapshot.staminaTimerMs
        repeat(totalTicks.coerceAtMost(Int.MAX_VALUE.toLong()).toInt()) {
            val progressed = progressStamina(
                stamina = stamina,
                staminaTimerMs = staminaTimerMs,
                characterState = snapshot.characterState,
                deltaMs = tickSizeMs.toDouble(),
            )
            stamina = progressed.stamina
            staminaTimerMs = progressed.staminaTimerMs
        }
        if (remainingMs > 0L) {
            val progressed = progressStamina(
                stamina = stamina,
                staminaTimerMs = staminaTimerMs,
                characterState = snapshot.characterState,
                deltaMs = remainingMs.toDouble(),
            )
            stamina = progressed.stamina
            staminaTimerMs = progressed.staminaTimerMs
        }
        val eggHatchTiming = resolveEggHatchTiming(
            nowMs = nowMs,
            characterState = snapshot.characterState,
            hatchTimeMs = snapshot.eggHatchTimeMs,
            hatchDurationMs = snapshot.eggHatchDurationMs,
        )

        return snapshot.copy(
            snapshotKind = "widgetProgressed",
            stamina = stamina,
            staminaPercent = (stamina / snapshot.maxStamina).coerceIn(0.0, 1.0),
            staminaLevel = resolveStaminaLevel(stamina),
            timeOfDay = if (snapshot.useLocalTime) {
                resolveTimeOfDay(nowMs, useLocalTime = true, appState = JSONObject())
            } else {
                "day"
            },
            animationFrameIndex = (((nowMs / 1000L) + (snapshot.characterKey ?: 0)) %
                ANIMATION_FRAME_COUNT).toInt(),
            updatedAtMs = nowMs,
            snapshotComputedAtMs = nowMs,
            projectedElapsedMs = snapshot.projectedElapsedMs + elapsedMs,
            projectionVersion = PROJECTION_VERSION,
            staminaTimerMs = staminaTimerMs,
            hasUrgentStatus = snapshot.hasUrgentStatus,
            eggHatchTimeMs = eggHatchTiming?.hatchTimeMs,
            eggHatchDurationMs = eggHatchTiming?.hatchDurationMs,
            eggCrackStage = resolveEggCrackStage(
                characterState = snapshot.characterState,
                timing = eggHatchTiming,
            ),
        )
    }

    private fun findMainCharacter(entities: JSONArray): CharacterSnapshotSource? {
        for (index in 0 until entities.length()) {
            val entity = entities.optJSONObject(index) ?: continue
            val components = entity.optJSONObject("components") ?: continue
            val objectComponent = components.optJSONObject("object") ?: continue
            if (objectComponent.optInt("type", -1) != CHARACTER_OBJECT_TYPE) {
                continue
            }

            val statusComponent = components.optJSONObject("characterStatus") ?: JSONObject()
            val rawStatuses = statusComponent.optJSONArray("statuses") ?: JSONArray()
            val statuses = buildList {
                for (statusIndex in 0 until rawStatuses.length()) {
                    add(rawStatuses.optInt(statusIndex))
                }
            }

            return CharacterSnapshotSource(
                state = objectComponent.optInt("state"),
                characterKey = statusComponent.optInt("characterKey").takeIf {
                    statusComponent.has("characterKey")
                },
                textureKey = components.optJSONObject("render")?.optInt("textureKey")?.takeIf {
                    components.optJSONObject("render")?.has("textureKey") == true
                },
                eggHatchTimeMs = components.optJSONObject("eggHatch")?.optLong("hatchTime")?.takeIf {
                    components.optJSONObject("eggHatch")?.has("hatchTime") == true
                },
                eggHatchDurationMs = components.optJSONObject("eggHatch")?.optLong("hatchDurationMs")
                    ?.takeIf {
                        components.optJSONObject("eggHatch")?.has("hatchDurationMs") == true
                    },
                stamina = statusComponent.optDouble("stamina").takeIf {
                    statusComponent.has("stamina")
                },
                statuses = statuses,
            )
        }

        return null
    }

    private fun resolveCharacterState(rawState: Int): String {
        return when (rawState) {
            CHARACTER_STATE_EGG -> "egg"
            CHARACTER_STATE_MOVING -> "moving"
            CHARACTER_STATE_SLEEPING -> "sleeping"
            CHARACTER_STATE_SICK -> "sick"
            CHARACTER_STATE_EATING -> "eating"
            CHARACTER_STATE_DEAD -> "dead"
            CHARACTER_STATE_IDLE -> "idle"
            else -> "idle"
        }
    }

    private fun resolveVisibleStatusIcons(characterState: String, statuses: List<Int>): List<String> {
        if (characterState == "dead") {
            return emptyList()
        }

        val visibleIcons = mutableListOf<String>()

        statuses.forEach { status ->
            when (status) {
                CHARACTER_STATUS_URGENT -> Unit
                CHARACTER_STATUS_SICK -> if (!visibleIcons.contains("sick")) {
                    visibleIcons.add("sick")
                }
                CHARACTER_STATUS_HAPPY,
                CHARACTER_STATUS_DISCOVER,
                -> Unit
            }
        }

        if (characterState == "sick" && !visibleIcons.contains("sick")) {
            visibleIcons.add("sick")
        }

        if (characterState == "sleeping") {
            visibleIcons.add("sleeping")
        }

        return visibleIcons
    }

    private fun resolveDisplayState(characterState: String, visibleStatusIcons: List<String>): String {
        return when {
            characterState == "sick" || visibleStatusIcons.contains("sick") -> "sick"
            characterState == "sleeping" || visibleStatusIcons.contains("sleeping") -> "sleep"
            else -> "idle"
        }
    }

    private fun resolveStaminaLevel(stamina: Double): String {
        return when {
            stamina <= LOW_STAMINA_THRESHOLD -> "red"
            stamina >= BOOSTED_STAMINA_THRESHOLD -> "green"
            else -> "orange"
        }
    }

    private fun resolveEggTextureKey(
        characterState: String,
        rawTextureKey: Int?,
    ): Int? {
        if (characterState != "egg") {
            return null
        }
        if (rawTextureKey == null || rawTextureKey !in EGG_TEXTURE_KEY_START..EGG_TEXTURE_KEY_END) {
            return EGG_TEXTURE_KEY_START
        }
        return rawTextureKey
    }

    private fun resolveEggHatchTiming(
        nowMs: Long,
        characterState: String,
        hatchTimeMs: Long?,
        hatchDurationMs: Long?,
    ): ResolvedEggHatchTiming? {
        if (characterState != "egg") {
            return null
        }

        val normalizedHatchTime = hatchTimeMs?.takeIf { it > 0L }
        val normalizedDurationMs = hatchDurationMs?.takeIf { it > 0L }

        val resolvedHatchTimeMs: Long
        val resolvedDurationMs: Long

        when {
            normalizedDurationMs != null && normalizedHatchTime != null -> {
                resolvedHatchTimeMs = normalizedHatchTime
                resolvedDurationMs = normalizedDurationMs
            }
            normalizedHatchTime != null -> {
                resolvedHatchTimeMs = normalizedHatchTime
                resolvedDurationMs = (normalizedHatchTime - nowMs).coerceAtLeast(0L)
            }
            normalizedDurationMs != null -> {
                resolvedDurationMs = normalizedDurationMs
                resolvedHatchTimeMs = nowMs + normalizedDurationMs
            }
            else -> {
                resolvedDurationMs = DEFAULT_EGG_HATCH_DURATION_MS
                resolvedHatchTimeMs = nowMs + resolvedDurationMs
            }
        }

        val hatchStartTime = if (resolvedDurationMs > 0L) {
            resolvedHatchTimeMs - resolvedDurationMs
        } else {
            resolvedHatchTimeMs
        }
        val progress = if (resolvedDurationMs <= 0L) {
            if (nowMs >= resolvedHatchTimeMs) 1.0 else 0.0
        } else {
            ((nowMs - hatchStartTime).toDouble() / resolvedDurationMs.toDouble())
                .coerceIn(0.0, 1.0)
        }

        return ResolvedEggHatchTiming(
            hatchTimeMs = resolvedHatchTimeMs,
            hatchDurationMs = resolvedDurationMs,
            progress = progress,
        )
    }

    private fun resolveEggCrackStage(
        characterState: String,
        timing: ResolvedEggHatchTiming?,
    ): Int {
        if (characterState != "egg" || timing == null) {
            return 0
        }

        return when {
            timing.progress >= 0.75 -> 3
            timing.progress >= 0.5 -> 2
            timing.progress >= 0.25 -> 1
            else -> 0
        }
    }

    private fun resolveTimeOfDay(
        nowMs: Long,
        useLocalTime: Boolean,
        appState: JSONObject,
    ): String {
        if (!useLocalTime) {
            return "day"
        }

        val cachedSunTimes = appState.optJSONObject("cached_sun_times") ?: JSONObject()
        val sunriseAt = projectSunTime(nowMs, cachedSunTimes, "sunriseAt")
        val sunsetAt = projectSunTime(nowMs, cachedSunTimes, "sunsetAt")
        val nowCalendar = Calendar.getInstance().apply { timeInMillis = nowMs }

        if (sunriseAt == null || sunsetAt == null || !sunriseAt.before(sunsetAt)) {
            val hour = nowCalendar.get(Calendar.HOUR_OF_DAY)
            return if (hour >= 19 || hour < 6) "night" else "day"
        }

        val sunriseStart = Calendar.getInstance().apply {
            timeInMillis = sunriseAt.timeInMillis
            add(Calendar.MINUTE, -60)
        }
        val sunriseEnd = Calendar.getInstance().apply {
            timeInMillis = sunriseAt.timeInMillis
            add(Calendar.MINUTE, 60)
        }
        val sunsetStart = Calendar.getInstance().apply {
            timeInMillis = sunsetAt.timeInMillis
            add(Calendar.MINUTE, -60)
        }
        val sunsetEnd = Calendar.getInstance().apply {
            timeInMillis = sunsetAt.timeInMillis
            add(Calendar.MINUTE, 60)
        }

        return when {
            nowCalendar.timeInMillis in sunriseStart.timeInMillis..sunriseEnd.timeInMillis -> "sunrise"
            nowCalendar.timeInMillis in sunsetStart.timeInMillis..sunsetEnd.timeInMillis -> "sunset"
            nowCalendar.after(sunriseEnd) && nowCalendar.before(sunsetStart) -> "day"
            else -> "night"
        }
    }

    private fun projectSunTime(
        nowMs: Long,
        cachedSunTimes: JSONObject,
        key: String,
    ): Calendar? {
        val rawTime = cachedSunTimes.optString(key).ifBlank { return null }
        if (!cachedSunTimes.has("timezoneOffsetMinutes")) {
            return null
        }
        val timezoneOffsetMinutes = cachedSunTimes.optInt("timezoneOffsetMinutes")
        val match = Regex("""T(\d{2}):(\d{2})(?::(\d{2}))?""").find(rawTime) ?: return null
        val hour = match.groupValues[1].toIntOrNull() ?: return null
        val minute = match.groupValues[2].toIntOrNull() ?: return null
        val second = match.groupValues.getOrNull(3)?.toIntOrNull() ?: 0

        val zonedNow = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
            timeInMillis = nowMs
            add(Calendar.MINUTE, timezoneOffsetMinutes)
        }

        return Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
            set(Calendar.YEAR, zonedNow.get(Calendar.YEAR))
            set(Calendar.MONTH, zonedNow.get(Calendar.MONTH))
            set(Calendar.DAY_OF_MONTH, zonedNow.get(Calendar.DAY_OF_MONTH))
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, second)
            set(Calendar.MILLISECOND, 0)
            add(Calendar.MINUTE, -timezoneOffsetMinutes)
        }
    }

    private fun resolveSimulationTickSizeMs(elapsedMs: Long): Long {
        return when {
            elapsedMs < 10 * 1000L -> 100L
            elapsedMs < 5 * 60 * 1000L -> 1000L
            elapsedMs < 60 * 60 * 1000L -> 10 * 1000L
            else -> 60 * 1000L
        }
    }

    private fun progressStamina(
        stamina: Double,
        staminaTimerMs: Double,
        characterState: String,
        deltaMs: Double,
    ): StaminaProgressResult {
        if (deltaMs <= 0.0 || characterState == "egg" || characterState == "dead") {
            return StaminaProgressResult(stamina = stamina, staminaTimerMs = staminaTimerMs)
        }

        var remainingDeltaMs = deltaMs
        var nextStamina = stamina
        var nextTimerMs = staminaTimerMs

        while (remainingDeltaMs > 0.0001 && nextStamina > 0.0) {
            val multiplier = resolveCurrentStaminaTimerMultiplier(nextStamina, characterState)
            if (multiplier <= 0.0) {
                break
            }

            val remainingEffectiveTime = (STAMINA_DECREASE_INTERVAL_MS - nextTimerMs)
                .coerceIn(0.0, STAMINA_DECREASE_INTERVAL_MS)
            val timeUntilDecrease = remainingEffectiveTime / multiplier

            if (remainingDeltaMs + 0.0001 < timeUntilDecrease) {
                nextTimerMs += remainingDeltaMs * multiplier
                remainingDeltaMs = 0.0
                break
            }

            nextTimerMs = 0.0
            remainingDeltaMs = (remainingDeltaMs - timeUntilDecrease).coerceAtLeast(0.0)
            nextStamina = (nextStamina - STAMINA_DECREASE_AMOUNT).coerceIn(0.0, MAX_STAMINA)
        }

        return StaminaProgressResult(
            stamina = nextStamina,
            staminaTimerMs = nextTimerMs,
        )
    }

    private fun resolveCurrentStaminaTimerMultiplier(stamina: Double, characterState: String): Double {
        val sleepMultiplier = if (characterState == "sleeping") {
            SLEEPING_STAMINA_DECAY_MULTIPLIER
        } else {
            1.0
        }
        return sleepMultiplier * resolveStaminaDecayRateMultiplier(stamina)
    }

    private fun resolveStaminaDecayRateMultiplier(stamina: Double): Double {
        return when {
            stamina >= BOOSTED_STAMINA_THRESHOLD -> HIGH_STAMINA_DECAY_MULTIPLIER
            stamina < LOW_STAMINA_THRESHOLD -> LOW_STAMINA_DECAY_MULTIPLIER
            else -> 1.0
        }
    }

    private data class CharacterSnapshotSource(
        val state: Int,
        val characterKey: Int?,
        val textureKey: Int?,
        val eggHatchTimeMs: Long?,
        val eggHatchDurationMs: Long?,
        val stamina: Double?,
        val statuses: List<Int>,
    )

    private data class StaminaProgressResult(
        val stamina: Double,
        val staminaTimerMs: Double,
    )
}
