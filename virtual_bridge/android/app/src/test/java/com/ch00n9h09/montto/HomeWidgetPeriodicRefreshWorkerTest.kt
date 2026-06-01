package com.ch00n9h09.montto

import android.content.SharedPreferences
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeWidgetPeriodicRefreshWorkerTest {
    @Test
    fun `runner cancels schedule when widgets are absent`() {
        val events = mutableListOf<String>()

        val updated = HomeWidgetPeriodicRefreshRunner.run(
            hasAnyWidgets = { false },
            onNoWidgets = {
                events += "cancel"
            },
            progressSnapshot = {
                events += "progress"
                null
            },
            loadAuthoritativeSnapshot = { null },
            requestAuthoritativeRefresh = {
                events += "requestRefresh"
                HomeWidgetAuthoritativeRefreshRequestResult.REQUESTED
            },
            notifySnapshotUpdated = { reason ->
                events += "notify:$reason"
            },
            recordPeriodicRefreshStatus = { status, _ ->
                events += "status:$status"
            },
            nowMsProvider = { 10_000L },
        )

        assertFalse(updated)
        assertEquals(listOf("cancel", "status:no_widgets"), events)
    }

    @Test
    fun `runner progresses snapshot and notifies when widgets are present`() {
        val events = mutableListOf<String>()

        val updated = HomeWidgetPeriodicRefreshRunner.run(
            hasAnyWidgets = { true },
            onNoWidgets = {
                events += "cancel"
            },
            progressSnapshot = { nowMs ->
                events += "progress:$nowMs"
                HomeWidgetDebugPresets.resolveSnapshot(index = 1, nowMs = 10_000L)
            },
            loadAuthoritativeSnapshot = { null },
            requestAuthoritativeRefresh = {
                events += "requestRefresh"
                HomeWidgetAuthoritativeRefreshRequestResult.REQUESTED
            },
            notifySnapshotUpdated = { reason ->
                events += "notify:$reason"
            },
            recordPeriodicRefreshStatus = { status, nowMs ->
                events += "status:$status@$nowMs"
            },
            nowMsProvider = { 10_000L },
        )

        assertTrue(updated)
        assertEquals(
            listOf(
                "progress:10000",
                "status:progress_only@10000",
                "notify:${HomeWidgetConstants.PERIODIC_REFRESH_REASON}",
            ),
            events,
        )
    }

    @Test
    fun `runner requests hidden refresh when matured egg cannot be projected authoritatively`() {
        val nowMs = 20_000L
        val events = mutableListOf<String>()
        val maturedEgg = HomeWidgetDebugPresets.resolveSnapshot(index = 0, nowMs = nowMs).copy(
            snapshotKind = "widgetProgressed",
            eggHatchTimeMs = nowMs - 1L,
            eggHatchDurationMs = 30_000L,
            eggCrackStage = 3,
        )

        val updated = HomeWidgetPeriodicRefreshRunner.run(
            hasAnyWidgets = { true },
            onNoWidgets = {
                events += "cancel"
            },
            progressSnapshot = {
                events += "progress"
                maturedEgg
            },
            loadAuthoritativeSnapshot = { maturedEgg },
            requestAuthoritativeRefresh = {
                events += "requestRefresh"
                HomeWidgetAuthoritativeRefreshRequestResult.REQUESTED
            },
            notifySnapshotUpdated = { reason ->
                events += "notify:$reason"
            },
            recordPeriodicRefreshStatus = { status, _ ->
                events += "status:$status"
            },
            nowMsProvider = { nowMs },
        )

        assertTrue(updated)
        assertEquals(
            listOf(
                "progress",
                "requestRefresh",
                "status:refresh_requested",
                "notify:${HomeWidgetConstants.PERIODIC_REFRESH_REASON}",
            ),
            events,
        )
    }

    @Test
    fun `authoritative refresh request is guarded while in flight and throttled after completion`() {
        val prefs = FakeSharedPreferences()

        val firstResult = HomeWidgetAuthoritativeRefreshRequester.request(
            prefs = prefs,
            nowMs = 1_000L,
            launchRefreshActivity = { true },
        )
        val secondResult = HomeWidgetAuthoritativeRefreshRequester.request(
            prefs = prefs,
            nowMs = 2_000L,
            launchRefreshActivity = { true },
        )

        HomeWidgetAuthoritativeRefreshRequester.completeRefresh(
            prefs = prefs,
            payloadSummary = "ok",
            completedAtMs = 3_000L,
        )
        val thirdResult = HomeWidgetAuthoritativeRefreshRequester.request(
            prefs = prefs,
            nowMs = 4_000L,
            launchRefreshActivity = { true },
        )

        assertEquals(HomeWidgetAuthoritativeRefreshRequestResult.REQUESTED, firstResult)
        assertEquals(
            HomeWidgetAuthoritativeRefreshRequestResult.SKIPPED_IN_FLIGHT,
            secondResult,
        )
        assertEquals(
            HomeWidgetAuthoritativeRefreshRequestResult.SKIPPED_THROTTLED,
            thirdResult,
        )
        assertFalse(prefs.getBoolean(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY, true))
        assertEquals(3_000L, prefs.getLong(HomeWidgetConstants.REFRESH_COMPLETED_AT_MS_KEY, 0L))
        assertEquals("ok", prefs.getString(HomeWidgetConstants.REFRESH_SMOKE_RESULT_KEY, null))
    }

    @Test
    fun `hasAnyWidgets returns true when either size exists`() {
        assertTrue(
            HomeWidgetPeriodicRefreshScheduler.hasAnyWidgets(
                homeWidgetIds = intArrayOf(),
                homeWidget1x1Ids = intArrayOf(101),
            ),
        )
        assertTrue(
            HomeWidgetPeriodicRefreshScheduler.hasAnyWidgets(
                homeWidgetIds = intArrayOf(7),
                homeWidget1x1Ids = intArrayOf(),
            ),
        )
        assertFalse(
            HomeWidgetPeriodicRefreshScheduler.hasAnyWidgets(
                homeWidgetIds = intArrayOf(),
                homeWidget1x1Ids = intArrayOf(),
            ),
        )
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
    }

    private class Editor(
        private val values: MutableMap<String, Any?>,
    ) : SharedPreferences.Editor {
        private val pending = linkedMapOf<String, Any?>()
        private var clearRequested = false

        override fun putString(key: String?, value: String?): SharedPreferences.Editor = apply {
            pending[key.orEmpty()] = value
        }

        override fun putStringSet(
            key: String?,
            values: MutableSet<String>?,
        ): SharedPreferences.Editor = apply {
            pending[key.orEmpty()] = values?.toSet()
        }

        override fun putInt(key: String?, value: Int): SharedPreferences.Editor = apply {
            pending[key.orEmpty()] = value
        }

        override fun putLong(key: String?, value: Long): SharedPreferences.Editor = apply {
            pending[key.orEmpty()] = value
        }

        override fun putFloat(key: String?, value: Float): SharedPreferences.Editor = apply {
            pending[key.orEmpty()] = value
        }

        override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor = apply {
            pending[key.orEmpty()] = value
        }

        override fun remove(key: String?): SharedPreferences.Editor = apply {
            pending[key.orEmpty()] = null
        }

        override fun clear(): SharedPreferences.Editor = apply {
            clearRequested = true
            pending.clear()
        }

        override fun commit(): Boolean {
            apply()
            return true
        }

        override fun apply() {
            if (clearRequested) {
                values.clear()
                clearRequested = false
            }
            pending.forEach { (key, value) ->
                if (value == null) {
                    values.remove(key)
                } else {
                    values[key] = value
                }
            }
            pending.clear()
        }
    }
}
