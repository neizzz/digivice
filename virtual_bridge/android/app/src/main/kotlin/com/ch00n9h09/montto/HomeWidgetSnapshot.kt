package com.ch00n9h09.montto

import android.content.Context
import androidx.annotation.ColorRes
import androidx.annotation.DrawableRes
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

enum class HomeWidgetBackgroundVariant(
    val frameName: String,
) {
    BROWN("widget-bg_brown"),
    BLUE("widget-bg_blue"),
    GREEN("widget-bg_green"),
    RED("widget-bg_red"),
}

internal const val HOME_WIDGET_NATIVE_SNAPSHOT_SOURCE = "native"
internal const val HOME_WIDGET_FLUTTER_SNAPSHOT_SOURCE = "flutter"

internal data class HomeWidgetAuthoritativeSnapshotSelection(
    val snapshot: HomeWidgetSnapshot?,
    val source: String?,
    val nativeSnapshot: HomeWidgetSnapshot?,
    val flutterSnapshot: HomeWidgetSnapshot?,
)

data class HomeWidgetSnapshot(
    val schemaVersion: Int,
    val snapshotKind: String,
    val monsterName: String?,
    val characterKey: Int?,
    val eggTextureKey: Int?,
    val eggHatchTimeMs: Long?,
    val eggHatchDurationMs: Long?,
    val eggCrackStage: Int,
    val characterState: String,
    val displayState: String,
    val timeOfDay: String,
    val stamina: Double,
    val maxStamina: Double,
    val staminaPercent: Double,
    val staminaLevel: String,
    val useLocalTime: Boolean,
    val animationFrameIndex: Int,
    val updatedAtMs: Long,
    val snapshotComputedAtMs: Long,
    val lastActiveTimeMs: Long?,
    val baseLastActiveTimeMs: Long?,
    val projectedElapsedMs: Long,
    val projectionVersion: Int,
    val staminaTimerMs: Double,
    val hasUrgentStatus: Boolean,
    val visibleStatusIcons: List<String>,
) {
    fun resolveTimeOfDayLabel(): String {
        return when (timeOfDay) {
            "sunrise" -> "Sunrise"
            "sunset" -> "Sunset"
            "night" -> "Night"
            else -> "Day"
        }
    }

    fun resolveStateLabel(): String {
        return when (displayState) {
            "sleep" -> "sleep"
            "sick" -> "sick"
            else -> "idle"
        }
    }

    fun resolveBackgroundVariant(): HomeWidgetBackgroundVariant {
        if (characterState == "egg") {
            return HomeWidgetBackgroundVariant.BROWN
        }

        return when (resolveEvolutionPhase()) {
            2 -> HomeWidgetBackgroundVariant.BLUE
            3 -> HomeWidgetBackgroundVariant.GREEN
            4 -> HomeWidgetBackgroundVariant.RED
            else -> HomeWidgetBackgroundVariant.BROWN
        }
    }

    fun resolveEvolutionPhase(): Int {
        return resolveEvolutionPhase(characterKey)
    }

    fun shouldUseClassBOrHigherWidgetScale(): Boolean {
        if (characterState == "egg" || characterState == "dead") {
            return false
        }

        return characterKey != null && resolveEvolutionPhase() >= 2
    }

    @DrawableRes
    fun resolveBackgroundDrawableRes(): Int {
        return R.drawable.bg_home_widget_day
    }

    @ColorRes
    fun resolveAccentColorRes(): Int {
        return when (displayState) {
            "sleep" -> R.color.home_widget_accent_sleep
            "sick" -> R.color.home_widget_accent_sick
            else -> R.color.home_widget_accent_idle
        }
    }

    @DrawableRes
    fun resolveStaminaDotDrawableRes(): Int {
        return when (staminaLevel) {
            "green" -> R.drawable.ic_home_widget_stamina_green
            "orange" -> R.drawable.ic_home_widget_stamina_orange
            else -> R.drawable.ic_home_widget_stamina_red
        }
    }

    fun shouldShowStaminaDot(): Boolean {
        return characterState != "egg" && characterState != "dead"
    }

    internal fun authoritativeTimestampMs(): Long? {
        return listOf(snapshotComputedAtMs, updatedAtMs)
            .filter { it > 0L }
            .maxOrNull()
    }

    fun resolveUpdatedAtLabel(): String {
        val formatter = SimpleDateFormat("HH:mm", Locale.getDefault())
        return formatter.format(Date(updatedAtMs))
    }

    fun toJsonString(): String {
        return JSONObject()
            .put("schemaVersion", schemaVersion)
            .put("snapshotKind", snapshotKind)
            .put("monsterName", monsterName)
            .put("characterKey", characterKey)
            .put("eggTextureKey", eggTextureKey)
            .put("eggHatchTimeMs", eggHatchTimeMs)
            .put("eggHatchDurationMs", eggHatchDurationMs)
            .put("eggCrackStage", eggCrackStage)
            .put("characterState", characterState)
            .put("displayState", displayState)
            .put("primaryStatus", displayState)
            .put("timeOfDay", timeOfDay)
            .put("stamina", stamina)
            .put("maxStamina", maxStamina)
            .put("staminaPercent", staminaPercent)
            .put("staminaLevel", staminaLevel)
            .put("useLocalTime", useLocalTime)
            .put("animationFrameIndex", animationFrameIndex)
            .put("updatedAtMs", updatedAtMs)
            .put("snapshotComputedAtMs", snapshotComputedAtMs)
            .put("lastActiveTimeMs", lastActiveTimeMs)
            .put("baseLastActiveTimeMs", baseLastActiveTimeMs)
            .put("projectedElapsedMs", projectedElapsedMs)
            .put("projectionVersion", projectionVersion)
            .put("staminaTimerMs", staminaTimerMs)
            .put("hasUrgentStatus", hasUrgentStatus)
            .put("visibleStatusIcons", JSONArray(visibleStatusIcons))
            .toString()
    }

    companion object {
        private fun resolveEvolutionPhase(characterKey: Int?): Int {
            return when (characterKey) {
                1, 14, 22 -> 1
                2, 5, 6, 16, 17, 24, 25 -> 2
                3, 7, 8, 9, 18, 19, 26, 27, 28 -> 3
                4, 10, 11, 12, 20, 21, 29, 30, 31 -> 4
                else -> 1
            }
        }

        fun load(context: Context): HomeWidgetSnapshot? {
            loadNativeCurrent(context)?.let { return it }
            return loadFlutterCurrent(context)
        }

        internal fun loadNativeCurrent(context: Context): HomeWidgetSnapshot? {
            val prefs = context.getSharedPreferences(
                HomeWidgetConstants.STORAGE_NAME,
                Context.MODE_PRIVATE,
            )
            return fromJson(prefs.getString(HomeWidgetConstants.SNAPSHOT_KEY, null))
        }

        internal fun loadFlutterCurrent(context: Context): HomeWidgetSnapshot? {
            val flutterPrefs = context.getSharedPreferences(
                HomeWidgetConstants.FLUTTER_STORAGE_NAME,
                Context.MODE_PRIVATE,
            )
            return fromJson(flutterPrefs.getString(HomeWidgetConstants.FLUTTER_SNAPSHOT_KEY, null))
        }

        fun loadAuthoritative(context: Context): HomeWidgetSnapshot? {
            return loadAuthoritativeSelection(context).snapshot
        }

        internal fun loadAuthoritativeSelection(context: Context): HomeWidgetAuthoritativeSnapshotSelection {
            return selectAuthoritativeSnapshot(
                nativeSnapshot = loadNativeAuthoritative(context),
                flutterSnapshot = loadFlutterAuthoritative(context),
            )
        }

        internal fun loadNativeAuthoritative(context: Context): HomeWidgetSnapshot? {
            val prefs = context.getSharedPreferences(
                HomeWidgetConstants.STORAGE_NAME,
                Context.MODE_PRIVATE,
            )
            return fromJson(
                prefs.getString(HomeWidgetConstants.AUTHORITATIVE_SNAPSHOT_KEY, null),
            )
        }

        internal fun loadFlutterAuthoritative(context: Context): HomeWidgetSnapshot? {
            val flutterPrefs = context.getSharedPreferences(
                HomeWidgetConstants.FLUTTER_STORAGE_NAME,
                Context.MODE_PRIVATE,
            )
            return fromJson(
                flutterPrefs.getString(HomeWidgetConstants.FLUTTER_AUTHORITATIVE_SNAPSHOT_KEY, null),
            )
        }

        internal fun selectAuthoritativeSnapshot(
            nativeSnapshot: HomeWidgetSnapshot?,
            flutterSnapshot: HomeWidgetSnapshot?,
        ): HomeWidgetAuthoritativeSnapshotSelection {
            val selectedSource = when {
                nativeSnapshot == null && flutterSnapshot != null -> HOME_WIDGET_FLUTTER_SNAPSHOT_SOURCE
                nativeSnapshot != null && flutterSnapshot == null -> HOME_WIDGET_NATIVE_SNAPSHOT_SOURCE
                nativeSnapshot != null && flutterSnapshot != null -> {
                    val nativeTimestamp = nativeSnapshot.authoritativeTimestampMs()
                    val flutterTimestamp = flutterSnapshot.authoritativeTimestampMs()
                    if (
                        nativeTimestamp != null &&
                        flutterTimestamp != null &&
                        flutterTimestamp > nativeTimestamp
                    ) {
                        HOME_WIDGET_FLUTTER_SNAPSHOT_SOURCE
                    } else {
                        HOME_WIDGET_NATIVE_SNAPSHOT_SOURCE
                    }
                }

                else -> null
            }
            val selectedSnapshot = when (selectedSource) {
                HOME_WIDGET_FLUTTER_SNAPSHOT_SOURCE -> flutterSnapshot
                HOME_WIDGET_NATIVE_SNAPSHOT_SOURCE -> nativeSnapshot
                else -> null
            }

            return HomeWidgetAuthoritativeSnapshotSelection(
                snapshot = selectedSnapshot,
                source = selectedSource,
                nativeSnapshot = nativeSnapshot,
                flutterSnapshot = flutterSnapshot,
            )
        }

        fun fromJson(raw: String?): HomeWidgetSnapshot? {
            if (raw.isNullOrBlank()) {
                return null
            }

            return runCatching {
                val json = JSONObject(raw)
                val stamina = json.optDouble("stamina", 0.0).coerceIn(0.0, 10.0)
                val maxStamina = json.optDouble("maxStamina", 10.0).coerceIn(1.0, 10.0)
                val characterState = json.optString("characterState", "idle")
                val visibleStatusIconsJson = json.optJSONArray("visibleStatusIcons") ?: JSONArray()
                val visibleStatusIcons = sanitizeVisibleStatusIconsForWidget(
                    characterState = characterState,
                    iconNames = buildList {
                        for (index in 0 until visibleStatusIconsJson.length()) {
                            visibleStatusIconsJson.optString(index)
                                .takeIf { it.isNotBlank() }
                                ?.let(::add)
                        }
                    },
                )
                val rawDisplayState = json.optString(
                    "displayState",
                    json.optString("primaryStatus", "idle"),
                )
                val normalizedDisplayState = when {
                    rawDisplayState == "sick" ||
                        characterState == "sick" ||
                        visibleStatusIcons.contains("sick") -> "sick"
                    rawDisplayState == "sleeping" ||
                        rawDisplayState == "sleep" ||
                        characterState == "sleeping" ||
                        visibleStatusIcons.contains("sleeping") -> "sleep"
                    else -> "idle"
                }

                HomeWidgetSnapshot(
                    schemaVersion = json.optInt("schemaVersion", 2),
                    snapshotKind = json.optString("snapshotKind", "authoritativeAppState"),
                    monsterName = json.optString("monsterName").ifBlank { null },
                    characterKey = json.optInt("characterKey").takeIf { json.has("characterKey") },
                    eggTextureKey = json.optInt("eggTextureKey").takeIf { json.has("eggTextureKey") },
                    eggHatchTimeMs = json.optLong("eggHatchTimeMs").takeIf { json.has("eggHatchTimeMs") },
                    eggHatchDurationMs = json.optLong("eggHatchDurationMs").takeIf {
                        json.has("eggHatchDurationMs")
                    },
                    eggCrackStage = json.optInt("eggCrackStage", 0).coerceIn(0, 3),
                    characterState = characterState,
                    displayState = normalizedDisplayState,
                    timeOfDay = json.optString("timeOfDay", "day"),
                    stamina = stamina,
                    maxStamina = maxStamina,
                    staminaPercent = json.optDouble("staminaPercent", stamina / maxStamina)
                        .coerceIn(0.0, 1.0),
                    staminaLevel = json.optString(
                        "staminaLevel",
                        when {
                            stamina < 3.0 -> "red"
                            stamina >= 7.0 -> "green"
                            else -> "orange"
                        },
                    ),
                    useLocalTime = if (json.has("useLocalTime")) {
                        json.optBoolean("useLocalTime", true)
                    } else {
                        true
                    },
                    animationFrameIndex = json.optInt("animationFrameIndex", 0).mod(4),
                    updatedAtMs = json.optLong(
                        "updatedAtMs",
                        json.optLong("snapshotComputedAtMs", 0L),
                    ),
                    snapshotComputedAtMs = json.optLong(
                        "snapshotComputedAtMs",
                        json.optLong("updatedAtMs", 0L),
                    ),
                    lastActiveTimeMs = json.optLong("lastActiveTimeMs").takeIf {
                        json.has("lastActiveTimeMs")
                    },
                    baseLastActiveTimeMs = json.optLong("baseLastActiveTimeMs").takeIf {
                        json.has("baseLastActiveTimeMs")
                    } ?: json.optLong("lastActiveTimeMs").takeIf {
                        json.has("lastActiveTimeMs")
                    },
                    projectedElapsedMs = json.optLong("projectedElapsedMs", 0L).coerceAtLeast(0L),
                    projectionVersion = json.optInt("projectionVersion", 1),
                    staminaTimerMs = json.optDouble("staminaTimerMs", 0.0)
                        .coerceIn(0.0, 12 * 60 * 1000.0),
                    hasUrgentStatus = json.optBoolean("hasUrgentStatus", false),
                    visibleStatusIcons = visibleStatusIcons,
                )
            }.getOrNull()
        }

        internal fun sanitizeVisibleStatusIconsForWidget(
            characterState: String,
            iconNames: List<String>,
        ): List<String> {
            if (characterState == "dead") {
                return emptyList()
            }

            return buildList {
                iconNames.forEach { iconName ->
                    when (iconName) {
                        "sick",
                        "sleeping",
                        -> if (!contains(iconName)) {
                            add(iconName)
                        }
                    }
                }
            }
        }
    }
}
