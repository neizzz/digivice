package com.ch00n9h09.montto

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
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
    fun `runner completes stale non egg authoritative snapshot natively without fallback`() {
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
            completeNativeAuthoritativeRefresh = { completionNowMs ->
                events += "nativeComplete:$completionNowMs"
                HomeWidgetNativeAuthoritativeRefreshResult(
                    status = "native_authoritative_completion_completed",
                    hasSnapshot = true,
                    hatched = false,
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
                "nativeComplete:1800000",
                "status:native_authoritative_completion_completed",
                "notify:${HomeWidgetConstants.PERIODIC_REFRESH_REASON}",
            ),
            events,
        )
    }

    @Test
    fun `runner completes fresh non egg authoritative snapshot natively`() {
        val nowMs = 30 * 60 * 1000L
        val events = mutableListOf<String>()
        val authoritativeSnapshot = HomeWidgetDebugPresets.resolveSnapshot(
            index = 1,
            nowMs = nowMs,
        ).copy(snapshotKind = "authoritativeAppState")
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
            nowMsProvider = { nowMs },
        )

        assertTrue(updated)
        assertEquals(
            listOf(
                "progress",
                "status:native_authoritative_completion_started",
                "nativeComplete",
                "status:native_authoritative_completion_completed",
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
                buildHomeWidgetEggWorldData(
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
        assertEquals(true, result.hatchSelectionDiagnostics?.usedPendingCharacterKey)
        assertEquals(22, result.hatchSelectionDiagnostics?.selectedCharacterKey)
        assertEquals(null, result.hatchSelectionDiagnostics?.rollPercent)
        assertEquals("idle", persistedSnapshot?.characterState)
        assertEquals(22, persistedSnapshot?.characterKey)
        assertTrue(updatedWorldData?.contains(""""state":1""") == true)
        assertTrue(updatedWorldData?.contains(""""characterKey":22""") == true)
        assertTrue(updatedWorldData?.contains(""""hatchTime":0""") == true)
        val updatedComponents = JSONObject(updatedWorldData!!)
            .getJSONArray("entities")
            .getJSONObject(0)
            .getJSONObject("components")
        assertEquals(0, updatedComponents.getJSONObject("render").getInt("textureKey"))
        assertEquals(22, updatedComponents.getJSONObject("animationRender").getInt("spritesheetKey"))
        assertEquals(2000, updatedComponents.getJSONObject("randomMovement").getInt("minIdleTime"))
        assertEquals(0.0, updatedComponents.getJSONObject("speed").getDouble("value"), 0.0)
        assertEquals(false, widgetPrefs.getBoolean(HomeWidgetConstants.REFRESH_IN_FLIGHT_KEY, true))
        assertEquals(nowMs, widgetPrefs.getLong(HomeWidgetConstants.REFRESH_COMPLETED_AT_MS_KEY, 0L))
        assertTrue(
            widgetPrefs.getString(HomeWidgetConstants.REFRESH_SMOKE_RESULT_KEY, null)
                ?.startsWith("native_authoritative_completion_completed") == true,
        )
    }


    @Test
    fun `native authoritative refresh includes stale food progressed during app off in hatch selection diagnostics`() {
        val nowMs = 11 * 60 * 1000L
        val widgetPrefs = FakeSharedPreferences()
        val flutterPrefs = FakeSharedPreferences()

        flutterPrefs.edit()
            .putString(
                HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY,
                buildHomeWidgetEggWorldData(
                    hatchTimeMs = nowMs - 1L,
                    resetMarkerId = "reset-current",
                    pendingCharacterKey = 0,
                    lastEcsSaved = 1000L,
                    extraEntitiesJson = buildHomeWidgetFoodEntityJson(
                        freshness = 2,
                        createdTime = 1000L,
                        staleTime = 10 * 60 * 1000L,
                    ),
                ),
            )
            .apply()

        val result = HomeWidgetNativeAuthoritativeRefresh.complete(
            widgetPrefs = widgetPrefs,
            flutterPrefs = flutterPrefs,
            nowMs = nowMs,
            persistSnapshot = {},
        )
        val updatedEntities = JSONObject(
            flutterPrefs.getString(HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY, null)!!,
        ).getJSONArray("entities")
        val updatedFoodComponents = updatedEntities.getJSONObject(1).getJSONObject("components")

        assertTrue(result.succeeded)
        assertEquals(true, result.hatched)
        assertEquals(false, result.hatchSelectionDiagnostics?.usedPendingCharacterKey)
        assertEquals(1, result.hatchSelectionDiagnostics?.staleFoodCountAtHatch)
        assertEquals(63, result.hatchSelectionDiagnostics?.greenProbability)
        assertEquals(22, result.hatchSelectionDiagnostics?.soilProbability)
        assertEquals(15, result.hatchSelectionDiagnostics?.skullProbability)
        assertEquals(3, updatedFoodComponents.getJSONObject("freshness").getInt("freshness"))
        assertEquals(2, updatedFoodComponents.getJSONObject("object").getInt("state"))
    }

    @Test
    fun `native authoritative refresh projects post hatch runtime movement after elapsed time`() {
        val nowMs = 40_000L
        val widgetPrefs = FakeSharedPreferences()
        val flutterPrefs = FakeSharedPreferences()
        val initialX = 100.0
        val initialY = 120.0

        flutterPrefs.edit()
            .putString(
                HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY,
                buildHomeWidgetEggWorldData(
                    hatchTimeMs = nowMs - 20_000L,
                    resetMarkerId = "reset-current",
                    pendingCharacterKey = 22,
                    positionX = initialX,
                    positionY = initialY,
                ),
            )
            .apply()

        val result = HomeWidgetNativeAuthoritativeRefresh.complete(
            widgetPrefs = widgetPrefs,
            flutterPrefs = flutterPrefs,
            nowMs = nowMs,
            persistSnapshot = {},
        )
        val updatedComponents = JSONObject(
            flutterPrefs.getString(HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY, null)!!,
        ).getJSONArray("entities")
            .getJSONObject(0)
            .getJSONObject("components")
        val updatedPosition = updatedComponents.getJSONObject("position")
        val updatedRandomMovement = updatedComponents.getJSONObject("randomMovement")

        assertTrue(result.succeeded)
        assertEquals(true, result.hatched)
        assertEquals(22, updatedComponents.getJSONObject("animationRender").getInt("spritesheetKey"))
        assertEquals(0, updatedComponents.getJSONObject("render").getInt("textureKey"))
        assertTrue(updatedComponents.getJSONObject("object").getInt("state") in listOf(1, 2))
        assertNotEquals(initialX, updatedPosition.getDouble("x"), 0.000001)
        assertNotEquals(initialY, updatedPosition.getDouble("y"), 0.000001)
        assertEquals(2000, updatedRandomMovement.getInt("minIdleTime"))
        assertEquals(8000, updatedRandomMovement.getInt("maxIdleTime"))
        assertTrue(updatedRandomMovement.getLong("nextChange") > nowMs)
        assertTrue(updatedComponents.has("angle"))
        assertTrue(updatedComponents.has("speed"))
    }

    @Test
    fun `native authoritative refresh exposes hatch selection diagnostics in result map`() {
        val nowMs = 20_000L
        val widgetPrefs = FakeSharedPreferences()
        val flutterPrefs = FakeSharedPreferences()

        flutterPrefs.edit()
            .putString(
                HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY,
                buildHomeWidgetEggWorldData(
                    hatchTimeMs = nowMs - 1L,
                    resetMarkerId = "reset-current",
                    pendingCharacterKey = 22,
                ),
            )
            .apply()

        val result = HomeWidgetNativeAuthoritativeRefresh.complete(
            widgetPrefs = widgetPrefs,
            flutterPrefs = flutterPrefs,
            nowMs = nowMs,
            persistSnapshot = {},
        ).toMap(includeWorldData = false)
        val diagnostics = result["hatchSelectionDiagnostics"] as Map<*, *>
        val probabilities = diagnostics["probabilities"] as Map<*, *>

        assertEquals(true, result["hasUpdatedRawWorldData"])
        assertEquals(22, diagnostics["selectedCharacterKey"])
        assertEquals(true, diagnostics["usedPendingCharacterKey"])
        assertEquals(65, probabilities["green"])
        assertEquals(20, probabilities["soil"])
        assertEquals(15, probabilities["skull"])
        assertEquals("egg", result["evolutionBlockReason"])
    }

    @Test
    fun `native authoritative refresh progresses due day nap into sleeping snapshot`() {
        val nowMs = 20 * 60 * 1000L
        val widgetPrefs = FakeSharedPreferences()
        val flutterPrefs = FakeSharedPreferences()
        var persistedSnapshot: HomeWidgetSnapshot? = null

        flutterPrefs.edit()
            .putString(
                HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY,
                buildHomeWidgetCharacterWorldData(
                    lastEcsSaved = 0L,
                    stamina = 6.0,
                    fatigue = 100.0,
                    nextDiseaseCheckTime = nowMs + 60_000L,
                    nextNapCheckTime = 1L,
                ),
            )
            .apply()

        val result = HomeWidgetNativeAuthoritativeRefresh.complete(
            widgetPrefs = widgetPrefs,
            flutterPrefs = flutterPrefs,
            nowMs = nowMs,
            persistSnapshot = { snapshot ->
                persistedSnapshot = snapshot
            },
            randomProvider = { event ->
                if (event.reason == "day_nap") 0.0 else 1.0
            },
        )

        assertEquals("native_authoritative_completion_completed", result.status)
        assertTrue(result.succeeded)
        assertEquals(false, result.hatched)
        assertEquals("sleeping", persistedSnapshot?.characterState)
        assertEquals("sleep", persistedSnapshot?.displayState)
        assertEquals(listOf("sleeping"), persistedSnapshot?.visibleStatusIcons)
        assertTrue(
            widgetPrefs.getString(HomeWidgetConstants.REFRESH_SMOKE_RESULT_KEY, null)
                ?.contains("characterState=sleeping") == true,
        )
    }

    @Test
    fun `native authoritative refresh applies due disease check to sick snapshot`() {
        val nowMs = 20_000L
        val widgetPrefs = FakeSharedPreferences()
        val flutterPrefs = FakeSharedPreferences()
        var persistedSnapshot: HomeWidgetSnapshot? = null

        flutterPrefs.edit()
            .putString(
                HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY,
                buildHomeWidgetCharacterWorldData(
                    lastEcsSaved = 0L,
                    stamina = 1.0,
                    fatigue = 90.0,
                    nextDiseaseCheckTime = 1L,
                    nextNapCheckTime = nowMs + 60_000L,
                ),
            )
            .apply()

        val result = HomeWidgetNativeAuthoritativeRefresh.complete(
            widgetPrefs = widgetPrefs,
            flutterPrefs = flutterPrefs,
            nowMs = nowMs,
            persistSnapshot = { snapshot ->
                persistedSnapshot = snapshot
            },
            randomProvider = { event ->
                if (event.reason == "disease") 0.0 else 1.0
            },
        )

        val updatedWorldData = flutterPrefs.getString(
            HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY,
            null,
        )

        assertEquals("native_authoritative_completion_completed", result.status)
        assertTrue(result.succeeded)
        assertEquals("sick", persistedSnapshot?.characterState)
        assertEquals("sick", persistedSnapshot?.displayState)
        assertEquals(listOf("sick"), persistedSnapshot?.visibleStatusIcons)
        assertTrue(updatedWorldData?.contains(""""state":4""") == true)
        assertTrue(updatedWorldData?.contains(""""statuses":[3]""") == true)
        assertTrue(
            widgetPrefs.getString(HomeWidgetConstants.REFRESH_SMOKE_RESULT_KEY, null)
                ?.contains("characterState=sick") == true,
        )
    }

    @Test
    fun `native authoritative refresh does not add fatigue bonus to disease rate`() {
        val nowMs = 20_000L
        val widgetPrefs = FakeSharedPreferences()
        val flutterPrefs = FakeSharedPreferences()
        var persistedSnapshot: HomeWidgetSnapshot? = null

        flutterPrefs.edit()
            .putString(
                HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY,
                buildHomeWidgetCharacterWorldData(
                    lastEcsSaved = 0L,
                    stamina = 6.0,
                    fatigue = 100.0,
                    nextDiseaseCheckTime = 1L,
                    nextNapCheckTime = nowMs + 60_000L,
                ),
            )
            .apply()

        val result = HomeWidgetNativeAuthoritativeRefresh.complete(
            widgetPrefs = widgetPrefs,
            flutterPrefs = flutterPrefs,
            nowMs = nowMs,
            persistSnapshot = { snapshot ->
                persistedSnapshot = snapshot
            },
            randomProvider = { event ->
                if (event.reason == "disease") 0.0003 else 1.0
            },
        )

        val updatedWorldData = flutterPrefs.getString(
            HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY,
            null,
        )

        assertTrue(result.succeeded)
        assertEquals("idle", persistedSnapshot?.characterState)
        assertEquals(emptyList<String>(), persistedSnapshot?.visibleStatusIcons)
        assertTrue(updatedWorldData?.contains(""""state":1""") == true)
        assertFalse(updatedWorldData?.contains(""""statuses":[3]""") == true)
    }

    @Test
    fun `native authoritative refresh progresses evolution gauge while eligible`() {
        val nowMs = 60 * 60 * 1000L
        val widgetPrefs = FakeSharedPreferences()
        val flutterPrefs = FakeSharedPreferences()

        flutterPrefs.edit()
            .putString(
                HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY,
                buildHomeWidgetCharacterWorldData(
                    lastEcsSaved = 0L,
                    stamina = 8.0,
                    evolutionGage = 0.0,
                    nextDiseaseCheckTime = nowMs + 60_000L,
                    nextNapCheckTime = nowMs + 60_000L,
                ),
            )
            .apply()

        val result = HomeWidgetNativeAuthoritativeRefresh.complete(
            widgetPrefs = widgetPrefs,
            flutterPrefs = flutterPrefs,
            nowMs = nowMs,
            persistSnapshot = {},
            randomProvider = { 1.0 },
        )

        val characterStatus = JSONObject(result.updatedRawWorldData!!)
            .getJSONArray("entities")
            .getJSONObject(0)
            .getJSONObject("components")
            .getJSONObject("characterStatus")

        assertTrue(result.succeeded)
        assertTrue(characterStatus.getDouble("evolutionGage") > 0.0)
        assertEquals(0.0, result.evolutionDiagnostics?.evolutionGageBefore ?: -1.0, 0.0)
        assertTrue(result.evolutionDiagnostics?.evolutionGageIncreased == true)
        assertEquals("none", result.evolutionDiagnostics?.blockReason)
        assertEquals(1, characterStatus.getInt("characterKey"))
        assertEquals(1, characterStatus.getInt("evolutionPhase"))
        assertTrue(
            widgetPrefs.getString(HomeWidgetConstants.REFRESH_SMOKE_RESULT_KEY, null)
                ?.contains("evolutionGage=0.0->") == true,
        )
    }

    @Test
    fun `native authoritative refresh evolves immediately when evolution gauge reaches max`() {
        val nowMs = 10_000L
        val widgetPrefs = FakeSharedPreferences()
        val flutterPrefs = FakeSharedPreferences()
        var persistedSnapshot: HomeWidgetSnapshot? = null

        flutterPrefs.edit()
            .putString(
                HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY,
                buildHomeWidgetCharacterWorldData(
                    lastEcsSaved = 0L,
                    stamina = 8.0,
                    evolutionGage = 99.999,
                    nextDiseaseCheckTime = nowMs + 60_000L,
                    nextNapCheckTime = nowMs + 60_000L,
                ),
            )
            .apply()

        val result = HomeWidgetNativeAuthoritativeRefresh.complete(
            widgetPrefs = widgetPrefs,
            flutterPrefs = flutterPrefs,
            nowMs = nowMs,
            persistSnapshot = { snapshot ->
                persistedSnapshot = snapshot
            },
            randomProvider = { event ->
                when (event.reason) {
                    "evolution_mutation" -> 1.0
                    "evolution" -> 0.0
                    else -> 1.0
                }
            },
        )

        val components = JSONObject(result.updatedRawWorldData!!)
            .getJSONArray("entities")
            .getJSONObject(0)
            .getJSONObject("components")
        val characterStatus = components.getJSONObject("characterStatus")
        val animationRender = components.getJSONObject("animationRender")
        val render = components.getJSONObject("render")

        assertTrue(result.succeeded)
        assertEquals(2, persistedSnapshot?.characterKey)
        assertEquals(2, characterStatus.getInt("characterKey"))
        assertEquals(2, characterStatus.getInt("evolutionPhase"))
        assertEquals(0.0, characterStatus.getDouble("evolutionGage"), 0.0)
        assertEquals(2, animationRender.getInt("spritesheetKey"))
        assertEquals(1, animationRender.getInt("animationKey"))
        assertEquals(0, render.getInt("textureKey"))
        assertEquals(0, render.getInt("storeIndex"))
    }

    @Test
    fun `native authoritative refresh detoxes injection stacks and clears legacy dirty stacks`() {
        val nowMs = 3 * 60 * 60 * 1000L
        val widgetPrefs = FakeSharedPreferences()
        val flutterPrefs = FakeSharedPreferences()

        flutterPrefs.edit()
            .putString(
                HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY,
                buildHomeWidgetCharacterWorldData(
                    lastEcsSaved = nowMs - 10_000L,
                    characterKey = 1,
                    stamina = 8.0,
                    evolutionGage = 0.0,
                    nextDiseaseCheckTime = nowMs + 60_000L,
                    nextNapCheckTime = nowMs + 60_000L,
                    mutationRiskJson = """
                        {
                          "unnecessaryInjectionStacks": 5,
                          "dirtyExposureStacks": 4,
                          "lastInjectionDetoxTime": 0,
                          "lastDirtyDetoxTime": 0
                        }
                    """.trimIndent(),
                ),
            )
            .apply()

        val result = HomeWidgetNativeAuthoritativeRefresh.complete(
            widgetPrefs = widgetPrefs,
            flutterPrefs = flutterPrefs,
            nowMs = nowMs,
            persistSnapshot = {},
            randomProvider = { 1.0 },
        )
        val mutationRisk = JSONObject(result.updatedRawWorldData!!)
            .getJSONArray("entities")
            .getJSONObject(0)
            .getJSONObject("components")
            .getJSONObject("mutationRisk")

        assertTrue(result.succeeded)
        assertEquals(2, mutationRisk.getInt("unnecessaryInjectionStacks"))
        assertEquals(0, mutationRisk.getInt("dirtyExposureStacks"))
        assertEquals(nowMs, mutationRisk.getLong("lastInjectionDetoxTime"))
        assertEquals(0, mutationRisk.getLong("lastDirtyDetoxTime"))
    }

    @Test
    fun `native authoritative refresh ignores legacy stored dirty stacks in mutation risk`() {
        val nowMs = 60 * 60 * 1000L
        val widgetPrefs = FakeSharedPreferences()
        val flutterPrefs = FakeSharedPreferences()

        flutterPrefs.edit()
            .putString(
                HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY,
                buildHomeWidgetCharacterWorldData(
                    lastEcsSaved = nowMs - 10_000L,
                    characterKey = 1,
                    stamina = 8.0,
                    evolutionGage = 99.999,
                    nextDiseaseCheckTime = nowMs + 60_000L,
                    nextNapCheckTime = nowMs + 60_000L,
                    mutationRiskJson = """
                        {
                          "unnecessaryInjectionStacks": 0,
                          "dirtyExposureStacks": 99,
                          "lastInjectionDetoxTime": 0,
                          "lastDirtyDetoxTime": 0
                        }
                    """.trimIndent(),
                ),
            )
            .apply()

        val result = HomeWidgetNativeAuthoritativeRefresh.complete(
            widgetPrefs = widgetPrefs,
            flutterPrefs = flutterPrefs,
            nowMs = nowMs,
            persistSnapshot = {},
            randomProvider = { event ->
                when (event.reason) {
                    "evolution_mutation" -> 0.015
                    "evolution" -> 0.0
                    else -> 1.0
                }
            },
        )
        val components = JSONObject(result.updatedRawWorldData!!)
            .getJSONArray("entities")
            .getJSONObject(0)
            .getJSONObject("components")
        val characterStatus = components.getJSONObject("characterStatus")
        val mutationRisk = components.getJSONObject("mutationRisk")

        assertTrue(result.succeeded)
        assertEquals(2, characterStatus.getInt("characterKey"))
        assertEquals(0, mutationRisk.getInt("dirtyExposureStacks"))
    }

    @Test
    fun `native authoritative refresh includes active cleanable dirty sources in mutation risk`() {
        val nowMs = 60 * 60 * 1000L
        val widgetPrefs = FakeSharedPreferences()
        val flutterPrefs = FakeSharedPreferences()

        flutterPrefs.edit()
            .putString(
                HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY,
                buildHomeWidgetCharacterWorldData(
                    lastEcsSaved = nowMs - 10_000L,
                    characterKey = 1,
                    stamina = 8.0,
                    evolutionGage = 99.999,
                    nextDiseaseCheckTime = nowMs + 60_000L,
                    nextNapCheckTime = nowMs + 60_000L,
                    extraEntitiesJson = """
                        ${buildHomeWidgetFoodEntityJson(
                            freshness = 3,
                            createdTime = nowMs,
                            staleTime = 10 * 60 * 1000L,
                        )},
                        {
                          "components": {
                            "object": {
                              "id": 21,
                              "type": 4,
                              "state": 0
                            },
                            "dirtyExposure": {
                              "stackCount": 0,
                              "accumulatedExposureMs": 0,
                              "lastUpdatedTime": $nowMs
                            }
                          }
                        }
                    """.trimIndent(),
                ),
            )
            .apply()

        val result = HomeWidgetNativeAuthoritativeRefresh.complete(
            widgetPrefs = widgetPrefs,
            flutterPrefs = flutterPrefs,
            nowMs = nowMs,
            persistSnapshot = {},
            randomProvider = { event ->
                when (event.reason) {
                    "evolution_mutation" -> 0.019
                    "evolution_mutation_target" -> 0.0
                    "evolution" -> 0.0
                    else -> 1.0
                }
            },
        )
        val characterStatus = JSONObject(result.updatedRawWorldData!!)
            .getJSONArray("entities")
            .getJSONObject(0)
            .getJSONObject("components")
            .getJSONObject("characterStatus")

        assertTrue(result.succeeded)
        assertEquals(14, characterStatus.getInt("characterKey"))
    }

    @Test
    fun `native authoritative refresh resolves evolution candidate after mutation risk detox`() {
        val nowMs = 10 * 60 * 60 * 1000L
        val widgetPrefs = FakeSharedPreferences()
        val flutterPrefs = FakeSharedPreferences()

        flutterPrefs.edit()
            .putString(
                HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY,
                buildHomeWidgetCharacterWorldData(
                    lastEcsSaved = nowMs - 10_000L,
                    characterKey = 1,
                    stamina = 8.0,
                    evolutionGage = 99.999,
                    nextDiseaseCheckTime = nowMs + 60_000L,
                    nextNapCheckTime = nowMs + 60_000L,
                    mutationRiskJson = """
                        {
                          "unnecessaryInjectionStacks": 10,
                          "dirtyExposureStacks": 0,
                          "lastInjectionDetoxTime": 0,
                          "lastDirtyDetoxTime": 0
                        }
                    """.trimIndent(),
                ),
            )
            .apply()

        val result = HomeWidgetNativeAuthoritativeRefresh.complete(
            widgetPrefs = widgetPrefs,
            flutterPrefs = flutterPrefs,
            nowMs = nowMs,
            persistSnapshot = {},
            randomProvider = { event ->
                when (event.reason) {
                    "evolution_mutation" -> 0.05
                    "evolution_mutation_target" -> 0.0
                    "evolution" -> 0.0
                    else -> 1.0
                }
            },
        )
        val components = JSONObject(result.updatedRawWorldData!!)
            .getJSONArray("entities")
            .getJSONObject(0)
            .getJSONObject("components")
        val characterStatus = components.getJSONObject("characterStatus")
        val mutationRisk = components.getJSONObject("mutationRisk")

        assertTrue(result.succeeded)
        assertEquals(2, characterStatus.getInt("characterKey"))
        assertEquals(0, mutationRisk.getInt("unnecessaryInjectionStacks"))
        assertEquals(nowMs, mutationRisk.getLong("lastInjectionDetoxTime"))
    }

    @Test
    fun `native authoritative refresh pauses evolution gauge while sick or low stamina`() {
        val nowMs = 60 * 60 * 1000L

        fun runPausedCase(stamina: Double, statuses: String): HomeWidgetNativeAuthoritativeRefreshResult {
            val widgetPrefs = FakeSharedPreferences()
            val flutterPrefs = FakeSharedPreferences()
            flutterPrefs.edit()
                .putString(
                    HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY,
                    buildHomeWidgetCharacterWorldData(
                        lastEcsSaved = 0L,
                        stamina = stamina,
                        evolutionGage = 10.0,
                        statuses = statuses,
                        nextDiseaseCheckTime = nowMs + 60_000L,
                        nextNapCheckTime = nowMs + 60_000L,
                    ),
                )
                .apply()

            val result = HomeWidgetNativeAuthoritativeRefresh.complete(
                widgetPrefs = widgetPrefs,
                flutterPrefs = flutterPrefs,
                nowMs = nowMs,
                persistSnapshot = {},
                randomProvider = { 1.0 },
            )

            assertTrue(result.succeeded)
            val evolutionGage = JSONObject(result.updatedRawWorldData!!)
                .getJSONArray("entities")
                .getJSONObject(0)
                .getJSONObject("components")
                .getJSONObject("characterStatus")
                .getDouble("evolutionGage")
            assertEquals(10.0, evolutionGage, 0.0)
            return result
        }

        val sickResult = runPausedCase(stamina = 8.0, statuses = "[3]")
        val lowStaminaResult = runPausedCase(stamina = 2.5, statuses = "[]")

        assertEquals("sick", sickResult.evolutionDiagnostics?.blockReason)
        assertEquals(false, sickResult.evolutionDiagnostics?.evolutionGageIncreased)
        assertEquals("low_stamina", lowStaminaResult.evolutionDiagnostics?.blockReason)
        assertEquals(false, lowStaminaResult.evolutionDiagnostics?.evolutionGageIncreased)
    }

    @Test
    fun `native authoritative refresh writes sick status into padded empty status slot`() {
        val nowMs = 20_000L
        val widgetPrefs = FakeSharedPreferences()
        val flutterPrefs = FakeSharedPreferences()
        var persistedSnapshot: HomeWidgetSnapshot? = null

        flutterPrefs.edit()
            .putString(
                HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY,
                buildHomeWidgetCharacterWorldData(
                    state = 4,
                    lastEcsSaved = 0L,
                    stamina = 5.0,
                    nextDiseaseCheckTime = nowMs + 60_000L,
                    nextNapCheckTime = nowMs + 60_000L,
                    statuses = "[0,0,0,0]",
                    sickStartTime = 1L,
                ),
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

        assertTrue(result.succeeded)
        assertEquals("sick", persistedSnapshot?.characterState)
        assertEquals(listOf("sick"), persistedSnapshot?.visibleStatusIcons)
        assertTrue(updatedWorldData?.contains(""""state":4""") == true)
        assertTrue(updatedWorldData?.contains(""""statuses":[3,0,0,0]""") == true)
    }

    @Test
    fun `native authoritative refresh does not append sick status when status slots are full`() {
        val nowMs = 20_000L
        val widgetPrefs = FakeSharedPreferences()
        val flutterPrefs = FakeSharedPreferences()
        var persistedSnapshot: HomeWidgetSnapshot? = null

        flutterPrefs.edit()
            .putString(
                HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY,
                buildHomeWidgetCharacterWorldData(
                    state = 4,
                    lastEcsSaved = 0L,
                    stamina = 5.0,
                    nextDiseaseCheckTime = nowMs + 60_000L,
                    nextNapCheckTime = nowMs + 60_000L,
                    statuses = "[2,4,5,2]",
                    sickStartTime = 1L,
                ),
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

        assertTrue(result.succeeded)
        assertEquals("sick", persistedSnapshot?.characterState)
        assertEquals(listOf("sick"), persistedSnapshot?.visibleStatusIcons)
        assertTrue(updatedWorldData?.contains(""""state":4""") == true)
        assertTrue(updatedWorldData?.contains(""""statuses":[2,4,5,2]""") == true)
        assertFalse(updatedWorldData?.contains(""""statuses":[2,4,5,2,3]""") == true)
    }

    @Test
    fun `native authoritative refresh keeps sleeping sick status without natural recovery`() {
        val nowMs = 40 * 60 * 1000L
        val widgetPrefs = FakeSharedPreferences()
        val flutterPrefs = FakeSharedPreferences()
        var persistedSnapshot: HomeWidgetSnapshot? = null

        flutterPrefs.edit()
            .putString(
                HomeWidgetConstants.FLUTTER_WORLD_DATA_KEY,
                buildHomeWidgetCharacterWorldData(
                    state = 3,
                    lastEcsSaved = 0L,
                    stamina = 6.0,
                    fatigue = 28.0,
                    nextDiseaseCheckTime = nowMs + 60_000L,
                    nextNapCheckTime = nowMs + 60_000L,
                    sleepMode = 2,
                    statuses = "[3]",
                    sickStartTime = 1L,
                ),
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
        assertEquals("sleeping", persistedSnapshot?.characterState)
        assertEquals("sick", persistedSnapshot?.displayState)
        assertEquals(listOf("sick", "sleeping"), persistedSnapshot?.visibleStatusIcons)
        assertTrue(updatedWorldData?.contains(""""state":3""") == true)
        assertTrue(updatedWorldData?.contains(""""statuses":[3]""") == true)
        assertTrue(updatedWorldData?.contains(""""sickStartTime":1""") == true)
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
                buildHomeWidgetEggWorldData(
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
