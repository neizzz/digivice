import assert from "node:assert/strict";
import test from "node:test";
import { FlappyBirdGameScene } from "../index";
import { GameState } from "../models";

function createSceneHarness(
  overrides: Record<string, unknown> = {},
): {
  scene: any;
  callLog: string[];
} {
  const callLog: string[] = [];
  const scene: any = Object.create(FlappyBirdGameScene.prototype);

  scene.gameState = GameState.PLAYING;
  scene.isAppSuspended = false;
  scene.isSettingsMenuOpen = false;
  scene.isReturningToMain = false;
  scene.pausedStateBeforePause = null;
  scene.boundVisibilityChangeHandler = () => undefined;
  scene.gameEngine = {
    pause: () => callLog.push("engine.pause"),
    resume: () => callLog.push("engine.resume"),
  };
  scene.playerManager = {
    stopAnimation: () => callLog.push("player.stopAnimation"),
    startAnimation: () => callLog.push("player.startAnimation"),
    update: () => callLog.push("player.update"),
    clampBasketBottomTo: (_maxBottomY: number) =>
      callLog.push("player.clampBasketBottomTo"),
    getBirdPositionSnapshot: () => {
      callLog.push("player.getBirdPositionSnapshot");
      return { x: 100, y: 120 };
    },
    getLastStableBirdPositionSnapshot: () => {
      callLog.push("player.getLastStableBirdPositionSnapshot");
      return { x: 100, y: 120 };
    },
    setBirdPosition: (_position: { x: number; y: number }) =>
      callLog.push("player.setBirdPosition"),
  };
  scene.physicsManager = {
    syncDisplayObjects: () => callLog.push("physics.syncDisplayObjects"),
    setupDebugRenderer: () => callLog.push("physics.setupDebugRenderer"),
  };
  scene.bgmController = {
    pause: () => callLog.push("bgm.pause"),
    resumeIfAvailable: () => {
      callLog.push("bgm.resumeIfAvailable");
      return Promise.resolve();
    },
  };
  scene.showSettingsMenu = () => {
    callLog.push("menu.show");
  };

  Object.assign(scene, overrides);

  return { scene, callLog };
}

test("앱이 hidden 되면 PLAYING 상태가 app suspend pause로 전환된다", () => {
  const { scene, callLog } = createSceneHarness();

  scene.handleDocumentHidden();

  assert.equal(scene.gameState, GameState.PAUSED);
  assert.equal(scene.isAppSuspended, true);
  assert.equal(scene.pausedStateBeforePause, GameState.PLAYING);
  assert.deepEqual(callLog, [
    "engine.pause",
    "player.stopAnimation",
    "physics.syncDisplayObjects",
    "player.update",
    "bgm.pause",
  ]);
});

test("앱 복귀 후 resume하면 PLAYING 상태와 오디오/애니메이션이 복원된다", async () => {
  const { scene, callLog } = createSceneHarness();

  scene.handleDocumentHidden();
  callLog.length = 0;

  scene.handleDocumentVisible();

  assert.equal(scene.isSettingsMenuOpen, true);
  assert.deepEqual(callLog, ["menu.show"]);

  callLog.length = 0;
  scene.isSettingsMenuOpen = false;
  scene.resumeGame();
  await Promise.resolve();

  assert.equal(scene.gameState, GameState.PLAYING);
  assert.equal(scene.isAppSuspended, false);
  assert.equal(scene.pausedStateBeforePause, null);
  assert.deepEqual(callLog, [
    "engine.resume",
    "player.startAnimation",
    "physics.syncDisplayObjects",
    "player.update",
    "bgm.resumeIfAvailable",
  ]);
});

test("COUNTDOWN 중 suspend 후 resume하면 countdown 상태로 복원된다", () => {
  const { scene, callLog } = createSceneHarness({
    gameState: GameState.COUNTDOWN,
  });

  scene.handleDocumentHidden();
  assert.equal(scene.pausedStateBeforePause, GameState.COUNTDOWN);

  callLog.length = 0;
  scene.resumeGame();

  assert.equal(scene.gameState, GameState.COUNTDOWN);
  assert.equal(scene.isAppSuspended, false);
  assert.equal(scene.pausedStateBeforePause, null);
  assert.deepEqual(callLog, [
    "engine.pause",
    "player.stopAnimation",
    "physics.syncDisplayObjects",
    "player.update",
    "bgm.pause",
  ]);
});

test("COUNTDOWN 중 settings를 열면 countdown pause 상태로 전환한 뒤 메뉴를 표시한다", () => {
  const { scene, callLog } = createSceneHarness({
    gameState: GameState.COUNTDOWN,
  });

  scene.openSettingsMenu();

  assert.equal(scene.gameState, GameState.PAUSED);
  assert.equal(scene.pausedStateBeforePause, GameState.COUNTDOWN);
  assert.equal(scene.isSettingsMenuOpen, true);
  assert.deepEqual(callLog, [
    "engine.pause",
    "player.stopAnimation",
    "physics.syncDisplayObjects",
    "player.update",
    "bgm.pause",
    "menu.show",
  ]);
});

test("READY, PAUSED, GAME_OVER 상태에서는 hidden 처리로 추가 pause를 걸지 않는다", () => {
  for (const state of [GameState.READY, GameState.PAUSED, GameState.GAME_OVER]) {
    const { scene, callLog } = createSceneHarness({
      gameState: state,
      isAppSuspended: false,
      pausedStateBeforePause: null,
    });

    scene.handleDocumentHidden();

    assert.equal(scene.gameState, state);
    assert.equal(scene.isAppSuspended, false);
    assert.equal(scene.pausedStateBeforePause, null);
    assert.deepEqual(callLog, []);
  }
});

test("game over 진입 시 마지막 플레이어 표시 상태를 즉시 동기화한다", async () => {
  const { scene, callLog } = createSceneHarness();

  scene.resetSimulationAccumulator = () => {
    callLog.push("resetSimulationAccumulator");
  };
  scene.hideSettingsMenu = () => {
    callLog.push("hideSettingsMenu");
  };
  scene.countdownUI = {
    hide: () => callLog.push("countdown.hide"),
  };
  scene.triggerGameOverVibrationPattern = () => {
    callLog.push("triggerGameOverVibrationPattern");
  };
  scene.flushPendingFrameDiagnostics = () => {
    callLog.push("flushPendingFrameDiagnostics");
  };
  scene.perfDiagnostics = {
    finalizeSession: () => {
      callLog.push("perf.finalizeSession");
      return Promise.resolve();
    },
  };
  scene.scoreUI = {
    getScore: () => 23,
    getBestScore: () => 42,
  };
  scene.game = {
    isDebugModeEnabled: () => false,
    showFlappyBirdGameOver: () => {
      callLog.push("game.showFlappyBirdGameOver");
    },
  };

  scene.handleGameOver();
  await Promise.resolve();

  assert.equal(scene.gameState, GameState.GAME_OVER);
  assert.deepEqual(callLog, [
    "resetSimulationAccumulator",
    "engine.pause",
    "hideSettingsMenu",
    "countdown.hide",
    "player.stopAnimation",
    "physics.syncDisplayObjects",
    "player.update",
    "bgm.pause",
    "triggerGameOverVibrationPattern",
    "flushPendingFrameDiagnostics",
    "perf.finalizeSession",
    "game.showFlappyBirdGameOver",
  ]);
});

test("debug mode 빌드에서는 collision debug overlay를 자동으로 켠다", () => {
  const { scene, callLog } = createSceneHarness();

  scene.game = {
    app: {},
    isDebugModeEnabled: () => true,
  };

  scene.maybeEnableCollisionDebugOverlay();

  assert.deepEqual(callLog, ["physics.setupDebugRenderer"]);
});

test("non-debug 빌드에서는 collision debug overlay를 자동으로 켜지 않는다", () => {
  const { scene, callLog } = createSceneHarness();

  scene.game = {
    app: {},
    isDebugModeEnabled: () => false,
  };

  scene.maybeEnableCollisionDebugOverlay();

  assert.deepEqual(callLog, []);
});

test("ground 충돌 game over는 basket을 ground top에 맞춘 뒤 표시 상태를 동기화한다", async () => {
  const { scene, callLog } = createSceneHarness();

  scene.resetSimulationAccumulator = () => {
    callLog.push("resetSimulationAccumulator");
  };
  scene.hideSettingsMenu = () => {
    callLog.push("hideSettingsMenu");
  };
  scene.countdownUI = {
    hide: () => callLog.push("countdown.hide"),
  };
  scene.triggerGameOverVibrationPattern = () => {
    callLog.push("triggerGameOverVibrationPattern");
  };
  scene.flushPendingFrameDiagnostics = () => {
    callLog.push("flushPendingFrameDiagnostics");
  };
  scene.perfDiagnostics = {
    finalizeSession: () => Promise.resolve(),
  };
  scene.scoreUI = {
    getScore: () => 23,
    getBestScore: () => 42,
  };
  scene.groundManager = {
    getBody: () => ({
      bounds: {
        min: { y: 464 },
      },
    }),
  };
  scene.game = {
    showFlappyBirdGameOver: () => {
      callLog.push("game.showFlappyBirdGameOver");
    },
  };

  scene.handleGameOver("ground");
  await Promise.resolve();

  assert.deepEqual(callLog, [
    "player.getLastStableBirdPositionSnapshot",
    "resetSimulationAccumulator",
    "engine.pause",
    "hideSettingsMenu",
    "countdown.hide",
    "player.clampBasketBottomTo",
    "player.stopAnimation",
    "physics.syncDisplayObjects",
    "player.update",
    "player.setBirdPosition",
    "bgm.pause",
    "triggerGameOverVibrationPattern",
    "flushPendingFrameDiagnostics",
    "game.showFlappyBirdGameOver",
  ]);
});

test("app suspend 중 update는 gameplay 진행을 멈춘다", () => {
  const calls: string[] = [];
  const scene: any = Object.create(FlappyBirdGameScene.prototype);

  scene.initialized = true;
  scene.isAppSuspended = true;
  scene.gameState = GameState.PAUSED;
  scene.syncSkyState = () => {
    calls.push("syncSkyState");
  };
  scene.nearMissUI = {
    update: () => calls.push("nearMissUI.update"),
  };
  scene.playerManager = {
    update: () => calls.push("playerManager.update"),
  };
  scene.cloudManager = {
    update: () => calls.push("cloudManager.update"),
  };
  scene.pipeManager = {
    update: () => {
      calls.push("pipeManager.update");
      return { spawned: 0, removed: 0 };
    },
  };
  scene.groundManager = {
    update: () => calls.push("groundManager.update"),
  };
  scene.countdownUI = {
    getCurrentDisplayValue: () => 0,
    update: () => {
      calls.push("countdownUI.update");
      return false;
    },
  };
  scene.bgmController = {
    playCountdownCue: () => Promise.resolve(),
  };
  scene.maybeLogSlowFrame = () => {
    calls.push("maybeLogSlowFrame");
  };

  scene.update(16);

  assert.deepEqual(calls, ["syncSkyState"]);
});

test("pipe 이동 중 충돌이 발생하면 같은 프레임에서 ground 이동을 더 진행하지 않는다", () => {
  const calls: string[] = [];
  const scene: any = Object.create(FlappyBirdGameScene.prototype);

  scene.initialized = true;
  scene.isAppSuspended = false;
  scene.gameState = GameState.PLAYING;
  scene.simulationAccumulatorMs = 0;
  scene.measurePhase = (
    _phaseCosts: Record<string, number>,
    _phaseKey: string,
    work: () => unknown,
  ) => work();
  scene.syncSkyState = () => {
    calls.push("syncSkyState");
  };
  scene.nearMissUI = {
    update: () => calls.push("nearMissUI.update"),
  };
  scene.playerManager = {
    update: () => calls.push("playerManager.update"),
    checkCollisions: () => calls.push("playerManager.checkCollisions"),
    getBasketBody: () => ({ label: "basket" }),
  };
  scene.cloudManager = {
    update: () => calls.push("cloudManager.update"),
  };
  scene.pipeManager = {
    update: (
      _playerBody: unknown,
      _onScoreUpdate: (scoreDelta: number) => void,
      _deltaTime: number,
      onPlayerCollision?: () => void,
    ) => {
      calls.push("pipeManager.update");
      onPlayerCollision?.();
      return {
        spawned: 0,
        removed: 0,
        phaseCosts: {},
        poolStats: {
          pairCreated: 0,
          pairReused: 0,
          bodyCreated: 0,
          bodyReused: 0,
          poolMissCount: 0,
        },
      };
    },
  };
  scene.groundManager = {
    update: () => calls.push("groundManager.update"),
  };
  scene.recordFrameDiagnostics = () => {
    calls.push("recordFrameDiagnostics");
  };
  scene.handleGameOver = () => {
    calls.push("handleGameOver");
    scene.gameState = GameState.GAME_OVER;
  };

  scene.update(16.7);

  assert.deepEqual(calls, [
    "syncSkyState",
    "nearMissUI.update",
    "playerManager.update",
    "cloudManager.update",
    "playerManager.checkCollisions",
    "pipeManager.update",
    "handleGameOver",
    "recordFrameDiagnostics",
  ]);
});

test("PLAYING 상태에서는 큰 delta를 고정 스텝 2회로 쪼개서 처리한다", () => {
  const pipeDeltaTimes: number[] = [];
  const groundDeltaTimes: number[] = [];
  const cloudDeltaTimes: number[] = [];
  const nearMissDeltaTimes: number[] = [];
  const scene: any = Object.create(FlappyBirdGameScene.prototype);

  scene.initialized = true;
  scene.isAppSuspended = false;
  scene.gameState = GameState.PLAYING;
  scene.simulationAccumulatorMs = 0;
  scene.measurePhase = (
    _phaseCosts: Record<string, number>,
    _phaseKey: string,
    work: () => unknown,
  ) => work();
  scene.syncSkyState = () => undefined;
  scene.nearMissUI = {
    update: (deltaTime: number) => nearMissDeltaTimes.push(deltaTime),
  };
  scene.playerManager = {
    update: () => undefined,
    checkCollisions: () => undefined,
    getBasketBody: () => ({ label: "basket" }),
  };
  scene.cloudManager = {
    update: (deltaTime: number) => cloudDeltaTimes.push(deltaTime),
  };
  scene.pipeManager = {
    update: (
      _playerBody: unknown,
      _onScoreUpdate: (scoreDelta: number) => void,
      deltaTime: number,
    ) => {
      pipeDeltaTimes.push(deltaTime);
      return {
        spawned: 0,
        removed: 0,
        phaseCosts: {},
        poolStats: {
          pairCreated: 0,
          pairReused: 0,
          bodyCreated: 0,
          bodyReused: 0,
          poolMissCount: 0,
        },
      };
    },
  };
  scene.groundManager = {
    update: (deltaTime: number) => groundDeltaTimes.push(deltaTime),
  };
  scene.recordFrameDiagnostics = () => undefined;

  scene.update(50);

  assert.equal(pipeDeltaTimes.length, 2);
  assert.equal(groundDeltaTimes.length, 2);
  assert.equal(cloudDeltaTimes.length, 2);
  assert.equal(nearMissDeltaTimes.length, 2);

  for (const deltaTime of pipeDeltaTimes) {
    assert.ok(Math.abs(deltaTime - 1000 / 60) < 0.01);
  }
});

test("cleanupVisibilityChangeHandler는 visibilitychange listener를 제거한다", () => {
  const { scene } = createSceneHarness();
  const originalDocument = globalThis.document;

  if (!originalDocument) {
    return;
  }

  const removed: Array<[string, EventListenerOrEventListenerObject]> = [];
  const originalRemoveEventListener = originalDocument.removeEventListener.bind(
    originalDocument,
  );

  originalDocument.removeEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ) => {
    removed.push([type, listener]);
    return originalRemoveEventListener(type, listener, options);
  }) as typeof document.removeEventListener;

  try {
    scene.cleanupVisibilityChangeHandler();
  } finally {
    originalDocument.removeEventListener = originalRemoveEventListener;
  }

  assert.deepEqual(removed, [["visibilitychange", scene.boundVisibilityChangeHandler]]);
});
