package com.ch00n9h09.montto

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

internal object HomeWidgetPeriodicRefreshRunner {
    fun run(
        hasAnyWidgets: () -> Boolean,
        onNoWidgets: () -> Unit,
        requestAuthoritativeRefresh: (nowMs: Long) -> HomeWidgetAuthoritativeRefreshRequestResult,
        recordPeriodicRefreshStatus: (status: String, nowMs: Long) -> Unit,
        nowMsProvider: () -> Long = { System.currentTimeMillis() },
    ): Boolean {
        val startedAtMs = nowMsProvider()
        recordPeriodicRefreshStatus(
            HomeWidgetPeriodicRefreshStatus.PERIODIC_WORK_STARTED.value,
            startedAtMs,
        )
        if (!hasAnyWidgets()) {
            onNoWidgets()
            recordPeriodicRefreshStatus(
                HomeWidgetPeriodicRefreshStatus.NO_WIDGETS.value,
                startedAtMs,
            )
            return false
        }

        val nowMs = nowMsProvider()
        recordPeriodicRefreshStatus(
            HomeWidgetPeriodicRefreshStatus.FLUTTER_REFRESH_PENDING.value,
            nowMs,
        )
        val refreshResult = runCatching {
            requestAuthoritativeRefresh(nowMs)
        }.getOrElse {
            recordPeriodicRefreshStatus(
                HomeWidgetPeriodicRefreshStatus.PERIODIC_WORK_FAILED.value,
                nowMs,
            )
            return false
        }
        recordPeriodicRefreshStatus(refreshResult.status, nowMs)
        return refreshResult == HomeWidgetAuthoritativeRefreshRequestResult.REQUESTED
    }
}

internal class HomeWidgetPeriodicRefreshWorker(
    appContext: Context,
    workerParameters: WorkerParameters,
) : Worker(appContext, workerParameters) {
    override fun doWork(): Result {
        HomeWidgetPeriodicRefreshRunner.run(
            hasAnyWidgets = {
                HomeWidgetPeriodicRefreshScheduler.hasAnyWidgets(applicationContext)
            },
            onNoWidgets = {
                HomeWidgetPeriodicRefreshScheduler.cancelIfNoWidgets(applicationContext)
            },
            requestAuthoritativeRefresh = { nowMs ->
                HomeWidgetAuthoritativeRefreshRequester.request(
                    context = applicationContext,
                    nowMs = nowMs,
                    force = true,
                )
            },
            recordPeriodicRefreshStatus = { status, nowMs ->
                applicationContext.getSharedPreferences(
                    HomeWidgetConstants.STORAGE_NAME,
                    Context.MODE_PRIVATE,
                ).edit()
                    .putString(HomeWidgetConstants.PERIODIC_REFRESH_STATUS_KEY, status)
                    .putLong(HomeWidgetConstants.PERIODIC_REFRESH_STATUS_AT_MS_KEY, nowMs)
                    .apply()
            },
        )

        return Result.success()
    }
}
