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
        requestAuthoritativeRefresh: () -> HomeWidgetAuthoritativeRefreshRequestResult,
        notifySnapshotUpdated: (reason: String) -> Unit,
        recordPeriodicRefreshStatus: (status: String, nowMs: Long) -> Unit,
        nowMsProvider: () -> Long = { System.currentTimeMillis() },
    ): Boolean {
        if (!hasAnyWidgets()) {
            onNoWidgets()
            recordPeriodicRefreshStatus("no_widgets", nowMsProvider())
            return false
        }

        val nowMs = nowMsProvider()
        val progressedSnapshot = progressSnapshot(nowMs) ?: run {
            recordPeriodicRefreshStatus("progress_unavailable", nowMs)
            return false
        }
        val authoritativeSnapshot = loadAuthoritativeSnapshot()
        val periodicStatus = if (
            HomeWidgetSnapshotFactory.requiresAuthoritativeRefresh(
                currentSnapshot = progressedSnapshot,
                authoritativeSnapshot = authoritativeSnapshot,
                nowMs = nowMs,
            )
        ) {
            requestAuthoritativeRefresh().status
        } else {
            "progress_only"
        }
        recordPeriodicRefreshStatus(periodicStatus, nowMs)
        notifySnapshotUpdated(
            HomeWidgetConstants.PERIODIC_REFRESH_REASON,
        )
        return progressedSnapshot.snapshotKind.isNotBlank()
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
                HomeWidgetSnapshotFactory.progressSnapshot(applicationContext, nowMs)
            },
            loadAuthoritativeSnapshot = {
                HomeWidgetSnapshot.loadAuthoritative(applicationContext)
            },
            requestAuthoritativeRefresh = {
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
