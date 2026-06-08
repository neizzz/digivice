package com.ch00n9h09.montto

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject

internal data class WorldDataNativeAuthoritativeRefreshResult(
    val status: String,
    val updatedRawWorldData: String? = null,
    val hasSnapshot: Boolean = false,
    val worldDataChanged: Boolean = false,
    val hatched: Boolean = false,
    val selectedCharacterKey: Int? = null,
    val hatchSelectionDiagnostics: WorldDataNativeRefreshHatchSelectionDiagnostics? = null,
    val evolutionDiagnostics: WorldDataNativeRefreshEvolutionDiagnostics? = null,
    val previousCharacterState: Int? = null,
    val nextCharacterState: Int? = null,
    val error: String? = null,
) {
    val succeeded: Boolean
        get() = status == WorldDataNativeAuthoritativeRefreshStatus.COMPLETED.value

    fun toMap(includeWorldData: Boolean = true): Map<String, Any?> {
        return mapOf(
            "status" to status,
            "updatedRawWorldData" to if (includeWorldData) updatedRawWorldData else null,
            "hasUpdatedRawWorldData" to !updatedRawWorldData.isNullOrBlank(),
            "hasSnapshot" to hasSnapshot,
            "worldDataChanged" to worldDataChanged,
            "hatched" to hatched,
            "selectedCharacterKey" to selectedCharacterKey,
            "hatchSelectionDiagnostics" to hatchSelectionDiagnostics?.toMap(),
            "evolutionDiagnostics" to evolutionDiagnostics?.toMap(),
            "evolutionGageBefore" to evolutionDiagnostics?.evolutionGageBefore,
            "evolutionGageAfter" to evolutionDiagnostics?.evolutionGageAfter,
            "evolutionGageIncreased" to evolutionDiagnostics?.evolutionGageIncreased,
            "evolutionBlockReason" to evolutionDiagnostics?.blockReason,
            "previousCharacterState" to previousCharacterState,
            "nextCharacterState" to nextCharacterState,
            "error" to error,
        )
    }
}

internal object WorldDataNativeAuthoritativeRefresh {
    fun complete(
        context: Context,
        nowMs: Long = System.currentTimeMillis(),
        allowEggSnapshot: Boolean = false,
    ): WorldDataNativeAuthoritativeRefreshResult {
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
                WorldDataSnapshotFactory.persistCurrentSnapshot(context, snapshot)
                WorldDataSnapshotFactory.persistAuthoritativeSnapshot(context, snapshot)
            },
            allowEggSnapshot = allowEggSnapshot,
        )
    }

    internal fun complete(
        widgetPrefs: SharedPreferences,
        flutterPrefs: SharedPreferences,
        nowMs: Long,
        persistSnapshot: (HomeWidgetSnapshot?) -> Unit,
        clearSnapshots: () -> Unit = {
            WorldDataNativeRefreshSnapshotStore.clear(widgetPrefs, flutterPrefs)
        },
        randomProvider: WorldDataNativeRefreshLifecycleRandomProvider? = null,
        allowEggSnapshot: Boolean = false,
    ): WorldDataNativeAuthoritativeRefreshResult {
        val rawWorldData = flutterPrefs.getString(HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY, null)
            ?: return failed("missing_world_data")

        return runCatching {
            WorldDataNativeRefreshResetGuard.clearStaleRestoreCandidate(
                flutterPrefs = flutterPrefs,
                rawWorldData = rawWorldData,
                clearSnapshots = clearSnapshots,
            )
            val refreshedWorldData = if (randomProvider == null) {
                WorldDataNativeRefresh.refresh(
                    rawWorldData = rawWorldData,
                    nowMs = nowMs,
                )
            } else {
                WorldDataNativeRefresh.refresh(
                    rawWorldData = rawWorldData,
                    nowMs = nowMs,
                    randomProvider = randomProvider,
                )
            }

            WorldDataNativeRefreshSnapshotStore.publishCompletion(
                widgetPrefs = widgetPrefs,
                flutterPrefs = flutterPrefs,
                refreshedWorldData = refreshedWorldData,
                nowMs = nowMs,
                persistSnapshot = persistSnapshot,
                allowEggSnapshot = allowEggSnapshot,
            )
        }.getOrElse { error ->
            failed(error.message ?: error.toString())
        }
    }

    private fun failed(error: String): WorldDataNativeAuthoritativeRefreshResult {
        return WorldDataNativeAuthoritativeRefreshResult(
            status = WorldDataNativeAuthoritativeRefreshStatus.FAILED.value,
            error = error,
        )
    }
}

private object WorldDataNativeRefreshResetGuard {
    fun clearStaleRestoreCandidate(
        flutterPrefs: SharedPreferences,
        rawWorldData: String,
        clearSnapshots: () -> Unit,
    ) {
        if (!isStaleResetBootstrapRestoreCandidate(flutterPrefs, rawWorldData)) {
            return
        }

        flutterPrefs.edit()
            .remove(HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY)
            .apply()
        clearSnapshots()
        throw IllegalStateException("stale_reset_bootstrap_marker")
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
}

private object WorldDataNativeRefreshSnapshotStore {
    fun publishCompletion(
        widgetPrefs: SharedPreferences,
        flutterPrefs: SharedPreferences,
        refreshedWorldData: WorldDataNativeRefreshResult,
        nowMs: Long,
        persistSnapshot: (HomeWidgetSnapshot?) -> Unit,
        allowEggSnapshot: Boolean = false,
    ): WorldDataNativeAuthoritativeRefreshResult {
        val snapshot = WorldDataSnapshotFactory.buildFromWorldDataJson(
            refreshedWorldData.rawWorldData,
            nowMs = nowMs,
        ) ?: throw IllegalStateException("snapshot_unavailable")

        if (!allowEggSnapshot && snapshot.characterState == "egg") {
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

        return WorldDataNativeAuthoritativeRefreshResult(
            status = WorldDataNativeAuthoritativeRefreshStatus.COMPLETED.value,
            updatedRawWorldData = refreshedWorldData.rawWorldData,
            hasSnapshot = true,
            worldDataChanged = refreshedWorldData.changed,
            hatched = refreshedWorldData.hatched,
            selectedCharacterKey = refreshedWorldData.selectedCharacterKey,
            hatchSelectionDiagnostics = refreshedWorldData.hatchSelectionDiagnostics,
            evolutionDiagnostics = refreshedWorldData.evolutionDiagnostics,
            previousCharacterState = refreshedWorldData.previousCharacterState,
            nextCharacterState = refreshedWorldData.nextCharacterState,
        )
    }

    fun clear(
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

    private fun buildCompletionSummary(
        snapshot: HomeWidgetSnapshot,
        refreshedWorldData: WorldDataNativeRefreshResult,
    ): String {
        return buildString {
            append(WorldDataNativeAuthoritativeRefreshStatus.COMPLETED.value)
            append("(characterState=")
            append(snapshot.characterState)
            append(",characterKey=")
            append(snapshot.characterKey)
            append(",hatched=")
            append(refreshedWorldData.hatched)
            refreshedWorldData.hatchSelectionDiagnostics?.let { diagnostics ->
                append(",hatchSelection=")
                append("staleFoodCountAtHatch:")
                append(diagnostics.staleFoodCountAtHatch)
                append(";syringeCount:")
                append(diagnostics.syringeCount)
                append(";rollPercent:")
                append(diagnostics.rollPercent)
                append(";probabilities:")
                append(diagnostics.greenProbability)
                append("/")
                append(diagnostics.soilProbability)
                append("/")
                append(diagnostics.skullProbability)
                append(";selectedCharacterKey:")
                append(diagnostics.selectedCharacterKey)
            }
            refreshedWorldData.evolutionDiagnostics?.let { diagnostics ->
                append(",evolutionGage=")
                append(diagnostics.evolutionGageBefore)
                append("->")
                append(diagnostics.evolutionGageAfter)
                append(";increased:")
                append(diagnostics.evolutionGageIncreased)
                append(";blockReason:")
                append(diagnostics.blockReason)
            }
            append(")")
        }
    }
}
