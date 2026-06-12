package com.ch00n9h09.montto

object HomeWidgetConstants {
    const val CHANNEL = "digivice/home_widget"
    const val STORAGE_NAME = "digivice_home_widget"
    const val SNAPSHOT_KEY = "home_widget_snapshot_v1"
    const val AUTHORITATIVE_SNAPSHOT_KEY = "home_widget_authoritative_snapshot_v1"
    const val SNAPSHOT_PUBLISH_HISTORY_KEY = "home_widget_snapshot_publish_history_v1"
    const val PERIODIC_REFRESH_WORK_NAME = "home_widget_periodic_refresh"
    const val FLUTTER_BACKGROUND_REFRESH_WORK_NAME =
        "home_widget_flutter_background_refresh"
    const val FLUTTER_BACKGROUND_REFRESH_TASK_NAME = "home_widget_periodic_refresh"
    const val PERIODIC_REFRESH_REASON = "periodic_work"
    const val PERIODIC_REFRESH_INTERVAL_MINUTES = 15L
    const val FLUTTER_STORAGE_NAME = "FlutterSharedPreferences"
    const val FLUTTER_PREFIX = "flutter."
    const val WORLD_DATA_KEY = "MainSceneWorldData"
    const val RESET_BOOTSTRAP_MARKER_STORAGE_KEY = "DigiviceResetBootstrapMarkerV1"
    const val RESET_BOOTSTRAP_MARKER_FIELD_KEY = "reset_bootstrap_marker_id"
    const val FLUTTER_WORLD_DATA_KEY = "${FLUTTER_PREFIX}${WORLD_DATA_KEY}"
    const val FLUTTER_RESET_BOOTSTRAP_MARKER_STORAGE_KEY =
        "${FLUTTER_PREFIX}${RESET_BOOTSTRAP_MARKER_STORAGE_KEY}"
    const val FLUTTER_SNAPSHOT_KEY = "${FLUTTER_PREFIX}HomeWidgetSnapshotV1"
    const val FLUTTER_AUTHORITATIVE_SNAPSHOT_KEY =
        "${FLUTTER_PREFIX}HomeWidgetAuthoritativeSnapshotV1"
    const val REFRESH_SMOKE_RESULT_KEY = "home_widget_refresh_smoke_last_result"
    const val REFRESH_REQUESTED_AT_MS_KEY = "home_widget_refresh_requested_at_ms"
    const val REFRESH_COMPLETED_AT_MS_KEY = "home_widget_refresh_completed_at_ms"
    const val REFRESH_IN_FLIGHT_KEY = "home_widget_refresh_in_flight"
    const val REFRESH_BACKGROUND_QUEUED_KEY = "home_widget_refresh_background_queued"
    const val REFRESH_ACTIVITY_LAUNCHED_KEY = "home_widget_refresh_activity_launched"
    const val PERIODIC_REFRESH_STATUS_KEY = "home_widget_periodic_refresh_status"
    const val PERIODIC_REFRESH_STATUS_AT_MS_KEY = "home_widget_periodic_refresh_status_at_ms"
    const val DEBUG_PRESET_OVERRIDE_ENABLED_KEY = "home_widget_debug_preset_override_enabled"
    const val DEBUG_PRESET_INDEX_KEY = "home_widget_debug_preset_index"
    const val ACTION_SNAPSHOT_UPDATED =
        "com.ch00n9h09.montto.HOME_WIDGET_SNAPSHOT_UPDATED"
    const val ACTION_REFRESH =
        "com.ch00n9h09.montto.HOME_WIDGET_REFRESH"
    const val ACTION_DEBUG_PRESET_PREV =
        "com.ch00n9h09.montto.HOME_WIDGET_DEBUG_PRESET_PREV"
    const val ACTION_DEBUG_PRESET_NEXT =
        "com.ch00n9h09.montto.HOME_WIDGET_DEBUG_PRESET_NEXT"
    const val ACTION_DEBUG_PRESET_LIVE =
        "com.ch00n9h09.montto.HOME_WIDGET_DEBUG_PRESET_LIVE"
}
