package com.ch00n9h09.montto

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews

class HomeWidgetProvider : AppWidgetProvider() {
    companion object {
        fun notifySnapshotUpdated(context: Context, reason: String) {
            context.sendBroadcast(
                Intent(HomeWidgetConstants.ACTION_SNAPSHOT_UPDATED).apply {
                    `package` = context.packageName
                    putExtra("reason", reason)
                },
            )
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        appWidgetIds.forEach { appWidgetId ->
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        when (intent.action) {
            HomeWidgetConstants.ACTION_REFRESH -> {
                HomeWidgetSnapshotFactory.progressSnapshot(context)
                updateAllWidgets(context)
            }

            HomeWidgetConstants.ACTION_SNAPSHOT_UPDATED,
            AppWidgetManager.ACTION_APPWIDGET_UPDATE,
            -> updateAllWidgets(context)
        }
    }

    private fun updateAllWidgets(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        val ids = manager.getAppWidgetIds(
            ComponentName(context, HomeWidgetProvider::class.java),
        )
        onUpdate(context, manager, ids)
    }

    private fun updateAppWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
    ) {
        val snapshot = HomeWidgetSnapshot.load(context)
            ?: HomeWidgetSnapshot.loadAuthoritative(context)
            ?: HomeWidgetSnapshotFactory.refreshFromWorldData(context)
        val views = RemoteViews(context.packageName, R.layout.montto_home_widget)

        val launchIntent = Intent(context, MainActivity::class.java)
        val launchPendingIntent = PendingIntent.getActivity(
            context,
            appWidgetId,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        views.setOnClickPendingIntent(R.id.widget_root, launchPendingIntent)

        if (snapshot == null) {
            bindCharacterFrames(views = views, frameBitmaps = emptyList(), initialFrameIndex = 0)
            views.setImageViewResource(
                R.id.widget_stamina_dot,
                R.drawable.ic_home_widget_stamina_orange,
            )
            views.setInt(
                R.id.widget_root,
                "setBackgroundResource",
                R.drawable.bg_home_widget_day,
            )
            renderStatusIcons(
                context = context,
                views = views,
                visibleStatusIcons = emptyList(),
            )
            appWidgetManager.updateAppWidget(appWidgetId, views)
            return
        }

        bindCharacterFrames(
            views = views,
            frameBitmaps = HomeWidgetSpriteRenderer.renderLoopFrames(context, snapshot),
            initialFrameIndex = snapshot.animationFrameIndex.mod(4),
        )
        if (snapshot.hasUrgentStatus) {
            HomeWidgetSpriteRenderer.renderStatusIcon(context, "urgent")?.let { bitmap ->
                views.setImageViewBitmap(R.id.widget_stamina_dot, bitmap)
            } ?: views.setImageViewResource(
                R.id.widget_stamina_dot,
                snapshot.resolveStaminaDotDrawableRes(),
            )
        } else {
            views.setImageViewResource(
                R.id.widget_stamina_dot,
                snapshot.resolveStaminaDotDrawableRes(),
            )
        }
        views.setInt(
            R.id.widget_root,
            "setBackgroundResource",
            snapshot.resolveBackgroundDrawableRes(),
        )
        renderStatusIcons(
            context = context,
            views = views,
            visibleStatusIcons = snapshot.visibleStatusIcons,
        )
        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun renderStatusIcons(
        context: Context,
        views: RemoteViews,
        visibleStatusIcons: List<String>,
    ) {
        val iconViewIds = listOf(
            R.id.widget_status_icon_1,
            R.id.widget_status_icon_2,
            R.id.widget_status_icon_3,
            R.id.widget_status_icon_4,
        )
        val iconsToRender = visibleStatusIcons.take(iconViewIds.size)

        if (iconsToRender.isEmpty()) {
            views.setViewVisibility(R.id.widget_status_icon_row, View.GONE)
            return
        }

        views.setViewVisibility(R.id.widget_status_icon_row, View.VISIBLE)
        iconViewIds.forEachIndexed { index, viewId ->
            val iconName = iconsToRender.getOrNull(index)
            if (iconName == null) {
                views.setViewVisibility(viewId, View.GONE)
                views.setImageViewResource(viewId, R.drawable.ic_home_widget_placeholder)
            } else {
                val bitmap = HomeWidgetSpriteRenderer.renderStatusIcon(context, iconName)
                if (bitmap != null) {
                    views.setViewVisibility(viewId, View.VISIBLE)
                    views.setImageViewBitmap(viewId, bitmap)
                } else {
                    views.setViewVisibility(viewId, View.GONE)
                }
            }
        }
    }

    private fun bindCharacterFrames(
        views: RemoteViews,
        frameBitmaps: List<android.graphics.Bitmap?>,
        initialFrameIndex: Int,
    ) {
        val frameViewIds = listOf(
            R.id.widget_character_frame_1,
            R.id.widget_character_frame_2,
            R.id.widget_character_frame_3,
            R.id.widget_character_frame_4,
        )
        frameViewIds.forEachIndexed { index, viewId ->
            val bitmap = frameBitmaps.getOrNull(index)
            if (bitmap != null) {
                views.setImageViewBitmap(viewId, bitmap)
            } else {
                views.setImageViewResource(viewId, R.drawable.ic_home_widget_placeholder)
            }
        }
        views.setInt(
            R.id.widget_character_flipper,
            "setDisplayedChild",
            initialFrameIndex.coerceIn(0, frameViewIds.lastIndex),
        )
    }
}
