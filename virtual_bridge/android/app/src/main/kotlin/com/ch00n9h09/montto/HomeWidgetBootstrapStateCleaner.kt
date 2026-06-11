package com.ch00n9h09.montto

import android.content.Context

internal object HomeWidgetBootstrapStateCleaner {
    fun clear(
        context: Context,
        clearSnapshots: Boolean,
        reason: String,
    ): Map<String, Any?> {
        context.getSharedPreferences(
            HomeWidgetConstants.STORAGE_NAME,
            Context.MODE_PRIVATE,
        ).edit().apply {
            remove(HomeWidgetConstants.REFRESH_REQUESTED_AT_MS_KEY)
            remove(HomeWidgetConstants.REFRESH_COMPLETED_AT_MS_KEY)
            remove(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY)
            remove(HomeWidgetConstants.REFRESH_SMOKE_RESULT_KEY)
            remove(HomeWidgetConstants.REFRESH_BACKGROUND_QUEUED_KEY)
            remove(HomeWidgetConstants.REFRESH_ACTIVITY_LAUNCHED_KEY)
            remove(HomeWidgetConstants.PERIODIC_REFRESH_STATUS_KEY)
            remove(HomeWidgetConstants.PERIODIC_REFRESH_STATUS_AT_MS_KEY)

            if (clearSnapshots) {
                remove(HomeWidgetConstants.SNAPSHOT_KEY)
                remove(HomeWidgetConstants.AUTHORITATIVE_SNAPSHOT_KEY)
            }
        }.apply()

        context.getSharedPreferences(
            HomeWidgetConstants.FLUTTER_STORAGE_NAME,
            Context.MODE_PRIVATE,
        ).edit().apply {
            if (clearSnapshots) {
                remove(HomeWidgetConstants.FLUTTER_SNAPSHOT_KEY)
                remove(HomeWidgetConstants.FLUTTER_AUTHORITATIVE_SNAPSHOT_KEY)
            }
        }.apply()

        if (clearSnapshots) {
            HomeWidgetProvider.notifySnapshotUpdated(context, "reset_clear")
        }

        return mapOf(
            "status" to "ok",
            "reason" to reason,
            "clearSnapshots" to clearSnapshots,
        )
    }
}
