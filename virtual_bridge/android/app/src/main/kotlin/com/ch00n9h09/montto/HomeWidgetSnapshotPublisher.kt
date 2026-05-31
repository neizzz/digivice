package com.ch00n9h09.montto

import android.content.SharedPreferences

internal object HomeWidgetSnapshotPublisher {
    fun publish(
        prefs: SharedPreferences,
        snapshotKey: String,
        snapshotJson: String?,
        reason: String,
        notifySnapshotUpdated: (reason: String) -> Unit,
    ): Map<String, String> {
        prefs.edit().apply {
            if (snapshotJson.isNullOrEmpty()) {
                remove(snapshotKey)
            } else {
                putString(snapshotKey, snapshotJson)
            }
        }.apply()

        notifySnapshotUpdated(reason.ifBlank { "publishSnapshot" })

        return mapOf(
            "status" to "ok",
        )
    }
}
