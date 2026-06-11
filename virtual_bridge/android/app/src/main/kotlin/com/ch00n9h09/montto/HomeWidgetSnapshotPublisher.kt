package com.ch00n9h09.montto

import android.content.SharedPreferences

internal object HomeWidgetSnapshotPublisher {
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
                        nowMsProvider(),
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
