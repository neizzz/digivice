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

        val result = HomeWidgetSnapshotPublisher.publish(
            prefs = prefs,
            snapshotKey = "home_widget_snapshot_v1",
            snapshotJson = """{"foo":"bar"}""",
            reason = "native_hidden",
            notifySnapshotUpdated = { reason ->
                notifiedReasons += reason
            },
        )

        assertEquals(mapOf("status" to "ok"), result)
        assertEquals("""{"foo":"bar"}""", prefs.getString("home_widget_snapshot_v1", null))
        assertEquals(listOf("native_hidden"), notifiedReasons)
    }

    @Test
    fun `publish removes snapshot when json is null and notifies update`() {
        val prefs = FakeSharedPreferences().apply {
            edit().putString("home_widget_snapshot_v1", """{"foo":"bar"}""").apply()
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

        assertEquals(mapOf("status" to "ok"), result)
        assertFalse(prefs.contains("home_widget_snapshot_v1"))
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
