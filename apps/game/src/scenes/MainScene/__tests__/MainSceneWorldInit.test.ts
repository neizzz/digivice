import assert from "node:assert/strict";
import test from "node:test";
import { addComponent, addEntity, createWorld, hasComponent } from "bitecs";
import * as PIXI from "pixi.js";
import {
  CharacterStatusComp,
  CleanableComp,
  DestinationComp,
  FoodEatingComp,
  FreshnessComp,
  ObjectComp,
  PositionComp,
  RandomMovementComp,
  RenderComp,
  SleepSystemComp,
  SpeedComp,
  VitalityComp,
} from "../raw-components";
import {
  CharacterKeyECS,
  CharacterState,
  DestinationType,
  FoodState,
  Freshness,
  ObjectType,
  SleepMode,
  TextureKey,
} from "../types";
import { ControlButtonType, type ControlButtonParams } from "../../../ui/types";
import {
  MainSceneWorld,
  MissingInitialGameDataError,
  type InitialGameData,
  type MainSceneReentrySimulationSource,
} from "../world";
import { GAME_CONSTANTS } from "../config";
import { foodEatingSystem } from "../systems/FoodEatingSystem";

type TestableMainSceneWorld = MainSceneWorld & {
  _requireInitialGameData: (
    initialGameData?: InitialGameData,
  ) => InitialGameData;
  _debugMode: boolean;
  _showAlert?: (message: string, title?: string) => void;
  _findMainCharacterEntity: () => number;
  _shouldBlockMiniGameEntry: () => boolean;
  _prepareMainCharacterForMiniGameEntry: () => void;
  _enterCleaningMode: () => boolean;
  _throwFood: () => number | null;
  _processReentrySimulation: (
    source?: MainSceneReentrySimulationSource,
  ) => Promise<void>;
  _createSimulationPipeline: () => unknown;
  _saveCurrentState: () => Promise<void>;
  _persistentData?: unknown;
  _simulationTime?: number | null;
};

function createMainSceneWorld(options?: {
  trustedClock?: unknown;
  showAlert?: (message: string, title?: string) => void;
  locale?: ConstructorParameters<typeof MainSceneWorld>[0]["locale"];
  onReentrySimulationStateChange?: ConstructorParameters<
    typeof MainSceneWorld
  >[0]["onReentrySimulationStateChange"];
}): TestableMainSceneWorld {
  return new MainSceneWorld({
    stage: new PIXI.Container(),
    positionBoundary: {
      x: 0,
      y: 0,
      width: 320,
      height: 320,
    },
    showAlert: options?.showAlert,
    locale: options?.locale,
    trustedClock: options?.trustedClock as never,
    onReentrySimulationStateChange:
      options?.onReentrySimulationStateChange,
  }) as TestableMainSceneWorld;
}

function createFoodEntity(
  world: TestableMainSceneWorld,
  options: { x: number; y: number; state?: FoodState } = { x: 100, y: 100 },
): number {
  const foodEid = addEntity(world as any);

  addComponent(world as any, ObjectComp, foodEid);
  addComponent(world as any, PositionComp, foodEid);
  addComponent(world as any, RenderComp, foodEid);
  addComponent(world as any, FreshnessComp, foodEid);
  ObjectComp.id[foodEid] = 10_000 + foodEid;
  ObjectComp.type[foodEid] = ObjectType.FOOD;
  ObjectComp.state[foodEid] = options.state ?? FoodState.LANDED;
  PositionComp.x[foodEid] = options.x;
  PositionComp.y[foodEid] = options.y;
  RenderComp.storeIndex[foodEid] = ECS_NULL_VALUE;
  RenderComp.textureKey[foodEid] = TextureKey.FOOD1;
  RenderComp.scale[foodEid] = 1.4;
  RenderComp.zIndex[foodEid] = ECS_NULL_VALUE;
  FreshnessComp.freshness[foodEid] = Freshness.NORMAL;

  return foodEid;
}

function createObjectEntity(
  world: TestableMainSceneWorld,
  type: ObjectType,
): number {
  const eid = addEntity(world as any);

  addComponent(world as any, ObjectComp, eid);
  ObjectComp.id[eid] = 20_000 + eid;
  ObjectComp.type[eid] = type;
  ObjectComp.state[eid] = 0;

  return eid;
}

test("초기 세팅 데이터가 없으면 setup 없이 기본 월드를 만들지 않는다", () => {
  const world = createMainSceneWorld();

  assert.throws(
    () => world._requireInitialGameData(),
    MissingInitialGameDataError,
  );
  assert.throws(
    () =>
      world._requireInitialGameData({
        name: "   ",
        useLocalTime: true,
      }),
    MissingInitialGameDataError,
  );
});

test("초기 세팅 데이터 이름은 정리된 값으로 사용한다", () => {
  const world = createMainSceneWorld();

  assert.deepEqual(
    world._requireInitialGameData({
      name: "  Toto  ",
      useLocalTime: false,
      cachedSunTimes: null,
    }),
    {
      name: "Toto",
      useLocalTime: false,
      cachedSunTimes: null,
    },
  );
});

test("egg 상태면 debug 모드가 아닐 때 미니게임 진입을 막고 alert를 띄운다", () => {
  const world = createMainSceneWorld();
  const alerts: Array<{ message: string; title?: string }> = [];
  const eid = 1;

  world._debugMode = false;
  world._showAlert = (message, title) => {
    alerts.push({ message, title });
  };
  world._findMainCharacterEntity = () => eid;
  ObjectComp.state[eid] = CharacterState.EGG;

  assert.equal(world._shouldBlockMiniGameEntry(), true);
  assert.deepEqual(alerts, [
    {
      message: "not available in egg state.",
      title: "Notice",
    },
  ]);
});

test("egg 상태면 debug 모드여도 미니게임 진입을 막고 alert를 띄운다", () => {
  const world = createMainSceneWorld();
  const alerts: Array<{ message: string; title?: string }> = [];
  const eid = 1;

  world._debugMode = true;
  world._showAlert = (message, title) => {
    alerts.push({ message, title });
  };
  world._findMainCharacterEntity = () => eid;
  ObjectComp.state[eid] = CharacterState.EGG;

  assert.equal(world._shouldBlockMiniGameEntry(), true);
  assert.deepEqual(alerts, [
    {
      message: "not available in egg state.",
      title: "Notice",
    },
  ]);
});

test("dead 상태면 debug 모드와 무관하게 미니게임 진입을 허용한다", () => {
  const world = createMainSceneWorld();
  const alerts: Array<{ message: string; title?: string }> = [];
  const eid = 1;

  world._debugMode = false;
  world._showAlert = (message, title) => {
    alerts.push({ message, title });
  };
  world._findMainCharacterEntity = () => eid;
  ObjectComp.state[eid] = CharacterState.DEAD;

  assert.equal(world._shouldBlockMiniGameEntry(), false);
  assert.deepEqual(alerts, []);
});

function setupReentryUntrustedClockWorld(
  reason: "clock_unavailable" | "reboot_detected",
): {
  world: TestableMainSceneWorld;
  eid: number;
  alerts: string[];
  getSaveCount: () => number;
} {
  const currentSnapshot = {
    trustedUtcMs: 1_600_000,
    osUptimeMs: 610_000,
    source: "ntp" as const,
    uncertaintyMs: 10,
    capturedWallMs: 1_600_000,
  };
  const lastActiveAnchor = {
    trustedUtcMs: 1_000_000,
    osUptimeMs: 10_000,
    source: "ntp" as const,
    uncertaintyMs: 10,
    capturedWallMs: 1_000_000,
  };
  const trustedClock = {
    refresh: async () => currentSnapshot,
    now: () => currentSnapshot.trustedUtcMs,
    elapsedSince: () => ({
      elapsedMs: 0,
      trusted: false,
      reason,
      currentSnapshot,
    }),
    captureAnchor: () => currentSnapshot,
  };
  const alerts: string[] = [];
  const world = createMainSceneWorld({
    trustedClock,
    showAlert: (message) => {
      alerts.push(message);
    },
  });

  createWorld(world as any, 16);
  const eid = addEntity(world as any);
  addComponent(world as any, ObjectComp, eid);
  addComponent(world as any, CharacterStatusComp, eid);
  ObjectComp.id[eid] = 1;
  ObjectComp.type[eid] = ObjectType.CHARACTER;
  ObjectComp.state[eid] = CharacterState.IDLE;

  world._persistentData = {
    world_metadata: {
      name: "MainScene",
      monster_name: "Test",
      last_ecs_saved: 1_000_000,
      version: "1.0.0",
      app_state: {
        last_active_time: 1_000_000,
        last_active_time_anchor: lastActiveAnchor,
        is_first_load: false,
        use_local_time: true,
        mini_game_scores: {
          flappy_bird: {
            best_score: 0,
          },
        },
      },
    },
    entities: [],
  };

  let saveCount = 0;
  world._saveCurrentState = async () => {
    saveCount += 1;
  };

  return {
    world,
    eid,
    alerts,
    getSaveCount: () => saveCount,
  };
}

test("수면 중 미니게임 진입 준비는 캐릭터를 깨우고 피로도와 스테미나 패널티를 적용한다", () => {
  const world = createMainSceneWorld();

  createWorld(world as any, 16);
  const eid = addEntity(world as any);
  addComponent(world as any, SleepSystemComp, eid);
  addComponent(world as any, CharacterStatusComp, eid);
  world._findMainCharacterEntity = () => eid;
  world._simulationTime = 5_000;
  ObjectComp.state[eid] = CharacterState.SLEEPING;
  SleepSystemComp.sleepMode[eid] = SleepMode.NIGHT_SLEEP;
  SleepSystemComp.fatigue[eid] = 35;
  CharacterStatusComp.stamina[eid] = 5;

  world._prepareMainCharacterForMiniGameEntry();

  assert.equal(ObjectComp.state[eid], CharacterState.IDLE);
  assert.equal(SleepSystemComp.sleepMode[eid], SleepMode.AWAKE);
  assert.equal(SleepSystemComp.fatigue[eid], 45);
  assert.equal(
    CharacterStatusComp.stamina[eid],
    5 - GAME_CONSTANTS.MINI_GAME_SLEEP_INTERRUPT_STAMINA,
  );
});

test("수면 중 미니게임 진입 준비는 스테미나를 0 아래로 내리지 않는다", () => {
  const world = createMainSceneWorld();

  createWorld(world as any, 16);
  const eid = addEntity(world as any);
  addComponent(world as any, SleepSystemComp, eid);
  addComponent(world as any, CharacterStatusComp, eid);
  world._findMainCharacterEntity = () => eid;
  world._simulationTime = 5_000;
  ObjectComp.state[eid] = CharacterState.SLEEPING;
  SleepSystemComp.sleepMode[eid] = SleepMode.NIGHT_SLEEP;
  SleepSystemComp.fatigue[eid] = 35;
  CharacterStatusComp.stamina[eid] = 0;

  world._prepareMainCharacterForMiniGameEntry();

  assert.equal(CharacterStatusComp.stamina[eid], 0);
});

test("미니게임 진입 준비는 이동 중이던 목표 음식을 LANDED로 되돌리고 목적지를 제거한다", () => {
  const world = createMainSceneWorld();

  createWorld(world as any, 16);
  const eid = addEntity(world as any);
  addComponent(world as any, ObjectComp, eid);
  addComponent(world as any, CharacterStatusComp, eid);
  addComponent(world as any, PositionComp, eid);
  addComponent(world as any, DestinationComp, eid);
  addComponent(world as any, SpeedComp, eid);
  ObjectComp.id[eid] = 1;
  ObjectComp.type[eid] = ObjectType.CHARACTER;
  ObjectComp.state[eid] = CharacterState.MOVING;
  CharacterStatusComp.stamina[eid] = 3;
  PositionComp.x[eid] = 50;
  PositionComp.y[eid] = 50;
  SpeedComp.value[eid] = 2;

  const foodEid = createFoodEntity(world, {
    x: 120,
    y: 120,
    state: FoodState.TARGETED,
  });
  DestinationComp.type[eid] = DestinationType.TARGETED;
  DestinationComp.target[eid] = foodEid;
  DestinationComp.x[eid] = 120;
  DestinationComp.y[eid] = 120;

  world._findMainCharacterEntity = () => eid;
  world._simulationTime = 5_000;
  world._persistentData = {
    world_metadata: {
      name: "MainScene",
      monster_name: "Test",
      last_ecs_saved: 1_000,
      version: "1.0.0",
      app_state: {
        last_active_time: 1_000,
        is_first_load: false,
        use_local_time: true,
      },
    },
    entities: [],
  };

  world._prepareMainCharacterForMiniGameEntry();

  assert.equal(ObjectComp.state[foodEid], FoodState.LANDED);
  assert.equal(hasComponent(world as any, DestinationComp, eid), false);
  assert.equal(ObjectComp.state[eid], CharacterState.IDLE);
  assert.equal(SpeedComp.value[eid], 0);
  assert.equal(hasComponent(world as any, RandomMovementComp, eid), true);
  assert.equal(
    (
      world._persistentData as {
        world_metadata: {
          app_state: { suspend_food_interaction_until_reentry?: boolean };
        };
      }
    ).world_metadata.app_state.suspend_food_interaction_until_reentry,
    true,
  );
});

test("미니게임 복귀 reentry는 수면 중단 후 깨어있는 상태로 피로도 경과를 적용한다", async () => {
  const lastActiveTime = 1_000_000;
  const elapsedMs = 2_000;
  const currentTime = lastActiveTime + elapsedMs;
  const currentSnapshot = {
    trustedUtcMs: currentTime,
    osUptimeMs: 3_610_000,
    source: "ntp" as const,
    uncertaintyMs: 10,
    capturedWallMs: currentTime,
  };
  const lastActiveAnchor = {
    trustedUtcMs: lastActiveTime,
    osUptimeMs: 10_000,
    source: "ntp" as const,
    uncertaintyMs: 10,
    capturedWallMs: lastActiveTime,
  };
  const trustedClock = {
    refresh: async () => currentSnapshot,
    now: () => currentTime,
    elapsedSince: () => ({
      elapsedMs,
      trusted: true,
      currentSnapshot,
    }),
    captureAnchor: () => currentSnapshot,
  };
  const world = createMainSceneWorld({ trustedClock });

  createWorld(world as any, 16);
  const eid = addEntity(world as any);
  addComponent(world as any, ObjectComp, eid);
  addComponent(world as any, CharacterStatusComp, eid);
  addComponent(world as any, PositionComp, eid);
  addComponent(world as any, SleepSystemComp, eid);
  ObjectComp.id[eid] = 1;
  ObjectComp.type[eid] = ObjectType.CHARACTER;
  ObjectComp.state[eid] = CharacterState.SLEEPING;
  PositionComp.x[eid] = 160;
  PositionComp.y[eid] = 160;
  CharacterStatusComp.characterKey[eid] = CharacterKeyECS.GreenSlimeA1;
  CharacterStatusComp.stamina[eid] = 5;
  SleepSystemComp.sleepMode[eid] = SleepMode.NIGHT_SLEEP;
  SleepSystemComp.fatigue[eid] = 35;
  world._findMainCharacterEntity = () => eid;
  world._simulationTime = lastActiveTime;

  world._prepareMainCharacterForMiniGameEntry();
  const fatigueAfterInterrupt = SleepSystemComp.fatigue[eid];

  world._simulationTime = null;
  world._persistentData = {
    world_metadata: {
      name: "MainScene",
      monster_name: "Test",
      last_ecs_saved: lastActiveTime,
      version: "1.0.0",
      app_state: {
        last_active_time: lastActiveTime,
        last_active_time_anchor: lastActiveAnchor,
        is_first_load: false,
        use_local_time: true,
        mini_game_scores: {
          flappy_bird: {
            best_score: 0,
          },
        },
      },
    },
    entities: [],
  };
  world._saveCurrentState = async () => {};

  await world._processReentrySimulation();

  assert.notEqual(ObjectComp.state[eid], CharacterState.SLEEPING);
  assert.equal(SleepSystemComp.sleepMode[eid], SleepMode.AWAKE);
  assert.ok(
    SleepSystemComp.fatigue[eid] > fatigueAfterInterrupt,
    `expected awake fatigue gain, before=${fatigueAfterInterrupt}, after=${SleepSystemComp.fatigue[eid]}`,
  );
});

test("미니게임 복귀 reentry는 음식 상호작용 suspend 플래그가 있으면 foodEatingSystem만 건너뛰고 이후 플래그를 지운다", async () => {
  const lastActiveTime = 2_000_000;
  const elapsedMs = 10_000;
  const currentTime = lastActiveTime + elapsedMs;
  const currentSnapshot = {
    trustedUtcMs: currentTime,
    osUptimeMs: 20_000,
    source: "ntp" as const,
    uncertaintyMs: 10,
    capturedWallMs: currentTime,
  };
  const lastActiveAnchor = {
    trustedUtcMs: lastActiveTime,
    osUptimeMs: 10_000,
    source: "ntp" as const,
    uncertaintyMs: 10,
    capturedWallMs: lastActiveTime,
  };
  const trustedClock = {
    refresh: async () => currentSnapshot,
    now: () => currentTime,
    elapsedSince: () => ({
      elapsedMs,
      trusted: true,
      currentSnapshot,
    }),
    captureAnchor: () => currentSnapshot,
  };
  const world = createMainSceneWorld({ trustedClock });

  createWorld(world as any, 16);
  const eid = addEntity(world as any);
  addComponent(world as any, ObjectComp, eid);
  addComponent(world as any, CharacterStatusComp, eid);
  addComponent(world as any, PositionComp, eid);
  ObjectComp.id[eid] = 1;
  ObjectComp.type[eid] = ObjectType.CHARACTER;
  ObjectComp.state[eid] = CharacterState.IDLE;
  PositionComp.x[eid] = 100;
  PositionComp.y[eid] = 100;
  CharacterStatusComp.characterKey[eid] = CharacterKeyECS.GreenSlimeA1;
  CharacterStatusComp.stamina[eid] = 3;

  const foodEid = createFoodEntity(world, { x: 112, y: 112 });
  world._persistentData = {
    world_metadata: {
      name: "MainScene",
      monster_name: "Test",
      last_ecs_saved: lastActiveTime,
      version: "1.0.0",
      app_state: {
        last_active_time: lastActiveTime,
        last_active_time_anchor: lastActiveAnchor,
        is_first_load: false,
        use_local_time: true,
        suspend_food_interaction_until_reentry: true,
      },
    },
    entities: [],
  };
  world._saveCurrentState = async () => {};

  await world._processReentrySimulation();

  assert.equal(hasComponent(world as any, ObjectComp, foodEid), true);
  assert.equal(ObjectComp.state[foodEid], FoodState.LANDED);
  if (hasComponent(world as any, DestinationComp, eid)) {
    assert.notEqual(DestinationComp.type[eid], DestinationType.TARGETED);
    assert.notEqual(DestinationComp.target[eid], foodEid);
  }
  assert.equal(hasComponent(world as any, FoodEatingComp, eid), false);
  assert.equal(
    (
      world._persistentData as {
        world_metadata: {
          app_state: { suspend_food_interaction_until_reentry?: boolean };
        };
      }
    ).world_metadata.app_state.suspend_food_interaction_until_reentry,
    undefined,
  );

  foodEatingSystem({
    world: world as any,
    delta: 0,
    currentTime,
  });

  assert.equal(ObjectComp.state[foodEid], FoodState.TARGETED);
  assert.equal(hasComponent(world as any, DestinationComp, eid), true);
  assert.equal(DestinationComp.target[eid], foodEid);
});

test("청소 모드 진입은 첫 타겟을 확정한 뒤 버튼을 한 번만 갱신한다", () => {
  const controlButtonCalls: Array<
    [ControlButtonParams, ControlButtonParams, ControlButtonParams]
  > = [];
  const world = new MainSceneWorld({
    stage: new PIXI.Container(),
    positionBoundary: {
      x: 0,
      y: 0,
      width: 320,
      height: 320,
    },
    changeControlButtons: (controlButtonParams) => {
      controlButtonCalls.push(controlButtonParams);
    },
  }) as TestableMainSceneWorld;

  createWorld(world as any, 16);
  controlButtonCalls.length = 0;

  const poopEid = addEntity(world as any);
  addComponent(world as any, ObjectComp, poopEid);
  addComponent(world as any, PositionComp, poopEid);
  ObjectComp.type[poopEid] = ObjectType.POOB;
  PositionComp.x[poopEid] = 80;
  PositionComp.y[poopEid] = 120;

  assert.equal(world._enterCleaningMode(), true);

  assert.equal(world.focusedTargetEid, poopEid);
  assert.equal(hasComponent(world as any, CleanableComp, poopEid), true);
  assert.equal(controlButtonCalls.length, 1);
  assert.deepEqual(
    controlButtonCalls[0].map((button) => button.type),
    [ControlButtonType.Cancel, ControlButtonType.Clean, ControlButtonType.Clean],
  );
  assert.equal(controlButtonCalls[0][1].hasCleaningTarget, true);
  assert.equal(controlButtonCalls[0][2].hasCleaningTarget, true);
});

test("reentry 상태 콜백은 앱 복귀 시뮬레이션 시작과 skip 완료를 알린다", async () => {
  const events: Array<{
    source: string;
    phase: string;
    result?: string;
  }> = [];
  const world = createMainSceneWorld({
    onReentrySimulationStateChange: (event) => {
      const nextEvent = {
        source: event.source,
        phase: event.phase,
      };
      if (event.result !== undefined) {
        events.push({ ...nextEvent, result: event.result });
        return;
      }
      events.push(nextEvent);
    },
  });

  await world._processReentrySimulation("app_resume");

  assert.deepEqual(events, [
    {
      source: "app_resume",
      phase: "started",
    },
    {
      source: "app_resume",
      phase: "finished",
      result: "skipped",
    },
  ]);
});

test("reentry 상태 콜백은 시뮬레이션 실패 후에도 완료를 알린다", async () => {
  const events: Array<{
    source: string;
    phase: string;
    result?: string;
    hasError: boolean;
  }> = [];
  const trustedClock = {
    refresh: async () => null,
    now: () => 2_000,
    elapsedSince: () => null,
    captureAnchor: () => null,
  };
  const world = createMainSceneWorld({
    trustedClock,
    onReentrySimulationStateChange: (event) => {
      const nextEvent = {
        source: event.source,
        phase: event.phase,
        hasError: event.error !== undefined,
      };
      if (event.result !== undefined) {
        events.push({ ...nextEvent, result: event.result });
        return;
      }
      events.push(nextEvent);
    },
  });

  world._persistentData = {
    world_metadata: {
      app_state: {
        last_active_time: 1_000,
      },
    },
    entities: [],
  };
  world._createSimulationPipeline = () => () => {
    throw new Error("simulation pipeline failed");
  };

  await world._processReentrySimulation("app_resume");

  assert.deepEqual(events, [
    {
      source: "app_resume",
      phase: "started",
      hasError: false,
    },
    {
      source: "app_resume",
      phase: "finished",
      result: "failed",
      hasError: true,
    },
  ]);
});

test("reentry는 trusted clock이 불가해도 패널티 없이 저장만 수행한다", async () => {
  const { world, eid, alerts, getSaveCount } = setupReentryUntrustedClockWorld(
    "clock_unavailable",
  );

  await world._processReentrySimulation();

  assert.deepEqual(alerts, []);
  assert.equal(ObjectComp.state[eid], CharacterState.IDLE);
  assert.equal(hasComponent(world as any, VitalityComp, eid), false);
  assert.equal(getSaveCount(), 1);
});

test("reentry는 reboot 추정만으로는 시간 조작 패널티를 주지 않는다", async () => {
  const { world, eid, alerts, getSaveCount } = setupReentryUntrustedClockWorld(
    "reboot_detected",
  );

  await world._processReentrySimulation();

  assert.deepEqual(alerts, []);
  assert.equal(ObjectComp.state[eid], CharacterState.IDLE);
  assert.equal(hasComponent(world as any, VitalityComp, eid), false);
  assert.equal(getSaveCount(), 1);
});

test("food가 최대 개수에 도달하면 새 food 생성 대신 한국어 alert를 띄운다", () => {
  const alerts: Array<{ message: string; title?: string }> = [];
  const world = createMainSceneWorld({
    locale: "ko",
    showAlert: (message, title) => {
      alerts.push({ message, title });
    },
  });

  createWorld(world as any, 128);
  for (let i = 0; i < GAME_CONSTANTS.MAX_ACTIVE_FOOD_COUNT; i += 1) {
    createFoodEntity(world, {
      x: 32 + i,
      y: 64,
    });
  }

  const foodEid = world._throwFood();

  assert.equal(foodEid, null);
  assert.deepEqual(alerts, [
    {
      message: "최대 객체 개수에 도달했습니다.\n청소 후 다시 시도해 주세요.",
      title: "알림",
    },
  ]);
});

test("총 object가 최대 개수에 도달하면 시도마다 alert를 다시 띄운다", () => {
  const alerts: Array<{ message: string; title?: string }> = [];
  const world = createMainSceneWorld({
    locale: "ko",
    showAlert: (message, title) => {
      alerts.push({ message, title });
    },
  });

  createWorld(world as any, 128);
  for (let i = 0; i < GAME_CONSTANTS.MAX_ACTIVE_OBJECT_COUNT; i += 1) {
    createObjectEntity(world, ObjectType.POOB);
  }

  assert.equal(world._throwFood(), null);
  assert.equal(world._throwFood(), null);
  assert.equal(
    world.getActiveObjectCountByType(),
    GAME_CONSTANTS.MAX_ACTIVE_OBJECT_COUNT,
  );
  assert.deepEqual(alerts, [
    {
      message: "최대 객체 개수에 도달했습니다.\n청소 후 다시 시도해 주세요.",
      title: "알림",
    },
    {
      message: "최대 객체 개수에 도달했습니다.\n청소 후 다시 시도해 주세요.",
      title: "알림",
    },
  ]);
});
