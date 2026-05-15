import assert from "node:assert/strict";
import test from "node:test";
import * as PIXI from "pixi.js";
import { Game } from "../Game";
import { SceneKey } from "../SceneKey";

test("changeScene는 loading 중 인터럽트 요청이 오면 이전 scene으로 복귀한다", async () => {
  const states: string[] = [];
  let onSceneReenterCalled = 0;
  let createSceneCalled = 0;

  const fakeGame: {
    currentSceneKey: SceneKey;
    currentScene: {
      onSceneExit: () => Promise<void>;
      onSceneReenter: () => Promise<void>;
      destroy: () => void;
    };
    _sceneTransitionRequestId: number;
    _pendingSceneTransitionInterruptions: Map<number, unknown>;
    _loadingTraceContext: null;
    _onSceneTransitionStateChange: (params: {
      state: "loading" | "interrupted";
    }) => void;
    _createScene: (key: SceneKey) => Promise<never>;
    app: {
      stage: {
        removeChildren: () => void;
        addChild: () => void;
      };
    };
  } = {
    currentSceneKey: SceneKey.MAIN,
    currentScene: {
      onSceneExit: async () => {
        Game.prototype.requestSceneTransitionInterruption.call(fakeGame, {
          requestId: 1,
          fallbackScene: SceneKey.MAIN,
          reason: "back_navigation",
        });
      },
      onSceneReenter: async () => {
        onSceneReenterCalled += 1;
      },
      destroy: () => {
        throw new Error("destroy should not be called when transition is interrupted");
      },
    },
    _sceneTransitionRequestId: 0,
    _pendingSceneTransitionInterruptions: new Map(),
    _loadingTraceContext: null,
    _onSceneTransitionStateChange: (params: {
      state: "loading" | "interrupted";
    }) => {
      states.push(params.state);
    },
    _createScene: async () => {
      createSceneCalled += 1;
      return {} as never;
    },
    app: {
      stage: {
        removeChildren: () => undefined,
        addChild: () => undefined,
      },
    },
  };

  const changed = await Game.prototype.changeScene.call(
    fakeGame as unknown as Game,
    SceneKey.FLAPPY_BIRD_GAME,
  );

  assert.equal(changed, false);
  assert.deepEqual(states, ["loading", "interrupted"]);
  assert.equal(onSceneReenterCalled, 1);
  assert.equal(createSceneCalled, 0);
  assert.equal(fakeGame.currentSceneKey, SceneKey.MAIN);
});

test("changeScene는 target scene 생성 중 인터럽트되면 이전 scene을 복구하고 새 scene은 폐기한다", async () => {
  const states: string[] = [];
  let onSceneReenterCalled = 0;
  let previousSceneDestroyed = 0;
  let createdSceneDestroyed = 0;
  let resolveCreatedScene: ((scene: {
    destroy: () => void;
  }) => void) | null = null;

  const stage = new PIXI.Container();
  const previousScene = Object.assign(new PIXI.Container(), {
    onSceneExit: async () => undefined,
    onSceneReenter: async () => {
      onSceneReenterCalled += 1;
    },
    destroy: () => {
      previousSceneDestroyed += 1;
    },
  });
  stage.addChild(previousScene);

  const fakeGame: {
    currentSceneKey: SceneKey;
    currentScene: typeof previousScene;
    _sceneTransitionRequestId: number;
    _pendingSceneTransitionInterruptions: Map<number, unknown>;
    _loadingTraceContext: null;
    _activeSceneTransition: unknown;
    _restoreParkedSceneAfterTransitionAbort: typeof Game.prototype["_restoreParkedSceneAfterTransitionAbort"];
    _applyTickerFramePolicy: typeof Game.prototype["_applyTickerFramePolicy"];
    _onSceneTransitionStateChange: (params: {
      state: "loading" | "interrupted";
    }) => void;
    _createScene: (key: SceneKey) => Promise<{
      destroy: () => void;
    }>;
    app: {
      stage: PIXI.Container;
      ticker: {
        minFPS: number;
        maxFPS: number;
      };
    };
  } = {
    currentSceneKey: SceneKey.MAIN,
    currentScene: previousScene,
    _sceneTransitionRequestId: 0,
    _pendingSceneTransitionInterruptions: new Map(),
    _loadingTraceContext: null,
    _activeSceneTransition: null,
    _restoreParkedSceneAfterTransitionAbort:
      Game.prototype["_restoreParkedSceneAfterTransitionAbort"],
    _applyTickerFramePolicy: Game.prototype["_applyTickerFramePolicy"],
    _onSceneTransitionStateChange: (params: {
      state: "loading" | "interrupted";
    }) => {
      states.push(params.state);
    },
    _createScene: async () =>
      await new Promise((resolve) => {
        resolveCreatedScene = resolve;
      }),
    app: {
      stage,
      ticker: {
        minFPS: 0,
        maxFPS: 0,
      },
    },
  };

  const changeScenePromise = Game.prototype.changeScene.call(
    fakeGame as unknown as Game,
    SceneKey.FLAPPY_BIRD_GAME,
  );

  await Promise.resolve();
  await Promise.resolve();

  const interrupted = Game.prototype.requestSceneTransitionInterruption.call(
    fakeGame as unknown as Game,
    {
      requestId: 1,
      fallbackScene: SceneKey.MAIN,
      reason: "back_navigation",
    },
  );

  assert.equal(interrupted, true);

  const createdScene = Object.assign(new PIXI.Container(), {
    destroy: () => {
      createdSceneDestroyed += 1;
    },
  });
  resolveCreatedScene?.(createdScene);

  const changed = await changeScenePromise;

  assert.equal(changed, false);
  assert.deepEqual(states, ["loading", "interrupted"]);
  assert.equal(onSceneReenterCalled, 1);
  assert.equal(previousSceneDestroyed, 0);
  assert.equal(createdSceneDestroyed, 1);
  assert.equal(fakeGame.currentSceneKey, SceneKey.MAIN);
  assert.equal(fakeGame.app.ticker.minFPS, 30);
  assert.equal(fakeGame.app.ticker.maxFPS, 60);
  assert.equal(stage.children.includes(previousScene), true);
  assert.equal(stage.children.includes(createdScene), false);
});

test("changeScene는 target scene 생성 실패 시 이전 scene을 복구한 뒤 failed 상태를 알린다", async () => {
  const states: string[] = [];
  let onSceneReenterCalled = 0;
  let previousSceneDestroyed = 0;

  const stage = new PIXI.Container();
  const previousScene = Object.assign(new PIXI.Container(), {
    onSceneExit: async () => undefined,
    onSceneReenter: async () => {
      onSceneReenterCalled += 1;
    },
    destroy: () => {
      previousSceneDestroyed += 1;
    },
  });
  stage.addChild(previousScene);

  const fakeGame: {
    currentSceneKey: SceneKey;
    currentScene: typeof previousScene;
    _sceneTransitionRequestId: number;
    _pendingSceneTransitionInterruptions: Map<number, unknown>;
    _loadingTraceContext: null;
    _activeSceneTransition: unknown;
    _restoreParkedSceneAfterTransitionAbort: typeof Game.prototype["_restoreParkedSceneAfterTransitionAbort"];
    _applyTickerFramePolicy: typeof Game.prototype["_applyTickerFramePolicy"];
    _onSceneTransitionStateChange: (params: {
      state: "loading" | "failed";
    }) => void;
    _createScene: (key: SceneKey) => Promise<never>;
    app: {
      stage: PIXI.Container;
      ticker: {
        minFPS: number;
        maxFPS: number;
      };
    };
  } = {
    currentSceneKey: SceneKey.MAIN,
    currentScene: previousScene,
    _sceneTransitionRequestId: 0,
    _pendingSceneTransitionInterruptions: new Map(),
    _loadingTraceContext: null,
    _activeSceneTransition: null,
    _restoreParkedSceneAfterTransitionAbort:
      Game.prototype["_restoreParkedSceneAfterTransitionAbort"],
    _applyTickerFramePolicy: Game.prototype["_applyTickerFramePolicy"],
    _onSceneTransitionStateChange: (params: {
      state: "loading" | "failed";
    }) => {
      states.push(params.state);
    },
    _createScene: async () => {
      throw new Error("create scene timed out");
    },
    app: {
      stage,
      ticker: {
        minFPS: 0,
        maxFPS: 0,
      },
    },
  };

  const changed = await Game.prototype.changeScene.call(
    fakeGame as unknown as Game,
    SceneKey.FLAPPY_BIRD_GAME,
  );

  assert.equal(changed, false);
  assert.deepEqual(states, ["loading", "failed"]);
  assert.equal(onSceneReenterCalled, 1);
  assert.equal(previousSceneDestroyed, 0);
  assert.equal(fakeGame.currentSceneKey, SceneKey.MAIN);
  assert.equal(fakeGame.app.ticker.minFPS, 30);
  assert.equal(fakeGame.app.ticker.maxFPS, 60);
  assert.equal(stage.children.includes(previousScene), true);
});

test("changeScene는 FlappyBird 진입 시 ticker 제한을 풀고 MainScene 복귀 시 60fps로 되돌린다", async () => {
  const stage = new PIXI.Container();
  let mainSceneDestroyed = 0;
  const initialScene = Object.assign(new PIXI.Container(), {
    destroy: () => {
      mainSceneDestroyed += 1;
    },
  });
  stage.addChild(initialScene);

  const createdScenes: PIXI.Container[] = [];
  const destroyedSceneIndexes: number[] = [];
  const fakeGame: {
    currentSceneKey: SceneKey;
    currentScene: PIXI.Container & { destroy: () => void };
    _sceneTransitionRequestId: number;
    _pendingSceneTransitionInterruptions: Map<number, unknown>;
    _loadingTraceContext: null;
    _activeSceneTransition: unknown;
    _applyTickerFramePolicy: typeof Game.prototype["_applyTickerFramePolicy"];
    _onSceneTransitionStateChange: () => void;
    _createScene: (
      key: SceneKey,
    ) => Promise<PIXI.Container & { destroy: () => void }>;
    app: {
      stage: PIXI.Container;
      ticker: {
        minFPS: number;
        maxFPS: number;
      };
    };
  } = {
    currentSceneKey: SceneKey.MAIN,
    currentScene: initialScene,
    _sceneTransitionRequestId: 0,
    _pendingSceneTransitionInterruptions: new Map(),
    _loadingTraceContext: null,
    _activeSceneTransition: null,
    _applyTickerFramePolicy: Game.prototype["_applyTickerFramePolicy"],
    _onSceneTransitionStateChange: () => undefined,
    _createScene: async () => {
      const sceneIndex = createdScenes.length;
      const scene = Object.assign(new PIXI.Container(), {
        destroy: () => {
          destroyedSceneIndexes.push(sceneIndex);
        },
      });
      createdScenes.push(scene);
      return scene;
    },
    app: {
      stage,
      ticker: {
        minFPS: 0,
        maxFPS: 60,
      },
    },
  };

  const changedToFlappyBird = await Game.prototype.changeScene.call(
    fakeGame as unknown as Game,
    SceneKey.FLAPPY_BIRD_GAME,
  );

  assert.equal(changedToFlappyBird, true);
  assert.equal(fakeGame.currentSceneKey, SceneKey.FLAPPY_BIRD_GAME);
  assert.equal(fakeGame.app.ticker.minFPS, 30);
  assert.equal(fakeGame.app.ticker.maxFPS, 0);
  assert.equal(mainSceneDestroyed, 1);

  const changedToMain = await Game.prototype.changeScene.call(
    fakeGame as unknown as Game,
    SceneKey.MAIN,
  );

  assert.equal(changedToMain, true);
  assert.equal(fakeGame.currentSceneKey, SceneKey.MAIN);
  assert.equal(fakeGame.app.ticker.minFPS, 30);
  assert.equal(fakeGame.app.ticker.maxFPS, 60);
  assert.equal(createdScenes.length, 2);
  assert.deepEqual(destroyedSceneIndexes, [0]);
});

test("initialize는 devicePixelRatio를 최대 렌더 해상도 2로 clamp한다", async () => {
  const hadWindow = "window" in globalThis;
  const originalWindow = (globalThis as { window?: unknown }).window;
  const fakeWindow = {
    devicePixelRatio: 3,
  };
  Object.defineProperty(globalThis, "window", {
    value: fakeWindow,
    configurable: true,
  });

  const initCalls: Array<Record<string, unknown>> = [];
  const appendChildCalls: unknown[] = [];
  const tickerStartCalls: string[] = [];
  const fakeApp = {
    init: async (options: Record<string, unknown>) => {
      initCalls.push(options);
    },
    renderer: { resolution: 2 },
    ticker: {
      minFPS: 0,
      maxFPS: 0,
      start: () => {
        tickerStartCalls.push("start");
      },
    },
    canvas: {},
  };

  const fakeGame: any = {
    app: fakeApp,
    _parentElement: {
      clientWidth: 320,
      clientHeight: 240,
      appendChild: (child: unknown) => {
        appendChildCalls.push(child);
      },
    },
    _isPixiReady: false,
    _applyTickerFramePolicy: Game.prototype["_applyTickerFramePolicy"],
    _onResize: () => undefined,
    _setupInitialScene: async () => undefined,
    _setupGameLoop: () => undefined,
    start: Game.prototype.start,
    _trustedClock: {
      initialize: async () => undefined,
    },
    assetsLoaded: false,
  };

  try {
    await Game.prototype.initialize.call(fakeGame as Game);
  } finally {
    if (hadWindow) {
      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        configurable: true,
      });
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }

  assert.equal(initCalls.length, 1);
  assert.equal(initCalls[0]?.resolution, 2);
  assert.equal(fakeGame._isPixiReady, true);
  assert.equal(fakeApp.ticker.minFPS, 30);
  assert.equal(fakeApp.ticker.maxFPS, 60);
  assert.equal(appendChildCalls.length, 1);
  assert.deepEqual(tickerStartCalls, ["start"]);
});

test("_onResize는 devicePixelRatio를 최대 렌더 해상도 2로 clamp한다", () => {
  const hadWindow = "window" in globalThis;
  const originalWindow = (globalThis as { window?: unknown }).window;
  const fakeWindow = {
    devicePixelRatio: 3,
  };
  Object.defineProperty(globalThis, "window", {
    value: fakeWindow,
    configurable: true,
  });

  const resizeCalls: Array<{ width: number; height: number }> = [];
  const sceneResizeCalls: Array<{ width: number; height: number }> = [];
  const fakeGame: any = {
    _parentElement: {
      clientWidth: 320,
      clientHeight: 240,
      getBoundingClientRect: () => ({ width: 320, height: 240 }),
    },
    _isPixiReady: true,
    _lastResizeMetricsKey: null,
    app: {
      renderer: {
        resolution: 1,
        resize: (width: number, height: number) => {
          resizeCalls.push({ width, height });
        },
      },
      stage: {
        scale: {
          x: 1,
          y: 1,
          set: () => undefined,
        },
      },
      screen: {
        width: 320,
        height: 240,
      },
    },
    currentScene: {
      resize: (width: number, height: number) => {
        sceneResizeCalls.push({ width, height });
      },
    },
  };

  try {
    Game.prototype["_onResize"].call(fakeGame as Game, "test");
  } finally {
    if (hadWindow) {
      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        configurable: true,
      });
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }

  assert.equal(fakeGame.app.renderer.resolution, 2);
  assert.deepEqual(resizeCalls, [{ width: 320, height: 240 }]);
  assert.deepEqual(sceneResizeCalls, [{ width: 320, height: 240 }]);
});
