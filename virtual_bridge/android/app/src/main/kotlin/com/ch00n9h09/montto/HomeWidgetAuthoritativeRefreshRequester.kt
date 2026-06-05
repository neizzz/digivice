package com.ch00n9h09.montto

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences

internal enum class HomeWidgetAuthoritativeRefreshRequestResult(
    val status: String,
) {
    REQUESTED("fallback_refresh_requested"),
    SKIPPED_IN_FLIGHT("fallback_refresh_skipped_in_flight"),
    SKIPPED_THROTTLED("fallback_refresh_skipped_throttled"),
    FAILED("fallback_refresh_failed"),
}

internal object HomeWidgetAuthoritativeRefreshRequester {
    private const val REQUEST_THROTTLE_WINDOW_MS =
        HomeWidgetConstants.PERIODIC_REFRESH_INTERVAL_MINUTES * 60_000L

    fun request(context: Context, nowMs: Long = System.currentTimeMillis()): HomeWidgetAuthoritativeRefreshRequestResult {
        val prefs = prefs(context)
        return request(
            prefs = prefs,
            nowMs = nowMs,
            launchRefreshActivity = {
                runCatching {
                    context.startActivity(
                        Intent(context, WidgetRefreshActivity::class.java).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        },
                    )
                }.isSuccess
            },
        )
    }

    fun completeRefresh(
        context: Context,
        payloadSummary: String?,
        completedAtMs: Long = System.currentTimeMillis(),
    ) {
        val prefs = prefs(context)
        completeRefresh(
            prefs = prefs,
            payloadSummary = payloadSummary,
            completedAtMs = completedAtMs,
        )
        HomeWidgetProvider.notifySnapshotUpdated(context, "completeRefresh")
    }

    fun readDiagnostics(context: Context): Map<String, Any?> {
        return readDiagnostics(prefs(context))
    }

    internal fun request(
        prefs: SharedPreferences,
        nowMs: Long,
        launchRefreshActivity: () -> Boolean,
    ): HomeWidgetAuthoritativeRefreshRequestResult {
        val lastRequestedAtMs = prefs.getLong(
            HomeWidgetConstants.REFRESH_REQUESTED_AT_MS_KEY,
            0L,
        ).coerceAtLeast(0L)
        val inFlight = prefs.getBoolean(
            HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY,
            false,
        )
        val hasRecentRequest = lastRequestedAtMs > 0L &&
            nowMs - lastRequestedAtMs < REQUEST_THROTTLE_WINDOW_MS

        if (inFlight && hasRecentRequest) {
            return HomeWidgetAuthoritativeRefreshRequestResult.SKIPPED_IN_FLIGHT
        }

        if (hasRecentRequest) {
            return HomeWidgetAuthoritativeRefreshRequestResult.SKIPPED_THROTTLED
        }

        prefs.edit()
            .putLong(HomeWidgetConstants.REFRESH_REQUESTED_AT_MS_KEY, nowMs)
            .putBoolean(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY, true)
            .apply()

        if (launchRefreshActivity()) {
            return HomeWidgetAuthoritativeRefreshRequestResult.REQUESTED
        }

        prefs.edit()
            .putBoolean(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY, false)
            .apply()
        return HomeWidgetAuthoritativeRefreshRequestResult.FAILED
    }

    internal fun completeRefresh(
        prefs: SharedPreferences,
        payloadSummary: String?,
        completedAtMs: Long,
    ) {
        prefs.edit()
            .putBoolean(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY, false)
            .putLong(HomeWidgetConstants.REFRESH_COMPLETED_AT_MS_KEY, completedAtMs)
            .putString(
                HomeWidgetConstants.REFRESH_SMOKE_RESULT_KEY,
                payloadSummary ?: "completed",
            )
            .apply()
    }

    internal fun readDiagnostics(
        prefs: SharedPreferences,
    ): Map<String, Any?> {
        return linkedMapOf(
            "periodicRefreshStatus" to prefs.getString(
                HomeWidgetConstants.PERIODIC_REFRESH_STATUS_KEY,
                null,
            ),
            "periodicRefreshStatusAtMs" to prefs.getLong(
                HomeWidgetConstants.PERIODIC_REFRESH_STATUS_AT_MS_KEY,
                0L,
            ).takeIf { it > 0L },
            "requestedAtMs" to prefs.getLong(
                HomeWidgetConstants.REFRESH_REQUESTED_AT_MS_KEY,
                0L,
            ).takeIf { it > 0L },
            "completedAtMs" to prefs.getLong(
                HomeWidgetConstants.REFRESH_COMPLETED_AT_MS_KEY,
                0L,
            ).takeIf { it > 0L },
            "inFlight" to prefs.getBoolean(
                HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY,
                false,
            ),
            "smokeResult" to prefs.getString(
                HomeWidgetConstants.REFRESH_SMOKE_RESULT_KEY,
                null,
            ),
        )
    }

    private fun prefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(
            HomeWidgetConstants.STORAGE_NAME,
            Context.MODE_PRIVATE,
        )
    }
}
