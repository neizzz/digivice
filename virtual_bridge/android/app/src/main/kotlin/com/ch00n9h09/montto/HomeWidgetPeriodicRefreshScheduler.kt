package com.ch00n9h09.montto

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

internal object HomeWidgetPeriodicRefreshScheduler {
    fun scheduleIfNeeded(context: Context) {
        if (!hasAnyWidgets(context)) {
            return
        }

        val request = PeriodicWorkRequestBuilder<HomeWidgetPeriodicRefreshWorker>(
            HomeWidgetConstants.PERIODIC_REFRESH_INTERVAL_MINUTES,
            TimeUnit.MINUTES,
        ).build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            HomeWidgetConstants.PERIODIC_REFRESH_WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }

    fun cancelIfNoWidgets(context: Context) {
        if (hasAnyWidgets(context)) {
            return
        }

        WorkManager.getInstance(context).cancelUniqueWork(
            HomeWidgetConstants.PERIODIC_REFRESH_WORK_NAME,
        )
    }

    fun hasAnyWidgets(context: Context): Boolean {
        val appWidgetManager = AppWidgetManager.getInstance(context)
        return hasAnyWidgets(
            homeWidgetIds = appWidgetManager.getAppWidgetIds(
                ComponentName(context, HomeWidgetProvider::class.java),
            ),
            homeWidget1x1Ids = appWidgetManager.getAppWidgetIds(
                ComponentName(context, HomeWidget1x1Provider::class.java),
            ),
        )
    }

    internal fun hasAnyWidgets(
        homeWidgetIds: IntArray,
        homeWidget1x1Ids: IntArray,
    ): Boolean {
        return homeWidgetIds.isNotEmpty() || homeWidget1x1Ids.isNotEmpty()
    }
}
