import assert from "node:assert/strict";
import test from "node:test";
import { addComponent, addEntity, createWorld, hasComponent } from "bitecs";
import * as PIXI from "pixi.js";
import {
  CharacterStatusComp,
  CleanableComp,
  ObjectComp,
  PositionComp,
  SleepSystemComp,
  VitalityComp,
} from "../raw-components";
import {
  CharacterKeyECS,
  CharacterState,
  ObjectType,
  SleepMode,
} from "../types";
import { ControlButtonType, type ControlButtonParams } from "../../../ui/types";
import {
  MainSceneWorld,
  MissingInitialGameDataError,
  type InitialGameData,
} from "../world";
import { GAME_CONSTANTS } from "../config";

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
  _processReentrySimulation: () => Promise<void>;
  _saveCurrentState: () => Promise<void>;
  _persistentData?: unknown;
  _simulationTime?: number | null;
};

function createMainSceneWorld(options?: {
  trustedClock?: unknown;
  showAlert?: (message: string, title?: string) => void;
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
    trustedClock: options?.trustedClock as never,
  }) as TestableMainSceneWorld;
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
