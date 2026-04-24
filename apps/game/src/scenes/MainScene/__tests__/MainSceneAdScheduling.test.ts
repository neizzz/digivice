import assert from "node:assert/strict";
import test from "node:test";
import * as PIXI from "pixi.js";
import {
  MainSceneWorld,
  type MainSceneAdMenu,
  type MainSceneWorldData,
} from "../world";
import { TimeOfDayMode, type SunTimesPayload } from "../timeOfDay";
import { withMockedDateNow } from "../../../test-utils/mainSceneTestUtils";

type MainSceneAdRequest = {
  menu: MainSceneAdMenu;
  cooldownMs: number;
  threshold: number;
  queuedAt: number;
  deepNight: boolean;
  menuUseCount: number;
};

type TestableMainSceneWorld = MainSceneWorld & {
  _persistentData?: MainSceneWorldData;
  _isPersistenceDisabled: boolean;
  _timeOfDayMode: TimeOfDayMode;
  _sunTimes: SunTimesPayload | null;
  _pendingFeedAdFoodEid: number | null;
  _recordMainSceneMenuUse: (menu: MainSceneAdMenu) => unknown;
  _schedulePendingMainSceneAdForMenu: (
    menu: MainSceneAdMenu,
    delayMs?: number,
  ) => void;
};

type MockTimer = {
  id: number;
  delayMs: number;
  callback: () => void;
};

function createMainSceneWorld(): TestableMainSceneWorld {
  const world = new MainSceneWorld({
    stage: new PIXI.Container(),
    positionBoundary: {
      x: 0,
      y: 0,
      width: 320,
      height: 320,
    },
  }) as TestableMainSceneWorld;

  world._isPersistenceDisabled = true;
  world._persistentData = {
    world_metadata: {
      name: "MainScene",
      monster_name: "test",
      last_ecs_saved: 0,
      version: world.VERSION,
      app_state: {
        last_active_time: 0,
        is_first_load: false,
        use_local_time: true,
        main_scene_ad: {
          menu_use_count: 0,
        },
      },
    },
    entities: [],
  };

  return world;
}

function installMockBrowserEnv(options: {
  requestMainSceneMenuAd?: (request: MainSceneAdRequest) => Promise<boolean>;
}): {
  timers: MockTimer[];
  runNextTimer: () => void;
  cleanup: () => void;
} {
  const originalWindow = (globalThis as { window?: unknown }).window;
  const originalDocument = (globalThis as { document?: unknown }).document;
  const timers: MockTimer[] = [];
  let nextTimerId = 1;

  (globalThis as { window?: unknown }).window = {
    digiviceAdBridge: options.requestMainSceneMenuAd
      ? {
          requestMainSceneMenuAd: options.requestMainSceneMenuAd,
        }
      : undefined,
    setTimeout(callback: () => void, delayMs: number) {
      const id = nextTimerId++;
      timers.push({ id, delayMs, callback });
      return id;
    },
    clearTimeout(id: number) {
      const index = timers.findIndex((timer) => timer.id === id);
      if (index >= 0) {
        timers.splice(index, 1);
      }
    },
  };
  (globalThis as { document?: unknown }).document = {
    hidden: false,
  };

  return {
    timers,
    runNextTimer: () => {
      const timer = timers.shift();
      assert.ok(timer, "expected a pending timer");
      timer.callback();
    },
    cleanup: () => {
      (globalThis as { window?: unknown }).window = originalWindow;
      (globalThis as { document?: unknown }).document = originalDocument;
    },
  };
}

async function flushAsyncTasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

function getAdState(world: TestableMainSceneWorld) {
  return world._persistentData?.world_metadata.app_state?.main_scene_ad;
}

test("MainScene 메뉴 광고는 일반 시간에 5회째 예약하고 성공 노출 후 카운트를 초기화한다", async () => {
  const world = createMainSceneWorld();
  const requests: MainSceneAdRequest[] = [];
  const browser = installMockBrowserEnv({
    requestMainSceneMenuAd: async (request) => {
      requests.push(request);
      return true;
    },
  });

  try {
    withMockedDateNow(10_000, () => {
      for (let i = 0; i < 4; i++) {
        world._recordMainSceneMenuUse("clean");
      }
    });

    assert.equal(getAdState(world)?.menu_use_count, 4);
    assert.equal(getAdState(world)?.pending, undefined);

    withMockedDateNow(11_000, () => {
      world._recordMainSceneMenuUse("clean");
    });

    assert.equal(getAdState(world)?.menu_use_count, 5);
    assert.equal(getAdState(world)?.pending?.menu, "clean");
    assert.equal(getAdState(world)?.pending?.threshold, 5);
    assert.equal(getAdState(world)?.pending?.cooldown_ms, 5 * 60 * 1000);
    assert.equal(getAdState(world)?.pending?.deep_night, false);

    world._schedulePendingMainSceneAdForMenu("clean", 200);
    assert.equal(browser.timers.length, 1);
    assert.equal(browser.timers[0].delayMs, 200);

    browser.runNextTimer();
    await flushAsyncTasks();

    assert.equal(requests.length, 1);
    assert.equal(requests[0].menu, "clean");
    assert.equal(requests[0].threshold, 5);
    assert.equal(requests[0].cooldownMs, 5 * 60 * 1000);
    assert.equal(requests[0].menuUseCount, 5);
    assert.equal(getAdState(world)?.menu_use_count, 0);
    assert.equal(getAdState(world)?.pending, undefined);
  } finally {
    browser.cleanup();
  }
});

test("MainScene 메뉴 광고는 심야 시간에 10회 기준과 1시간 쿨다운을 사용한다", () => {
  const world = createMainSceneWorld();
  world._timeOfDayMode = TimeOfDayMode.Auto;
  world._sunTimes = {
    sunriseAt: "2026-04-24T06:00:00.000Z",
    sunsetAt: "2026-04-24T18:00:00.000Z",
    date: "2026-04-24",
    timezone: "UTC",
    timezoneOffsetMinutes: 0,
    fetchedAt: "2026-04-24T00:00:00.000Z",
    locationSource: "fallback",
    hasLocationPermission: false,
  };

  const deepNightTime = Date.parse("2026-04-24T23:00:00.000Z");
  withMockedDateNow(deepNightTime, () => {
    for (let i = 0; i < 9; i++) {
      world._recordMainSceneMenuUse("hospital");
    }
  });

  assert.equal(getAdState(world)?.menu_use_count, 9);
  assert.equal(getAdState(world)?.pending, undefined);
  withMockedDateNow(deepNightTime, () => {
    assert.equal(world.getMainSceneAdDebugState().threshold, 10);
    assert.equal(world.getMainSceneAdDebugState().deepNight, true);
  });

  withMockedDateNow(deepNightTime, () => {
    world._recordMainSceneMenuUse("hospital");
  });

  assert.equal(getAdState(world)?.pending?.menu, "hospital");
  assert.equal(getAdState(world)?.pending?.threshold, 10);
  assert.equal(getAdState(world)?.pending?.cooldown_ms, 60 * 60 * 1000);
  assert.equal(getAdState(world)?.pending?.deep_night, true);
});

test("먹이 메뉴 광고 예약은 음식 착지 후 fallback 지연을 거쳐 안전 시점에 요청된다", async () => {
  const world = createMainSceneWorld();
  const requests: MainSceneAdRequest[] = [];
  const browser = installMockBrowserEnv({
    requestMainSceneMenuAd: async (request) => {
      requests.push(request);
      return false;
    },
  });

  try {
    withMockedDateNow(20_000, () => {
      for (let i = 0; i < 5; i++) {
        world._recordMainSceneMenuUse("feed");
      }
    });
    world._pendingFeedAdFoodEid = 123;

    world.handleThrownFoodLanded(123);

    assert.equal(browser.timers.length, 1);
    assert.equal(browser.timers[0].delayMs, 3000);

    browser.runNextTimer();
    assert.equal(browser.timers.length, 1);
    assert.equal(browser.timers[0].delayMs, 200);

    browser.runNextTimer();
    await flushAsyncTasks();

    assert.equal(requests.length, 1);
    assert.equal(requests[0].menu, "feed");
    assert.equal(getAdState(world)?.menu_use_count, 5);
    assert.equal(getAdState(world)?.pending?.menu, "feed");
  } finally {
    browser.cleanup();
  }
});
