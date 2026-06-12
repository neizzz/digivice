package com.ch00n9h09.montto

import android.content.SharedPreferences
import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeWidgetSnapshotPublisherTest {
    @Test
    fun `publish saves snapshot and notifies update`() {
        val prefs = FakeSharedPreferences()
        val notifiedReasons = mutableListOf<String>()
        val snapshotJson = buildSnapshotJson(
            characterState = "egg",
            characterKey = 1,
            eggHatchTimeMs = 12345L,
        )

        val result = HomeWidgetSnapshotPublisher.publish(
            prefs = prefs,
            snapshotKey = "home_widget_snapshot_v1",
            snapshotJson = snapshotJson,
            reason = "native_hidden",
            notifySnapshotUpdated = { reason ->
                notifiedReasons += reason
            },
        )

        assertEquals("ok", result["status"])
        assertEquals("home_widget_snapshot_v1", result["snapshotKey"])
        assertEquals("native_hidden", result["reason"])
        assertEquals(true, result["hasSnapshot"])
        assertEquals("egg", result["characterState"])
        assertEquals(1, result["characterKey"])
        assertEquals(12345L, result["eggHatchTimeMs"])
        assertEquals("authoritativeAppState", result["snapshotKind"])
        assertTrue(
            prefs.getString("home_widget_snapshot_v1", null)?.contains(
                "\"characterState\":\"egg\"",
            ) == true,
        )
        val history = JSONArray(
            prefs.getString(HomeWidgetConstants.SNAPSHOT_PUBLISH_HISTORY_KEY, null),
        )
        val latestHistory = history.getJSONObject(0)
        assertEquals(1, history.length())
        assertEquals("native_hidden", latestHistory.getString("reason"))
        assertEquals("home_widget_snapshot_v1", latestHistory.getString("snapshotKey"))
        assertEquals("current", latestHistory.getString("snapshotSlot"))
        assertEquals("egg", latestHistory.getString("characterState"))
        assertEquals("authoritativeAppState", latestHistory.getString("snapshotKind"))
        assertEquals(true, latestHistory.getBoolean("success"))
        assertEquals(listOf("native_hidden"), notifiedReasons)
    }

    @Test
    fun `publish history keeps only latest twenty entries with sick snapshot details`() {
        val prefs = FakeSharedPreferences()

        repeat(21) { index ->
            HomeWidgetSnapshotPublisher.publish(
                prefs = prefs,
                snapshotKey = HomeWidgetConstants.AUTHORITATIVE_SNAPSHOT_KEY,
                snapshotJson = buildSnapshotJson(
                    characterState = "sick",
                    characterKey = index,
                    eggHatchTimeMs = null,
                    displayState = "sick",
                    hasUrgentStatus = true,
                    visibleStatusIcons = listOf("sick"),
                    snapshotComputedAtMs = index.toLong(),
                ),
                reason = "history_$index",
                notifySnapshotUpdated = {},
                nowMsProvider = { index.toLong() },
            )
        }

        val history = JSONArray(
            prefs.getString(HomeWidgetConstants.SNAPSHOT_PUBLISH_HISTORY_KEY, null),
        )
        val first = history.getJSONObject(0)
        val last = history.getJSONObject(history.length() - 1)

        assertEquals(20, history.length())
        assertEquals("history_1", first.getString("reason"))
        assertEquals("history_20", last.getString("reason"))
        assertEquals("authoritative", last.getString("snapshotSlot"))
        assertEquals("sick", last.getString("characterState"))
        assertEquals("sick", last.getString("displayState"))
        assertEquals("sick", last.getJSONArray("visibleStatusIcons").getString(0))
        assertEquals(true, last.getBoolean("hasUrgentStatus"))
        assertEquals(20, last.getInt("characterKey"))
        assertEquals(20L, last.getLong("snapshotComputedAtMs"))
        assertEquals(20L, last.getLong("authoritativeTimestampMs"))
    }

    @Test
    fun `authoritative publish completes pending refresh metadata`() {
        val prefs = FakeSharedPreferences().apply {
            edit()
                .putLong(HomeWidgetConstants.REFRESH_REQUESTED_AT_MS_KEY, 100L)
                .putBoolean(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY, true)
                .apply()
        }

        HomeWidgetSnapshotPublisher.publish(
            prefs = prefs,
            snapshotKey = HomeWidgetConstants.AUTHORITATIVE_SNAPSHOT_KEY,
            snapshotJson = buildSnapshotJson(
                characterState = "idle",
                characterKey = 22,
                eggHatchTimeMs = null,
            ),
            reason = "widget_periodic_refresh_world_data_update_authoritative",
            notifySnapshotUpdated = {},
            nowMsProvider = { 2_000L },
        )

        assertFalse(
            prefs.getBoolean(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY, true),
        )
        assertEquals(
            2_000L,
            prefs.getLong(HomeWidgetConstants.REFRESH_COMPLETED_AT_MS_KEY, 0L),
        )
        val smokeResult = prefs.getString(
            HomeWidgetConstants.REFRESH_SMOKE_RESULT_KEY,
            null,
        )
        assertTrue(
            smokeResult?.contains(
                "reason=widget_periodic_refresh_world_data_update_authoritative",
            ) == true,
        )
        assertTrue(smokeResult?.contains("state=idle") == true)
        assertTrue(smokeResult?.contains("key=22") == true)
        assertTrue(smokeResult?.contains("kind=authoritativeAppState") == true)
    }

    @Test
    fun `current snapshot publish does not complete pending refresh metadata`() {
        val prefs = FakeSharedPreferences().apply {
            edit()
                .putLong(HomeWidgetConstants.REFRESH_REQUESTED_AT_MS_KEY, 100L)
                .putBoolean(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY, true)
                .apply()
        }

        HomeWidgetSnapshotPublisher.publish(
            prefs = prefs,
            snapshotKey = HomeWidgetConstants.SNAPSHOT_KEY,
            snapshotJson = buildSnapshotJson(
                characterState = "idle",
                characterKey = 22,
                eggHatchTimeMs = null,
            ),
            reason = "widget_periodic_refresh_world_data_update",
            notifySnapshotUpdated = {},
            nowMsProvider = { 2_000L },
        )

        assertTrue(
            prefs.getBoolean(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY, false),
        )
        assertFalse(prefs.contains(HomeWidgetConstants.REFRESH_COMPLETED_AT_MS_KEY))
        assertFalse(prefs.contains(HomeWidgetConstants.REFRESH_SMOKE_RESULT_KEY))
    }

    @Test
    fun `publish removes snapshot when json is null and notifies update`() {
        val prefs = FakeSharedPreferences().apply {
            edit()
                .putString("home_widget_snapshot_v1", """{"foo":"bar"}""")
                .putLong(HomeWidgetConstants.REFRESH_REQUESTED_AT_MS_KEY, 100L)
                .putLong(HomeWidgetConstants.REFRESH_COMPLETED_AT_MS_KEY, 200L)
                .putBoolean(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY, true)
                .putString(HomeWidgetConstants.REFRESH_SMOKE_RESULT_KEY, "stale")
                .putString(HomeWidgetConstants.PERIODIC_REFRESH_STATUS_KEY, "stale_status")
                .putLong(HomeWidgetConstants.PERIODIC_REFRESH_STATUS_AT_MS_KEY, 300L)
                .apply()
        }
        val notifiedReasons = mutableListOf<String>()

        val result = HomeWidgetSnapshotPublisher.publish(
            prefs = prefs,
            snapshotKey = "home_widget_snapshot_v1",
            snapshotJson = null,
            reason = "native_paused",
            notifySnapshotUpdated = { reason ->
                notifiedReasons += reason
            },
        )

        assertEquals("ok", result["status"])
        assertEquals(false, result["hasSnapshot"])
        assertEquals("native_paused", result["reason"])
        assertNull(result["characterState"])
        assertFalse(prefs.contains("home_widget_snapshot_v1"))
        assertFalse(prefs.contains(HomeWidgetConstants.REFRESH_REQUESTED_AT_MS_KEY))
        assertFalse(prefs.contains(HomeWidgetConstants.REFRESH_COMPLETED_AT_MS_KEY))
        assertFalse(prefs.contains(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY))
        assertFalse(prefs.contains(HomeWidgetConstants.REFRESH_SMOKE_RESULT_KEY))
        assertFalse(prefs.contains(HomeWidgetConstants.PERIODIC_REFRESH_STATUS_KEY))
        assertFalse(prefs.contains(HomeWidgetConstants.PERIODIC_REFRESH_STATUS_AT_MS_KEY))
        assertNull(prefs.getString("home_widget_snapshot_v1", null))
        assertEquals(listOf("native_paused"), notifiedReasons)
    }

    @Test
    fun `blank reason falls back to publishSnapshot`() {
        val prefs = FakeSharedPreferences()
        var notifiedReason: String? = null

        HomeWidgetSnapshotPublisher.publish(
            prefs = prefs,
            snapshotKey = "home_widget_snapshot_v1",
            snapshotJson = """{"foo":"bar"}""",
            reason = "",
            notifySnapshotUpdated = { reason ->
                notifiedReason = reason
            },
        )

        assertEquals("publishSnapshot", notifiedReason)
        assertTrue(prefs.contains("home_widget_snapshot_v1"))
    }

    private fun buildSnapshotJson(
        characterState: String,
        characterKey: Int,
        eggHatchTimeMs: Long?,
        displayState: String = "idle",
        hasUrgentStatus: Boolean = false,
        visibleStatusIcons: List<String> = emptyList(),
        snapshotComputedAtMs: Long = 0L,
    ): String = """
        {
          "schemaVersion":2,
          "snapshotKind":"authoritativeAppState",
          "monsterName":null,
          "characterKey":$characterKey,
          "eggTextureKey":null,
          "eggHatchTimeMs":$eggHatchTimeMs,
          "eggHatchDurationMs":null,
          "eggCrackStage":0,
          "characterState":"$characterState",
          "displayState":"$displayState",
          "primaryStatus":"$displayState",
          "timeOfDay":"day",
          "stamina":0,
          "maxStamina":10,
          "staminaPercent":0,
          "staminaLevel":"red",
          "useLocalTime":true,
          "animationFrameIndex":0,
          "updatedAtMs":0,
          "snapshotComputedAtMs":$snapshotComputedAtMs,
          "lastActiveTimeMs":null,
          "baseLastActiveTimeMs":null,
          "projectedElapsedMs":0,
          "projectionVersion":1,
          "staminaTimerMs":0,
          "hasUrgentStatus":$hasUrgentStatus,
          "visibleStatusIcons":${JSONArray(visibleStatusIcons)}
        }
    """.trimIndent()

    private class FakeSharedPreferences : SharedPreferences {
        private val values = linkedMapOf<String, Any?>()

        override fun getAll(): MutableMap<String, *> = values.toMutableMap()

        override fun getString(key: String?, defValue: String?): String? {
            return values[key] as? String ?: defValue
        }

        @Suppress("UNCHECKED_CAST")
        override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? {
            val stored = values[key] as? Set<String>
            return stored?.toMutableSet() ?: defValues
        }

        override fun getInt(key: String?, defValue: Int): Int {
            return values[key] as? Int ?: defValue
        }

        override fun getLong(key: String?, defValue: Long): Long {
            return values[key] as? Long ?: defValue
        }

        override fun getFloat(key: String?, defValue: Float): Float {
            return values[key] as? Float ?: defValue
        }

        override fun getBoolean(key: String?, defValue: Boolean): Boolean {
            return values[key] as? Boolean ?: defValue
        }

        override fun contains(key: String?): Boolean {
            return values.containsKey(key)
        }

        override fun edit(): SharedPreferences.Editor = Editor(values)

        override fun registerOnSharedPreferenceChangeListener(
            listener: SharedPreferences.OnSharedPreferenceChangeListener?,
        ) = Unit

        override fun unregisterOnSharedPreferenceChangeListener(
            listener: SharedPreferences.OnSharedPreferenceChangeListener?,
        ) = Unit

        private class Editor(
            private val values: MutableMap<String, Any?>,
        ) : SharedPreferences.Editor {
            private val pending = linkedMapOf<String, Any?>()
            private val removals = linkedSetOf<String>()
            private var shouldClear = false

            override fun putString(key: String?, value: String?): SharedPreferences.Editor = apply {
                if (key != null) {
                    pending[key] = value
                    removals.remove(key)
                }
            }

            override fun putStringSet(
                key: String?,
                values: MutableSet<String>?,
            ): SharedPreferences.Editor = apply {
                if (key != null) {
                    pending[key] = values?.toSet()
                    removals.remove(key)
                }
            }

            override fun putInt(key: String?, value: Int): SharedPreferences.Editor = apply {
                if (key != null) {
                    pending[key] = value
                    removals.remove(key)
                }
            }

            override fun putLong(key: String?, value: Long): SharedPreferences.Editor = apply {
                if (key != null) {
                    pending[key] = value
                    removals.remove(key)
                }
            }

            override fun putFloat(key: String?, value: Float): SharedPreferences.Editor = apply {
                if (key != null) {
                    pending[key] = value
                    removals.remove(key)
                }
            }

            override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor = apply {
                if (key != null) {
                    pending[key] = value
                    removals.remove(key)
                }
            }

            override fun remove(key: String?): SharedPreferences.Editor = apply {
                if (key != null) {
                    removals += key
                    pending.remove(key)
                }
            }

            override fun clear(): SharedPreferences.Editor = apply {
                shouldClear = true
                pending.clear()
                removals.clear()
            }

            override fun commit(): Boolean {
                apply()
                return true
            }

            override fun apply() {
                if (shouldClear) {
                    values.clear()
                }
                removals.forEach(values::remove)
                pending.forEach { (key, value) ->
                    if (value == null) {
                        values.remove(key)
                    } else {
                        values[key] = value
                    }
                }
            }
        }
    }
}
