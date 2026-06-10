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
            progressSnapshot = {
                events += "progress"
                null
            },
            loadAuthoritativeSnapshot = { null },
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
    fun `runner skips update when snapshot progress is unavailable`() {
        val events = mutableListOf<String>()

        val updated = HomeWidgetPeriodicRefreshRunner.run(
            hasAnyWidgets = { true },
            onNoWidgets = {
                events += "cancel"
            },
            progressSnapshot = {
                events += "progress"
                null
            },
            loadAuthoritativeSnapshot = {
                events += "loadAuthoritative"
                null
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
            nowMsProvider = { 20_000L },
        )

        assertFalse(updated)
        assertEquals(
            listOf(
                "progress",
                "status:progress_unavailable@20000",
            ),
            events,
        )
    }

    @Test
    fun `runner requests Flutter refresh for matured egg without native completion`() {
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
                "status:flutter_authority_only",
                "fallbackRefresh",
                "status:fallback_refresh_requested",
                "notify:${HomeWidgetConstants.PERIODIC_REFRESH_REASON}",
            ),
            events,
        )
    }

    @Test
    fun `runner records Flutter refresh request failure for matured egg`() {
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
            requestAuthoritativeRefreshFallback = {
                events += "fallbackRefresh"
                HomeWidgetAuthoritativeRefreshRequestResult.FAILED
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
                "status:flutter_authority_only",
                "fallbackRefresh",
                "status:fallback_refresh_failed",
                "notify:${HomeWidgetConstants.PERIODIC_REFRESH_REASON}",
            ),
            events,
        )
    }

    @Test
    fun `runner leaves non egg snapshot progress only`() {
        val nowMs = 30 * 60 * 1000L
        val events = mutableListOf<String>()
        val authoritativeSnapshot = HomeWidgetDebugPresets.resolveSnapshot(
            index = 1,
            nowMs = nowMs,
        ).copy(
            snapshotKind = "authoritativeAppState",
            snapshotComputedAtMs = nowMs -
                (HomeWidgetConstants.PERIODIC_REFRESH_INTERVAL_MINUTES * 60 * 1000L),
            updatedAtMs = nowMs -
                (HomeWidgetConstants.PERIODIC_REFRESH_INTERVAL_MINUTES * 60 * 1000L),
        )
        val progressedSnapshot = authoritativeSnapshot.copy(
            snapshotKind = "widgetProgressed",
            snapshotComputedAtMs = nowMs,
            updatedAtMs = nowMs,
        )

        val updated = HomeWidgetPeriodicRefreshRunner.run(
            hasAnyWidgets = { true },
            onNoWidgets = {
                events += "cancel"
            },
            progressSnapshot = {
                events += "progress"
                progressedSnapshot
            },
            loadAuthoritativeSnapshot = { authoritativeSnapshot },
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
            nowMsProvider = { nowMs },
        )

        assertTrue(updated)
        assertEquals(
            listOf(
                "progress",
                "status:periodic_progress_only@1800000",
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
}
