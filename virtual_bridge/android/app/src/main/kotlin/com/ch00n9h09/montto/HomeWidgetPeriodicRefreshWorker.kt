package com.ch00n9h09.montto

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

internal object HomeWidgetPeriodicRefreshRunner {
    fun run(
        hasAnyWidgets: () -> Boolean,
        onNoWidgets: () -> Unit,
        progressSnapshot: (nowMs: Long) -> HomeWidgetSnapshot?,
        loadAuthoritativeSnapshot: () -> HomeWidgetSnapshot?,
        completeNativeAuthoritativeRefresh: (nowMs: Long) -> WorldDataNativeAuthoritativeRefreshResult,
        requestAuthoritativeRefreshFallback: () -> HomeWidgetAuthoritativeRefreshRequestResult,
        notifySnapshotUpdated: (reason: String) -> Unit,
        recordPeriodicRefreshStatus: (status: String, nowMs: Long) -> Unit,
        nowMsProvider: () -> Long = { System.currentTimeMillis() },
    ): Boolean {
        if (!hasAnyWidgets()) {
            onNoWidgets()
            recordPeriodicRefreshStatus(
                HomeWidgetPeriodicRefreshStatus.NO_WIDGETS.value,
                nowMsProvider(),
            )
            return false
        }

        val nowMs = nowMsProvider()
        recordPeriodicRefreshStatus(
            HomeWidgetPeriodicRefreshStatus.FLUTTER_AUTHORITY_ONLY.value,
            nowMs,
        )
        notifySnapshotUpdated(
            HomeWidgetConstants.PERIODIC_REFRESH_REASON,
        )
        return loadAuthoritativeSnapshot() != null
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
            progressSnapshot = { nowMs ->
                WorldDataSnapshotFactory.progressSnapshot(applicationContext, nowMs)
            },
            loadAuthoritativeSnapshot = {
                HomeWidgetSnapshot.loadAuthoritative(applicationContext)
            },
            completeNativeAuthoritativeRefresh = { nowMs ->
                WorldDataNativeAuthoritativeRefresh.complete(
                    context = applicationContext,
                    nowMs = nowMs,
                )
            },
            requestAuthoritativeRefreshFallback = {
                HomeWidgetAuthoritativeRefreshRequester.request(applicationContext)
            },
            notifySnapshotUpdated = { reason ->
                HomeWidgetProvider.notifySnapshotUpdated(applicationContext, reason)
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
