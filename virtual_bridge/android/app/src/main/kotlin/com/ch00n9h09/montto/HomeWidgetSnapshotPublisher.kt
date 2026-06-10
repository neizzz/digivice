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
    ): Map<String, Any?> {
        prefs.edit().apply {
            if (snapshotJson.isNullOrEmpty()) {
                remove(snapshotKey)
                remove(HomeWidgetConstants.REFRESH_REQUESTED_AT_MS_KEY)
                remove(HomeWidgetConstants.REFRESH_COMPLETED_AT_MS_KEY)
                remove(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY)
                remove(HomeWidgetConstants.REFRESH_SMOKE_RESULT_KEY)
                remove(HomeWidgetConstants.PERIODIC_REFRESH_STATUS_KEY)
                remove(HomeWidgetConstants.PERIODIC_REFRESH_STATUS_AT_MS_KEY)
            } else {
                putString(snapshotKey, snapshotJson)
            }
        }.apply()

        notifySnapshotUpdated(reason.ifBlank { "publishSnapshot" })

        return linkedMapOf(
            "status" to "ok",
            "snapshotKey" to snapshotKey,
            "reason" to reason.ifBlank { "publishSnapshot" },
            "hasSnapshot" to snapshotJson.isNullOrEmpty().not(),
            "characterState" to extractStringField(snapshotJson, "characterState"),
            "characterKey" to extractIntField(snapshotJson, "characterKey"),
            "eggHatchTimeMs" to extractLongField(snapshotJson, "eggHatchTimeMs"),
            "snapshotKind" to extractStringField(snapshotJson, "snapshotKind"),
        )
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
