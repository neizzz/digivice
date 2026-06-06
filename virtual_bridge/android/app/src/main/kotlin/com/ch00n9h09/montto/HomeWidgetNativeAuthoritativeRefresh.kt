package com.ch00n9h09.montto

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject

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
        get() = status == HomeWidgetNativeAuthoritativeRefreshStatus.COMPLETED.value

    fun toMap(includeWorldData: Boolean = true): Map<String, Any?> {
        return mapOf(
            "status" to status,
            "updatedRawWorldData" to if (includeWorldData) updatedRawWorldData else null,
            "hasUpdatedRawWorldData" to !updatedRawWorldData.isNullOrBlank(),
            "hasSnapshot" to hasSnapshot,
            "worldDataChanged" to worldDataChanged,
            "hatched" to hatched,
            "selectedCharacterKey" to selectedCharacterKey,
            "previousCharacterState" to previousCharacterState,
            "nextCharacterState" to nextCharacterState,
            "error" to error,
        )
    }
}

internal object HomeWidgetNativeAuthoritativeRefresh {
    fun complete(
        context: Context,
        nowMs: Long = System.currentTimeMillis(),
        allowEggSnapshot: Boolean = false,
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
            allowEggSnapshot = allowEggSnapshot,
        )
    }

    internal fun complete(
        widgetPrefs: SharedPreferences,
        flutterPrefs: SharedPreferences,
        nowMs: Long,
        persistSnapshot: (HomeWidgetSnapshot?) -> Unit,
        clearSnapshots: () -> Unit = {
            HomeWidgetNativeRefreshSnapshotStore.clear(widgetPrefs, flutterPrefs)
        },
        randomProvider: HomeWidgetNativeLifecycleRandomProvider? = null,
        allowEggSnapshot: Boolean = false,
    ): HomeWidgetNativeAuthoritativeRefreshResult {
        val rawWorldData = flutterPrefs.getString(HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY, null)
            ?: return failed("missing_world_data")

        return runCatching {
            HomeWidgetNativeRefreshResetGuard.clearStaleRestoreCandidate(
                flutterPrefs = flutterPrefs,
                rawWorldData = rawWorldData,
                clearSnapshots = clearSnapshots,
            )
            val refreshedWorldData = if (randomProvider == null) {
                HomeWidgetNativeRefreshWorldData.refresh(
                    rawWorldData = rawWorldData,
                    nowMs = nowMs,
                )
            } else {
                HomeWidgetNativeRefreshWorldData.refresh(
                    rawWorldData = rawWorldData,
                    nowMs = nowMs,
                    randomProvider = randomProvider,
                )
            }

            HomeWidgetNativeRefreshSnapshotStore.publishCompletion(
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

    private fun failed(error: String): HomeWidgetNativeAuthoritativeRefreshResult {
        return HomeWidgetNativeAuthoritativeRefreshResult(
            status = HomeWidgetNativeAuthoritativeRefreshStatus.FAILED.value,
            error = error,
        )
    }
}

private object HomeWidgetNativeRefreshResetGuard {
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

private object HomeWidgetNativeRefreshSnapshotStore {
    fun publishCompletion(
        widgetPrefs: SharedPreferences,
        flutterPrefs: SharedPreferences,
        refreshedWorldData: RefreshedHomeWidgetWorldData,
        nowMs: Long,
        persistSnapshot: (HomeWidgetSnapshot?) -> Unit,
        allowEggSnapshot: Boolean = false,
    ): HomeWidgetNativeAuthoritativeRefreshResult {
        val snapshot = HomeWidgetSnapshotFactory.buildFromWorldDataJson(
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

        return HomeWidgetNativeAuthoritativeRefreshResult(
            status = HomeWidgetNativeAuthoritativeRefreshStatus.COMPLETED.value,
            updatedRawWorldData = refreshedWorldData.rawWorldData,
            hasSnapshot = true,
            worldDataChanged = refreshedWorldData.changed,
            hatched = refreshedWorldData.hatched,
            selectedCharacterKey = refreshedWorldData.selectedCharacterKey,
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
        refreshedWorldData: RefreshedHomeWidgetWorldData,
    ): String {
        return buildString {
            append(HomeWidgetNativeAuthoritativeRefreshStatus.COMPLETED.value)
            append("(characterState=")
            append(snapshot.characterState)
            append(",characterKey=")
            append(snapshot.characterKey)
            append(",hatched=")
            append(refreshedWorldData.hatched)
            append(")")
        }
    }
}
