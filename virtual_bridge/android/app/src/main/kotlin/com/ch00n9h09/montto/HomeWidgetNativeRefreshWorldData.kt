package com.ch00n9h09.montto

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.min
import kotlin.math.sin

private const val NATIVE_CHARACTER_OBJECT_TYPE = 1
private const val NATIVE_FOOD_OBJECT_TYPE = 3
private const val NATIVE_POOB_OBJECT_TYPE = 4
private const val NATIVE_CHARACTER_STATE_EGG = 0
private const val NATIVE_CHARACTER_STATE_IDLE = 1
private const val NATIVE_CHARACTER_STATE_MOVING = 2
private const val NATIVE_CHARACTER_STATE_SLEEPING = 3
private const val NATIVE_CHARACTER_STATE_SICK = 4
private const val NATIVE_CHARACTER_STATE_EATING = 5
private const val NATIVE_CHARACTER_STATE_DEAD = 6
private const val NATIVE_CHARACTER_STATUS_SICK = 3
private const val NATIVE_CHARACTER_STATUS_SLOT_COUNT = 4
private const val NATIVE_TEXTURE_KEY_NULL = 0
private const val NATIVE_ANIMATION_KEY_IDLE = 1
private const val NATIVE_ANIMATION_KEY_WALKING = 2
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
private const val NATIVE_EGG_HATCH_BASE_SKULL_PERCENT = 15
private const val NATIVE_EGG_HATCH_BONUS_PER_COUNT_PERCENT = 2
private const val NATIVE_HATCH_RANDOM_MOVEMENT_MIN_IDLE_MS = 2000
private const val NATIVE_HATCH_RANDOM_MOVEMENT_MAX_IDLE_MS = 8000
private const val NATIVE_HATCH_RANDOM_MOVEMENT_MIN_MOVE_MS = 1000
private const val NATIVE_HATCH_RANDOM_MOVEMENT_MAX_MOVE_MS = 8000
private const val NATIVE_HATCH_ROAMING_OFFSET_THRESHOLD_MS = 5000L
private const val NATIVE_HATCH_ROAMING_MOVE_SPEED = 0.03
private const val NATIVE_HATCH_ROAMING_MAX_OFFSET_PX = 48.0
private const val NATIVE_HATCH_ROAMING_CYCLE_MS = 8000L
private const val NATIVE_HATCH_ROAMING_MOVE_WINDOW_START_MS = 2000L
private const val NATIVE_HATCH_ROAMING_MOVE_WINDOW_END_MS = 6000L
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
private const val NATIVE_POOP_DISEASE_RATE = 0.000093
private const val NATIVE_STALE_FOOD_DISEASE_RATE = 0.000093
private const val NATIVE_NORMAL_TO_STALE_TIME_MS = 10 * 60 * 1000L
private const val NATIVE_EVOLUTION_MAX_GAUGE = 100.0
private const val NATIVE_EVOLUTION_CHECK_INTERVAL_MS = 10_000L
private const val NATIVE_EVOLUTION_GAUGE_GAIN_MULTIPLIER = 1.1
private const val NATIVE_SLEEPING_EVOLUTION_TIME_MULTIPLIER = 1.0 / 3.0
private const val NATIVE_BOOSTED_EVOLUTION_GAUGE_GAIN_MULTIPLIER = 1.2
private const val NATIVE_MUTATION_BASE_RATE = 0.01
private const val NATIVE_MUTATION_STACK_CAP = 10
private const val NATIVE_MUTATION_DIRTY_EXPOSURE_STACK_INTERVAL_MS = 2 * 60 * 60 * 1000L
private const val NATIVE_MUTATION_DETOX_INTERVAL_CLASS_A_MS = 1 * 60 * 60 * 1000L
private const val NATIVE_MUTATION_DETOX_INTERVAL_DEFAULT_MS = 2 * 60 * 60 * 1000L
private const val NATIVE_EVOLUTION_CANDIDATE_KIND_BASE = "base"
private const val NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE = "same_line_variant_mutation"
private const val NATIVE_EVOLUTION_CANDIDATE_KIND_CROSS_LINE =
    "same_class_cross_line_mutation"
internal data class RefreshedHomeWidgetWorldData(
    val rawWorldData: String,
    val changed: Boolean,
    val hatched: Boolean,
    val previousCharacterState: Int?,
    val nextCharacterState: Int?,
    val selectedCharacterKey: Int?,
    val hatchSelectionDiagnostics: HomeWidgetNativeHatchSelectionDiagnostics? = null,
    val evolutionDiagnostics: HomeWidgetNativeEvolutionDiagnostics? = null,
)

internal data class HomeWidgetNativeEvolutionDiagnostics(
    val evolutionGageBefore: Double?,
    val evolutionGageAfter: Double?,
    val evolutionGageIncreased: Boolean,
    val blockReason: String,
) {
    fun toMap(): Map<String, Any?> {
        return mapOf(
            "evolutionGageBefore" to evolutionGageBefore,
            "evolutionGageAfter" to evolutionGageAfter,
            "evolutionGageIncreased" to evolutionGageIncreased,
            "evolutionBlockReason" to blockReason,
        )
    }
}

private data class HomeWidgetNativePostHatchLifecycleResult(
    val changed: Boolean,
    val evolutionDiagnostics: HomeWidgetNativeEvolutionDiagnostics?,
)

private data class HomeWidgetNativeEvolutionProgressResult(
    val changed: Boolean,
    val diagnostics: HomeWidgetNativeEvolutionDiagnostics,
)

internal data class HomeWidgetNativeHatchSelectionDiagnostics(
    val staleFoodCountAtHatch: Int,
    val syringeCount: Int,
    val normalizedStaleFoodCountAtHatch: Int,
    val normalizedSyringeCount: Int,
    val random: Double?,
    val normalizedRandom: Double?,
    val rollPercent: Double?,
    val greenProbability: Int,
    val soilProbability: Int,
    val skullProbability: Int,
    val selectedCharacterKey: Int,
    val usedPendingCharacterKey: Boolean,
) {
    fun toMap(): Map<String, Any?> {
        return mapOf(
            "staleFoodCountAtHatch" to staleFoodCountAtHatch,
            "syringeCount" to syringeCount,
            "normalizedStaleFoodCountAtHatch" to normalizedStaleFoodCountAtHatch,
            "normalizedSyringeCount" to normalizedSyringeCount,
            "random" to random,
            "normalizedRandom" to normalizedRandom,
            "rollPercent" to rollPercent,
            "probabilities" to mapOf(
                "green" to greenProbability,
                "soil" to soilProbability,
                "skull" to skullProbability,
            ),
            "selectedCharacterKey" to selectedCharacterKey,
            "usedPendingCharacterKey" to usedPendingCharacterKey,
        )
    }
}

internal data class HomeWidgetNativeLifecycleRandomEvent(
    val objectId: Int,
    val checkTimeMs: Long,
    val reason: String,
)

internal typealias HomeWidgetNativeLifecycleRandomProvider = (
    HomeWidgetNativeLifecycleRandomEvent,
) -> Double

internal object HomeWidgetNativeRefreshWorldData {
    private val nativeEvolutionSpecs = createNativeEvolutionSpecs()
    private val nativeMonsterCharacterKeys = nativeEvolutionSpecs.keys.sorted()

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
        var hatchSelectionDiagnostics: HomeWidgetNativeHatchSelectionDiagnostics? = null
        var previousCharacterState: Int? = null
        var nextCharacterState: Int? = null
        var evolutionDiagnostics: HomeWidgetNativeEvolutionDiagnostics? = null

        if (source != null) {
            previousCharacterState = source.objectComponent.optIntOrNull("state")
            nextCharacterState = previousCharacterState
            changed = syncSickStatusFromState(source) || changed

            if (previousCharacterState == NATIVE_CHARACTER_STATE_EGG) {
                val hatchTimeMs = source.eggHatch.optLongOrNull("hatchTime")
                if (hatchTimeMs != null && hatchTimeMs > 0L && nowMs >= hatchTimeMs) {
                    changed = progressFoodFreshness(entities, nowMs) || changed
                    val hatchSelection = resolveStartingCharacterKeyForHatch(
                        worldData = worldData,
                        source = source,
                    )
                    selectedCharacterKey = hatchSelection.selectedCharacterKey
                    hatchSelectionDiagnostics = hatchSelection.diagnostics
                    completeEggHatch(
                        source = source,
                        selectedCharacterKey = hatchSelection.selectedCharacterKey,
                        hatchTimeMs = hatchTimeMs,
                        nowMs = nowMs,
                        monsterName = worldMetadata.optString("monster_name"),
                    )
                    nextCharacterState = source.objectComponent.optIntOrNull("state")
                    hatched = true
                    changed = true
                }
                evolutionDiagnostics = buildEvolutionDiagnostics(
                    source = source,
                    blockReason = "egg",
                )
            } else if (elapsedMs > 0L) {
                val lifecycleResult = progressPostHatchLifecycle(
                    source = source,
                    entities = entities,
                    appState = appState,
                    nowMs = nowMs,
                    elapsedMs = elapsedMs,
                    randomProvider = randomProvider,
                )
                changed = lifecycleResult.changed || changed
                evolutionDiagnostics = lifecycleResult.evolutionDiagnostics
                nextCharacterState = source.objectComponent.optIntOrNull("state")
            } else {
                evolutionDiagnostics = buildEvolutionDiagnostics(
                    source = source,
                    blockReason = "elapsed_below_interval",
                )
            }
        }

        return RefreshedHomeWidgetWorldData(
            rawWorldData = worldData.toString(),
            changed = changed,
            hatched = hatched,
            previousCharacterState = previousCharacterState,
            nextCharacterState = nextCharacterState,
            selectedCharacterKey = selectedCharacterKey,
            hatchSelectionDiagnostics = hatchSelectionDiagnostics,
            evolutionDiagnostics = evolutionDiagnostics,
        )
    }

    private fun completeEggHatch(
        source: CharacterEntitySource,
        selectedCharacterKey: Int,
        hatchTimeMs: Long,
        nowMs: Long,
        monsterName: String,
    ) {
        source.objectComponent.put("state", NATIVE_CHARACTER_STATE_IDLE)
        source.characterStatus.put("characterKey", selectedCharacterKey)
        source.characterStatus.put("evolutionPhase", 1)
        source.eggHatch.put("hatchTime", 0)
        source.eggHatch.put("hatchDurationMs", 0)
        source.eggHatch.put("isReadyToHatch", false)
        source.eggHatch.put("syringeCount", 0)
        source.eggHatch.put("pendingCharacterKey", NATIVE_CHARACTER_KEY_NULL)
        ensureObject(source.components, "render")
            .put("storeIndex", NATIVE_TEXTURE_KEY_NULL)
            .put("textureKey", NATIVE_TEXTURE_KEY_NULL)
        ensureObject(source.components, "animationRender")
            .put("storeIndex", NATIVE_TEXTURE_KEY_NULL)
            .put("spritesheetKey", selectedCharacterKey)
            .put("animationKey", NATIVE_ANIMATION_KEY_IDLE)
            .put("isPlaying", true)
            .put("loop", true)
            .put("speed", 0.04)
        normalizePostHatchRuntimeComponents(
            source = source,
            hatchTimeMs = hatchTimeMs,
            nowMs = nowMs,
            monsterName = monsterName,
        )
    }

    private fun normalizePostHatchRuntimeComponents(
        source: CharacterEntitySource,
        hatchTimeMs: Long,
        nowMs: Long,
        monsterName: String,
    ) {
        val position = ensureObject(source.components, "position")
        val angle = ensureObject(source.components, "angle")
        val speed = ensureObject(source.components, "speed")
        val randomMovement = ensureObject(source.components, "randomMovement")
        randomMovement.put("minIdleTime", NATIVE_HATCH_RANDOM_MOVEMENT_MIN_IDLE_MS)
        randomMovement.put("maxIdleTime", NATIVE_HATCH_RANDOM_MOVEMENT_MAX_IDLE_MS)
        randomMovement.put("minMoveTime", NATIVE_HATCH_RANDOM_MOVEMENT_MIN_MOVE_MS)
        randomMovement.put("maxMoveTime", NATIVE_HATCH_RANDOM_MOVEMENT_MAX_MOVE_MS)

        val elapsedAfterHatchMs = (nowMs - hatchTimeMs).coerceAtLeast(0L)
        val objectId = source.objectComponent.optIntOrNull("id") ?: 0
        val roamAngle = resolveDeterministicRoamingAngle(
            objectId = objectId,
            hatchTimeMs = hatchTimeMs,
            monsterName = monsterName,
        )

        angle.put("value", roamAngle)
        if (elapsedAfterHatchMs >= NATIVE_HATCH_ROAMING_OFFSET_THRESHOLD_MS) {
            val distance = min(
                NATIVE_HATCH_ROAMING_MAX_OFFSET_PX,
                (elapsedAfterHatchMs - NATIVE_HATCH_ROAMING_OFFSET_THRESHOLD_MS) *
                    NATIVE_HATCH_ROAMING_MOVE_SPEED,
            )
            val currentX = position.optDoubleOrNull("x") ?: 0.0
            val currentY = position.optDoubleOrNull("y") ?: 0.0
            position.put("x", currentX + cos(roamAngle) * distance)
            position.put("y", currentY + sin(roamAngle) * distance)

            val cyclePosition = elapsedAfterHatchMs % NATIVE_HATCH_ROAMING_CYCLE_MS
            if (
                cyclePosition >= NATIVE_HATCH_ROAMING_MOVE_WINDOW_START_MS &&
                cyclePosition < NATIVE_HATCH_ROAMING_MOVE_WINDOW_END_MS
            ) {
                source.objectComponent.put("state", NATIVE_CHARACTER_STATE_MOVING)
                speed.put("value", NATIVE_HATCH_ROAMING_MOVE_SPEED)
                ensureObject(source.components, "animationRender")
                    .put("animationKey", NATIVE_ANIMATION_KEY_WALKING)
                randomMovement.put(
                    "nextChange",
                    nowMs + (NATIVE_HATCH_ROAMING_MOVE_WINDOW_END_MS - cyclePosition),
                )
            } else {
                source.objectComponent.put("state", NATIVE_CHARACTER_STATE_IDLE)
                speed.put("value", 0)
                ensureObject(source.components, "animationRender")
                    .put("animationKey", NATIVE_ANIMATION_KEY_IDLE)
                val nextMoveDelayMs = if (cyclePosition < NATIVE_HATCH_ROAMING_MOVE_WINDOW_START_MS) {
                    NATIVE_HATCH_ROAMING_MOVE_WINDOW_START_MS - cyclePosition
                } else {
                    NATIVE_HATCH_ROAMING_CYCLE_MS - cyclePosition +
                        NATIVE_HATCH_ROAMING_MOVE_WINDOW_START_MS
                }
                randomMovement.put("nextChange", nowMs + nextMoveDelayMs)
            }
        } else {
            source.objectComponent.put("state", NATIVE_CHARACTER_STATE_IDLE)
            speed.put("value", 0)
            randomMovement.put(
                "nextChange",
                nowMs + NATIVE_HATCH_ROAMING_OFFSET_THRESHOLD_MS - elapsedAfterHatchMs,
            )
        }
    }

    private fun progressPostHatchLifecycle(
        source: CharacterEntitySource,
        entities: JSONArray,
        appState: JSONObject,
        nowMs: Long,
        elapsedMs: Long,
        randomProvider: HomeWidgetNativeLifecycleRandomProvider,
    ): HomeWidgetNativePostHatchLifecycleResult {
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
        changed = progressMutationRiskDetox(source, nowMs) || changed
        val evolutionResult = progressEvolutionLifecycle(
            source = source,
            entities = entities,
            nowMs = nowMs,
            elapsedMs = elapsedMs,
            randomProvider = randomProvider,
        )
        changed = evolutionResult.changed || changed

        return HomeWidgetNativePostHatchLifecycleResult(
            changed = changed,
            evolutionDiagnostics = evolutionResult.diagnostics,
        )
    }

    private fun syncSickStatusFromState(source: CharacterEntitySource): Boolean {
        if (source.objectComponent.optIntOrNull("state") != NATIVE_CHARACTER_STATE_SICK) {
            return false
        }
        if (hasStatus(source.statuses, NATIVE_CHARACTER_STATUS_SICK)) {
            return false
        }

        return addStatus(source.statuses, NATIVE_CHARACTER_STATUS_SICK)
    }

    private fun progressEvolutionLifecycle(
        source: CharacterEntitySource,
        entities: JSONArray,
        nowMs: Long,
        elapsedMs: Long,
        randomProvider: HomeWidgetNativeLifecycleRandomProvider,
    ): HomeWidgetNativeEvolutionProgressResult {
        val state = source.objectComponent.optIntOrNull("state")
        if (elapsedMs <= 0L) {
            return evolutionProgressResult(
                source = source,
                changed = false,
                blockReason = "elapsed_below_interval",
            )
        }
        when {
            state == NATIVE_CHARACTER_STATE_EGG ->
                return evolutionProgressResult(
                    source = source,
                    changed = false,
                    blockReason = "egg",
                )
            state == NATIVE_CHARACTER_STATE_DEAD ->
                return evolutionProgressResult(
                    source = source,
                    changed = false,
                    blockReason = "dead",
                )
            state == NATIVE_CHARACTER_STATE_SICK ||
                hasStatus(source.statuses, NATIVE_CHARACTER_STATUS_SICK) ->
                return evolutionProgressResult(
                    source = source,
                    changed = false,
                    blockReason = "sick",
                )
        }

        val stamina = source.characterStatus.optDoubleOrNull("stamina") ?: NATIVE_MAX_STAMINA
        if (stamina < NATIVE_LOW_STAMINA_THRESHOLD) {
            return evolutionProgressResult(
                source = source,
                changed = false,
                blockReason = "low_stamina",
            )
        }

        val currentCharacterKey = source.characterStatus.optIntOrNull("characterKey")
            ?: NATIVE_CHARACTER_KEY_NULL
        val spec = nativeEvolutionSpecs[currentCharacterKey]
            ?: return evolutionProgressResult(
                source = source,
                changed = false,
                blockReason = "terminal",
            )
        if (spec.candidates.isEmpty()) {
            return evolutionProgressResult(
                source = source,
                changed = false,
                blockReason = "terminal",
            )
        }

        val effectiveElapsedMs = elapsedMs.toDouble() *
            if (state == NATIVE_CHARACTER_STATE_SLEEPING) {
                NATIVE_SLEEPING_EVOLUTION_TIME_MULTIPLIER
            } else {
                1.0
            }
        val increaseCount = floor(
            (effectiveElapsedMs + 0.000001) / NATIVE_EVOLUTION_CHECK_INTERVAL_MS.toDouble(),
        ).toInt()
        if (increaseCount <= 0) {
            return evolutionProgressResult(
                source = source,
                changed = false,
                blockReason = "elapsed_below_interval",
            )
        }

        val currentGauge = source.characterStatus.optDoubleOrNull("evolutionGage") ?: 0.0
        val baseGain = getNativeEvolutionGaugeGainForEntity(
            spec = spec,
            objectId = source.objectComponent.optIntOrNull("id") ?: 0,
        )
        if (baseGain <= 0.0) {
            return evolutionProgressResult(
                source = source,
                changed = false,
                blockReason = "terminal",
            )
        }

        val gaugeGain = if (stamina >= NATIVE_BOOSTED_STAMINA_THRESHOLD) {
            baseGain * NATIVE_BOOSTED_EVOLUTION_GAUGE_GAIN_MULTIPLIER
        } else {
            baseGain
        }
        val nextGauge = min(
            NATIVE_EVOLUTION_MAX_GAUGE,
            currentGauge + gaugeGain * increaseCount,
        )
        if (nextGauge == currentGauge) {
            return evolutionProgressResult(
                source = source,
                changed = false,
                blockReason = "none",
            )
        }

        source.characterStatus.put("evolutionGage", nextGauge)
        if (nextGauge >= NATIVE_EVOLUTION_MAX_GAUGE) {
            resolveNativeEvolutionCandidate(
                source = source,
                entities = entities,
                currentSpec = spec,
                nowMs = nowMs,
                randomProvider = randomProvider,
            )?.let { candidate ->
                applyNativeEvolution(
                    source = source,
                    currentSpec = spec,
                    candidate = candidate,
                )
            }
        }

        return HomeWidgetNativeEvolutionProgressResult(
            changed = true,
            diagnostics = buildEvolutionDiagnostics(
                source = source,
                evolutionGageBefore = currentGauge,
                evolutionGageIncreased = nextGauge > currentGauge,
                blockReason = "none",
            ),
        )
    }

    private fun evolutionProgressResult(
        source: CharacterEntitySource,
        changed: Boolean,
        blockReason: String,
    ): HomeWidgetNativeEvolutionProgressResult {
        return HomeWidgetNativeEvolutionProgressResult(
            changed = changed,
            diagnostics = buildEvolutionDiagnostics(
                source = source,
                blockReason = blockReason,
            ),
        )
    }

    private fun buildEvolutionDiagnostics(
        source: CharacterEntitySource,
        blockReason: String,
        evolutionGageBefore: Double? = source.characterStatus.optDoubleOrNull("evolutionGage"),
        evolutionGageIncreased: Boolean = false,
    ): HomeWidgetNativeEvolutionDiagnostics {
        return HomeWidgetNativeEvolutionDiagnostics(
            evolutionGageBefore = evolutionGageBefore,
            evolutionGageAfter = source.characterStatus.optDoubleOrNull("evolutionGage"),
            evolutionGageIncreased = evolutionGageIncreased,
            blockReason = blockReason,
        )
    }

    private fun getNativeEvolutionGaugeGainForEntity(
        spec: NativeEvolutionSpec,
        objectId: Int,
    ): Double {
        val targetDurationMs = when (spec.classCode) {
            "A" -> 20 * NATIVE_HOUR_MS
            "B" -> 40 * NATIVE_HOUR_MS
            "C" -> 60 * NATIVE_HOUR_MS
            "D" -> 80 * NATIVE_HOUR_MS
            else -> return 0.0
        }
        val varianceMs = when (spec.classCode) {
            "A" -> 2 * NATIVE_HOUR_MS
            "B" -> 4 * NATIVE_HOUR_MS
            "C" -> 6 * NATIVE_HOUR_MS
            "D" -> 8 * NATIVE_HOUR_MS
            else -> return 0.0
        }
        val seedValue = getStableSeededUnitValue(
            "${objectId}:${spec.classCode}:${spec.phase}",
        )
        val durationMs = targetDurationMs + varianceMs * (seedValue * 2 - 1)
        if (durationMs <= 0.0) {
            return 0.0
        }

        return (
            (NATIVE_EVOLUTION_MAX_GAUGE * NATIVE_EVOLUTION_CHECK_INTERVAL_MS) /
                durationMs
            ) * NATIVE_EVOLUTION_GAUGE_GAIN_MULTIPLIER
    }

    private fun resolveNativeEvolutionCandidate(
        source: CharacterEntitySource,
        entities: JSONArray,
        currentSpec: NativeEvolutionSpec,
        nowMs: Long,
        randomProvider: HomeWidgetNativeLifecycleRandomProvider,
    ): NativeEvolutionCandidate? {
        val objectId = source.objectComponent.optIntOrNull("id") ?: 0
        val mutationStacks = getNativeMutationRiskStacks(source, entities, nowMs)
        val mutationCandidate = resolveNativeMutationEvolutionCandidate(
            currentSpec = currentSpec,
            unnecessaryInjectionStacks = mutationStacks.unnecessaryInjectionStacks,
            dirtyExposureStacks = mutationStacks.dirtyExposureStacks,
            mutationRoll = normalizeRandom(
                randomProvider(
                    HomeWidgetNativeLifecycleRandomEvent(
                        objectId = objectId,
                        checkTimeMs = nowMs,
                        reason = "evolution_mutation",
                    ),
                ),
            ),
            targetRoll = normalizeRandom(
                randomProvider(
                    HomeWidgetNativeLifecycleRandomEvent(
                        objectId = objectId,
                        checkTimeMs = nowMs,
                        reason = "evolution_mutation_target",
                    ),
                ),
            ),
        )
        if (mutationCandidate != null) {
            return mutationCandidate
        }

        return resolveWeightedNativeEvolutionCandidate(
            candidates = currentSpec.candidates,
            random = normalizeRandom(
                randomProvider(
                    HomeWidgetNativeLifecycleRandomEvent(
                        objectId = objectId,
                        checkTimeMs = nowMs,
                        reason = "evolution",
                    ),
                ),
            ),
        )
    }

    private fun resolveNativeMutationEvolutionCandidate(
        currentSpec: NativeEvolutionSpec,
        unnecessaryInjectionStacks: Int,
        dirtyExposureStacks: Int,
        mutationRoll: Double,
        targetRoll: Double,
    ): NativeEvolutionCandidate? {
        val mutationTargets = getNativeSameClassCrossGeneMutationTargets(currentSpec)
        if (mutationTargets.isEmpty()) {
            return null
        }

        val mutationRate = calculateNativeMutationRate(
            currentSpec = currentSpec,
            unnecessaryInjectionStacks = unnecessaryInjectionStacks,
            dirtyExposureStacks = dirtyExposureStacks,
        )
        if (mutationRoll >= mutationRate) {
            return null
        }

        val index = floor(targetRoll * mutationTargets.size).toInt()
            .coerceIn(0, mutationTargets.lastIndex)
        return NativeEvolutionCandidate(
            to = mutationTargets[index],
            weight = 1,
            kind = NATIVE_EVOLUTION_CANDIDATE_KIND_CROSS_LINE,
        )
    }

    private fun calculateNativeMutationRate(
        currentSpec: NativeEvolutionSpec,
        unnecessaryInjectionStacks: Int,
        dirtyExposureStacks: Int,
    ): Double {
        val stackBonusRate = when (currentSpec.geneLine) {
            "green-slime" -> 0.005
            "soil-slime" -> 0.01
            "skull-slime" -> 0.015
            else -> 0.0
        }
        val injectionStacks = normalizeNativeMutationStackCount(unnecessaryInjectionStacks)
        val dirtyStacks = normalizeNativeMutationStackCount(dirtyExposureStacks)

        return min(
            1.0,
            NATIVE_MUTATION_BASE_RATE + (injectionStacks + dirtyStacks) * stackBonusRate,
        )
    }

    private fun getNativeSameClassCrossGeneMutationTargets(
        currentSpec: NativeEvolutionSpec,
    ): List<Int> {
        return nativeMonsterCharacterKeys.filter { targetKey ->
            val targetSpec = nativeEvolutionSpecs[targetKey] ?: return@filter false
            targetSpec.classCode == currentSpec.classCode &&
                targetSpec.geneLine != currentSpec.geneLine
        }
    }

    private fun resolveWeightedNativeEvolutionCandidate(
        candidates: List<NativeEvolutionCandidate>,
        random: Double,
    ): NativeEvolutionCandidate? {
        if (candidates.isEmpty()) {
            return null
        }

        val totalWeight = candidates.sumOf { it.weight }.takeIf { it > 0 } ?: return null
        val roll = random * totalWeight
        var accumulatedWeight = 0
        for (candidate in candidates) {
            accumulatedWeight += candidate.weight
            if (roll < accumulatedWeight) {
                return candidate
            }
        }

        return candidates.lastOrNull()
    }

    private fun applyNativeEvolution(
        source: CharacterEntitySource,
        currentSpec: NativeEvolutionSpec,
        candidate: NativeEvolutionCandidate,
    ) {
        val targetSpec = nativeEvolutionSpecs[candidate.to] ?: return
        val nextPhase = if (candidate.kind == NATIVE_EVOLUTION_CANDIDATE_KIND_CROSS_LINE) {
            currentSpec.phase
        } else {
            targetSpec.phase
        }

        source.characterStatus.put("characterKey", candidate.to)
        source.characterStatus.put("evolutionPhase", nextPhase)
        source.characterStatus.put("evolutionGage", 0.0)
        ensureObject(source.components, "animationRender")
            .put("storeIndex", NATIVE_TEXTURE_KEY_NULL)
            .put("spritesheetKey", candidate.to)
            .put("animationKey", NATIVE_ANIMATION_KEY_IDLE)
            .put("isPlaying", true)
            .put("loop", true)
            .put("speed", 0.04)
        ensureObject(source.components, "render")
            .put("storeIndex", NATIVE_TEXTURE_KEY_NULL)
            .put("textureKey", NATIVE_TEXTURE_KEY_NULL)
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
        var diseaseRate = NATIVE_BASE_DISEASE_RATE

        diseaseRate += when {
            stamina <= NATIVE_VERY_LOW_STAMINA_THRESHOLD -> NATIVE_VERY_LOW_STAMINA_DISEASE_BONUS
            stamina <= NATIVE_LOW_STAMINA_THRESHOLD -> NATIVE_LOW_STAMINA_DISEASE_BONUS
            else -> 0.0
        }
        diseaseRate += countObjectsInWorld(entities, NATIVE_POOB_OBJECT_TYPE) *
            NATIVE_POOP_DISEASE_RATE
        diseaseRate += countStaleFood(entities) * NATIVE_STALE_FOOD_DISEASE_RATE

        return diseaseRate.coerceIn(0.0, 1.0)
    }

    private fun progressMutationRiskDetox(
        source: CharacterEntitySource,
        nowMs: Long,
    ): Boolean {
        val mutationRisk = ensureObject(source.components, "mutationRisk")
        val detoxIntervalMs = getNativeMutationDetoxIntervalMs(
            source.characterStatus.optIntOrNull("characterKey"),
        )
        val previousInjectionStacks =
            mutationRisk.optIntOrNull("unnecessaryInjectionStacks") ?: 0
        val previousDirtyStacks = mutationRisk.optIntOrNull("dirtyExposureStacks") ?: 0
        val previousLastInjectionDetoxTime =
            mutationRisk.optLongOrNull("lastInjectionDetoxTime")
        val previousLastDirtyDetoxTime = mutationRisk.optLongOrNull("lastDirtyDetoxTime")
        val nextInjectionStacks = getDetoxedNativeMutationStackCount(
            currentStacks = previousInjectionStacks,
            lastDetoxTime = previousLastInjectionDetoxTime,
            currentTime = nowMs,
            detoxIntervalMs = detoxIntervalMs,
        )
        val nextDirtyStacks = previousDirtyStacks.coerceAtLeast(0)
        val nextLastDirtyDetoxTime = previousLastDirtyDetoxTime ?: nowMs

        mutationRisk.put(
            "unnecessaryInjectionStacks",
            nextInjectionStacks.stacks,
        )
        mutationRisk.put("dirtyExposureStacks", nextDirtyStacks)
        mutationRisk.put(
            "lastInjectionDetoxTime",
            nextInjectionStacks.lastDetoxTime,
        )
        mutationRisk.put("lastDirtyDetoxTime", nextLastDirtyDetoxTime)

        return previousInjectionStacks != nextInjectionStacks.stacks ||
            previousDirtyStacks != nextDirtyStacks ||
            previousLastInjectionDetoxTime != nextInjectionStacks.lastDetoxTime ||
            previousLastDirtyDetoxTime != nextLastDirtyDetoxTime
    }

    private fun getDetoxedNativeMutationStackCount(
        currentStacks: Int,
        lastDetoxTime: Long?,
        currentTime: Long,
        detoxIntervalMs: Long,
    ): NativeMutationRiskDetoxResult {
        val normalizedStacks = normalizeNativeMutationStackCount(currentStacks)
        val normalizedLastDetoxTime = lastDetoxTime ?: currentTime

        if (normalizedStacks <= 0 || detoxIntervalMs <= 0L) {
            return NativeMutationRiskDetoxResult(
                stacks = 0,
                lastDetoxTime = currentTime,
            )
        }

        val elapsedMs = (currentTime - normalizedLastDetoxTime).coerceAtLeast(0L)
        val detoxCount = floor(
            elapsedMs.toDouble() / detoxIntervalMs.toDouble(),
        ).toInt()

        if (detoxCount <= 0) {
            return NativeMutationRiskDetoxResult(
                stacks = normalizedStacks,
                lastDetoxTime = normalizedLastDetoxTime,
            )
        }

        val stacks = (normalizedStacks - detoxCount).coerceAtLeast(0)

        return NativeMutationRiskDetoxResult(
            stacks = stacks,
            lastDetoxTime = if (stacks == 0) {
                currentTime
            } else {
                normalizedLastDetoxTime + detoxCount * detoxIntervalMs
            },
        )
    }

    private fun getNativeMutationDetoxIntervalMs(characterKey: Int?): Long {
        val classCode = nativeEvolutionSpecs[characterKey]?.classCode
        return when (classCode) {
            "A" -> NATIVE_MUTATION_DETOX_INTERVAL_CLASS_A_MS
            "B", "C", "D" -> NATIVE_MUTATION_DETOX_INTERVAL_DEFAULT_MS
            else -> NATIVE_MUTATION_DETOX_INTERVAL_DEFAULT_MS
        }
    }

    private fun getNativeMutationRiskStacks(
        source: CharacterEntitySource,
        entities: JSONArray,
        nowMs: Long,
    ): NativeMutationRiskStacks {
        val mutationRisk = source.components.optJSONObject("mutationRisk")
        val unnecessaryInjectionStacks = normalizeNativeMutationStackCount(
            mutationRisk?.optIntOrNull("unnecessaryInjectionStacks") ?: 0,
        )
        val storedDirtyExposureStacks = mutationRisk
            ?.optIntOrNull("dirtyExposureStacks")
            ?.coerceAtLeast(0)
            ?: 0
        val activeDirtyExposureStacks = countActiveDirtyExposureStacks(entities, nowMs)

        return NativeMutationRiskStacks(
            unnecessaryInjectionStacks = unnecessaryInjectionStacks,
            dirtyExposureStacks = storedDirtyExposureStacks + activeDirtyExposureStacks,
        )
    }

    private fun countActiveDirtyExposureStacks(entities: JSONArray, nowMs: Long): Int {
        var stackCount = 0
        for (index in 0 until entities.length()) {
            val entity = entities.optJSONObject(index) ?: continue
            val components = entity.optJSONObject("components") ?: continue
            if (!isActiveDirtyExposureSource(components)) {
                continue
            }
            val dirtyExposure = components.optJSONObject("dirtyExposure")
            if (dirtyExposure == null) {
                stackCount += 1
                continue
            }
            val currentStacks = dirtyExposure.optIntOrNull("stackCount") ?: 0
            val accumulatedExposureMs =
                dirtyExposure.optLongOrNull("accumulatedExposureMs") ?: 0L
            val lastUpdatedTime = dirtyExposure.optLongOrNull("lastUpdatedTime") ?: nowMs
            val elapsedMs = (nowMs - lastUpdatedTime).coerceAtLeast(0L)
            val totalExposureMs = accumulatedExposureMs + elapsedMs
            val gainedStacks = floor(
                totalExposureMs.toDouble() /
                    NATIVE_MUTATION_DIRTY_EXPOSURE_STACK_INTERVAL_MS.toDouble(),
            ).toInt()
            val exposureStacks =
                normalizeNativeMutationStackCount(currentStacks + gainedStacks)

            stackCount += exposureStacks.coerceAtLeast(1)
        }

        return stackCount
    }

    private fun isActiveDirtyExposureSource(components: JSONObject): Boolean {
        val objectComponent = components.optJSONObject("object") ?: return false
        if (objectComponent.optIntOrNull("type") == NATIVE_POOB_OBJECT_TYPE) {
            return true
        }

        return objectComponent.optIntOrNull("type") == NATIVE_FOOD_OBJECT_TYPE &&
            objectComponent.optIntOrNull("state") != NATIVE_FOOD_STATE_BEING_THROWING &&
            components.optJSONObject("freshness")
                ?.optIntOrNull("freshness") == NATIVE_FOOD_FRESHNESS_STALE
    }

    private fun normalizeNativeMutationStackCount(value: Int): Int {
        if (value <= 0) {
            return 0
        }

        return min(NATIVE_MUTATION_STACK_CAP, value)
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
    ): NativeEggHatchSelection {
        val staleFoodCountAtHatch = countStaleFoodAtHatch(worldData.optJSONArray("entities"))
        val syringeCount = normalizeEggHatchBonusCount(
            source.eggHatch.optIntOrNull("syringeCount") ?: 0,
        )
        val probabilities = calculateEggHatchProbabilities(
            staleFoodCountAtHatch = staleFoodCountAtHatch,
            syringeCount = syringeCount,
        )
        normalizePendingEggHatchCharacterKey(
            source.eggHatch.optIntOrNull("pendingCharacterKey"),
        )?.let { pendingCharacterKey ->
            return NativeEggHatchSelection(
                selectedCharacterKey = pendingCharacterKey,
                diagnostics = HomeWidgetNativeHatchSelectionDiagnostics(
                    staleFoodCountAtHatch = staleFoodCountAtHatch,
                    syringeCount = syringeCount,
                    normalizedStaleFoodCountAtHatch = probabilities.normalizedStaleFoodCount,
                    normalizedSyringeCount = probabilities.normalizedSyringeCount,
                    random = null,
                    normalizedRandom = null,
                    rollPercent = null,
                    greenProbability = probabilities.green,
                    soilProbability = probabilities.soil,
                    skullProbability = probabilities.skull,
                    selectedCharacterKey = pendingCharacterKey,
                    usedPendingCharacterKey = true,
                ),
            )
        }

        val random = resolveDeterministicHatchRandom(
            objectId = source.objectComponent.optIntOrNull("id") ?: 0,
            hatchTimeMs = source.eggHatch.optLongOrNull("hatchTime") ?: 0L,
            monsterName = ensureObject(worldData, "world_metadata").optString("monster_name"),
            staleFoodCountAtHatch = staleFoodCountAtHatch,
            syringeCount = syringeCount,
        )
        val normalizedRandom = normalizeEggHatchSelectionRandom(random)
        val rollPercent = normalizedRandom * 100
        val selectedCharacterKey = selectEggHatchStartingCharacterKey(
            probabilities = probabilities,
            rollPercent = rollPercent,
        )

        return NativeEggHatchSelection(
            selectedCharacterKey = selectedCharacterKey,
            diagnostics = HomeWidgetNativeHatchSelectionDiagnostics(
                staleFoodCountAtHatch = staleFoodCountAtHatch,
                syringeCount = syringeCount,
                normalizedStaleFoodCountAtHatch = probabilities.normalizedStaleFoodCount,
                normalizedSyringeCount = probabilities.normalizedSyringeCount,
                random = random,
                normalizedRandom = normalizedRandom,
                rollPercent = rollPercent,
                greenProbability = probabilities.green,
                soilProbability = probabilities.soil,
                skullProbability = probabilities.skull,
                selectedCharacterKey = selectedCharacterKey,
                usedPendingCharacterKey = false,
            ),
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

    private fun calculateEggHatchProbabilities(
        staleFoodCountAtHatch: Int,
        syringeCount: Int,
    ): NativeEggHatchProbabilities {
        val normalizedStaleFoodCount = normalizeEggHatchBonusCount(staleFoodCountAtHatch)
        val normalizedSyringeCount = normalizeEggHatchBonusCount(syringeCount)
        val soilBonus = normalizedStaleFoodCount * NATIVE_EGG_HATCH_BONUS_PER_COUNT_PERCENT
        val skullBonus = normalizedSyringeCount * NATIVE_EGG_HATCH_BONUS_PER_COUNT_PERCENT
        return NativeEggHatchProbabilities(
            normalizedStaleFoodCount = normalizedStaleFoodCount,
            normalizedSyringeCount = normalizedSyringeCount,
            green = NATIVE_EGG_HATCH_BASE_GREEN_PERCENT - soilBonus - skullBonus,
            soil = NATIVE_EGG_HATCH_BASE_SOIL_PERCENT + soilBonus,
            skull = NATIVE_EGG_HATCH_BASE_SKULL_PERCENT + skullBonus,
        )
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

    private fun getStableSeededUnitValue(seed: String): Double {
        var hash = 2166136261L

        seed.forEach { character ->
            hash = hash xor character.code.toLong()
            hash = (hash * 16777619L) and 0xffffffffL
        }

        return hash.toDouble() / 4294967296.0
    }

    private fun selectEggHatchStartingCharacterKey(
        probabilities: NativeEggHatchProbabilities,
        rollPercent: Double,
    ): Int {
        return when {
            rollPercent < probabilities.green -> NATIVE_GREEN_SLIME_A1_CHARACTER_KEY
            rollPercent < probabilities.green + probabilities.soil -> NATIVE_SOIL_SLIME_A1_CHARACTER_KEY
            else -> NATIVE_SKULL_SLIME_A1_CHARACTER_KEY
        }
    }

    private fun resolveDeterministicRoamingAngle(
        objectId: Int,
        hatchTimeMs: Long,
        monsterName: String,
    ): Double {
        val random = hashToUnit("$objectId|$hatchTimeMs|$monsterName|post_hatch_roam")
        return normalizeRandom(random) * PI * 2
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

    private fun addStatus(statuses: JSONArray, status: Int): Boolean {
        if (hasStatus(statuses, status)) {
            return false
        }
        for (index in 0 until NATIVE_CHARACTER_STATUS_SLOT_COUNT) {
            if (statuses.optInt(index) == 0) {
                statuses.put(index, status)
                return true
            }
        }
        return false
    }

    private fun removeStatus(statuses: JSONArray, status: Int) {
        for (index in 0 until statuses.length()) {
            if (statuses.optInt(index) == status) {
                statuses.put(index, 0)
                return
            }
        }
    }

    private fun createNativeEvolutionSpecs(): Map<Int, NativeEvolutionSpec> {
        return listOf(
            spec(
                1,
                "green-slime",
                "A",
                1,
                listOf(
                    candidate(2, 55, NATIVE_EVOLUTION_CANDIDATE_KIND_BASE),
                    candidate(5, 25, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                    candidate(6, 20, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                ),
            ),
            spec(
                2,
                "green-slime",
                "B",
                2,
                listOf(
                    candidate(3, 50, NATIVE_EVOLUTION_CANDIDATE_KIND_BASE),
                    candidate(7, 20, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                    candidate(8, 15, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                    candidate(9, 15, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                ),
            ),
            spec(
                3,
                "green-slime",
                "C",
                3,
                listOf(
                    candidate(4, 50, NATIVE_EVOLUTION_CANDIDATE_KIND_BASE),
                    candidate(10, 20, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                    candidate(11, 15, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                    candidate(12, 15, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                ),
            ),
            spec(4, "green-slime", "D", 4, emptyList()),
            spec(
                5,
                "green-slime",
                "B",
                2,
                listOf(
                    candidate(7, 50, NATIVE_EVOLUTION_CANDIDATE_KIND_BASE),
                    candidate(3, 20, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                    candidate(8, 15, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                    candidate(9, 15, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                ),
            ),
            spec(
                6,
                "green-slime",
                "B",
                2,
                listOf(
                    candidate(8, 50, NATIVE_EVOLUTION_CANDIDATE_KIND_BASE),
                    candidate(3, 20, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                    candidate(7, 15, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                    candidate(9, 15, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                ),
            ),
            spec(
                7,
                "green-slime",
                "C",
                3,
                listOf(
                    candidate(10, 50, NATIVE_EVOLUTION_CANDIDATE_KIND_BASE),
                    candidate(4, 20, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                    candidate(11, 15, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                    candidate(12, 15, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                ),
            ),
            spec(
                8,
                "green-slime",
                "C",
                3,
                listOf(
                    candidate(11, 50, NATIVE_EVOLUTION_CANDIDATE_KIND_BASE),
                    candidate(4, 20, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                    candidate(10, 15, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                    candidate(12, 15, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                ),
            ),
            spec(
                9,
                "green-slime",
                "C",
                3,
                listOf(
                    candidate(12, 50, NATIVE_EVOLUTION_CANDIDATE_KIND_BASE),
                    candidate(4, 20, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                    candidate(10, 15, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                    candidate(11, 15, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                ),
            ),
            spec(10, "green-slime", "D", 4, emptyList()),
            spec(11, "green-slime", "D", 4, emptyList()),
            spec(12, "green-slime", "D", 4, emptyList()),
            spec(
                14,
                "skull-slime",
                "A",
                1,
                listOf(
                    candidate(16, 70, NATIVE_EVOLUTION_CANDIDATE_KIND_BASE),
                    candidate(17, 30, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                ),
            ),
            spec(
                16,
                "skull-slime",
                "B",
                2,
                listOf(
                    candidate(18, 70, NATIVE_EVOLUTION_CANDIDATE_KIND_BASE),
                    candidate(19, 30, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                ),
            ),
            spec(
                17,
                "skull-slime",
                "B",
                2,
                listOf(
                    candidate(19, 70, NATIVE_EVOLUTION_CANDIDATE_KIND_BASE),
                    candidate(18, 30, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                ),
            ),
            spec(
                18,
                "skull-slime",
                "C",
                3,
                listOf(
                    candidate(20, 70, NATIVE_EVOLUTION_CANDIDATE_KIND_BASE),
                    candidate(21, 30, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                ),
            ),
            spec(
                19,
                "skull-slime",
                "C",
                3,
                listOf(
                    candidate(21, 60, NATIVE_EVOLUTION_CANDIDATE_KIND_BASE),
                    candidate(20, 40, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                ),
            ),
            spec(20, "skull-slime", "D", 4, emptyList()),
            spec(21, "skull-slime", "D", 4, emptyList()),
            spec(
                22,
                "soil-slime",
                "A",
                1,
                listOf(
                    candidate(24, 70, NATIVE_EVOLUTION_CANDIDATE_KIND_BASE),
                    candidate(25, 30, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                ),
            ),
            spec(
                24,
                "soil-slime",
                "B",
                2,
                listOf(
                    candidate(26, 55, NATIVE_EVOLUTION_CANDIDATE_KIND_BASE),
                    candidate(27, 25, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                    candidate(28, 20, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                ),
            ),
            spec(
                25,
                "soil-slime",
                "B",
                2,
                listOf(
                    candidate(27, 55, NATIVE_EVOLUTION_CANDIDATE_KIND_BASE),
                    candidate(26, 25, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                    candidate(28, 20, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                ),
            ),
            spec(
                26,
                "soil-slime",
                "C",
                3,
                listOf(
                    candidate(29, 55, NATIVE_EVOLUTION_CANDIDATE_KIND_BASE),
                    candidate(30, 25, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                    candidate(31, 20, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                ),
            ),
            spec(
                27,
                "soil-slime",
                "C",
                3,
                listOf(
                    candidate(30, 55, NATIVE_EVOLUTION_CANDIDATE_KIND_BASE),
                    candidate(29, 25, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                    candidate(31, 20, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                ),
            ),
            spec(
                28,
                "soil-slime",
                "C",
                3,
                listOf(
                    candidate(31, 55, NATIVE_EVOLUTION_CANDIDATE_KIND_BASE),
                    candidate(29, 25, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                    candidate(30, 20, NATIVE_EVOLUTION_CANDIDATE_KIND_SAME_LINE),
                ),
            ),
            spec(29, "soil-slime", "D", 4, emptyList()),
            spec(30, "soil-slime", "D", 4, emptyList()),
            spec(31, "soil-slime", "D", 4, emptyList()),
        ).associateBy { it.key }
    }

    private fun spec(
        key: Int,
        geneLine: String,
        classCode: String,
        phase: Int,
        candidates: List<NativeEvolutionCandidate>,
    ): NativeEvolutionSpec {
        return NativeEvolutionSpec(
            key = key,
            geneLine = geneLine,
            classCode = classCode,
            phase = phase,
            candidates = candidates,
        )
    }

    private fun candidate(
        to: Int,
        weight: Int,
        kind: String,
    ): NativeEvolutionCandidate {
        return NativeEvolutionCandidate(to = to, weight = weight, kind = kind)
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

    private data class NativeMutationRiskStacks(
        val unnecessaryInjectionStacks: Int,
        val dirtyExposureStacks: Int,
    )

    private data class NativeMutationRiskDetoxResult(
        val stacks: Int,
        val lastDetoxTime: Long,
    )

    private data class NativeEvolutionSpec(
        val key: Int,
        val geneLine: String,
        val classCode: String,
        val phase: Int,
        val candidates: List<NativeEvolutionCandidate>,
    )

    private data class NativeEvolutionCandidate(
        val to: Int,
        val weight: Int,
        val kind: String,
    )

    private data class CharacterEntitySource(
        val components: JSONObject,
        val objectComponent: JSONObject,
        val characterStatus: JSONObject,
        val eggHatch: JSONObject,
        val diseaseSystem: JSONObject,
        val sleepSystem: JSONObject,
    )

    private data class NativeEggHatchSelection(
        val selectedCharacterKey: Int,
        val diagnostics: HomeWidgetNativeHatchSelectionDiagnostics,
    )

    private data class NativeEggHatchProbabilities(
        val normalizedStaleFoodCount: Int,
        val normalizedSyringeCount: Int,
        val green: Int,
        val soil: Int,
        val skull: Int,
    )
}
