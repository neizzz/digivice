package com.ch00n9h09.montto

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import org.json.JSONObject

object HomeWidgetSpriteRenderer {
    private const val WIDGET_LOOP_FRAME_COUNT = 4

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
        return Bitmap.createScaledBitmap(cropped, 96, 96, false)
    }

    fun renderLoopFrames(
        context: Context,
        snapshot: HomeWidgetSnapshot,
        frameSlots: Int = WIDGET_LOOP_FRAME_COUNT,
    ): List<Bitmap?> {
        val animationFrameCount = resolveFrameCount(snapshot).coerceAtLeast(1)
        return List(frameSlots.coerceAtLeast(1)) { slotIndex ->
            val sourceFrameIndex = when (animationFrameCount) {
                1 -> 0
                2 -> slotIndex % 2
                else -> slotIndex % animationFrameCount
            }
            renderFrame(context, snapshot, sourceFrameIndex)
        }
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
        return Bitmap.createScaledBitmap(cropped, 24, 24, false)
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
            return "egg-0"
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

    private fun toFlutterAssetPath(relativePath: String): String {
        return "flutter_assets/$relativePath"
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
}
