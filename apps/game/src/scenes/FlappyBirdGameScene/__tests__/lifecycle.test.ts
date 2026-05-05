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
  };
  scene.physicsManager = {
    syncDisplayObjects: () => callLog.push("physics.syncDisplayObjects"),
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
    "player.update",
    "physics.syncDisplayObjects",
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
    "player.update",
    "physics.syncDisplayObjects",
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
    "player.update",
    "physics.syncDisplayObjects",
    "bgm.pause",
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
