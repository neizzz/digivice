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

internal object HomeWidgetLayoutSizing {
    private const val ONE_BY_ONE_CHARACTER_VISIBLE_WIDTH_NUMERATOR = 60
    private const val ONE_BY_ONE_CHARACTER_VISIBLE_WIDTH_DENOMINATOR = 100

    fun resolveWidgetDimensionDp(
        minDp: Int,
        maxDp: Int,
        fallbackDp: Int,
    ): Int {
        val resolvedDp = listOf(minDp, maxDp)
            .filter { it > 0 }
            .maxOrNull()
        return resolvedDp ?: fallbackDp
    }

    fun dpToPx(
        dp: Int,
        density: Float,
    ): Int {
        return (dp * density).roundToInt().coerceAtLeast(1)
    }

    fun resolveOneByOneCharacterTargetVisibleWidthPx(widgetWidthPx: Int): Int {
        val safeWidgetWidthPx = widgetWidthPx.coerceAtLeast(1)
        return (
            (safeWidgetWidthPx * ONE_BY_ONE_CHARACTER_VISIBLE_WIDTH_NUMERATOR) +
                (ONE_BY_ONE_CHARACTER_VISIBLE_WIDTH_DENOMINATOR - 1)
        ) / ONE_BY_ONE_CHARACTER_VISIBLE_WIDTH_DENOMINATOR
    }
}

internal object HomeWidgetBroadcastActionHandler {
    fun handle(
        action: String?,
        onRefresh: () -> Unit,
        onAdvancePreset: (step: Int) -> Unit,
        onDisableOverride: () -> Unit,
        onUpdateAllWidgets: () -> Unit,
    ): Boolean {
        when (action) {
            HomeWidgetConstants.ACTION_REFRESH -> {
                onRefresh()
                onUpdateAllWidgets()
            }

            HomeWidgetConstants.ACTION_DEBUG_PRESET_PREV -> {
                onAdvancePreset(-1)
                onUpdateAllWidgets()
            }

            HomeWidgetConstants.ACTION_DEBUG_PRESET_NEXT -> {
                onAdvancePreset(1)
                onUpdateAllWidgets()
            }

            HomeWidgetConstants.ACTION_DEBUG_PRESET_LIVE -> {
                onDisableOverride()
                onUpdateAllWidgets()
            }

            HomeWidgetConstants.ACTION_SNAPSHOT_UPDATED,
            AppWidgetManager.ACTION_APPWIDGET_UPDATE,
            -> onUpdateAllWidgets()

            else -> return false
        }

        return true
    }
}

abstract class BaseHomeWidgetProvider : AppWidgetProvider() {
    protected open val layoutResId: Int = R.layout.montto_home_widget
    protected open val statusIconsRightToLeft: Boolean = false
    protected open val fallbackWidgetWidthDp: Int = 180
    protected open val fallbackWidgetHeightDp: Int = 90
    protected open val statusIconGroupViewId: Int = R.id.widget_status_icon_row
    protected open val statusIconRowViewIds: List<Int> = listOf(R.id.widget_status_icon_row)
    protected open val statusIconRows: List<List<Int>> = listOf(
        listOf(
            R.id.widget_status_icon_1,
            R.id.widget_status_icon_2,
            R.id.widget_status_icon_3,
            R.id.widget_status_icon_4,
        ),
    )

    protected open fun resolveStaminaDotDrawableRes(snapshot: HomeWidgetSnapshot?): Int {
        return snapshot?.resolveStaminaDotDrawableRes() ?: R.drawable.ic_home_widget_stamina_orange
    }

    protected open fun resolveCharacterTargetVisibleWidthPx(
        context: Context,
        appWidgetManager: AppWidgetManager?,
        appWidgetId: Int?,
    ): Int? = null

    internal fun buildRemoteViews(
        context: Context,
        snapshot: HomeWidgetSnapshot?,
        debugModeEnabled: Boolean,
        appWidgetId: Int? = null,
        appWidgetManager: AppWidgetManager? = null,
    ): RemoteViews {
        val views = RemoteViews(context.packageName, layoutResId)

        if (appWidgetId != null) {
            val launchIntent = Intent(context, MainActivity::class.java)
            val launchPendingIntent = PendingIntent.getActivity(
                context,
                appWidgetId,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            views.setOnClickPendingIntent(R.id.widget_root, launchPendingIntent)
        }

        bindDebugControls(
            context = context,
            views = views,
            appWidgetId = appWidgetId ?: 0,
            debugModeEnabled = debugModeEnabled && appWidgetId != null,
        )

        if (snapshot == null) {
            views.setViewVisibility(R.id.widget_stamina_dot, View.VISIBLE)
            bindCharacterFrames(views = views, frameBitmaps = emptyList(), initialFrameIndex = 0)
            views.setImageViewResource(
                R.id.widget_stamina_dot,
                resolveStaminaDotDrawableRes(snapshot = null),
            )
            bindBackground(
                context = context,
                views = views,
                snapshot = null,
                targetSizePx = resolveBackgroundTargetSizePx(
                    context = context,
                    appWidgetManager = appWidgetManager,
                    appWidgetId = appWidgetId,
                ),
            )
            renderStatusIcons(
                context = context,
                views = views,
                visibleStatusIcons = emptyList(),
            )
            return views
        }

        views.setViewVisibility(
            R.id.widget_stamina_dot,
            if (snapshot.shouldShowStaminaDot()) View.VISIBLE else View.GONE,
        )
        bindCharacterFrames(
            views = views,
            frameBitmaps = HomeWidgetSpriteRenderer.renderLoopFrames(
                context = context,
                snapshot = snapshot,
                targetVisibleWidthPx = resolveCharacterTargetVisibleWidthPx(
                    context = context,
                    appWidgetManager = appWidgetManager,
                    appWidgetId = appWidgetId,
                ),
            ),
            initialFrameIndex = snapshot.animationFrameIndex.mod(4),
        )
        if (snapshot.hasUrgentStatus) {
            HomeWidgetSpriteRenderer.renderStatusIcon(context, "urgent")?.let { bitmap ->
                views.setImageViewBitmap(R.id.widget_stamina_dot, bitmap)
            } ?: views.setImageViewResource(
                R.id.widget_stamina_dot,
                resolveStaminaDotDrawableRes(snapshot),
            )
        } else {
            views.setImageViewResource(
                R.id.widget_stamina_dot,
                resolveStaminaDotDrawableRes(snapshot),
            )
        }
        bindBackground(
            context = context,
            views = views,
            snapshot = snapshot,
            targetSizePx = resolveBackgroundTargetSizePx(
                context = context,
                appWidgetManager = appWidgetManager,
                appWidgetId = appWidgetId,
            ),
        )
        renderStatusIcons(
            context = context,
            views = views,
            visibleStatusIcons = snapshot.visibleStatusIcons,
        )
        return views
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        HomeWidgetPeriodicRefreshScheduler.scheduleIfNeeded(context)
        appWidgetIds.forEach { appWidgetId ->
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        HomeWidgetPeriodicRefreshScheduler.scheduleIfNeeded(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        HomeWidgetPeriodicRefreshScheduler.cancelIfNoWidgets(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        HomeWidgetBroadcastActionHandler.handle(
            action = intent.action,
            onRefresh = {
                HomeWidgetSnapshotFactory.progressSnapshot(context)
            },
            onAdvancePreset = { step ->
                HomeWidgetDebugPresetStore.advancePreset(context, step = step)
            },
            onDisableOverride = {
                HomeWidgetDebugPresetStore.disableOverride(context)
            },
            onUpdateAllWidgets = {
                updateAllWidgets(context)
            },
        )
    }

    private fun providerComponent(context: Context): ComponentName {
        return ComponentName(context, javaClass)
    }

    private fun updateAllWidgets(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        val ids = manager.getAppWidgetIds(providerComponent(context))
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
        val views = buildRemoteViews(
            context = context,
            snapshot = snapshot,
            debugModeEnabled = debugModeEnabled,
            appWidgetId = appWidgetId,
            appWidgetManager = appWidgetManager,
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
        views.setOnClickPendingIntent(
            R.id.widget_debug_live_button,
            createDebugPresetPendingIntent(
                context = context,
                action = HomeWidgetConstants.ACTION_DEBUG_PRESET_LIVE,
                appWidgetId = appWidgetId,
                requestCodeOffset = 3,
            ),
        )
    }

    private fun createDebugPresetPendingIntent(
        context: Context,
        action: String,
        appWidgetId: Int,
        requestCodeOffset: Int,
    ): PendingIntent {
        val intent = Intent(context, javaClass).apply {
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
        views: RemoteViews,
        snapshot: HomeWidgetSnapshot?,
        targetSizePx: WidgetBackgroundSizePx,
    ) {
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
        val iconViewIds = statusIconRows.flatten().distinct()
        val iconsToRender = visibleStatusIcons.take(iconViewIds.size)

        if (iconsToRender.isEmpty()) {
            views.setViewVisibility(statusIconGroupViewId, View.GONE)
            return
        }

        views.setViewVisibility(statusIconGroupViewId, View.VISIBLE)

        var iconIndex = 0
        statusIconRows.forEachIndexed { rowIndex, rowViewIds ->
            val rowIcons = iconsToRender.drop(iconIndex).take(rowViewIds.size)
            val rowViewId = statusIconRowViewIds.getOrNull(rowIndex)
            rowViewId?.let { views.setViewVisibility(it, if (rowIcons.isEmpty()) View.GONE else View.VISIBLE) }

            val orderedViewIds = if (statusIconsRightToLeft) {
                rowViewIds.reversed()
            } else {
                rowViewIds
            }
            val iconByViewId = orderedViewIds.withIndex().associate { indexedValue ->
                indexedValue.value to rowIcons.getOrNull(indexedValue.index)
            }

            rowViewIds.forEach { viewId ->
                val iconName = iconByViewId[viewId]
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
            iconIndex += rowViewIds.size
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
        appWidgetManager: AppWidgetManager?,
        appWidgetId: Int?,
    ): WidgetBackgroundSizePx {
        if (appWidgetManager == null || appWidgetId == null) {
            return WidgetBackgroundSizePx(
                width = dpToPx(context, fallbackWidgetWidthDp),
                height = dpToPx(context, fallbackWidgetHeightDp),
            )
        }

        val options = appWidgetManager.getAppWidgetOptions(appWidgetId)

        fun resolveDimensionPx(
            minKey: String,
            maxKey: String,
            fallbackDp: Int,
        ): Int {
            val minDp = options.getInt(minKey, 0)
            val maxDp = options.getInt(maxKey, 0)
            val resolvedDp = HomeWidgetLayoutSizing.resolveWidgetDimensionDp(
                minDp = minDp,
                maxDp = maxDp,
                fallbackDp = fallbackDp,
            )
            return dpToPx(context, resolvedDp)
        }

        return WidgetBackgroundSizePx(
            width = resolveDimensionPx(
                AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,
                AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH,
                fallbackWidgetWidthDp,
            ),
            height = resolveDimensionPx(
                AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,
                AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT,
                fallbackWidgetHeightDp,
            ),
        )
    }

    protected fun resolveWidgetWidthPx(
        context: Context,
        appWidgetManager: AppWidgetManager?,
        appWidgetId: Int?,
    ): Int {
        return resolveWidgetDimensionPx(
            context = context,
            appWidgetManager = appWidgetManager,
            appWidgetId = appWidgetId,
            minKey = AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,
            maxKey = AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH,
            fallbackDp = fallbackWidgetWidthDp,
        )
    }

    private fun resolveWidgetDimensionPx(
        context: Context,
        appWidgetManager: AppWidgetManager?,
        appWidgetId: Int?,
        minKey: String,
        maxKey: String,
        fallbackDp: Int,
    ): Int {
        if (appWidgetManager == null || appWidgetId == null) {
            return dpToPx(context, fallbackDp)
        }

        val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
        val minDp = options.getInt(minKey, 0)
        val maxDp = options.getInt(maxKey, 0)
        val resolvedDp = HomeWidgetLayoutSizing.resolveWidgetDimensionDp(
            minDp = minDp,
            maxDp = maxDp,
            fallbackDp = fallbackDp,
        )
        return dpToPx(context, resolvedDp)
    }

    private fun dpToPx(context: Context, dp: Int): Int {
        return HomeWidgetLayoutSizing.dpToPx(
            dp = dp,
            density = context.resources.displayMetrics.density,
        )
    }

    internal data class WidgetBackgroundSizePx(
        val width: Int,
        val height: Int,
    )
}

class HomeWidgetProvider : BaseHomeWidgetProvider() {
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
}

class HomeWidget1x1Provider : BaseHomeWidgetProvider() {
    override val layoutResId: Int = R.layout.montto_home_widget_1x1
    override val statusIconsRightToLeft: Boolean = true
    override val fallbackWidgetWidthDp: Int = 90
    override val fallbackWidgetHeightDp: Int = 90
    override val statusIconRowViewIds: List<Int> = listOf(
        R.id.widget_status_icon_row_1,
        R.id.widget_status_icon_row_2,
    )
    override val statusIconRows: List<List<Int>> = listOf(
        listOf(R.id.widget_status_icon_1, R.id.widget_status_icon_2),
        listOf(R.id.widget_status_icon_3, R.id.widget_status_icon_4),
    )

    override fun resolveStaminaDotDrawableRes(snapshot: HomeWidgetSnapshot?): Int {
        return when (snapshot?.staminaLevel) {
            "green" -> R.drawable.ic_home_widget_1x1_stamina_green
            "red" -> R.drawable.ic_home_widget_1x1_stamina_red
            else -> R.drawable.ic_home_widget_1x1_stamina_orange
        }
    }

    override fun resolveCharacterTargetVisibleWidthPx(
        context: Context,
        appWidgetManager: AppWidgetManager?,
        appWidgetId: Int?,
    ): Int {
        return HomeWidgetLayoutSizing.resolveOneByOneCharacterTargetVisibleWidthPx(
            resolveWidgetWidthPx(
                context = context,
                appWidgetManager = appWidgetManager,
                appWidgetId = appWidgetId,
            ),
        )
    }
}
