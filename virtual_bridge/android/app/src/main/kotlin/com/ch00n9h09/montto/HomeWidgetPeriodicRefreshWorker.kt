package com.ch00n9h09.montto

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

internal object HomeWidgetPeriodicRefreshRunner {
    fun run(
        hasAnyWidgets: () -> Boolean,
        onNoWidgets: () -> Unit,
        progressSnapshot: () -> HomeWidgetSnapshot?,
        notifySnapshotUpdated: (reason: String) -> Unit,
    ): Boolean {
        if (!hasAnyWidgets()) {
            onNoWidgets()
            return false
        }

        val progressedSnapshot = progressSnapshot() ?: return false
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
            progressSnapshot = {
                HomeWidgetSnapshotFactory.progressSnapshot(applicationContext)
            },
            notifySnapshotUpdated = { reason ->
                HomeWidgetProvider.notifySnapshotUpdated(applicationContext, reason)
            },
        )

        return Result.success()
    }
}
