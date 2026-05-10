import assert from "node:assert/strict";
import test from "node:test";
import { StorageManager } from "../../../managers/StorageManager";
import { FlappyBirdPerfDiagnostics } from "../diagnostics/flappyBirdPerfDiagnostics";

function mockStorage() {
  const originalGetData = StorageManager.getData.bind(StorageManager);
  const originalSetData = StorageManager.setData.bind(StorageManager);
  const writes: unknown[] = [];

  (StorageManager as {
    getData: typeof StorageManager.getData;
    setData: typeof StorageManager.setData;
  }).getData = async () => null;
  (StorageManager as {
    getData: typeof StorageManager.getData;
    setData: typeof StorageManager.setData;
  }).setData = async (_key, data) => {
    writes.push(data);
  };

  return {
    writes,
    restore() {
      (StorageManager as {
        getData: typeof StorageManager.getData;
        setData: typeof StorageManager.setData;
      }).getData = originalGetData;
      (StorageManager as {
        getData: typeof StorageManager.getData;
        setData: typeof StorageManager.setData;
      }).setData = originalSetData;
    },
  };
}

test("FlappyBirdPerfDiagnostics는 초 단위 집계와 느린 프레임/BGM spike를 기록한다", async () => {
  const storageMock = mockStorage();

  try {
    const diagnostics = new FlappyBirdPerfDiagnostics();
    diagnostics.startSession({
      screenWidth: 320,
      screenHeight: 480,
      startedAtMs: 1_000,
    });

    diagnostics.recordFrame({
      timestampMs: 1_000,
      deltaTimeMs: 16.7,
      updateCostMs: 5.2,
      tickerGapMs: 16.8,
      updateToRenderStartMs: 0.4,
      renderCostMs: 1.1,
      frameEndToEndCostMs: 6.7,
      gameState: "PLAYING",
      score: 2,
      activePipePairs: 3,
      cloudCount: 4,
      groundTileCount: 9,
      trackedPhysicsObjects: 8,
      syncedDisplayObjects: 1,
      spawnedPipes: 1,
      removedPipes: 0,
      isAppSuspended: false,
      documentHidden: false,
      phaseCosts: {
        pipeUpdate: 2.8,
        cloudUpdate: 0.9,
      },
      pipePhaseCosts: {
        spawnPlanning: 0.4,
        createPipePairDisplay: 1.2,
      },
      pipePoolStats: {
        pairCreated: 1,
        pairReused: 0,
        bodyCreated: 2,
        bodyReused: 0,
        poolMissCount: 1,
      },
    });
    diagnostics.recordPhysicsStep({
      timestampMs: 1_000,
      deltaMs: 16.7,
      engineUpdateCostMs: 1.4,
      syncDisplayCostMs: 0.3,
      totalCostMs: 1.7,
      trackedPhysicsObjects: 8,
      syncedDisplayObjects: 1,
    });
    diagnostics.recordBgmScheduleTick({
      timestampMs: 1_020,
      durationMs: 4.5,
      scheduledSteps: 2,
      scheduledVoices: 3,
    });
    diagnostics.recordFrame({
      timestampMs: 2_050,
      deltaTimeMs: 24.2,
      updateCostMs: 9.4,
      tickerGapMs: 24.2,
      updateToRenderStartMs: 0.6,
      renderCostMs: 10.8,
      frameEndToEndCostMs: 20.8,
      gameState: "PLAYING",
      score: 3,
      activePipePairs: 4,
      cloudCount: 5,
      groundTileCount: 9,
      trackedPhysicsObjects: 10,
      syncedDisplayObjects: 1,
      spawnedPipes: 0,
      removedPipes: 1,
      isAppSuspended: false,
      documentHidden: false,
      phaseCosts: {
        pipeUpdate: 5.8,
        groundUpdate: 1.1,
      },
      pipePhaseCosts: {
        moveExistingPipes: 3.6,
        recycleOrRemovePipes: 0.7,
      },
      pipePoolStats: {
        pairCreated: 0,
        pairReused: 1,
        bodyCreated: 0,
        bodyReused: 2,
        poolMissCount: 0,
      },
    });

    const snapshot = diagnostics.getSnapshot();
    const activeSession = snapshot.activeSession;

    assert.ok(activeSession);
    assert.equal(activeSession.summary.frameCount, 2);
    assert.equal(activeSession.summary.renderTimingSampleCount, 2);
    assert.equal(activeSession.summary.slowFrameCount, 1);
    assert.equal(activeSession.summary.renderDominantSlowFrameCount, 1);
    assert.equal(activeSession.summary.tickerGapDominantSlowFrameCount, 0);
    assert.equal(activeSession.summary.physicsStepCount, 1);
    assert.equal(activeSession.summary.bgmSpikeCount, 1);
    assert.equal(activeSession.scoreSummary.maxScore, 3);
    assert.equal(activeSession.summary.pipePairsCreated, 1);
    assert.equal(activeSession.summary.pipePairsReused, 1);
    assert.equal(activeSession.summary.pipeBodiesCreated, 2);
    assert.equal(activeSession.summary.pipeBodiesReused, 2);
    assert.equal(activeSession.summary.pipePoolMissCount, 1);
    assert.equal(activeSession.summary.maxTickerGapMs, 24.2);
    assert.equal(activeSession.summary.maxRenderCostMs, 10.8);
    assert.equal(activeSession.summary.maxFrameEndToEndCostMs, 20.8);
    assert.equal(activeSession.secondBuckets.length, 2);
    assert.equal(activeSession.secondBuckets[0]?.frameCount, 1);
    assert.equal(activeSession.secondBuckets[0]?.renderTimingSampleCount, 1);
    assert.equal(activeSession.secondBuckets[0]?.physicsStepCount, 1);
    assert.equal(activeSession.secondBuckets[0]?.bgmTickCount, 1);
    assert.equal(activeSession.secondBuckets[0]?.totalPipePairsCreated, 1);
    assert.equal(activeSession.secondBuckets[1]?.avgRenderCostMs, 10.8);
    assert.equal(activeSession.slowFrames.length, 1);
    assert.equal(activeSession.bgmSpikes.length, 1);
    assert.equal(activeSession.slowFrames[0]?.delayCause, "render");
    assert.equal(
      activeSession.slowFrames[0]?.pipePhaseCosts.moveExistingPipes,
      3.6,
    );
    assert.equal(activeSession.slowFrames[0]?.pipePoolStats.pairReused, 1);
    assert.equal(activeSession.slowFrames[0]?.renderCostMs, 10.8);
    assert.equal(activeSession.slowFrames[0]?.tickerGapMs, 24.2);
    assert.equal(activeSession.topTickerGapFrames[0]?.metric, "tickerGapMs");
    assert.equal(activeSession.topTickerGapFrames[0]?.metricValueMs, 24.2);
    assert.equal(activeSession.topRenderFrames[0]?.metric, "renderCostMs");
    assert.equal(activeSession.topRenderFrames[0]?.metricValueMs, 10.8);
    assert.equal(
      activeSession.topFrameEndToEndFrames[0]?.metricValueMs,
      20.8,
    );

    await diagnostics.finalizeSession("game_over");

    assert.equal(storageMock.writes.length, 1);
    assert.equal(diagnostics.getSnapshot().activeSession, null);
    assert.equal(
      diagnostics.getSnapshot().lastCompletedSession?.completionReason,
      "game_over",
    );
  } finally {
    storageMock.restore();
  }
});

test("FlappyBirdPerfDiagnostics는 느린 프레임 이벤트를 최근 20건만 유지한다", () => {
  const diagnostics = new FlappyBirdPerfDiagnostics();
  diagnostics.startSession({
    screenWidth: 320,
    screenHeight: 480,
    startedAtMs: 1_000,
  });

  for (let index = 0; index < 25; index += 1) {
    diagnostics.recordFrame({
      timestampMs: 1_000 + index * 1_000,
      deltaTimeMs: 25,
      updateCostMs: 9,
      gameState: "PLAYING",
      score: index,
      activePipePairs: 2,
      cloudCount: 3,
      groundTileCount: 8,
      trackedPhysicsObjects: 6,
      syncedDisplayObjects: 1,
      spawnedPipes: 0,
      removedPipes: 0,
      isAppSuspended: false,
      documentHidden: false,
      phaseCosts: {
        pipeUpdate: 4,
      },
      pipePhaseCosts: {
        moveExistingPipes: 2,
      },
      pipePoolStats: {
        pairCreated: 0,
        pairReused: 0,
        bodyCreated: 0,
        bodyReused: 0,
        poolMissCount: 0,
      },
    });
  }

  const activeSession = diagnostics.getSnapshot().activeSession;
  assert.ok(activeSession);
  assert.equal(activeSession.slowFrames.length, 20);
  assert.equal(activeSession.slowFrames[0]?.score, 5);
});

test("FlappyBirdPerfDiagnostics는 auto flush 비활성화 시 periodic flush timer를 잡지 않는다", () => {
  const diagnostics = new FlappyBirdPerfDiagnostics({
    enableAutoFlush: false,
  }) as FlappyBirdPerfDiagnostics & {
    _autoFlushTimeoutId: ReturnType<typeof setTimeout> | null;
  };

  diagnostics.startSession({
    screenWidth: 320,
    screenHeight: 480,
    startedAtMs: 1_000,
  });

  diagnostics.recordFrame({
    timestampMs: 1_000,
    deltaTimeMs: 25,
    updateCostMs: 9,
    gameState: "PLAYING",
    score: 1,
    activePipePairs: 2,
    cloudCount: 3,
    groundTileCount: 8,
    trackedPhysicsObjects: 6,
    syncedDisplayObjects: 1,
    spawnedPipes: 0,
    removedPipes: 0,
    isAppSuspended: false,
    documentHidden: false,
    phaseCosts: {
      pipeUpdate: 4,
    },
    pipePhaseCosts: {
      moveExistingPipes: 2,
    },
    pipePoolStats: {
      pairCreated: 0,
      pairReused: 0,
      bodyCreated: 0,
      bodyReused: 0,
      poolMissCount: 0,
    },
  });

  assert.equal(diagnostics._autoFlushTimeoutId, null);
});
