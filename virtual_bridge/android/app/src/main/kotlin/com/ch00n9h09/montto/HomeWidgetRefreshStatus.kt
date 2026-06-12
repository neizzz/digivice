package com.ch00n9h09.montto

internal enum class HomeWidgetPeriodicRefreshStatus(
    val value: String,
) {
    PERIODIC_WORK_STARTED("periodic_worker_started"),
    PERIODIC_WORK_FAILED("periodic_worker_failed"),
    NO_WIDGETS("no_widgets"),
    FLUTTER_REFRESH_PENDING("flutter_refresh_pending"),
}
