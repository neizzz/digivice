package com.ch00n9h09.montto

import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

internal object HomeWidgetSnapshotPublisher {
    private const val SNAPSHOT_PUBLISH_HISTORY_LIMIT = 20

    private val stringFieldPatterns = mapOf(
        "characterState" to Regex(""""characterState"\s*:\s*"([^"]*)""""),
        "snapshotKind" to Regex(""""snapshotKind"\s*:\s*"([^"]*)""""),
    )
    private val intFieldPatterns = mapOf(
        "characterKey" to Regex(""""characterKey"\s*:\s*(-?\d+)"""),
        "eggHatchTimeMs" to Regex(""""eggHatchTimeMs"\s*:\s*(-?\d+)"""),
    )

    fun publish(
        prefs: SharedPreferences,
        snapshotKey: String,
        snapshotJson: String?,
        reason: String,
        notifySnapshotUpdated: (reason: String) -> Unit,
        nowMsProvider: () -> Long = { System.currentTimeMillis() },
    ): Map<String, Any?> {
        val resolvedReason = reason.ifBlank { "publishSnapshot" }
        val characterState = extractStringField(snapshotJson, "characterState")
        val characterKey = extractIntField(snapshotJson, "characterKey")
        val eggHatchTimeMs = extractLongField(snapshotJson, "eggHatchTimeMs")
        val snapshotKind = extractStringField(snapshotJson, "snapshotKind")
        val snapshot = HomeWidgetSnapshot.fromJson(snapshotJson)
        val publishedAtMs = nowMsProvider()
        val historyJson = appendSnapshotPublishHistory(
            rawHistory = prefs.getString(HomeWidgetConstants.SNAPSHOT_PUBLISH_HISTORY_KEY, null),
            snapshot = snapshot,
            snapshotKey = snapshotKey,
            reason = resolvedReason,
            publishedAtMs = publishedAtMs,
            success = true,
        )

        prefs.edit().apply {
            if (snapshotJson.isNullOrEmpty()) {
                remove(snapshotKey)
                remove(HomeWidgetConstants.REFRESH_REQUESTED_AT_MS_KEY)
                remove(HomeWidgetConstants.REFRESH_COMPLETED_AT_MS_KEY)
                remove(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY)
                remove(HomeWidgetConstants.REFRESH_SMOKE_RESULT_KEY)
                remove(HomeWidgetConstants.REFRESH_BACKGROUND_QUEUED_KEY)
                remove(HomeWidgetConstants.REFRESH_ACTIVITY_LAUNCHED_KEY)
                remove(HomeWidgetConstants.PERIODIC_REFRESH_STATUS_KEY)
                remove(HomeWidgetConstants.PERIODIC_REFRESH_STATUS_AT_MS_KEY)
            } else {
                putString(snapshotKey, snapshotJson)
                if (snapshotKey == HomeWidgetConstants.AUTHORITATIVE_SNAPSHOT_KEY) {
                    putBoolean(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY, false)
                    putLong(
                        HomeWidgetConstants.REFRESH_COMPLETED_AT_MS_KEY,
                        publishedAtMs,
                    )
                    putString(
                        HomeWidgetConstants.REFRESH_SMOKE_RESULT_KEY,
                        buildAuthoritativePublishSummary(
                            reason = resolvedReason,
                            characterState = characterState,
                            characterKey = characterKey,
                            snapshotKind = snapshotKind,
                        ),
                    )
                }
            }
            putString(HomeWidgetConstants.SNAPSHOT_PUBLISH_HISTORY_KEY, historyJson)
        }.apply()

        notifySnapshotUpdated(resolvedReason)

        return linkedMapOf(
            "status" to "ok",
            "snapshotKey" to snapshotKey,
            "reason" to resolvedReason,
            "hasSnapshot" to snapshotJson.isNullOrEmpty().not(),
            "characterState" to characterState,
            "characterKey" to characterKey,
            "eggHatchTimeMs" to eggHatchTimeMs,
            "snapshotKind" to snapshotKind,
        )
    }

    private fun appendSnapshotPublishHistory(
        rawHistory: String?,
        snapshot: HomeWidgetSnapshot?,
        snapshotKey: String,
        reason: String,
        publishedAtMs: Long,
        success: Boolean,
    ): String {
        val existing = parseHistory(rawHistory).toMutableList()
        existing += buildSnapshotPublishHistoryEntry(
            snapshot = snapshot,
            snapshotKey = snapshotKey,
            reason = reason,
            publishedAtMs = publishedAtMs,
            success = success,
        )
        val trimmed = existing.takeLast(SNAPSHOT_PUBLISH_HISTORY_LIMIT)
        return JSONArray(trimmed).toString()
    }

    private fun parseHistory(rawHistory: String?): List<JSONObject> {
        if (rawHistory.isNullOrBlank()) {
            return emptyList()
        }
        return runCatching {
            val array = JSONArray(rawHistory)
            buildList {
                for (index in 0 until array.length()) {
                    val item = array.optJSONObject(index) ?: continue
                    add(item)
                }
            }
        }.getOrDefault(emptyList())
    }

    private fun buildSnapshotPublishHistoryEntry(
        snapshot: HomeWidgetSnapshot?,
        snapshotKey: String,
        reason: String,
        publishedAtMs: Long,
        success: Boolean,
    ): JSONObject {
        val entry = JSONObject()
            .put("publishedAtMs", publishedAtMs)
            .put("reason", reason)
            .put("snapshotSlot", resolveSnapshotSlot(snapshotKey))
            .put("snapshotKey", snapshotKey)
            .put("hasSnapshot", snapshot != null)
            .put("success", success)
            .put("characterState", snapshot?.characterState)
            .put("displayState", snapshot?.displayState)
            .put("visibleStatusIcons", JSONArray(snapshot?.visibleStatusIcons ?: emptyList<String>()))
            .put("hasUrgentStatus", snapshot?.hasUrgentStatus)
            .put("characterKey", snapshot?.characterKey)
            .put("snapshotKind", snapshot?.snapshotKind)
            .put("snapshotComputedAtMs", snapshot?.snapshotComputedAtMs)
            .put("authoritativeTimestampMs", snapshot?.authoritativeTimestampMs())

        return entry
    }

    private fun resolveSnapshotSlot(snapshotKey: String): String {
        return when (snapshotKey) {
            HomeWidgetConstants.AUTHORITATIVE_SNAPSHOT_KEY -> "authoritative"
            HomeWidgetConstants.SNAPSHOT_KEY -> "current"
            else -> snapshotKey
        }
    }

    private fun buildAuthoritativePublishSummary(
        reason: String,
        characterState: String?,
        characterKey: Int?,
        snapshotKind: String?,
    ): String {
        return "authoritative_snapshot_published(" +
            "reason=$reason," +
            "state=${characterState ?: "unknown"}," +
            "key=${characterKey ?: "unknown"}," +
            "kind=${snapshotKind ?: "unknown"}" +
            ")"
    }

    private fun extractStringField(raw: String?, fieldName: String): String? {
        if (raw.isNullOrBlank()) {
            return null
        }

        return stringFieldPatterns[fieldName]
            ?.find(raw)
            ?.groupValues
            ?.getOrNull(1)
            ?.ifBlank { null }
    }

    private fun extractIntField(raw: String?, fieldName: String): Int? {
        return intFieldPatterns[fieldName]
            ?.find(raw.orEmpty())
            ?.groupValues
            ?.getOrNull(1)
            ?.toIntOrNull()
    }

    private fun extractLongField(raw: String?, fieldName: String): Long? {
        return intFieldPatterns[fieldName]
            ?.find(raw.orEmpty())
            ?.groupValues
            ?.getOrNull(1)
            ?.toLongOrNull()
    }
}
