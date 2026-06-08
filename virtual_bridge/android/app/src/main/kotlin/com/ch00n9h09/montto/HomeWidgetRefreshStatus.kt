package com.ch00n9h09.montto

internal enum class WorldDataNativeAuthoritativeRefreshStatus(
    val value: String,
) {
    STARTED("native_authoritative_completion_started"),
    COMPLETED("native_authoritative_completion_completed"),
    FAILED("native_authoritative_completion_failed"),
}

internal enum class HomeWidgetPeriodicRefreshStatus(
    val value: String,
) {
    NO_WIDGETS("no_widgets"),
    PROGRESS_UNAVAILABLE("progress_unavailable"),
    PROGRESS_ONLY("periodic_progress_only"),
}
