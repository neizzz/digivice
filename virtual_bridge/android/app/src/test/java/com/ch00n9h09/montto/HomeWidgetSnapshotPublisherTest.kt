package com.ch00n9h09.montto

import android.content.SharedPreferences
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
        val snapshotJson = """
            {
              "schemaVersion":2,
              "snapshotKind":"authoritativeAppState",
              "monsterName":null,
              "characterKey":1,
              "eggTextureKey":null,
              "eggHatchTimeMs":12345,
              "eggHatchDurationMs":null,
              "eggCrackStage":0,
              "characterState":"egg",
              "displayState":"idle",
              "primaryStatus":"idle",
              "timeOfDay":"day",
              "stamina":0,
              "maxStamina":10,
              "staminaPercent":0,
              "staminaLevel":"red",
              "useLocalTime":true,
              "animationFrameIndex":0,
              "updatedAtMs":0,
              "snapshotComputedAtMs":0,
              "lastActiveTimeMs":null,
              "baseLastActiveTimeMs":null,
              "projectedElapsedMs":0,
              "projectionVersion":1,
              "staminaTimerMs":0,
              "hasUrgentStatus":false,
              "visibleStatusIcons":[]
            }
        """.trimIndent()

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
        assertEquals(listOf("native_hidden"), notifiedReasons)
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
