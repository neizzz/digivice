package com.ch00n9h09.montto

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

internal data class HomeWidgetPresence(
    val homeWidget2x1Count: Int,
    val homeWidget1x1Count: Int,
) {
    val hasAnyWidgets: Boolean
        get() = homeWidget2x1Count > 0 || homeWidget1x1Count > 0

    fun toDiagnosticsMap(): Map<String, Any> = mapOf(
        "hasAnyWidgets" to hasAnyWidgets,
        "homeWidget2x1Count" to homeWidget2x1Count,
        "homeWidget1x1Count" to homeWidget1x1Count,
    )
}

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
        return widgetPresence(context).hasAnyWidgets
    }

    fun widgetPresence(context: Context): HomeWidgetPresence {
        val appWidgetManager = AppWidgetManager.getInstance(context)
        return widgetPresence(
            homeWidgetIds = appWidgetManager.getAppWidgetIds(
                ComponentName(context, HomeWidgetProvider::class.java),
            ),
            homeWidget1x1Ids = appWidgetManager.getAppWidgetIds(
                ComponentName(context, HomeWidget1x1Provider::class.java),
            ),
        )
    }

    internal fun widgetPresence(
        homeWidgetIds: IntArray,
        homeWidget1x1Ids: IntArray,
    ): HomeWidgetPresence {
        return HomeWidgetPresence(
            homeWidget2x1Count = homeWidgetIds.size,
            homeWidget1x1Count = homeWidget1x1Ids.size,
        )
    }

    internal fun hasAnyWidgets(
        homeWidgetIds: IntArray,
        homeWidget1x1Ids: IntArray,
    ): Boolean {
        return widgetPresence(
            homeWidgetIds = homeWidgetIds,
            homeWidget1x1Ids = homeWidget1x1Ids,
        ).hasAnyWidgets
    }
}
