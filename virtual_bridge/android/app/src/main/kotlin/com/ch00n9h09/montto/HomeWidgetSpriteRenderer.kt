package com.ch00n9h09.montto

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import org.json.JSONObject
import kotlin.math.ceil
import kotlin.math.roundToInt

object HomeWidgetSpriteRenderer {
    private const val WIDGET_LOOP_FRAME_COUNT = 4
    private const val DEFAULT_CHARACTER_FRAME_SIZE_PX = 96
    private const val BASE_EGG_FRAME_SIZE_PX = 32f
    private const val EGG_TEXTURE_KEY_START = 500
    private const val EGG_CRACK_BASE_ALPHA = 1.0f
    private const val EGG_CRACK_STAGE_ALPHA_STEP = 0.12f
    private val widgetBackgroundAsset = SpriteAsset(
        pngPath = "assets/web/assets/game/sprites/widget-bg.png",
        jsonPath = "assets/web/assets/game/sprites/widget-bg.json",
    )

    private val frameCache = mutableMapOf<String, Map<String, FrameRect>>()
    private val sheetCache = mutableMapOf<String, Bitmap>()

    fun render(context: Context, snapshot: HomeWidgetSnapshot): Bitmap? {
        return renderFrame(context, snapshot, snapshot.animationFrameIndex)
    }

    fun renderFrame(
        context: Context,
        snapshot: HomeWidgetSnapshot,
        frameIndex: Int,
    ): Bitmap? {
        val asset = resolveCharacterAsset(snapshot) ?: return null
        val frames = frameCache.getOrPut(asset.jsonPath) {
            loadFrameMap(context, asset.jsonPath)
        }
        val frameRect = frames[resolveCharacterFrameName(snapshot, frames, frameIndex)] ?: return null
        val bitmap = sheetCache.getOrPut(asset.pngPath) {
            loadBitmap(context, asset.pngPath)
        }
        val cropped = Bitmap.createBitmap(
            bitmap,
            frameRect.x,
            frameRect.y,
            frameRect.width,
            frameRect.height,
        )
        val scaled = Bitmap.createScaledBitmap(
            cropped,
            DEFAULT_CHARACTER_FRAME_SIZE_PX,
            DEFAULT_CHARACTER_FRAME_SIZE_PX,
            false,
        )
        return applyEggCrackOverlayIfNeeded(snapshot, scaled)
    }

    fun renderLoopFrames(
        context: Context,
        snapshot: HomeWidgetSnapshot,
        frameSlots: Int = WIDGET_LOOP_FRAME_COUNT,
        targetVisibleWidthPx: Int? = null,
    ): List<Bitmap?> {
        val animationFrameCount = resolveFrameCount(snapshot).coerceAtLeast(1)
        val normalizedFrameSlots = frameSlots.coerceAtLeast(1)
        if (targetVisibleWidthPx == null || targetVisibleWidthPx <= 0) {
            return List(normalizedFrameSlots) { slotIndex ->
                val sourceFrameIndex = when (animationFrameCount) {
                    1 -> 0
                    2 -> slotIndex % 2
                    else -> slotIndex % animationFrameCount
                }
                renderFrame(context, snapshot, sourceFrameIndex)
            }
        }

        val asset = resolveCharacterAsset(snapshot) ?: return List(normalizedFrameSlots) { null }
        val frames = frameCache.getOrPut(asset.jsonPath) {
            loadFrameMap(context, asset.jsonPath)
        }
        val sheet = sheetCache.getOrPut(asset.pngPath) {
            loadBitmap(context, asset.pngPath)
        }
        val frameNames = List(normalizedFrameSlots) { slotIndex ->
            val sourceFrameIndex = when (animationFrameCount) {
                1 -> 0
                2 -> slotIndex % 2
                else -> slotIndex % animationFrameCount
            }
            resolveCharacterFrameName(snapshot, frames, sourceFrameIndex)
        }

        val referenceFrameName = resolveReferenceFrameName(snapshot, frames)
        val referenceFrame = renderCharacterFrameSource(
            sheet = sheet,
            frameRect = frames[referenceFrameName] ?: return List(normalizedFrameSlots) { null },
        )
        val referenceVisibleBounds = resolveVisibleBounds(referenceFrame)
        val scaleMultiplier = resolveScaleMultiplier(
            referenceVisibleWidthPx = referenceVisibleBounds?.width ?: referenceFrame.width,
            targetVisibleWidthPx = targetVisibleWidthPx,
        )

        val scaledFrames = frameNames.map { frameName ->
            val frameRect = frames[frameName] ?: return@map null
            val frameBitmap = renderCharacterFrameSource(sheet = sheet, frameRect = frameRect)
            val visibleBounds = resolveVisibleBounds(frameBitmap)
            val trimmedBitmap = trimToVisibleBounds(frameBitmap, visibleBounds)
            val scaledBitmap = scaleBitmap(trimmedBitmap, scaleMultiplier)
            applyEggCrackOverlayIfNeeded(snapshot, scaledBitmap)
        }

        val canvasWidth = scaledFrames.filterNotNull().maxOfOrNull { it.width } ?: 1
        val canvasHeight = scaledFrames.filterNotNull().maxOfOrNull { it.height } ?: 1
        return scaledFrames.map { frame ->
            frame?.let {
                composeOnCanvas(
                    bitmap = it,
                    canvasWidth = canvasWidth,
                    canvasHeight = canvasHeight,
                )
            }
        }
    }

    fun renderBackground(
        context: Context,
        snapshot: HomeWidgetSnapshot,
        targetWidthPx: Int,
        targetHeightPx: Int,
    ): Bitmap? {
        val frames = frameCache.getOrPut(widgetBackgroundAsset.jsonPath) {
            loadFrameMap(context, widgetBackgroundAsset.jsonPath)
        }
        val frameRect = frames[snapshot.resolveBackgroundVariant().frameName] ?: return null
        val bitmap = sheetCache.getOrPut(widgetBackgroundAsset.pngPath) {
            loadBitmap(context, widgetBackgroundAsset.pngPath)
        }
        val cropped = Bitmap.createBitmap(
            bitmap,
            frameRect.x,
            frameRect.y,
            frameRect.width,
            frameRect.height,
        )
        return cropAndScaleToFill(
            source = cropped,
            targetWidthPx = targetWidthPx,
            targetHeightPx = targetHeightPx,
        )
    }

    fun resolveFrameCount(snapshot: HomeWidgetSnapshot?): Int {
        if (snapshot == null) {
            return 1
        }

        return when {
            snapshot.characterState == "egg" -> 1
            snapshot.characterState == "dead" -> 1
            snapshot.displayState == "sleep" -> 2
            snapshot.displayState == "sick" -> 1
            snapshot.characterState == "eating" -> 2
            else -> 2
        }
    }

    fun renderStatusIcon(context: Context, iconName: String): Bitmap? {
        val asset = SpriteAsset(
            pngPath = "assets/web/assets/game/sprites/common16x16.png",
            jsonPath = "assets/web/assets/game/sprites/common16x16.json",
        )
        val frames = frameCache.getOrPut(asset.jsonPath) {
            loadFrameMap(context, asset.jsonPath)
        }
        val frameRect = frames[iconName] ?: return null
        val bitmap = sheetCache.getOrPut(asset.pngPath) {
            loadBitmap(context, asset.pngPath)
        }
        val cropped = Bitmap.createBitmap(
            bitmap,
            frameRect.x,
            frameRect.y,
            frameRect.width,
            frameRect.height,
        )
        val targetSizePx = if (iconName == "urgent") 26 else 24
        return Bitmap.createScaledBitmap(cropped, targetSizePx, targetSizePx, false)
    }

    private fun resolveCharacterAsset(snapshot: HomeWidgetSnapshot): SpriteAsset? {
        if (snapshot.characterState == "egg") {
            return SpriteAsset(
                pngPath = "assets/web/assets/game/sprites/eggs.png",
                jsonPath = "assets/web/assets/game/sprites/eggs.json",
            )
        }

        if (snapshot.characterState == "dead") {
            return SpriteAsset(
                pngPath = "assets/web/assets/game/sprites/common32x32.png",
                jsonPath = "assets/web/assets/game/sprites/common32x32.json",
            )
        }

        val spritesheetName = when (snapshot.characterKey) {
            1 -> "green-slime_A1"
            2 -> "green-slime_B1"
            3 -> "green-slime_C1"
            4 -> "green-slime_D1"
            5 -> "green-slime_B2"
            6 -> "green-slime_B3"
            7 -> "green-slime_C2"
            8 -> "green-slime_C3"
            9 -> "green-slime_C4"
            10 -> "green-slime_D2"
            11 -> "green-slime_D3"
            12 -> "green-slime_D4"
            14 -> "skull-slime_A1"
            16 -> "skull-slime_B1"
            17 -> "skull-slime_B2"
            18 -> "skull-slime_C1"
            19 -> "skull-slime_C2"
            20 -> "skull-slime_D1"
            21 -> "skull-slime_D2"
            22 -> "soil-slime_A1"
            24 -> "soil-slime_B1"
            25 -> "soil-slime_B2"
            26 -> "soil-slime_C1"
            27 -> "soil-slime_C2"
            28 -> "soil-slime_C3"
            29 -> "soil-slime_D1"
            30 -> "soil-slime_D2"
            31 -> "soil-slime_D3"
            else -> null
        } ?: return null

        return SpriteAsset(
            pngPath = "assets/web/assets/game/sprites/monsters/${spritesheetName}.png",
            jsonPath = "assets/web/assets/game/sprites/monsters/${spritesheetName}.json",
        )
    }

    private fun resolveCharacterFrameName(
        snapshot: HomeWidgetSnapshot,
        frames: Map<String, FrameRect>,
        frameIndex: Int,
    ): String {
        if (snapshot.characterState == "egg") {
            val eggFrameIndex = (snapshot.eggTextureKey ?: EGG_TEXTURE_KEY_START) - EGG_TEXTURE_KEY_START
            val eggFrameName = "egg-${eggFrameIndex.coerceAtLeast(0)}"
            return if (frames.containsKey(eggFrameName)) eggFrameName else "egg-0"
        }

        if (snapshot.characterState == "dead") {
            return "tomb"
        }

        val idleFrame = "idle_${frameIndex % 2}"
        val sleepFrame = "sleeping_${frameIndex % 2}"
        val eatingFrame = "eating_${frameIndex % 2}"
        return when (snapshot.displayState) {
            "sleep" -> if (frames.containsKey(sleepFrame)) sleepFrame else idleFrame
            "sick" -> if (frames.containsKey("sick_0")) "sick_0" else idleFrame
            else -> when (snapshot.characterState) {
                "eating" ->
                    if (frames.containsKey(eatingFrame)) {
                        eatingFrame
                    } else {
                        idleFrame
                    }

                else -> if (frames.containsKey(idleFrame)) idleFrame else "idle_0"
            }
        }
    }

    private fun resolveReferenceFrameName(
        snapshot: HomeWidgetSnapshot,
        frames: Map<String, FrameRect>,
    ): String {
        return when {
            snapshot.characterState == "egg" -> resolveCharacterFrameName(snapshot, frames, 0)
            snapshot.characterState == "dead" -> "tomb"
            frames.containsKey("idle_0") -> "idle_0"
            else -> resolveCharacterFrameName(snapshot, frames, 0)
        }
    }

    private fun applyEggCrackOverlayIfNeeded(
        snapshot: HomeWidgetSnapshot,
        bitmap: Bitmap,
    ): Bitmap {
        val crackStage = snapshot.eggCrackStage.coerceIn(0, 3)
        if (snapshot.characterState != "egg" || crackStage == 0) {
            return bitmap
        }

        val mutableBitmap = bitmap.copy(Bitmap.Config.ARGB_8888, true)
        val canvas = Canvas(mutableBitmap)
        val paint = Paint().apply {
            color = android.graphics.Color.BLACK
            style = Paint.Style.FILL
            isAntiAlias = false
        }
        drawEggCracks(
            canvas = canvas,
            paint = paint,
            width = mutableBitmap.width.toFloat(),
            height = mutableBitmap.height.toFloat(),
            stage = crackStage,
            crackPixelSize = resolveEggCrackPixelSize(
                width = mutableBitmap.width,
                height = mutableBitmap.height,
            ),
        )
        return mutableBitmap
    }

    private fun renderCharacterFrameSource(
        sheet: Bitmap,
        frameRect: FrameRect,
    ): Bitmap {
        return Bitmap.createBitmap(
            sheet,
            frameRect.x,
            frameRect.y,
            frameRect.width,
            frameRect.height,
        )
    }

    private fun trimToVisibleBounds(
        bitmap: Bitmap,
        visibleBounds: VisibleBounds?,
    ): Bitmap {
        if (visibleBounds == null) {
            return bitmap
        }

        if (
            visibleBounds.left == 0 &&
            visibleBounds.top == 0 &&
            visibleBounds.width == bitmap.width &&
            visibleBounds.height == bitmap.height
        ) {
            return bitmap
        }

        return Bitmap.createBitmap(
            bitmap,
            visibleBounds.left,
            visibleBounds.top,
            visibleBounds.width,
            visibleBounds.height,
        )
    }

    private fun scaleBitmap(
        bitmap: Bitmap,
        scaleMultiplier: Float,
    ): Bitmap {
        val targetWidth = resolveScaledDimension(bitmap.width, scaleMultiplier)
        val targetHeight = resolveScaledDimension(bitmap.height, scaleMultiplier)
        if (bitmap.width == targetWidth && bitmap.height == targetHeight) {
            return bitmap
        }
        return Bitmap.createScaledBitmap(bitmap, targetWidth, targetHeight, false)
    }

    private fun composeOnCanvas(
        bitmap: Bitmap,
        canvasWidth: Int,
        canvasHeight: Int,
    ): Bitmap {
        if (bitmap.width == canvasWidth && bitmap.height == canvasHeight) {
            return bitmap
        }

        val composed = Bitmap.createBitmap(
            canvasWidth.coerceAtLeast(1),
            canvasHeight.coerceAtLeast(1),
            Bitmap.Config.ARGB_8888,
        )
        val canvas = Canvas(composed)
        val left = ((canvasWidth - bitmap.width) / 2f).coerceAtLeast(0f)
        val top = (canvasHeight - bitmap.height).toFloat().coerceAtLeast(0f)
        canvas.drawBitmap(bitmap, left, top, null)
        return composed
    }

    private fun drawEggCracks(
        canvas: Canvas,
        paint: Paint,
        width: Float,
        height: Float,
        stage: Int,
        crackPixelSize: Int,
    ) {
        val inset = maxOf(6f, minOf(width, height) * 0.2f)
        val left = inset
        val right = width - inset
        val top = inset + 1f
        val bottom = height - inset - 1f
        val centerX = width / 2f
        val centerY = height / 2f
        val innerWidth = right - left
        val innerHeight = bottom - top
        val shortX = innerWidth * 0.07f
        val shortY = innerHeight * 0.1f
        val mediumX = innerWidth * 0.16f
        val mediumY = innerHeight * 0.2f
        val longX = innerWidth * 0.25f
        val longY = innerHeight * 0.32f
        val alpha = minOf(1f, EGG_CRACK_BASE_ALPHA + stage * EGG_CRACK_STAGE_ALPHA_STEP)
        paint.alpha = (alpha * 255).toInt().coerceIn(0, 255)

        val rootTop = point(centerX - shortX * 0.55f, centerY - shortY * 1.05f)
        val rootUpper = point(centerX + shortX * 0.18f, centerY - shortY * 0.28f)
        val rootMiddle = point(centerX - shortX * 0.46f, centerY + shortY * 0.28f)
        val rootLower = point(centerX + shortX * 0.08f, centerY + shortY * 1.02f)
        val upperRightStem = point(centerX + shortX * 0.96f, centerY - shortY * 1.08f)
        val upperRightTip = point(centerX + longX * 0.94f, centerY - mediumY * 1.08f)
        val lowerLeftStem = point(centerX - shortX * 1.18f, centerY + shortY * 1.02f)
        val lowerLeftTip = point(centerX - longX * 0.92f, centerY + mediumY * 0.98f)
        val upperLeftStem = point(centerX - shortX * 1.16f, centerY - shortY * 1.66f)
        val upperLeftTip = point(centerX - longX * 0.86f, centerY - longY * 0.94f)
        val lowerRightStem = point(centerX + shortX * 1.02f, centerY + shortY * 1.1f)
        val lowerRightTip = point(centerX + longX * 0.84f, centerY + longY * 0.84f)
        val upperRightSplit = point(centerX + mediumX * 0.78f, centerY - shortY * 0.44f)
        val upperRightSplitTip = point(centerX + longX * 0.8f, centerY + shortY * 0.08f)
        val lowerLeftSplit = point(centerX - mediumX * 0.74f, centerY + shortY * 0.32f)
        val lowerLeftSplitTip = point(centerX - longX * 0.74f, centerY - shortY * 0.14f)
        val topStem = point(centerX - shortX * 0.04f, centerY - mediumY * 0.96f)
        val topTip = point(centerX + shortX * 0.1f, top + innerHeight * 0.08f)
        val lowerLeftDownStem = point(centerX - mediumX * 0.58f, centerY + mediumY * 0.96f)
        val lowerLeftDownTip = point(left + innerWidth * 0.18f, bottom - innerHeight * 0.06f)

        drawCrackPath(
            canvas,
            paint,
            listOf(rootTop, rootUpper, rootMiddle, rootLower),
            crackPixelSize,
        )

        if (stage >= 2) {
            drawCrackPath(
                canvas,
                paint,
                listOf(rootUpper, upperRightStem, upperRightTip),
                crackPixelSize,
            )
            drawCrackPath(
                canvas,
                paint,
                listOf(rootMiddle, lowerLeftStem, lowerLeftTip),
                crackPixelSize,
            )
        }

        if (stage >= 3) {
            drawCrackPath(
                canvas,
                paint,
                listOf(rootTop, upperLeftStem, upperLeftTip),
                crackPixelSize,
            )
            drawCrackPath(
                canvas,
                paint,
                listOf(rootLower, lowerRightStem, lowerRightTip),
                crackPixelSize,
            )
            drawCrackPath(
                canvas,
                paint,
                listOf(upperRightStem, upperRightSplit, upperRightSplitTip),
                crackPixelSize,
            )
            drawCrackPath(
                canvas,
                paint,
                listOf(lowerLeftStem, lowerLeftSplit, lowerLeftSplitTip),
                crackPixelSize,
            )
            drawCrackPath(
                canvas,
                paint,
                listOf(rootUpper, topStem, topTip),
                crackPixelSize,
            )
            drawCrackPath(
                canvas,
                paint,
                listOf(lowerLeftStem, lowerLeftDownStem, lowerLeftDownTip),
                crackPixelSize,
            )
        }
    }

    private fun drawCrackPath(
        canvas: Canvas,
        paint: Paint,
        points: List<Pair<Float, Float>>,
        crackPixelSize: Int,
    ) {
        if (points.size < 2) return
        for (index in 1 until points.size) {
            val start = points[index - 1]
            val end = points[index]
            drawPixelSegment(
                canvas,
                paint,
                start.first,
                start.second,
                end.first,
                end.second,
                crackPixelSize,
            )
        }
    }

    private fun drawPixelSegment(
        canvas: Canvas,
        paint: Paint,
        startX: Float,
        startY: Float,
        endX: Float,
        endY: Float,
        crackPixelSize: Int,
    ) {
        var x0 = startX.toInt()
        var y0 = startY.toInt()
        val x1 = endX.toInt()
        val y1 = endY.toInt()
        val deltaX = kotlin.math.abs(x1 - x0)
        val deltaY = kotlin.math.abs(y1 - y0)
        val stepX = if (x0 < x1) 1 else -1
        val stepY = if (y0 < y1) 1 else -1
        var error = deltaX - deltaY

        while (true) {
            canvas.drawRect(
                x0.toFloat(),
                y0.toFloat(),
                x0 + crackPixelSize.toFloat(),
                y0 + crackPixelSize.toFloat(),
                paint,
            )
            if (x0 == x1 && y0 == y1) break
            val doubledError = error * 2
            if (doubledError > -deltaY) {
                error -= deltaY
                x0 += stepX
            }
            if (doubledError < deltaX) {
                error += deltaX
                y0 += stepY
            }
        }
    }

    internal fun resolveEggCrackPixelSize(
        width: Int,
        height: Int,
    ): Int {
        val scale = minOf(width, height).coerceAtLeast(1) / BASE_EGG_FRAME_SIZE_PX
        return scale.roundToInt().coerceAtLeast(1)
    }

    private fun point(x: Float, y: Float): Pair<Float, Float> = x to y

    private fun loadFrameMap(
        context: Context,
        relativePath: String,
    ): Map<String, FrameRect> {
        val json = context.assets.open(toFlutterAssetPath(relativePath)).bufferedReader().use {
            it.readText()
        }
        val frames = JSONObject(json).optJSONObject("frames") ?: JSONObject()
        return buildMap {
            val keys = frames.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                val frame = frames.optJSONObject(key)?.optJSONObject("frame") ?: continue
                put(
                    key,
                    FrameRect(
                        x = frame.optInt("x"),
                        y = frame.optInt("y"),
                        width = frame.optInt("w"),
                        height = frame.optInt("h"),
                    ),
                )
            }
        }
    }

    private fun loadBitmap(context: Context, relativePath: String): Bitmap {
        context.assets.open(toFlutterAssetPath(relativePath)).use { stream ->
            return BitmapFactory.decodeStream(stream)
                ?: error("Failed to decode widget sprite asset: $relativePath")
        }
    }

    private fun cropAndScaleToFill(
        source: Bitmap,
        targetWidthPx: Int,
        targetHeightPx: Int,
    ): Bitmap {
        val safeTargetWidth = targetWidthPx.coerceAtLeast(1)
        val safeTargetHeight = targetHeightPx.coerceAtLeast(1)
        val sourceAspectRatio = source.width.toFloat() / source.height.toFloat()
        val targetAspectRatio = safeTargetWidth.toFloat() / safeTargetHeight.toFloat()

        val cropWidth: Int
        val cropHeight: Int
        val cropX: Int
        val cropY: Int

        if (sourceAspectRatio > targetAspectRatio) {
            cropHeight = source.height
            cropWidth = (cropHeight * targetAspectRatio).toInt().coerceIn(1, source.width)
            cropX = ((source.width - cropWidth) / 2).coerceAtLeast(0)
            cropY = 0
        } else {
            cropWidth = source.width
            cropHeight = (cropWidth / targetAspectRatio).toInt().coerceIn(1, source.height)
            cropX = 0
            cropY = ((source.height - cropHeight) / 2).coerceAtLeast(0)
        }

        val cropped = if (
            cropWidth == source.width &&
            cropHeight == source.height &&
            cropX == 0 &&
            cropY == 0
        ) {
            source
        } else {
            Bitmap.createBitmap(source, cropX, cropY, cropWidth, cropHeight)
        }

        return if (cropped.width == safeTargetWidth && cropped.height == safeTargetHeight) {
            cropped
        } else {
            Bitmap.createScaledBitmap(cropped, safeTargetWidth, safeTargetHeight, true)
        }
    }

    private fun toFlutterAssetPath(relativePath: String): String {
        return "flutter_assets/$relativePath"
    }

    internal fun resolveVisibleBounds(
        width: Int,
        height: Int,
        pixels: IntArray,
    ): VisibleBounds? {
        if (width <= 0 || height <= 0 || pixels.size < width * height) {
            return null
        }

        var minX = width
        var minY = height
        var maxX = -1
        var maxY = -1

        for (y in 0 until height) {
            for (x in 0 until width) {
                val pixel = pixels[(y * width) + x]
                val alpha = pixel ushr 24
                if (alpha == 0) {
                    continue
                }

                if (x < minX) minX = x
                if (y < minY) minY = y
                if (x > maxX) maxX = x
                if (y > maxY) maxY = y
            }
        }

        if (maxX < minX || maxY < minY) {
            return null
        }

        return VisibleBounds(
            left = minX,
            top = minY,
            right = maxX,
            bottom = maxY,
        )
    }

    internal fun resolveScaleMultiplier(
        referenceVisibleWidthPx: Int,
        targetVisibleWidthPx: Int,
    ): Float {
        val requiredScale = targetVisibleWidthPx.coerceAtLeast(1).toFloat() /
            referenceVisibleWidthPx.coerceAtLeast(1).toFloat()
        return maxOf(1f, requiredScale)
    }

    internal fun resolveScaledDimension(
        sizePx: Int,
        scaleMultiplier: Float,
    ): Int {
        return ceil(sizePx.coerceAtLeast(1) * scaleMultiplier.toDouble()).toInt().coerceAtLeast(1)
    }

    private fun resolveVisibleBounds(bitmap: Bitmap): VisibleBounds? {
        val pixels = IntArray(bitmap.width * bitmap.height)
        bitmap.getPixels(
            pixels,
            0,
            bitmap.width,
            0,
            0,
            bitmap.width,
            bitmap.height,
        )
        return resolveVisibleBounds(bitmap.width, bitmap.height, pixels)
    }

    private data class SpriteAsset(
        val pngPath: String,
        val jsonPath: String,
    )

    private data class FrameRect(
        val x: Int,
        val y: Int,
        val width: Int,
        val height: Int,
    )

    internal data class VisibleBounds(
        val left: Int,
        val top: Int,
        val right: Int,
        val bottom: Int,
    ) {
        val width: Int
            get() = (right - left + 1).coerceAtLeast(1)
        val height: Int
            get() = (bottom - top + 1).coerceAtLeast(1)
    }
}
