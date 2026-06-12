package com.ch00n9h09.montto

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
            requestAuthoritativeRefresh = { nowMs ->
                events += "authoritativeRefresh:$nowMs"
                HomeWidgetAuthoritativeRefreshRequestResult.REQUESTED
            },
            recordPeriodicRefreshStatus = { status, _ ->
                events += "status:$status"
            },
            nowMsProvider = { 10_000L },
        )

        assertFalse(updated)
        assertEquals(
            listOf(
                "status:periodic_worker_started",
                "cancel",
                "status:no_widgets",
            ),
            events,
        )
    }

    @Test
    fun `runner requests Flutter refresh every periodic run when widgets are present`() {
        val events = mutableListOf<String>()

        val updated = HomeWidgetPeriodicRefreshRunner.run(
            hasAnyWidgets = { true },
            onNoWidgets = {
                events += "cancel"
            },
            requestAuthoritativeRefresh = { nowMs ->
                events += "authoritativeRefresh:$nowMs"
                HomeWidgetAuthoritativeRefreshRequestResult.REQUESTED
            },
            recordPeriodicRefreshStatus = { status, nowMs ->
                events += "status:$status@$nowMs"
            },
            nowMsProvider = { 10_000L },
        )

        assertTrue(updated)
        assertEquals(
            listOf(
                "status:periodic_worker_started@10000",
                "status:flutter_refresh_pending@10000",
                "authoritativeRefresh:10000",
                "status:flutter_refresh_requested@10000",
            ),
            events,
        )
    }

    @Test
    fun `runner records Flutter refresh request failure`() {
        val nowMs = 20_000L
        val events = mutableListOf<String>()

        val updated = HomeWidgetPeriodicRefreshRunner.run(
            hasAnyWidgets = { true },
            onNoWidgets = {
                events += "cancel"
            },
            requestAuthoritativeRefresh = { requestedAtMs ->
                events += "authoritativeRefresh:$requestedAtMs"
                HomeWidgetAuthoritativeRefreshRequestResult.FAILED
            },
            recordPeriodicRefreshStatus = { status, _ ->
                events += "status:$status"
            },
            nowMsProvider = { nowMs },
        )

        assertFalse(updated)
        assertEquals(
            listOf(
                "status:periodic_worker_started",
                "status:flutter_refresh_pending",
                "authoritativeRefresh:20000",
                "status:flutter_refresh_failed",
            ),
            events,
        )
    }

    @Test
    fun `runner records periodic worker failure when refresh request throws`() {
        val events = mutableListOf<String>()

        val updated = HomeWidgetPeriodicRefreshRunner.run(
            hasAnyWidgets = { true },
            onNoWidgets = {
                events += "cancel"
            },
            requestAuthoritativeRefresh = {
                error("boom")
            },
            recordPeriodicRefreshStatus = { status, nowMs ->
                events += "status:$status@$nowMs"
            },
            nowMsProvider = { 30_000L },
        )

        assertFalse(updated)
        assertEquals(
            listOf(
                "status:periodic_worker_started@30000",
                "status:flutter_refresh_pending@30000",
                "status:periodic_worker_failed@30000",
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
    fun `forced authoritative refresh bypasses stale in-flight throttle`() {
        val prefs = FakeSharedPreferences().apply {
            edit()
                .putLong(HomeWidgetConstants.REFRESH_REQUESTED_AT_MS_KEY, 1_000L)
                .putBoolean(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY, true)
                .apply()
        }
        val events = mutableListOf<String>()

        val result = HomeWidgetAuthoritativeRefreshRequester.request(
            prefs = prefs,
            nowMs = 2_000L,
            force = true,
            enqueueFlutterBackgroundRefresh = {
                events += "backgroundRefresh"
                true
            },
            launchRefreshActivity = {
                events += "activityRefresh"
                false
            },
        )

        assertEquals(HomeWidgetAuthoritativeRefreshRequestResult.REQUESTED, result)
        assertEquals(listOf("backgroundRefresh", "activityRefresh"), events)
        assertEquals(2_000L, prefs.getLong(HomeWidgetConstants.REFRESH_REQUESTED_AT_MS_KEY, 0L))
    }

    @Test
    fun `authoritative refresh request succeeds when Flutter background refresh is queued`() {
        val prefs = FakeSharedPreferences()
        val events = mutableListOf<String>()

        val result = HomeWidgetAuthoritativeRefreshRequester.request(
            prefs = prefs,
            nowMs = 1_000L,
            enqueueFlutterBackgroundRefresh = {
                events += "backgroundRefresh"
                true
            },
            launchRefreshActivity = {
                events += "activityRefresh"
                false
            },
        )

        assertEquals(HomeWidgetAuthoritativeRefreshRequestResult.REQUESTED, result)
        assertEquals(listOf("backgroundRefresh", "activityRefresh"), events)
        assertTrue(prefs.getBoolean(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY, false))
        assertEquals(1_000L, prefs.getLong(HomeWidgetConstants.REFRESH_REQUESTED_AT_MS_KEY, 0L))
        assertTrue(prefs.getBoolean(HomeWidgetConstants.REFRESH_BACKGROUND_QUEUED_KEY, false))
        assertFalse(prefs.getBoolean(HomeWidgetConstants.REFRESH_ACTIVITY_LAUNCHED_KEY, true))
    }

    @Test
    fun `readDiagnostics exposes periodic refresh and refresh handshake fields`() {
        val prefs = FakeSharedPreferences()
        prefs.edit()
            .putString(HomeWidgetConstants.PERIODIC_REFRESH_STATUS_KEY, "flutter_world_data_update_completed")
            .putLong(HomeWidgetConstants.PERIODIC_REFRESH_STATUS_AT_MS_KEY, 1_000L)
            .putLong(HomeWidgetConstants.REFRESH_REQUESTED_AT_MS_KEY, 900L)
            .putLong(HomeWidgetConstants.REFRESH_COMPLETED_AT_MS_KEY, 1_050L)
            .putBoolean(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY, false)
            .putString(
                HomeWidgetConstants.REFRESH_SMOKE_RESULT_KEY,
                "completeRefresh(result=completed,source=flutter)",
            )
            .apply()

        val diagnostics = HomeWidgetAuthoritativeRefreshRequester.readDiagnostics(prefs)

        assertEquals(
            "flutter_world_data_update_completed",
            diagnostics["periodicRefreshStatus"],
        )
        assertEquals(1_000L, diagnostics["periodicRefreshStatusAtMs"])
        assertEquals(900L, diagnostics["requestedAtMs"])
        assertEquals(1_050L, diagnostics["completedAtMs"])
        assertEquals(false, diagnostics["inFlight"])
        assertEquals(
            "completeRefresh(result=completed,source=flutter)",
            diagnostics["smokeResult"],
        )
        assertEquals(false, diagnostics["backgroundRefreshQueued"])
        assertEquals(false, diagnostics["refreshActivityLaunched"])
        assertEquals(false, diagnostics["hasAnyWidgets"])
        assertEquals(0, diagnostics["homeWidget2x1Count"])
        assertEquals(0, diagnostics["homeWidget1x1Count"])
    }

    @Test
    fun `readDiagnostics exposes widget presence fields`() {
        val diagnostics = HomeWidgetAuthoritativeRefreshRequester.readDiagnostics(
            nativePrefs = FakeSharedPreferences(),
            flutterPrefs = null,
            widgetPresence = HomeWidgetPresence(
                homeWidget2x1Count = 2,
                homeWidget1x1Count = 1,
            ),
        )

        assertEquals(true, diagnostics["hasAnyWidgets"])
        assertEquals(2, diagnostics["homeWidget2x1Count"])
        assertEquals(1, diagnostics["homeWidget1x1Count"])
    }

    @Test
    fun `readDiagnostics exposes native flutter selected snapshots and debug override`() {
        val nativePrefs = FakeSharedPreferences()
        val flutterPrefs = FakeSharedPreferences()
        val nativeSnapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 0, nowMs = 1_000L)
            .copy(
                snapshotKind = "authoritativeAppState",
                characterState = "egg",
                snapshotComputedAtMs = 1_000L,
                updatedAtMs = 1_000L,
            )
        val flutterSnapshot = HomeWidgetDebugPresets.resolveSnapshot(index = 1, nowMs = 2_000L)
            .copy(
                snapshotKind = "authoritativeAppState",
                characterState = "idle",
                snapshotComputedAtMs = 2_000L,
                updatedAtMs = 2_000L,
            )
        nativePrefs.edit()
            .putString(HomeWidgetConstants.AUTHORITATIVE_SNAPSHOT_KEY, nativeSnapshot.toJsonString())
            .putString(HomeWidgetConstants.SNAPSHOT_KEY, nativeSnapshot.toJsonString())
            .putBoolean(HomeWidgetConstants.DEBUG_PRESET_OVERRIDE_ENABLED_KEY, true)
            .putInt(HomeWidgetConstants.DEBUG_PRESET_INDEX_KEY, 3)
            .apply()
        flutterPrefs.edit()
            .putString(
                HomeWidgetConstants.FLUTTER_AUTHORITATIVE_SNAPSHOT_KEY,
                flutterSnapshot.toJsonString(),
            )
            .putString(HomeWidgetConstants.FLUTTER_SNAPSHOT_KEY, flutterSnapshot.toJsonString())
            .apply()

        val diagnostics = HomeWidgetAuthoritativeRefreshRequester.readDiagnostics(
            nativePrefs = nativePrefs,
            flutterPrefs = flutterPrefs,
            debugModeEnabled = true,
        )

        assertEquals(HOME_WIDGET_FLUTTER_SNAPSHOT_SOURCE, diagnostics["selectedAuthoritativeSource"])
        assertEquals(true, diagnostics["debugOverrideEnabled"])
        assertEquals(3, diagnostics["debugPresetIndex"])
        assertEquals(
            "egg",
            (diagnostics["nativeAuthoritativeSnapshot"] as Map<*, *>)["characterState"],
        )
        assertEquals(
            "idle",
            (diagnostics["flutterAuthoritativeSnapshot"] as Map<*, *>)["characterState"],
        )
        assertEquals(
            "idle",
            (diagnostics["selectedAuthoritativeSnapshot"] as Map<*, *>)["characterState"],
        )
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

    @Test
    fun `widgetPresence exposes counts and diagnostics map`() {
        val presence = HomeWidgetPeriodicRefreshScheduler.widgetPresence(
            homeWidgetIds = intArrayOf(7, 8),
            homeWidget1x1Ids = intArrayOf(101),
        )
        val diagnostics = presence.toDiagnosticsMap()

        assertTrue(presence.hasAnyWidgets)
        assertEquals(2, presence.homeWidget2x1Count)
        assertEquals(1, presence.homeWidget1x1Count)
        assertEquals(true, diagnostics["hasAnyWidgets"])
        assertEquals(2, diagnostics["homeWidget2x1Count"])
        assertEquals(1, diagnostics["homeWidget1x1Count"])
    }
}
