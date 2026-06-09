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
        val progressedSnapshot = progressSnapshot(nowMs) ?: run {
            recordPeriodicRefreshStatus(
                HomeWidgetPeriodicRefreshStatus.PROGRESS_UNAVAILABLE.value,
                nowMs,
            )
            return false
        }
        val authoritativeSnapshot = loadAuthoritativeSnapshot()
        val shouldRequestFlutterRefresh = isMaturedEggSnapshot(
            progressedSnapshot,
            nowMs,
        ) || isMaturedEggSnapshot(
            authoritativeSnapshot,
            nowMs,
        )
        val periodicStatus = if (shouldRequestFlutterRefresh) {
            recordPeriodicRefreshStatus(
                HomeWidgetPeriodicRefreshStatus.FLUTTER_AUTHORITY_ONLY.value,
                nowMs,
            )
            requestAuthoritativeRefreshFallback().status
        } else {
            HomeWidgetPeriodicRefreshStatus.PROGRESS_ONLY.value
        }
        recordPeriodicRefreshStatus(periodicStatus, nowMs)
        notifySnapshotUpdated(
            HomeWidgetConstants.PERIODIC_REFRESH_REASON,
        )
        return progressedSnapshot.snapshotKind.isNotBlank()
    }

    private fun isMaturedEggSnapshot(
        snapshot: HomeWidgetSnapshot?,
        nowMs: Long,
    ): Boolean {
        return snapshot?.characterState == "egg" &&
            snapshot.eggHatchTimeMs?.let { it <= nowMs } == true
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
