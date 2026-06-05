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
            completeNativeAuthoritativeRefresh = {
                events += "nativeComplete"
                HomeWidgetNativeAuthoritativeRefreshResult(
                    status = "native_authoritative_completion_completed",
                )
            },
            requestAuthoritativeRefreshFallback = {
                events += "fallbackRefresh"
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
            completeNativeAuthoritativeRefresh = {
                events += "nativeComplete"
                HomeWidgetNativeAuthoritativeRefreshResult(
                    status = "native_authoritative_completion_completed",
                )
            },
            requestAuthoritativeRefreshFallback = {
                events += "fallbackRefresh"
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
                "status:periodic_progress_only@10000",
                "notify:${HomeWidgetConstants.PERIODIC_REFRESH_REASON}",
            ),
            events,
        )
    }

    @Test
    fun `runner completes matured egg natively without requesting fallback refresh`() {
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
            completeNativeAuthoritativeRefresh = { completionNowMs ->
                events += "nativeComplete:$completionNowMs"
                HomeWidgetNativeAuthoritativeRefreshResult(
                    status = "native_authoritative_completion_completed",
                    hasSnapshot = true,
                    hatched = true,
                )
            },
            requestAuthoritativeRefreshFallback = {
                events += "fallbackRefresh"
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
                "status:native_authoritative_completion_started",
                "nativeComplete:20000",
                "status:native_authoritative_completion_completed",
                "notify:${HomeWidgetConstants.PERIODIC_REFRESH_REASON}",
            ),
            events,
        )
    }

    @Test
    fun `runner requests fallback refresh only after native completion failure`() {
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
            completeNativeAuthoritativeRefresh = {
                events += "nativeComplete"
                HomeWidgetNativeAuthoritativeRefreshResult(
                    status = "native_authoritative_completion_failed",
                    error = "boom",
                )
            },
            requestAuthoritativeRefreshFallback = {
                events += "fallbackRefresh"
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
                "status:native_authoritative_completion_started",
                "nativeComplete",
                "status:native_authoritative_completion_failed",
                "fallbackRefresh",
                "status:fallback_refresh_requested",
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
    fun `native authoritative refresh completes matured egg and records smoke result`() {
        val nowMs = 20_000L
        val widgetPrefs = FakeSharedPreferences()
        val flutterPrefs = FakeSharedPreferences()
        var persistedSnapshot: HomeWidgetSnapshot? = null

        widgetPrefs.edit()
            .putBoolean(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY, true)
            .apply()
        flutterPrefs.edit()
            .putString(
                HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY,
                buildEggWorldData(
                    hatchTimeMs = nowMs - 1L,
                    resetMarkerId = "reset-current",
                    pendingCharacterKey = 22,
                ),
            )
            .putString(
                HomeWidgetConstants.FLUTTER_RESET_BOOTSTRAP_MARKER_STORAGE_KEY,
                """{"version":1,"resetId":"reset-current","reason":"user_reset","createdAt":1}""",
            )
            .apply()

        val result = HomeWidgetNativeAuthoritativeRefresh.complete(
            widgetPrefs = widgetPrefs,
            flutterPrefs = flutterPrefs,
            nowMs = nowMs,
            persistSnapshot = { snapshot ->
                persistedSnapshot = snapshot
            },
        )

        val updatedWorldData = flutterPrefs.getString(
            HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY,
            null,
        )

        assertEquals("native_authoritative_completion_completed", result.status)
        assertTrue(result.succeeded)
        assertEquals(true, result.hatched)
        assertEquals(22, result.selectedCharacterKey)
        assertEquals("idle", persistedSnapshot?.characterState)
        assertEquals(22, persistedSnapshot?.characterKey)
        assertTrue(updatedWorldData?.contains(""""state":1""") == true)
        assertTrue(updatedWorldData?.contains(""""characterKey":22""") == true)
        assertTrue(updatedWorldData?.contains(""""hatchTime":0""") == true)
        assertEquals(false, widgetPrefs.getBoolean(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY, true))
        assertEquals(nowMs, widgetPrefs.getLong(HomeWidgetConstants.REFRESH_COMPLETED_AT_MS_KEY, 0L))
        assertTrue(
            widgetPrefs.getString(HomeWidgetConstants.REFRESH_SMOKE_RESULT_KEY, null)
                ?.startsWith("native_authoritative_completion_completed") == true,
        )
    }

    @Test
    fun `native authoritative refresh blocks stale reset bootstrap world before hatch write`() {
        val nowMs = 20_000L
        val widgetPrefs = FakeSharedPreferences()
        val flutterPrefs = FakeSharedPreferences()
        var persistCalled = false

        widgetPrefs.edit()
            .putString(HomeWidgetConstants.SNAPSHOT_KEY, """{"stale":true}""")
            .putString(HomeWidgetConstants.AUTHORITATIVE_SNAPSHOT_KEY, """{"stale":true}""")
            .apply()
        flutterPrefs.edit()
            .putString(
                HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY,
                buildEggWorldData(
                    hatchTimeMs = nowMs - 1L,
                    resetMarkerId = "reset-old",
                    pendingCharacterKey = 22,
                ),
            )
            .putString(
                HomeWidgetConstants.FLUTTER_RESET_BOOTSTRAP_MARKER_STORAGE_KEY,
                """{"version":1,"resetId":"reset-current","reason":"user_reset","createdAt":1}""",
            )
            .putString(HomeWidgetConstants.FLUTTER_SNAPSHOT_KEY, """{"stale":true}""")
            .putString(HomeWidgetConstants.FLUTTER_AUTHORITATIVE_SNAPSHOT_KEY, """{"stale":true}""")
            .apply()

        val result = HomeWidgetNativeAuthoritativeRefresh.complete(
            widgetPrefs = widgetPrefs,
            flutterPrefs = flutterPrefs,
            nowMs = nowMs,
            persistSnapshot = {
                persistCalled = true
            },
        )

        assertEquals("native_authoritative_completion_failed", result.status)
        assertEquals("stale_reset_bootstrap_marker", result.error)
        assertFalse(persistCalled)
        assertEquals(null, flutterPrefs.getString(HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY, null))
        assertFalse(widgetPrefs.contains(HomeWidgetConstants.SNAPSHOT_KEY))
        assertFalse(widgetPrefs.contains(HomeWidgetConstants.AUTHORITATIVE_SNAPSHOT_KEY))
        assertFalse(flutterPrefs.contains(HomeWidgetConstants.FLUTTER_SNAPSHOT_KEY))
        assertFalse(flutterPrefs.contains(HomeWidgetConstants.FLUTTER_AUTHORITATIVE_SNAPSHOT_KEY))
    }

    @Test
    fun `readDiagnostics exposes periodic refresh and refresh handshake fields`() {
        val prefs = FakeSharedPreferences()
        prefs.edit()
            .putString(HomeWidgetConstants.PERIODIC_REFRESH_STATUS_KEY, "native_authoritative_completion_completed")
            .putLong(HomeWidgetConstants.PERIODIC_REFRESH_STATUS_AT_MS_KEY, 1_000L)
            .putLong(HomeWidgetConstants.REFRESH_REQUESTED_AT_MS_KEY, 900L)
            .putLong(HomeWidgetConstants.REFRESH_COMPLETED_AT_MS_KEY, 1_050L)
            .putBoolean(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY, false)
            .putString(
                HomeWidgetConstants.REFRESH_SMOKE_RESULT_KEY,
                "native_authoritative_completion_completed(characterState=idle)",
            )
            .apply()

        val diagnostics = HomeWidgetAuthoritativeRefreshRequester.readDiagnostics(prefs)

        assertEquals(
            "native_authoritative_completion_completed",
            diagnostics["periodicRefreshStatus"],
        )
        assertEquals(1_000L, diagnostics["periodicRefreshStatusAtMs"])
        assertEquals(900L, diagnostics["requestedAtMs"])
        assertEquals(1_050L, diagnostics["completedAtMs"])
        assertEquals(false, diagnostics["inFlight"])
        assertEquals(
            "native_authoritative_completion_completed(characterState=idle)",
            diagnostics["smokeResult"],
        )
    }

    private fun buildEggWorldData(
        hatchTimeMs: Long,
        resetMarkerId: String,
        pendingCharacterKey: Int,
    ): String {
        return """
            {
              "world_metadata": {
                "name": "MainScene",
                "monster_name": "Test",
                "last_ecs_saved": 1000,
                "version": "1.0.0",
                "app_state": {
                  "last_active_time": 1000,
                  "use_local_time": true,
                  "reset_bootstrap_marker_id": "$resetMarkerId"
                }
              },
              "entities": [
                {
                  "components": {
                    "object": {
                      "id": 10,
                      "type": 1,
                      "state": 0
                    },
                    "characterStatus": {
                      "characterKey": 0,
                      "stamina": 5,
                      "evolutionPhase": 0,
                      "statuses": []
                    },
                    "eggHatch": {
                      "hatchTime": $hatchTimeMs,
                      "hatchDurationMs": 30000,
                      "isReadyToHatch": true,
                      "syringeCount": 0,
                      "pendingCharacterKey": $pendingCharacterKey
                    },
                    "render": {
                      "textureKey": 517
                    }
                  }
                }
              ]
            }
        """.trimIndent()
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
