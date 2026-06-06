package com.ch00n9h09.montto

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.min

private const val NATIVE_CHARACTER_OBJECT_TYPE = 1
private const val NATIVE_FOOD_OBJECT_TYPE = 3
private const val NATIVE_POOB_OBJECT_TYPE = 4
private const val NATIVE_CHARACTER_STATE_EGG = 0
private const val NATIVE_CHARACTER_STATE_IDLE = 1
private const val NATIVE_CHARACTER_STATE_SLEEPING = 3
private const val NATIVE_CHARACTER_STATE_SICK = 4
private const val NATIVE_CHARACTER_STATE_EATING = 5
private const val NATIVE_CHARACTER_STATE_DEAD = 6
private const val NATIVE_CHARACTER_STATUS_SICK = 3
private const val NATIVE_FOOD_STATE_BEING_THROWING = 1
private const val NATIVE_FOOD_STATE_LANDED = 2
private const val NATIVE_FOOD_FRESHNESS_FRESH = 1
private const val NATIVE_FOOD_FRESHNESS_NORMAL = 2
private const val NATIVE_FOOD_FRESHNESS_STALE = 3
private const val NATIVE_CHARACTER_KEY_NULL = 0
private const val NATIVE_GREEN_SLIME_A1_CHARACTER_KEY = 1
private const val NATIVE_SKULL_SLIME_A1_CHARACTER_KEY = 14
private const val NATIVE_SOIL_SLIME_A1_CHARACTER_KEY = 22
private const val NATIVE_MAX_EGG_HATCH_SELECTION_BONUS_COUNT = 10
private const val NATIVE_EGG_HATCH_BASE_GREEN_PERCENT = 65
private const val NATIVE_EGG_HATCH_BASE_SOIL_PERCENT = 20
private const val NATIVE_EGG_HATCH_BONUS_PER_COUNT_PERCENT = 2
private const val NATIVE_MAX_STAMINA = 10.0
private const val NATIVE_LOW_STAMINA_THRESHOLD = 3.0
private const val NATIVE_VERY_LOW_STAMINA_THRESHOLD = 1.5
private const val NATIVE_BOOSTED_STAMINA_THRESHOLD = 7.0
private const val NATIVE_STAMINA_DECREASE_INTERVAL_MS = 12 * 60 * 1000.0
private const val NATIVE_STAMINA_DECREASE_AMOUNT = 0.25
private const val NATIVE_HIGH_STAMINA_DECAY_MULTIPLIER = 1.3
private const val NATIVE_LOW_STAMINA_DECAY_MULTIPLIER = 0.7
private const val NATIVE_SLEEPING_STAMINA_DECAY_MULTIPLIER = 0.2
private const val NATIVE_HOUR_MS = 60 * 60 * 1000.0
private const val NATIVE_FATIGUE_MAX = 100.0
private const val NATIVE_FATIGUE_DEFAULT = 35.0
private const val NATIVE_FATIGUE_AWAKE_GAIN_PER_HOUR = 9.0
private const val NATIVE_FATIGUE_SLEEP_RECOVERY_PER_HOUR = 12.0
private const val NATIVE_FATIGUE_SLEEP_RECOVERY_PER_HOUR_WHEN_SICK = 6.0
private const val NATIVE_LOW_STAMINA_FATIGUE_AWAKE_GAIN_MULTIPLIER = 1.25
private const val NATIVE_CRITICAL_STAMINA_FATIGUE_AWAKE_GAIN_MULTIPLIER = 1.5
private const val NATIVE_DAY_NAP_CHANCE = 0.07
private const val NATIVE_DAY_NAP_CHECK_INTERVAL_MS = 20 * 60 * 1000L
private const val NATIVE_DAY_NAP_MIN_DURATION_MS = 10 * 60 * 1000L
private const val NATIVE_DAY_NAP_MAX_DURATION_MS = 30 * 60 * 1000L
private const val NATIVE_FATIGUE_DAY_NAP_MIN_THRESHOLD = 55.0
private const val NATIVE_FATIGUE_DAY_NAP_WAKE_THRESHOLD = 28.0
private const val NATIVE_SLEEP_MODE_AWAKE = 0
private const val NATIVE_SLEEP_MODE_DAY_NAP = 1
private const val NATIVE_SLEEP_MODE_NIGHT_SLEEP = 2
private const val NATIVE_SLEEP_REASON_NONE = 0
private const val NATIVE_SLEEP_REASON_NAP = 2
private const val NATIVE_DISEASE_CHECK_INTERVAL_MS = 10 * 1000L
private const val NATIVE_SLEEPING_DISEASE_RATE_MULTIPLIER = 0.1
private const val NATIVE_BASE_DISEASE_RATE = 0.0001862601875783909
private const val NATIVE_LOW_STAMINA_DISEASE_BONUS = 0.000093
private const val NATIVE_VERY_LOW_STAMINA_DISEASE_BONUS = 0.000186
private const val NATIVE_FATIGUE_DISEASE_THRESHOLD_TIRED = 55.0
private const val NATIVE_FATIGUE_DISEASE_THRESHOLD_VERY_TIRED = 70.0
private const val NATIVE_FATIGUE_DISEASE_THRESHOLD_EXHAUSTED = 85.0
private const val NATIVE_FATIGUE_DISEASE_BONUS_TIRED = 0.000093
private const val NATIVE_FATIGUE_DISEASE_BONUS_VERY_TIRED = 0.000186
private const val NATIVE_FATIGUE_DISEASE_BONUS_EXHAUSTED = 0.000279
private const val NATIVE_POOP_DISEASE_RATE = 0.000093
private const val NATIVE_STALE_FOOD_DISEASE_RATE = 0.000093
private const val NATIVE_NORMAL_TO_STALE_TIME_MS = 10 * 60 * 1000L
internal data class RefreshedHomeWidgetWorldData(
    val rawWorldData: String,
    val changed: Boolean,
    val hatched: Boolean,
    val previousCharacterState: Int?,
    val nextCharacterState: Int?,
    val selectedCharacterKey: Int?,
)

internal data class HomeWidgetNativeLifecycleRandomEvent(
    val objectId: Int,
    val checkTimeMs: Long,
    val reason: String,
)

internal typealias HomeWidgetNativeLifecycleRandomProvider = (
    HomeWidgetNativeLifecycleRandomEvent,
) -> Double

internal object HomeWidgetNativeRefreshWorldData {
    fun refresh(
        rawWorldData: String,
        nowMs: Long,
        randomProvider: HomeWidgetNativeLifecycleRandomProvider = ::resolveDeterministicLifecycleRandom,
    ): RefreshedHomeWidgetWorldData {
        val worldData = JSONObject(rawWorldData)
        val worldMetadata = ensureObject(worldData, "world_metadata")
        val appState = ensureObject(worldMetadata, "app_state")
        val entities = ensureArray(worldData, "entities")
        val source = findMutableMainCharacter(entities)

        val previousLastEcsSaved = worldMetadata.optLongOrNull("last_ecs_saved")
        val elapsedMs = previousLastEcsSaved
            ?.let { (nowMs - it).coerceAtLeast(0L) }
            ?: 0L
        worldMetadata.put("last_ecs_saved", nowMs)
        appState.put("last_active_time", nowMs)
        appState.remove("last_active_time_anchor")

        var changed = previousLastEcsSaved != nowMs
        var hatched = false
        var selectedCharacterKey: Int? = null
        var previousCharacterState: Int? = null
        var nextCharacterState: Int? = null

        if (source != null) {
            previousCharacterState = source.objectComponent.optIntOrNull("state")
            nextCharacterState = previousCharacterState

            if (previousCharacterState == NATIVE_CHARACTER_STATE_EGG) {
                val hatchTimeMs = source.eggHatch.optLongOrNull("hatchTime")
                if (hatchTimeMs != null && hatchTimeMs > 0L && nowMs >= hatchTimeMs) {
                    selectedCharacterKey = resolveStartingCharacterKeyForHatch(
                        worldData = worldData,
                        source = source,
                    )
                    completeEggHatch(source, selectedCharacterKey)
                    nextCharacterState = NATIVE_CHARACTER_STATE_IDLE
                    hatched = true
                    changed = true
                }
            } else if (elapsedMs > 0L) {
                changed = progressPostHatchLifecycle(
                    source = source,
                    entities = entities,
                    appState = appState,
                    nowMs = nowMs,
                    elapsedMs = elapsedMs,
                    randomProvider = randomProvider,
                ) || changed
                nextCharacterState = source.objectComponent.optIntOrNull("state")
            }
        }

        return RefreshedHomeWidgetWorldData(
            rawWorldData = worldData.toString(),
            changed = changed,
            hatched = hatched,
            previousCharacterState = previousCharacterState,
            nextCharacterState = nextCharacterState,
            selectedCharacterKey = selectedCharacterKey,
        )
    }

    private fun completeEggHatch(
        source: CharacterEntitySource,
        selectedCharacterKey: Int,
    ) {
        source.objectComponent.put("state", NATIVE_CHARACTER_STATE_IDLE)
        source.characterStatus.put("characterKey", selectedCharacterKey)
        source.characterStatus.put("evolutionPhase", 1)
        source.eggHatch.put("hatchTime", 0)
        source.eggHatch.put("hatchDurationMs", 0)
        source.eggHatch.put("isReadyToHatch", false)
        source.eggHatch.put("syringeCount", 0)
        source.eggHatch.put("pendingCharacterKey", NATIVE_CHARACTER_KEY_NULL)
    }

    private fun progressPostHatchLifecycle(
        source: CharacterEntitySource,
        entities: JSONArray,
        appState: JSONObject,
        nowMs: Long,
        elapsedMs: Long,
        randomProvider: HomeWidgetNativeLifecycleRandomProvider,
    ): Boolean {
        var changed = false
        val previousState = source.objectComponent.optIntOrNull("state")
        val previousStamina = source.characterStatus.optDoubleOrNull("stamina")
            ?: NATIVE_MAX_STAMINA
        val nextStamina = progressStamina(
            stamina = previousStamina,
            characterState = previousState,
            deltaMs = elapsedMs.toDouble(),
        )
        if (nextStamina != previousStamina) {
            source.characterStatus.put("stamina", nextStamina)
            changed = true
        }

        val staleFoodChanged = progressFoodFreshness(entities, nowMs)
        changed = staleFoodChanged || changed

        changed = progressSleepLifecycle(
            source = source,
            appState = appState,
            nowMs = nowMs,
            elapsedMs = elapsedMs,
            randomProvider = randomProvider,
        ) || changed
        changed = progressDiseaseLifecycle(
            source = source,
            entities = entities,
            nowMs = nowMs,
            randomProvider = randomProvider,
        ) || changed

        return changed
    }

    private fun progressStamina(
        stamina: Double,
        characterState: Int?,
        deltaMs: Double,
    ): Double {
        if (deltaMs <= 0.0 ||
            characterState == NATIVE_CHARACTER_STATE_EGG ||
            characterState == NATIVE_CHARACTER_STATE_DEAD
        ) {
            return stamina.coerceIn(0.0, NATIVE_MAX_STAMINA)
        }

        var remainingDeltaMs = deltaMs
        var nextStamina = stamina.coerceIn(0.0, NATIVE_MAX_STAMINA)
        var staminaTimerMs = 0.0

        while (remainingDeltaMs > 0.0001 && nextStamina > 0.0) {
            val multiplier = resolveStaminaTimerMultiplier(nextStamina, characterState)
            if (multiplier <= 0.0) {
                break
            }

            val timeUntilDecrease =
                (NATIVE_STAMINA_DECREASE_INTERVAL_MS - staminaTimerMs) / multiplier

            if (remainingDeltaMs + 0.0001 < timeUntilDecrease) {
                break
            }

            staminaTimerMs = 0.0
            remainingDeltaMs = (remainingDeltaMs - timeUntilDecrease).coerceAtLeast(0.0)
            nextStamina = (nextStamina - NATIVE_STAMINA_DECREASE_AMOUNT)
                .coerceIn(0.0, NATIVE_MAX_STAMINA)
        }

        return nextStamina
    }

    private fun resolveStaminaTimerMultiplier(stamina: Double, characterState: Int?): Double {
        val sleepMultiplier = if (characterState == NATIVE_CHARACTER_STATE_SLEEPING) {
            NATIVE_SLEEPING_STAMINA_DECAY_MULTIPLIER
        } else {
            1.0
        }
        val decayMultiplier = when {
            stamina >= NATIVE_BOOSTED_STAMINA_THRESHOLD -> NATIVE_HIGH_STAMINA_DECAY_MULTIPLIER
            stamina < NATIVE_LOW_STAMINA_THRESHOLD -> NATIVE_LOW_STAMINA_DECAY_MULTIPLIER
            else -> 1.0
        }
        return sleepMultiplier * decayMultiplier
    }

    private fun progressSleepLifecycle(
        source: CharacterEntitySource,
        appState: JSONObject,
        nowMs: Long,
        elapsedMs: Long,
        randomProvider: HomeWidgetNativeLifecycleRandomProvider,
    ): Boolean {
        val state = source.objectComponent.optIntOrNull("state")
        if (state == NATIVE_CHARACTER_STATE_EGG || state == NATIVE_CHARACTER_STATE_DEAD) {
            return false
        }

        var changed = false
        val sleepSystem = source.sleepSystem
        val previousFatigue = sleepSystem.optDoubleOrNull("fatigue")
            ?: NATIVE_FATIGUE_DEFAULT
        val nextFatigue = progressFatigue(
            fatigue = previousFatigue,
            stamina = source.characterStatus.optDoubleOrNull("stamina") ?: NATIVE_MAX_STAMINA,
            isSleeping = state == NATIVE_CHARACTER_STATE_SLEEPING,
            isSick = hasStatus(source.statuses, NATIVE_CHARACTER_STATUS_SICK),
            elapsedMs = elapsedMs,
        )
        if (nextFatigue != previousFatigue) {
            sleepSystem.put("fatigue", nextFatigue)
            changed = true
        }

        changed = handleScheduledWake(source, nowMs) || changed
        changed = handleScheduledSleep(source, nowMs) || changed
        changed = handleDayNapChecks(source, appState, nowMs, randomProvider) || changed
        changed = handleNapWake(source, nowMs) || changed

        return changed
    }

    private fun progressFatigue(
        fatigue: Double,
        stamina: Double,
        isSleeping: Boolean,
        isSick: Boolean,
        elapsedMs: Long,
    ): Double {
        val nextFatigue = if (isSleeping) {
            val recoveryPerMs = (if (isSick) {
                NATIVE_FATIGUE_SLEEP_RECOVERY_PER_HOUR_WHEN_SICK
            } else {
                NATIVE_FATIGUE_SLEEP_RECOVERY_PER_HOUR
            }) / NATIVE_HOUR_MS
            fatigue - elapsedMs * recoveryPerMs
        } else {
            val gainPerMs = NATIVE_FATIGUE_AWAKE_GAIN_PER_HOUR *
                resolveStaminaFatigueAwakeGainMultiplier(stamina) /
                NATIVE_HOUR_MS
            fatigue + elapsedMs * gainPerMs
        }
        return nextFatigue.coerceIn(0.0, NATIVE_FATIGUE_MAX)
    }

    private fun resolveStaminaFatigueAwakeGainMultiplier(stamina: Double): Double {
        return when {
            stamina <= NATIVE_VERY_LOW_STAMINA_THRESHOLD ->
                NATIVE_CRITICAL_STAMINA_FATIGUE_AWAKE_GAIN_MULTIPLIER
            stamina <= NATIVE_LOW_STAMINA_THRESHOLD ->
                NATIVE_LOW_STAMINA_FATIGUE_AWAKE_GAIN_MULTIPLIER
            else -> 1.0
        }
    }

    private fun handleScheduledWake(source: CharacterEntitySource, nowMs: Long): Boolean {
        if (source.objectComponent.optIntOrNull("state") != NATIVE_CHARACTER_STATE_SLEEPING) {
            return false
        }
        val nextWakeTime = source.sleepSystem.optLongOrNull("nextWakeTime") ?: return false
        if (nextWakeTime <= 0L || nowMs < nextWakeTime) {
            return false
        }

        wakeCharacter(source, nowMs)
        return true
    }

    private fun handleScheduledSleep(source: CharacterEntitySource, nowMs: Long): Boolean {
        val nextSleepTime = source.sleepSystem.optLongOrNull("nextSleepTime") ?: return false
        if (nextSleepTime <= 0L || nowMs < nextSleepTime || !canEnterSleep(source)) {
            return false
        }

        val mode = if (source.sleepSystem.optInt("pendingSleepReason") == NATIVE_SLEEP_REASON_NAP) {
            NATIVE_SLEEP_MODE_DAY_NAP
        } else {
            NATIVE_SLEEP_MODE_NIGHT_SLEEP
        }
        enterSleep(source, nowMs, mode)
        return true
    }

    private fun handleDayNapChecks(
        source: CharacterEntitySource,
        appState: JSONObject,
        nowMs: Long,
        randomProvider: HomeWidgetNativeLifecycleRandomProvider,
    ): Boolean {
        if (resolveNativeTimeOfDay(nowMs, appState) != "day" ||
            source.objectComponent.optIntOrNull("state") == NATIVE_CHARACTER_STATE_SLEEPING ||
            (source.sleepSystem.optLongOrNull("nextSleepTime") ?: 0L) > 0L ||
            (source.sleepSystem.optDoubleOrNull("fatigue") ?: NATIVE_FATIGUE_DEFAULT) <
            NATIVE_FATIGUE_DAY_NAP_MIN_THRESHOLD
        ) {
            return false
        }

        if ((source.sleepSystem.optLongOrNull("nextNapCheckTime") ?: 0L) <= 0L) {
            source.sleepSystem.put("nextNapCheckTime", nowMs + NATIVE_DAY_NAP_CHECK_INTERVAL_MS)
            return true
        }

        var changed = false
        while (nowMs >= (source.sleepSystem.optLongOrNull("nextNapCheckTime") ?: Long.MAX_VALUE)) {
            val checkTime = source.sleepSystem.optLong("nextNapCheckTime")
            source.sleepSystem.put("nextNapCheckTime", checkTime + NATIVE_DAY_NAP_CHECK_INTERVAL_MS)
            changed = true

            val fatigue = source.sleepSystem.optDoubleOrNull("fatigue") ?: NATIVE_FATIGUE_DEFAULT
            val fatigueRatio = (fatigue / NATIVE_FATIGUE_MAX).coerceIn(0.0, 1.0)
            val napChance = min(1.0, NATIVE_DAY_NAP_CHANCE * (0.5 + fatigueRatio))
            val roll = normalizeRandom(
                randomProvider(
                    HomeWidgetNativeLifecycleRandomEvent(
                        objectId = source.objectComponent.optInt("id", 0),
                        checkTimeMs = checkTime,
                        reason = "day_nap",
                    ),
                ),
            )
            if (roll < napChance) {
                source.sleepSystem.put("nextSleepTime", nowMs)
                source.sleepSystem.put("pendingSleepReason", NATIVE_SLEEP_REASON_NAP)
                if (canEnterSleep(source)) {
                    enterSleep(source, nowMs, NATIVE_SLEEP_MODE_DAY_NAP)
                }
                break
            }
        }

        return changed
    }

    private fun handleNapWake(source: CharacterEntitySource, nowMs: Long): Boolean {
        if (source.objectComponent.optIntOrNull("state") != NATIVE_CHARACTER_STATE_SLEEPING ||
            source.sleepSystem.optInt("sleepMode") != NATIVE_SLEEP_MODE_DAY_NAP
        ) {
            return false
        }

        val startedAt = source.sleepSystem.optLongOrNull("sleepSessionStartedAt") ?: return false
        val elapsed = nowMs - startedAt
        val hasReachedMinDuration = elapsed >= NATIVE_DAY_NAP_MIN_DURATION_MS
        val hasRecoveredEnough = (source.sleepSystem.optDoubleOrNull("fatigue") ?: NATIVE_FATIGUE_MAX) <=
            NATIVE_FATIGUE_DAY_NAP_WAKE_THRESHOLD
        val hasReachedMaxDuration = elapsed >= NATIVE_DAY_NAP_MAX_DURATION_MS
        if (!hasReachedMaxDuration && !(hasReachedMinDuration && hasRecoveredEnough)) {
            return false
        }

        wakeCharacter(source, nowMs)
        return true
    }

    private fun enterSleep(source: CharacterEntitySource, nowMs: Long, mode: Int) {
        val reservedWakeTime = if (mode == NATIVE_SLEEP_MODE_NIGHT_SLEEP) {
            source.sleepSystem.optLongOrNull("nextWakeTime") ?: 0L
        } else {
            0L
        }
        val reservedWakeReason = if (mode == NATIVE_SLEEP_MODE_NIGHT_SLEEP) {
            source.sleepSystem.optInt("pendingWakeReason")
        } else {
            NATIVE_SLEEP_REASON_NONE
        }
        source.objectComponent.put("state", NATIVE_CHARACTER_STATE_SLEEPING)
        source.sleepSystem.put("sleepMode", mode)
        source.sleepSystem.put("sleepSessionStartedAt", nowMs)
        source.sleepSystem.put("nextSleepTime", 0)
        source.sleepSystem.put("pendingSleepReason", NATIVE_SLEEP_REASON_NONE)
        source.sleepSystem.put("nextWakeTime", if (reservedWakeTime > 0L) maxOf(nowMs, reservedWakeTime) else 0L)
        source.sleepSystem.put("pendingWakeReason", if (reservedWakeTime > 0L) reservedWakeReason else NATIVE_SLEEP_REASON_NONE)
        source.sleepSystem.put("nextNightWakeCheckTime", 0)
    }

    private fun wakeCharacter(source: CharacterEntitySource, nowMs: Long) {
        val nextState = if (hasStatus(source.statuses, NATIVE_CHARACTER_STATUS_SICK)) {
            NATIVE_CHARACTER_STATE_SICK
        } else {
            NATIVE_CHARACTER_STATE_IDLE
        }
        source.objectComponent.put("state", nextState)
        source.sleepSystem.put("sleepMode", NATIVE_SLEEP_MODE_AWAKE)
        source.sleepSystem.put("nextSleepTime", 0)
        source.sleepSystem.put("nextWakeTime", 0)
        source.sleepSystem.put("nextNightWakeCheckTime", 0)
        source.sleepSystem.put("pendingSleepReason", NATIVE_SLEEP_REASON_NONE)
        source.sleepSystem.put("pendingWakeReason", NATIVE_SLEEP_REASON_NONE)
        source.sleepSystem.put("sleepSessionStartedAt", 0)
        source.sleepSystem.put("nextNapCheckTime", nowMs + NATIVE_DAY_NAP_CHECK_INTERVAL_MS)
    }

    private fun canEnterSleep(source: CharacterEntitySource): Boolean {
        return when (source.objectComponent.optIntOrNull("state")) {
            NATIVE_CHARACTER_STATE_EGG,
            NATIVE_CHARACTER_STATE_DEAD,
            NATIVE_CHARACTER_STATE_EATING,
            -> false
            else -> true
        }
    }

    private fun progressDiseaseLifecycle(
        source: CharacterEntitySource,
        entities: JSONArray,
        nowMs: Long,
        randomProvider: HomeWidgetNativeLifecycleRandomProvider,
    ): Boolean {
        val state = source.objectComponent.optIntOrNull("state")
        if (state == NATIVE_CHARACTER_STATE_DEAD) {
            return false
        }
        if (state == NATIVE_CHARACTER_STATE_EGG) {
            removeStatus(source.statuses, NATIVE_CHARACTER_STATUS_SICK)
            source.diseaseSystem.put("sickStartTime", 0)
            source.diseaseSystem.put(
                "nextCheckTime",
                advanceCheckTime(
                    source.diseaseSystem.optLongOrNull("nextCheckTime"),
                    nowMs,
                    NATIVE_DISEASE_CHECK_INTERVAL_MS,
                ),
            )
            return true
        }

        var nextCheckTime = source.diseaseSystem.optLongOrNull("nextCheckTime")
        if (nextCheckTime == null || nextCheckTime <= 0L) {
            source.diseaseSystem.put("nextCheckTime", nowMs + NATIVE_DISEASE_CHECK_INTERVAL_MS)
            return true
        }

        var changed = false
        val isSleeping = state == NATIVE_CHARACTER_STATE_SLEEPING
        val effectiveInterval = if (isSleeping) {
            (NATIVE_DISEASE_CHECK_INTERVAL_MS / NATIVE_SLEEPING_DISEASE_RATE_MULTIPLIER).toLong()
        } else {
            NATIVE_DISEASE_CHECK_INTERVAL_MS
        }
        while (nowMs >= nextCheckTime) {
            val checkTime = nextCheckTime
            nextCheckTime += effectiveInterval
            changed = true

            if (!hasStatus(source.statuses, NATIVE_CHARACTER_STATUS_SICK)) {
                val diseaseRate = calculateDiseaseRate(source, entities)
                val roll = normalizeRandom(
                    randomProvider(
                        HomeWidgetNativeLifecycleRandomEvent(
                            objectId = source.objectComponent.optInt("id", 0),
                            checkTimeMs = checkTime,
                            reason = "disease",
                        ),
                    ),
                )
                if (roll < diseaseRate) {
                    addStatus(source.statuses, NATIVE_CHARACTER_STATUS_SICK)
                    source.diseaseSystem.put("sickStartTime", checkTime)
                    if (!isSleeping) {
                        source.objectComponent.put("state", NATIVE_CHARACTER_STATE_SICK)
                    }
                    break
                }
            }
        }
        source.diseaseSystem.put("nextCheckTime", nextCheckTime)

        return changed
    }

    private fun calculateDiseaseRate(source: CharacterEntitySource, entities: JSONArray): Double {
        val stamina = source.characterStatus.optDoubleOrNull("stamina") ?: NATIVE_MAX_STAMINA
        val fatigue = source.sleepSystem.optDoubleOrNull("fatigue") ?: NATIVE_FATIGUE_DEFAULT
        var diseaseRate = NATIVE_BASE_DISEASE_RATE

        diseaseRate += when {
            stamina <= NATIVE_VERY_LOW_STAMINA_THRESHOLD -> NATIVE_VERY_LOW_STAMINA_DISEASE_BONUS
            stamina <= NATIVE_LOW_STAMINA_THRESHOLD -> NATIVE_LOW_STAMINA_DISEASE_BONUS
            else -> 0.0
        }
        diseaseRate += when {
            fatigue >= NATIVE_FATIGUE_DISEASE_THRESHOLD_EXHAUSTED ->
                NATIVE_FATIGUE_DISEASE_BONUS_EXHAUSTED
            fatigue >= NATIVE_FATIGUE_DISEASE_THRESHOLD_VERY_TIRED ->
                NATIVE_FATIGUE_DISEASE_BONUS_VERY_TIRED
            fatigue >= NATIVE_FATIGUE_DISEASE_THRESHOLD_TIRED ->
                NATIVE_FATIGUE_DISEASE_BONUS_TIRED
            else -> 0.0
        }
        diseaseRate += countObjectsInWorld(entities, NATIVE_POOB_OBJECT_TYPE) *
            NATIVE_POOP_DISEASE_RATE
        diseaseRate += countStaleFood(entities) * NATIVE_STALE_FOOD_DISEASE_RATE

        return diseaseRate.coerceIn(0.0, 1.0)
    }

    private fun progressFoodFreshness(entities: JSONArray, nowMs: Long): Boolean {
        var changed = false
        for (index in 0 until entities.length()) {
            val entity = entities.optJSONObject(index) ?: continue
            val components = entity.optJSONObject("components") ?: continue
            val objectComponent = components.optJSONObject("object") ?: continue
            if (objectComponent.optIntOrNull("type") != NATIVE_FOOD_OBJECT_TYPE) {
                continue
            }
            val freshness = ensureObject(components, "freshness")
            val timer = components.optJSONObject("freshnessTimer") ?: continue
            if (timer.optBoolean("isBeingEaten", false)) {
                continue
            }

            val currentFreshness = freshness.optInt("freshness", NATIVE_FOOD_FRESHNESS_NORMAL)
            if (currentFreshness == NATIVE_FOOD_FRESHNESS_FRESH) {
                freshness.put("freshness", NATIVE_FOOD_FRESHNESS_NORMAL)
                changed = true
            }
            if (freshness.optInt("freshness", NATIVE_FOOD_FRESHNESS_NORMAL) ==
                NATIVE_FOOD_FRESHNESS_STALE
            ) {
                if (objectComponent.optIntOrNull("state") != NATIVE_FOOD_STATE_BEING_THROWING &&
                    objectComponent.optIntOrNull("state") != NATIVE_FOOD_STATE_LANDED
                ) {
                    objectComponent.put("state", NATIVE_FOOD_STATE_LANDED)
                    changed = true
                }
                continue
            }

            val createdTime = timer.optLongOrNull("createdTime") ?: nowMs
            val staleTime = timer.optLongOrNull("staleTime")
                ?.takeIf { it > 0L }
                ?: NATIVE_NORMAL_TO_STALE_TIME_MS
            if (nowMs - createdTime >= staleTime) {
                freshness.put("freshness", NATIVE_FOOD_FRESHNESS_STALE)
                objectComponent.put("state", NATIVE_FOOD_STATE_LANDED)
                changed = true
            }
        }
        return changed
    }

    private fun advanceCheckTime(
        currentCheckTime: Long?,
        nowMs: Long,
        intervalMs: Long,
    ): Long {
        var nextCheckTime = currentCheckTime ?: return nowMs + intervalMs
        if (nextCheckTime <= 0L) {
            return nowMs + intervalMs
        }
        while (nowMs >= nextCheckTime) {
            nextCheckTime += intervalMs
        }
        return nextCheckTime
    }

    private fun resolveNativeTimeOfDay(nowMs: Long, appState: JSONObject): String {
        if (!appState.optBoolean("use_local_time", true)) {
            return "day"
        }

        val calendar = java.util.Calendar.getInstance().apply {
            timeInMillis = nowMs
        }
        val hour = calendar.get(java.util.Calendar.HOUR_OF_DAY)
        return if (hour >= 19 || hour < 6) "night" else "day"
    }

    private fun ensureObject(target: JSONObject, key: String): JSONObject {
        target.optJSONObject(key)?.let { return it }
        return JSONObject().also { target.put(key, it) }
    }

    private fun ensureArray(target: JSONObject, key: String): JSONArray {
        target.optJSONArray(key)?.let { return it }
        return JSONArray().also { target.put(key, it) }
    }

    private fun findMutableMainCharacter(entities: JSONArray): CharacterEntitySource? {
        for (index in 0 until entities.length()) {
            val entity = entities.optJSONObject(index) ?: continue
            val components = ensureObject(entity, "components")
            val objectComponent = ensureObject(components, "object")
            if (objectComponent.optIntOrNull("type") != NATIVE_CHARACTER_OBJECT_TYPE) {
                continue
            }

            return CharacterEntitySource(
                components = components,
                objectComponent = objectComponent,
                characterStatus = ensureObject(components, "characterStatus"),
                eggHatch = ensureObject(components, "eggHatch"),
                diseaseSystem = ensureObject(components, "diseaseSystem"),
                sleepSystem = ensureObject(components, "sleepSystem"),
            )
        }

        return null
    }

    private fun resolveStartingCharacterKeyForHatch(
        worldData: JSONObject,
        source: CharacterEntitySource,
    ): Int {
        normalizePendingEggHatchCharacterKey(
            source.eggHatch.optIntOrNull("pendingCharacterKey"),
        )?.let { return it }

        val staleFoodCountAtHatch = countStaleFoodAtHatch(worldData.optJSONArray("entities"))
        val syringeCount = normalizeEggHatchBonusCount(
            source.eggHatch.optIntOrNull("syringeCount") ?: 0,
        )
        val random = resolveDeterministicHatchRandom(
            objectId = source.objectComponent.optIntOrNull("id") ?: 0,
            hatchTimeMs = source.eggHatch.optLongOrNull("hatchTime") ?: 0L,
            monsterName = ensureObject(worldData, "world_metadata").optString("monster_name"),
            staleFoodCountAtHatch = staleFoodCountAtHatch,
            syringeCount = syringeCount,
        )

        return selectEggHatchStartingCharacterKey(
            staleFoodCountAtHatch = staleFoodCountAtHatch,
            syringeCount = syringeCount,
            random = random,
        )
    }

    private fun normalizePendingEggHatchCharacterKey(value: Int?): Int? {
        return when (value) {
            NATIVE_GREEN_SLIME_A1_CHARACTER_KEY,
            NATIVE_SOIL_SLIME_A1_CHARACTER_KEY,
            NATIVE_SKULL_SLIME_A1_CHARACTER_KEY,
            -> value
            else -> null
        }
    }

    private fun countStaleFoodAtHatch(entities: JSONArray?): Int {
        if (entities == null) {
            return 0
        }

        var count = 0
        for (index in 0 until entities.length()) {
            val entity = entities.optJSONObject(index) ?: continue
            val components = entity.optJSONObject("components") ?: continue
            val objectComponent = components.optJSONObject("object") ?: continue
            if (objectComponent.optIntOrNull("type") != NATIVE_FOOD_OBJECT_TYPE) {
                continue
            }

            val freshness = components.optJSONObject("freshness") ?: continue
            if (freshness.optIntOrNull("freshness") == NATIVE_FOOD_FRESHNESS_STALE) {
                count += 1
            }
        }

        return count
    }

    private fun countStaleFood(entities: JSONArray): Int {
        var count = 0
        for (index in 0 until entities.length()) {
            val entity = entities.optJSONObject(index) ?: continue
            val components = entity.optJSONObject("components") ?: continue
            val objectComponent = components.optJSONObject("object") ?: continue
            if (objectComponent.optIntOrNull("type") != NATIVE_FOOD_OBJECT_TYPE) {
                continue
            }
            if (objectComponent.optIntOrNull("state") == NATIVE_FOOD_STATE_BEING_THROWING) {
                continue
            }
            val freshness = components.optJSONObject("freshness") ?: continue
            if (freshness.optIntOrNull("freshness") == NATIVE_FOOD_FRESHNESS_STALE) {
                count += 1
            }
        }
        return count
    }

    private fun countObjectsInWorld(entities: JSONArray, objectType: Int): Int {
        var count = 0
        for (index in 0 until entities.length()) {
            val entity = entities.optJSONObject(index) ?: continue
            val objectComponent = entity.optJSONObject("components")
                ?.optJSONObject("object")
                ?: continue
            if (objectComponent.optIntOrNull("type") == objectType) {
                count += 1
            }
        }
        return count
    }

    private fun normalizeEggHatchBonusCount(value: Int): Int {
        if (value <= 0) {
            return 0
        }

        return min(NATIVE_MAX_EGG_HATCH_SELECTION_BONUS_COUNT, value)
    }

    private fun resolveDeterministicHatchRandom(
        objectId: Int,
        hatchTimeMs: Long,
        monsterName: String,
        staleFoodCountAtHatch: Int,
        syringeCount: Int,
    ): Double {
        val seed = "$objectId|$hatchTimeMs|$monsterName|$staleFoodCountAtHatch|$syringeCount"
        return normalizeRandom(hashToUnit(seed))
    }

    private fun resolveDeterministicLifecycleRandom(
        event: HomeWidgetNativeLifecycleRandomEvent,
    ): Double {
        return normalizeRandom(hashToUnit("${event.objectId}|${event.checkTimeMs}|${event.reason}"))
    }

    private fun hashToUnit(seed: String): Double {
        var hash = 0

        seed.forEach { character ->
            hash = 0x1fffffff and (hash + character.code)
            hash = 0x1fffffff and (hash + ((0x0007ffff and hash) shl 10))
            hash = hash xor (hash ushr 6)
        }

        hash = 0x1fffffff and (hash + ((0x03ffffff and hash) shl 3))
        hash = hash xor (hash ushr 11)
        hash = 0x1fffffff and (hash + ((0x00003fff and hash) shl 15))

        return (hash and 0x7fffffff).toDouble() / 0x7fffffff.toDouble()
    }

    private fun selectEggHatchStartingCharacterKey(
        staleFoodCountAtHatch: Int,
        syringeCount: Int,
        random: Double,
    ): Int {
        val normalizedStaleFoodCount = normalizeEggHatchBonusCount(staleFoodCountAtHatch)
        val normalizedSyringeCount = normalizeEggHatchBonusCount(syringeCount)
        val soilBonus = normalizedStaleFoodCount * NATIVE_EGG_HATCH_BONUS_PER_COUNT_PERCENT
        val skullBonus = normalizedSyringeCount * NATIVE_EGG_HATCH_BONUS_PER_COUNT_PERCENT
        val greenPercent = NATIVE_EGG_HATCH_BASE_GREEN_PERCENT - soilBonus - skullBonus
        val soilPercent = NATIVE_EGG_HATCH_BASE_SOIL_PERCENT + soilBonus
        val rollPercent = normalizeEggHatchSelectionRandom(random) * 100

        return when {
            rollPercent < greenPercent -> NATIVE_GREEN_SLIME_A1_CHARACTER_KEY
            rollPercent < greenPercent + soilPercent -> NATIVE_SOIL_SLIME_A1_CHARACTER_KEY
            else -> NATIVE_SKULL_SLIME_A1_CHARACTER_KEY
        }
    }

    private fun normalizeEggHatchSelectionRandom(value: Double): Double {
        return normalizeRandom(value)
    }

    private fun normalizeRandom(value: Double): Double {
        return when {
            !value.isFinite() || value <= 0.0 -> 0.0
            value >= 1.0 -> 1.0 - 1e-9
            else -> value
        }
    }

    private fun hasStatus(statuses: JSONArray, status: Int): Boolean {
        for (index in 0 until statuses.length()) {
            if (statuses.optInt(index) == status) {
                return true
            }
        }
        return false
    }

    private fun addStatus(statuses: JSONArray, status: Int) {
        if (hasStatus(statuses, status)) {
            return
        }
        statuses.put(status)
    }

    private fun removeStatus(statuses: JSONArray, status: Int) {
        for (index in 0 until statuses.length()) {
            if (statuses.optInt(index) == status) {
                statuses.put(index, 0)
                return
            }
        }
    }

    private fun JSONObject.optIntOrNull(key: String): Int? {
        return if (has(key)) optInt(key) else null
    }

    private fun JSONObject.optLongOrNull(key: String): Long? {
        return if (has(key)) optLong(key) else null
    }

    private fun JSONObject.optDoubleOrNull(key: String): Double? {
        return if (has(key)) optDouble(key).takeIf { it.isFinite() } else null
    }

    private val CharacterEntitySource.statuses: JSONArray
        get() = characterStatus.optJSONArray("statuses") ?: JSONArray().also {
            characterStatus.put("statuses", it)
        }

    private data class CharacterEntitySource(
        val components: JSONObject,
        val objectComponent: JSONObject,
        val characterStatus: JSONObject,
        val eggHatch: JSONObject,
        val diseaseSystem: JSONObject,
        val sleepSystem: JSONObject,
    )
}
