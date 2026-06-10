package com.ch00n9h09.montto

internal enum class HomeWidgetPeriodicRefreshStatus(
    val value: String,
) {
    NO_WIDGETS("no_widgets"),
    PROGRESS_UNAVAILABLE("progress_unavailable"),
    PROGRESS_ONLY("periodic_progress_only"),
    FLUTTER_AUTHORITY_ONLY("flutter_authority_only"),
}
