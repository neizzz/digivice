package com.ch00n9h09.montto

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences

internal enum class HomeWidgetAuthoritativeRefreshRequestResult(
    val status: String,
) {
    REQUESTED("refresh_requested"),
    SKIPPED_IN_FLIGHT("refresh_skipped_in_flight"),
    SKIPPED_THROTTLED("refresh_skipped_throttled"),
    FAILED("refresh_request_failed"),
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

    private fun prefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(
            HomeWidgetConstants.STORAGE_NAME,
            Context.MODE_PRIVATE,
        )
    }
}
