package com.ch00n9h09.montto

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import dev.fluttercommunity.workmanager.BackgroundWorker
import org.json.JSONArray
import org.json.JSONObject

internal enum class HomeWidgetAuthoritativeRefreshRequestResult(
    val status: String,
) {
    REQUESTED("flutter_refresh_requested"),
    SKIPPED_IN_FLIGHT("flutter_refresh_skipped_in_flight"),
    SKIPPED_THROTTLED("flutter_refresh_skipped_throttled"),
    FAILED("flutter_refresh_failed"),
}

internal object HomeWidgetAuthoritativeRefreshRequester {
    private const val REQUEST_THROTTLE_WINDOW_MS =
        HomeWidgetConstants.PERIODIC_REFRESH_INTERVAL_MINUTES * 60_000L

    fun request(
        context: Context,
        nowMs: Long = System.currentTimeMillis(),
        force: Boolean = false,
        allowActivityLaunch: Boolean = false,
    ): HomeWidgetAuthoritativeRefreshRequestResult {
        val prefs = prefs(context)
        return request(
            prefs = prefs,
            nowMs = nowMs,
            force = force,
            enqueueFlutterBackgroundRefresh = {
                enqueueFlutterBackgroundRefresh(context)
            },
            launchRefreshActivity = {
                if (allowActivityLaunch) {
                    runCatching {
                        context.startActivity(
                            Intent(context, WidgetRefreshActivity::class.java).apply {
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            },
                        )
                    }.isSuccess
                } else {
                    false
                }
            },
        )
    }

    fun completeRefresh(
        context: Context,
        payloadSummary: String?,
        completedAtMs: Long = System.currentTimeMillis(),
    ) {
        val prefs = prefs(context)
        completeRefresh(
            prefs = prefs,
            payloadSummary = payloadSummary,
            completedAtMs = completedAtMs,
        )
        HomeWidgetProvider.notifySnapshotUpdated(context, "completeRefresh")
    }

    fun readDiagnostics(context: Context): Map<String, Any?> {
        return readDiagnostics(
            nativePrefs = prefs(context),
            flutterPrefs = context.getSharedPreferences(
                HomeWidgetConstants.FLUTTER_STORAGE_NAME,
                Context.MODE_PRIVATE,
            ),
            debugModeEnabled = HomeWidgetDebugPresetStore.isNativeDebugModeEnabled(),
            widgetPresence = HomeWidgetPeriodicRefreshScheduler.widgetPresence(context),
        )
    }

    internal fun request(
        prefs: SharedPreferences,
        nowMs: Long,
        force: Boolean = false,
        enqueueFlutterBackgroundRefresh: () -> Boolean = { false },
        launchRefreshActivity: () -> Boolean,
    ): HomeWidgetAuthoritativeRefreshRequestResult {
        val lastRequestedAtMs = prefs.getLong(
            HomeWidgetConstants.REFRESH_REQUESTED_AT_MS_KEY,
            0L,
        ).coerceAtLeast(0L)
        val inFlight = prefs.getBoolean(
            HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY,
            false,
        )
        val hasRecentRequest = lastRequestedAtMs > 0L &&
            nowMs - lastRequestedAtMs < REQUEST_THROTTLE_WINDOW_MS

        if (!force && inFlight && hasRecentRequest) {
            return HomeWidgetAuthoritativeRefreshRequestResult.SKIPPED_IN_FLIGHT
        }

        if (!force && hasRecentRequest) {
            return HomeWidgetAuthoritativeRefreshRequestResult.SKIPPED_THROTTLED
        }

        prefs.edit()
            .putLong(HomeWidgetConstants.REFRESH_REQUESTED_AT_MS_KEY, nowMs)
            .putBoolean(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY, true)
            .apply()

        val backgroundRefreshQueued = enqueueFlutterBackgroundRefresh()
        val backgroundRefreshEnqueueStatus = if (backgroundRefreshQueued) {
            "queued"
        } else {
            "failed"
        }
        val refreshActivityLaunched = launchRefreshActivity()
        prefs.edit()
            .putBoolean(
                HomeWidgetConstants.REFRESH_BACKGROUND_QUEUED_KEY,
                backgroundRefreshQueued,
            )
            .putString(
                HomeWidgetConstants.REFRESH_BACKGROUND_ENQUEUE_STATUS_KEY,
                backgroundRefreshEnqueueStatus,
            )
            .remove(HomeWidgetConstants.REFRESH_BACKGROUND_ENQUEUE_ERROR_KEY)
            .putBoolean(
                HomeWidgetConstants.REFRESH_ACTIVITY_LAUNCHED_KEY,
                refreshActivityLaunched,
            )
            .apply()

        if (backgroundRefreshQueued || refreshActivityLaunched) {
            return HomeWidgetAuthoritativeRefreshRequestResult.REQUESTED
        }

        prefs.edit()
            .putBoolean(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY, false)
            .apply()
        return HomeWidgetAuthoritativeRefreshRequestResult.FAILED
    }

    private fun enqueueFlutterBackgroundRefresh(context: Context): Boolean {
        return runCatching {
            val inputData = Data.Builder()
                .putString(
                    BackgroundWorker.DART_TASK_KEY,
                    HomeWidgetConstants.FLUTTER_BACKGROUND_REFRESH_TASK_NAME,
                )
                .build()
            val request = OneTimeWorkRequestBuilder<BackgroundWorker>()
                .setInputData(inputData)
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                HomeWidgetConstants.FLUTTER_BACKGROUND_REFRESH_WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                request,
            )
        }.isSuccess
    }

    internal fun completeRefresh(
        prefs: SharedPreferences,
        payloadSummary: String?,
        completedAtMs: Long,
    ) {
        prefs.edit()
            .putBoolean(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY, false)
            .putLong(HomeWidgetConstants.REFRESH_COMPLETED_AT_MS_KEY, completedAtMs)
            .putString(
                HomeWidgetConstants.REFRESH_SMOKE_RESULT_KEY,
                payloadSummary ?: "completed",
            )
            .apply()
    }

    internal fun readDiagnostics(
        prefs: SharedPreferences,
    ): Map<String, Any?> {
        return readDiagnostics(
            nativePrefs = prefs,
            flutterPrefs = null,
            debugModeEnabled = true,
        )
    }

    internal fun readDiagnostics(
        nativePrefs: SharedPreferences,
        flutterPrefs: SharedPreferences?,
        debugModeEnabled: Boolean = true,
        widgetPresence: HomeWidgetPresence = HomeWidgetPresence(
            homeWidget2x1Count = 0,
            homeWidget1x1Count = 0,
        ),
    ): Map<String, Any?> {
        val nativeAuthoritativeSnapshot = HomeWidgetSnapshot.fromJson(
            nativePrefs.getString(HomeWidgetConstants.AUTHORITATIVE_SNAPSHOT_KEY, null),
        )
        val flutterAuthoritativeSnapshot = HomeWidgetSnapshot.fromJson(
            flutterPrefs?.getString(
                HomeWidgetConstants.FLUTTER_AUTHORITATIVE_SNAPSHOT_KEY,
                null,
            ),
        )
        val selectedAuthoritativeSnapshot = HomeWidgetSnapshot.selectAuthoritativeSnapshot(
            nativeSnapshot = nativeAuthoritativeSnapshot,
            flutterSnapshot = flutterAuthoritativeSnapshot,
        )
        val debugOverrideEnabled = debugModeEnabled &&
            HomeWidgetDebugPresetStore.isOverrideEnabled(nativePrefs)

        return linkedMapOf(
            "periodicRefreshStatus" to nativePrefs.getString(
                HomeWidgetConstants.PERIODIC_REFRESH_STATUS_KEY,
                null,
            ),
            "periodicRefreshStatusAtMs" to nativePrefs.getLong(
                HomeWidgetConstants.PERIODIC_REFRESH_STATUS_AT_MS_KEY,
                0L,
            ).takeIf { it > 0L },
            "requestedAtMs" to nativePrefs.getLong(
                HomeWidgetConstants.REFRESH_REQUESTED_AT_MS_KEY,
                0L,
            ).takeIf { it > 0L },
            "completedAtMs" to nativePrefs.getLong(
                HomeWidgetConstants.REFRESH_COMPLETED_AT_MS_KEY,
                0L,
            ).takeIf { it > 0L },
            "inFlight" to nativePrefs.getBoolean(
                HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY,
                false,
            ),
            "smokeResult" to nativePrefs.getString(
                HomeWidgetConstants.REFRESH_SMOKE_RESULT_KEY,
                null,
            ),
            "backgroundRefreshQueued" to nativePrefs.getBoolean(
                HomeWidgetConstants.REFRESH_BACKGROUND_QUEUED_KEY,
                false,
            ),
            "backgroundRefreshEnqueueStatus" to nativePrefs.getString(
                HomeWidgetConstants.REFRESH_BACKGROUND_ENQUEUE_STATUS_KEY,
                null,
            ),
            "backgroundRefreshEnqueueError" to nativePrefs.getString(
                HomeWidgetConstants.REFRESH_BACKGROUND_ENQUEUE_ERROR_KEY,
                null,
            ).takeUnless { it.isNullOrBlank() },
            "backgroundRefreshStartedAtMs" to nativePrefs.getLong(
                HomeWidgetConstants.REFRESH_BACKGROUND_STARTED_AT_MS_KEY,
                0L,
            ).takeIf { it > 0L },
            "backgroundRefreshCompletedAtMs" to nativePrefs.getLong(
                HomeWidgetConstants.REFRESH_BACKGROUND_COMPLETED_AT_MS_KEY,
                0L,
            ).takeIf { it > 0L },
            "backgroundRefreshStatus" to nativePrefs.getString(
                HomeWidgetConstants.REFRESH_BACKGROUND_STATUS_KEY,
                null,
            ),
            "backgroundRefreshError" to nativePrefs.getString(
                HomeWidgetConstants.REFRESH_BACKGROUND_ERROR_KEY,
                null,
            ).takeUnless { it.isNullOrBlank() },
            "flutterBackgroundRefreshStartedAtMs" to flutterPrefs?.getLong(
                HomeWidgetConstants.FLUTTER_PREFIX +
                    HomeWidgetConstants.REFRESH_BACKGROUND_STARTED_AT_MS_KEY,
                0L,
            )?.takeIf { it > 0L },
            "flutterBackgroundRefreshCompletedAtMs" to flutterPrefs?.getLong(
                HomeWidgetConstants.FLUTTER_PREFIX +
                    HomeWidgetConstants.REFRESH_BACKGROUND_COMPLETED_AT_MS_KEY,
                0L,
            )?.takeIf { it > 0L },
            "flutterBackgroundRefreshStatus" to flutterPrefs?.getString(
                HomeWidgetConstants.FLUTTER_PREFIX +
                    HomeWidgetConstants.REFRESH_BACKGROUND_STATUS_KEY,
                null,
            ),
            "flutterBackgroundRefreshError" to flutterPrefs?.getString(
                HomeWidgetConstants.FLUTTER_PREFIX +
                    HomeWidgetConstants.REFRESH_BACKGROUND_ERROR_KEY,
                null,
            ).takeUnless { it.isNullOrBlank() },
            "refreshActivityLaunched" to nativePrefs.getBoolean(
                HomeWidgetConstants.REFRESH_ACTIVITY_LAUNCHED_KEY,
                false,
            ),
            "hasAnyWidgets" to widgetPresence.hasAnyWidgets,
            "homeWidget2x1Count" to widgetPresence.homeWidget2x1Count,
            "homeWidget1x1Count" to widgetPresence.homeWidget1x1Count,
            "nativeCurrentSnapshot" to summarizeSnapshot(
                source = HOME_WIDGET_NATIVE_SNAPSHOT_SOURCE,
                snapshot = HomeWidgetSnapshot.fromJson(
                    nativePrefs.getString(HomeWidgetConstants.SNAPSHOT_KEY, null),
                ),
            ),
            "nativeAuthoritativeSnapshot" to summarizeSnapshot(
                source = HOME_WIDGET_NATIVE_SNAPSHOT_SOURCE,
                snapshot = nativeAuthoritativeSnapshot,
            ),
            "flutterCurrentSnapshot" to summarizeSnapshot(
                source = HOME_WIDGET_FLUTTER_SNAPSHOT_SOURCE,
                snapshot = HomeWidgetSnapshot.fromJson(
                    flutterPrefs?.getString(HomeWidgetConstants.FLUTTER_SNAPSHOT_KEY, null),
                ),
            ),
            "flutterAuthoritativeSnapshot" to summarizeSnapshot(
                source = HOME_WIDGET_FLUTTER_SNAPSHOT_SOURCE,
                snapshot = flutterAuthoritativeSnapshot,
            ),
            "selectedAuthoritativeSource" to selectedAuthoritativeSnapshot.source,
            "selectedAuthoritativeSnapshot" to summarizeSnapshot(
                source = selectedAuthoritativeSnapshot.source,
                snapshot = selectedAuthoritativeSnapshot.snapshot,
            ),
            "nativeSnapshotPublishHistory" to readSnapshotPublishHistory(
                nativePrefs.getString(
                    HomeWidgetConstants.SNAPSHOT_PUBLISH_HISTORY_KEY,
                    null,
                ),
            ),
            "flutterSnapshotPublishHistory" to readSnapshotPublishHistory(
                flutterPrefs?.getString(
                    HomeWidgetConstants.FLUTTER_PREFIX +
                        HomeWidgetConstants.SNAPSHOT_PUBLISH_HISTORY_KEY,
                    null,
                ),
            ),
            "debugOverrideEnabled" to debugOverrideEnabled,
            "debugPresetIndex" to HomeWidgetDebugPresetStore.loadPresetIndex(nativePrefs),
        )
    }

    private fun readSnapshotPublishHistory(rawHistory: String?): List<Map<String, Any?>> {
        if (rawHistory.isNullOrBlank()) {
            return emptyList()
        }

        return runCatching {
            val array = JSONArray(rawHistory)
            buildList {
                for (index in 0 until array.length()) {
                    val item = array.optJSONObject(index) ?: continue
                    add(jsonObjectToMap(item))
                }
            }
        }.getOrDefault(emptyList())
    }

    private fun jsonObjectToMap(jsonObject: JSONObject): Map<String, Any?> {
        return buildMap {
            val keys = jsonObject.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                put(key, jsonValue(jsonObject.opt(key)))
            }
        }
    }

    private fun jsonArrayToList(jsonArray: JSONArray): List<Any?> {
        return buildList {
            for (index in 0 until jsonArray.length()) {
                add(jsonValue(jsonArray.opt(index)))
            }
        }
    }

    private fun jsonValue(value: Any?): Any? {
        return when (value) {
            null, JSONObject.NULL -> null
            is JSONObject -> jsonObjectToMap(value)
            is JSONArray -> jsonArrayToList(value)
            else -> value
        }
    }

    private fun summarizeSnapshot(
        source: String?,
        snapshot: HomeWidgetSnapshot?,
    ): Map<String, Any?>? {
        if (snapshot == null) {
            return null
        }

        return linkedMapOf(
            "source" to source,
            "snapshotKind" to snapshot.snapshotKind,
            "characterState" to snapshot.characterState,
            "displayState" to snapshot.displayState,
            "characterKey" to snapshot.characterKey,
            "eggTextureKey" to snapshot.eggTextureKey,
            "eggHatchTimeMs" to snapshot.eggHatchTimeMs,
            "eggCrackStage" to snapshot.eggCrackStage,
            "hasUrgentStatus" to snapshot.hasUrgentStatus,
            "visibleStatusIcons" to snapshot.visibleStatusIcons,
            "updatedAtMs" to snapshot.updatedAtMs,
            "snapshotComputedAtMs" to snapshot.snapshotComputedAtMs,
            "authoritativeTimestampMs" to snapshot.authoritativeTimestampMs(),
        )
    }

    private fun prefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(
            HomeWidgetConstants.STORAGE_NAME,
            Context.MODE_PRIVATE,
        )
    }
}
