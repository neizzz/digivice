package com.ch00n9h09.montto

object HomeWidgetConstants {
    const val CHANNEL = "digivice/home_widget"
    const val STORAGE_NAME = "digivice_home_widget"
    const val SNAPSHOT_KEY = "home_widget_snapshot_v1"
    const val AUTHORITATIVE_SNAPSHOT_KEY = "home_widget_authoritative_snapshot_v1"
    const val FLUTTER_STORAGE_NAME = "FlutterSharedPreferences"
    const val FLUTTER_PREFIX = "flutter."
    const val WORLD_DATA_KEY = "MainSceneWorldData"
    const val FLUTTER_WORLD_DATA_KEY = "${FLUTTER_PREFIX}${WORLD_DATA_KEY}"
    const val FLUTTER_SNAPSHOT_KEY = "${FLUTTER_PREFIX}HomeWidgetSnapshotV1"
    const val FLUTTER_AUTHORITATIVE_SNAPSHOT_KEY =
        "${FLUTTER_PREFIX}HomeWidgetAuthoritativeSnapshotV1"
    const val REFRESH_SMOKE_RESULT_KEY = "home_widget_refresh_smoke_last_result"
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
