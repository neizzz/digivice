package com.ch00n9h09.montto

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import kotlin.math.roundToInt

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

            HomeWidgetConstants.ACTION_DEBUG_PRESET_PREV -> {
                HomeWidgetDebugPresetStore.advancePreset(context, step = -1)
                updateAllWidgets(context)
            }

            HomeWidgetConstants.ACTION_DEBUG_PRESET_NEXT -> {
                HomeWidgetDebugPresetStore.advancePreset(context, step = 1)
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
        val debugModeEnabled = HomeWidgetDebugPresetStore.isNativeDebugModeEnabled()
        val snapshot = HomeWidgetSnapshotSelector.select(
            debugModeEnabled = debugModeEnabled,
            debugOverrideSnapshot = HomeWidgetDebugPresetStore.resolveOverrideSnapshot(context),
            currentSnapshot = HomeWidgetSnapshot.load(context),
            authoritativeSnapshot = HomeWidgetSnapshot.loadAuthoritative(context),
            worldDataFallback = {
                HomeWidgetSnapshotFactory.refreshFromWorldData(context)
            },
        )
        val views = RemoteViews(context.packageName, R.layout.montto_home_widget)

        val launchIntent = Intent(context, MainActivity::class.java)
        val launchPendingIntent = PendingIntent.getActivity(
            context,
            appWidgetId,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        views.setOnClickPendingIntent(R.id.widget_root, launchPendingIntent)
        bindDebugControls(
            context = context,
            views = views,
            appWidgetId = appWidgetId,
            debugModeEnabled = debugModeEnabled,
        )

        if (snapshot == null) {
            bindCharacterFrames(views = views, frameBitmaps = emptyList(), initialFrameIndex = 0)
            views.setImageViewResource(
                R.id.widget_stamina_dot,
                R.drawable.ic_home_widget_stamina_orange,
            )
            bindBackground(
                context = context,
                appWidgetManager = appWidgetManager,
                appWidgetId = appWidgetId,
                views = views,
                snapshot = null,
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
        bindBackground(
            context = context,
            appWidgetManager = appWidgetManager,
            appWidgetId = appWidgetId,
            views = views,
            snapshot = snapshot,
        )
        renderStatusIcons(
            context = context,
            views = views,
            visibleStatusIcons = snapshot.visibleStatusIcons,
        )
        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun bindDebugControls(
        context: Context,
        views: RemoteViews,
        appWidgetId: Int,
        debugModeEnabled: Boolean,
    ) {
        views.setViewVisibility(
            R.id.widget_debug_controls,
            if (debugModeEnabled) View.VISIBLE else View.GONE,
        )
        if (!debugModeEnabled) {
            return
        }

        views.setOnClickPendingIntent(
            R.id.widget_debug_prev_button,
            createDebugPresetPendingIntent(
                context = context,
                action = HomeWidgetConstants.ACTION_DEBUG_PRESET_PREV,
                appWidgetId = appWidgetId,
                requestCodeOffset = 1,
            ),
        )
        views.setOnClickPendingIntent(
            R.id.widget_debug_next_button,
            createDebugPresetPendingIntent(
                context = context,
                action = HomeWidgetConstants.ACTION_DEBUG_PRESET_NEXT,
                appWidgetId = appWidgetId,
                requestCodeOffset = 2,
            ),
        )
    }

    private fun createDebugPresetPendingIntent(
        context: Context,
        action: String,
        appWidgetId: Int,
        requestCodeOffset: Int,
    ): PendingIntent {
        val intent = Intent(context, HomeWidgetProvider::class.java).apply {
            this.action = action
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        }
        return PendingIntent.getBroadcast(
            context,
            (appWidgetId * 10) + requestCodeOffset,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun bindBackground(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        views: RemoteViews,
        snapshot: HomeWidgetSnapshot?,
    ) {
        val targetSizePx = resolveBackgroundTargetSizePx(context, appWidgetManager, appWidgetId)
        val backgroundBitmap = snapshot?.let {
            HomeWidgetSpriteRenderer.renderBackground(
                context = context,
                snapshot = it,
                targetWidthPx = targetSizePx.width,
                targetHeightPx = targetSizePx.height,
            )
        }

        if (backgroundBitmap != null) {
            views.setImageViewBitmap(R.id.widget_background_image, backgroundBitmap)
        } else {
            views.setImageViewResource(
                R.id.widget_background_image,
                R.drawable.bg_home_widget_day,
            )
        }
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

    private fun resolveBackgroundTargetSizePx(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
    ): WidgetBackgroundSizePx {
        val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
        val density = context.resources.displayMetrics.density

        fun resolveDimensionPx(
            minKey: String,
            maxKey: String,
            fallbackDp: Int,
        ): Int {
            val minDp = options.getInt(minKey, 0)
            val maxDp = options.getInt(maxKey, 0)
            val resolvedDp = maxOf(minDp, maxDp, fallbackDp)
            return (resolvedDp * density).roundToInt().coerceAtLeast(1)
        }

        return WidgetBackgroundSizePx(
            width = resolveDimensionPx(
                AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,
                AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH,
                180,
            ),
            height = resolveDimensionPx(
                AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,
                AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT,
                90,
            ),
        )
    }

    private data class WidgetBackgroundSizePx(
        val width: Int,
        val height: Int,
    )
}
