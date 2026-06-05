package com.ch00n9h09.montto

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.min

private const val NATIVE_CHARACTER_OBJECT_TYPE = 1
private const val NATIVE_FOOD_OBJECT_TYPE = 3
private const val NATIVE_CHARACTER_STATE_EGG = 0
private const val NATIVE_CHARACTER_STATE_IDLE = 1
private const val NATIVE_FOOD_FRESHNESS_STALE = 3
private const val NATIVE_CHARACTER_KEY_NULL = 0
private const val NATIVE_GREEN_SLIME_A1_CHARACTER_KEY = 1
private const val NATIVE_SKULL_SLIME_A1_CHARACTER_KEY = 14
private const val NATIVE_SOIL_SLIME_A1_CHARACTER_KEY = 22
private const val NATIVE_MAX_EGG_HATCH_SELECTION_BONUS_COUNT = 10
private const val NATIVE_EGG_HATCH_BASE_GREEN_PERCENT = 65
private const val NATIVE_EGG_HATCH_BASE_SOIL_PERCENT = 20
private const val NATIVE_EGG_HATCH_BONUS_PER_COUNT_PERCENT = 2

internal data class HomeWidgetNativeAuthoritativeRefreshResult(
    val status: String,
    val updatedRawWorldData: String? = null,
    val hasSnapshot: Boolean = false,
    val worldDataChanged: Boolean = false,
    val hatched: Boolean = false,
    val selectedCharacterKey: Int? = null,
    val previousCharacterState: Int? = null,
    val nextCharacterState: Int? = null,
    val error: String? = null,
) {
    val succeeded: Boolean
        get() = status == "native_authoritative_completion_completed"
}

internal object HomeWidgetNativeAuthoritativeRefresh {
    fun complete(
        context: Context,
        nowMs: Long = System.currentTimeMillis(),
    ): HomeWidgetNativeAuthoritativeRefreshResult {
        val widgetPrefs = context.getSharedPreferences(
            HomeWidgetConstants.STORAGE_NAME,
            Context.MODE_PRIVATE,
        )
        val flutterPrefs = context.getSharedPreferences(
            HomeWidgetConstants.FLUTTER_STORAGE_NAME,
            Context.MODE_PRIVATE,
        )

        return complete(
            widgetPrefs = widgetPrefs,
            flutterPrefs = flutterPrefs,
            nowMs = nowMs,
            persistSnapshot = { snapshot ->
                HomeWidgetSnapshotFactory.persistCurrentSnapshot(context, snapshot)
                HomeWidgetSnapshotFactory.persistAuthoritativeSnapshot(context, snapshot)
            },
            clearSnapshots = {
                clearWidgetSnapshots(widgetPrefs, flutterPrefs)
            },
        )
    }

    internal fun complete(
        widgetPrefs: SharedPreferences,
        flutterPrefs: SharedPreferences,
        nowMs: Long,
        persistSnapshot: (HomeWidgetSnapshot?) -> Unit,
        clearSnapshots: () -> Unit = {
            clearWidgetSnapshots(widgetPrefs, flutterPrefs)
        },
    ): HomeWidgetNativeAuthoritativeRefreshResult {
        val rawWorldData = flutterPrefs.getString(HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY, null)
            ?: return failed("missing_world_data")

        return runCatching {
            if (isStaleResetBootstrapRestoreCandidate(flutterPrefs, rawWorldData)) {
                flutterPrefs.edit()
                    .remove(HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY)
                    .apply()
                clearSnapshots()
                throw IllegalStateException("stale_reset_bootstrap_marker")
            }

            val refreshedWorldData = refreshWorldDataJson(
                rawWorldData = rawWorldData,
                nowMs = nowMs,
            )
            val snapshot = HomeWidgetSnapshotFactory.buildFromWorldDataJson(
                refreshedWorldData.rawWorldData,
                nowMs = nowMs,
            ) ?: throw IllegalStateException("snapshot_unavailable")

            if (snapshot.characterState == "egg") {
                throw IllegalStateException("egg_not_completed")
            }

            flutterPrefs.edit()
                .putString(HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY, refreshedWorldData.rawWorldData)
                .apply()
            persistSnapshot(snapshot)
            HomeWidgetAuthoritativeRefreshRequester.completeRefresh(
                prefs = widgetPrefs,
                payloadSummary = buildCompletionSummary(
                    snapshot = snapshot,
                    refreshedWorldData = refreshedWorldData,
                ),
                completedAtMs = nowMs,
            )

            HomeWidgetNativeAuthoritativeRefreshResult(
                status = "native_authoritative_completion_completed",
                updatedRawWorldData = refreshedWorldData.rawWorldData,
                hasSnapshot = true,
                worldDataChanged = refreshedWorldData.changed,
                hatched = refreshedWorldData.hatched,
                selectedCharacterKey = refreshedWorldData.selectedCharacterKey,
                previousCharacterState = refreshedWorldData.previousCharacterState,
                nextCharacterState = refreshedWorldData.nextCharacterState,
            )
        }.getOrElse { error ->
            failed(error.message ?: error.toString())
        }
    }

    private fun buildCompletionSummary(
        snapshot: HomeWidgetSnapshot,
        refreshedWorldData: RefreshedWorldData,
    ): String {
        return buildString {
            append("native_authoritative_completion_completed")
            append("(characterState=")
            append(snapshot.characterState)
            append(",characterKey=")
            append(snapshot.characterKey)
            append(",hatched=")
            append(refreshedWorldData.hatched)
            append(")")
        }
    }

    internal fun refreshWorldDataJson(
        rawWorldData: String,
        nowMs: Long,
    ): RefreshedWorldData {
        val worldData = JSONObject(rawWorldData)
        val worldMetadata = ensureObject(worldData, "world_metadata")
        val appState = ensureObject(worldMetadata, "app_state")
        val entities = ensureArray(worldData, "entities")
        val source = findMutableMainCharacter(entities)

        val previousLastEcsSaved = worldMetadata.optLongOrNull("last_ecs_saved")
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
                    source.objectComponent.put("state", NATIVE_CHARACTER_STATE_IDLE)
                    source.characterStatus.put("characterKey", selectedCharacterKey)
                    source.characterStatus.put("evolutionPhase", 1)
                    source.eggHatch.put("hatchTime", 0)
                    source.eggHatch.put("hatchDurationMs", 0)
                    source.eggHatch.put("isReadyToHatch", false)
                    source.eggHatch.put("syringeCount", 0)
                    source.eggHatch.put("pendingCharacterKey", NATIVE_CHARACTER_KEY_NULL)
                    nextCharacterState = NATIVE_CHARACTER_STATE_IDLE
                    hatched = true
                    changed = true
                }
            }
        }

        return RefreshedWorldData(
            rawWorldData = worldData.toString(),
            changed = changed,
            hatched = hatched,
            previousCharacterState = previousCharacterState,
            nextCharacterState = nextCharacterState,
            selectedCharacterKey = selectedCharacterKey,
        )
    }

    private fun failed(error: String): HomeWidgetNativeAuthoritativeRefreshResult {
        return HomeWidgetNativeAuthoritativeRefreshResult(
            status = "native_authoritative_completion_failed",
            error = error,
        )
    }

    private fun clearWidgetSnapshots(
        widgetPrefs: SharedPreferences,
        flutterPrefs: SharedPreferences,
    ) {
        widgetPrefs.edit()
            .remove(HomeWidgetConstants.SNAPSHOT_KEY)
            .remove(HomeWidgetConstants.AUTHORITATIVE_SNAPSHOT_KEY)
            .apply()

        flutterPrefs.edit()
            .remove(HomeWidgetConstants.FLUTTER_SNAPSHOT_KEY)
            .remove(HomeWidgetConstants.FLUTTER_AUTHORITATIVE_SNAPSHOT_KEY)
            .apply()
    }

    private fun isStaleResetBootstrapRestoreCandidate(
        flutterPrefs: SharedPreferences,
        rawWorldData: String,
    ): Boolean {
        val resetMarkerId = readResetBootstrapMarkerId(flutterPrefs) ?: return false
        val worldMarkerId = readWorldResetBootstrapMarkerId(rawWorldData)

        return worldMarkerId != resetMarkerId
    }

    private fun readResetBootstrapMarkerId(flutterPrefs: SharedPreferences): String? {
        val rawMarker = flutterPrefs.getString(
            HomeWidgetConstants.FLUTTER_RESET_BOOTSTRAP_MARKER_STORAGE_KEY,
            null,
        )
        if (rawMarker.isNullOrBlank()) {
            return null
        }

        return runCatching {
            JSONObject(rawMarker).optString("resetId").takeIf { it.isNotBlank() }
        }.getOrNull()
    }

    private fun readWorldResetBootstrapMarkerId(rawWorldData: String): String? {
        return runCatching {
            JSONObject(rawWorldData)
                .optJSONObject("world_metadata")
                ?.optJSONObject("app_state")
                ?.optString(HomeWidgetConstants.RESET_BOOTSTRAP_MARKER_FIELD_KEY)
                ?.takeIf { it.isNotBlank() }
        }.getOrNull()
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
                entity = entity,
                components = components,
                objectComponent = objectComponent,
                characterStatus = ensureObject(components, "characterStatus"),
                eggHatch = ensureObject(components, "eggHatch"),
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
        var hash = 0

        seed.forEach { character ->
            hash = 0x1fffffff and (hash + character.code)
            hash = 0x1fffffff and (hash + ((0x0007ffff and hash) shl 10))
            hash = hash xor (hash ushr 6)
        }

        hash = 0x1fffffff and (hash + ((0x03ffffff and hash) shl 3))
        hash = hash xor (hash ushr 11)
        hash = 0x1fffffff and (hash + ((0x00003fff and hash) shl 15))

        val normalized = (hash and 0x7fffffff).toDouble() / 0x7fffffff.toDouble()
        return when {
            normalized >= 1.0 -> 1.0 - 1e-9
            normalized <= 0.0 -> 0.0
            else -> normalized
        }
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
        return when {
            !value.isFinite() || value <= 0.0 -> 0.0
            value >= 1.0 -> 1.0 - 1e-9
            else -> value
        }
    }

    private fun JSONObject.optIntOrNull(key: String): Int? {
        return if (has(key)) optInt(key) else null
    }

    private fun JSONObject.optLongOrNull(key: String): Long? {
        return if (has(key)) optLong(key) else null
    }

    internal data class RefreshedWorldData(
        val rawWorldData: String,
        val changed: Boolean,
        val hatched: Boolean,
        val previousCharacterState: Int?,
        val nextCharacterState: Int?,
        val selectedCharacterKey: Int?,
    )

    private data class CharacterEntitySource(
        val entity: JSONObject,
        val components: JSONObject,
        val objectComponent: JSONObject,
        val characterStatus: JSONObject,
        val eggHatch: JSONObject,
    )
}
