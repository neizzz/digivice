import assert from "node:assert/strict";
import test from "node:test";
import { addComponent, addEntity, createWorld, hasComponent } from "bitecs";
import * as PIXI from "pixi.js";
import { StorageManager } from "../../../managers/StorageManager";
import {
  createTestCharacter,
  withMockedDateNow,
  withMockedRandom,
  withMockedRandomAsync,
} from "../../../test-utils/mainSceneTestUtils";
import { createMonsterBookCardInfo } from "../../MonsterBookScene/catalog";
import { hasReachedMonster } from "../monsterBook";
import {
  MONSTER_BOOK_STORAGE_KEY,
  migrateLegacyMonsterBookIfNeeded,
} from "../monsterBookStorage";
import {
  CharacterStatusComp,
  CleanableComp,
  DiseaseSystemComp,
  DestinationComp,
  FoodEatingComp,
  FreshnessComp,
  ObjectComp,
  PositionComp,
  RandomMovementComp,
  RenderComp,
  SleepSystemComp,
  SpeedComp,
  ThrowAnimationComp,
  VitalityComp,
} from "../raw-components";
import {
  CharacterKeyECS,
  CharacterStatus,
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
  type MainSceneWorldData,
  type MainSceneReentrySimulationSource,
  WORLD_DATA_STORAGE_KEY,
} from "../world";
import { GAME_CONSTANTS } from "../config";
import { foodEatingSystem } from "../systems/FoodEatingSystem";
import { resetCharacterManageSystemStateForTests } from "../systems/CharacterManageSystem";
import { TimeOfDay } from "../timeOfDay";

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
  applyPersistedWorldDataForReentry: (data: unknown) => void;
  _saveCurrentState: () => Promise<void>;
  _initializeData: (initialGameData: InitialGameData) => unknown;
  _applyPersistedMonsterBookState: (state: unknown) => void;
  _hasPlayableSavedData: (data: unknown) => boolean;
  _persistentData?: unknown;
  _isPersistenceDisabled?: boolean;
  _isRunningReentrySimulation?: boolean;
  _simulationTime?: number | null;
};

function createMainSceneWorld(options?: {
  trustedClock?: unknown;
  showAlert?: (message: string, title?: string) => void;
  locale?: ConstructorParameters<typeof MainSceneWorld>[0]["locale"];
  onReentrySimulationStateChange?: ConstructorParameters<
    typeof MainSceneWorld
  >[0]["onReentrySimulationStateChange"];
  onNativeWorldDataUpdateForReentry?: ConstructorParameters<
    typeof MainSceneWorld
  >[0]["onNativeWorldDataUpdateForReentry"];
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
    onNativeWorldDataUpdateForReentry:
      options?.onNativeWorldDataUpdateForReentry,
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

function hasCharacterStatus(eid: number, status: number): boolean {
  return Array.from(CharacterStatusComp.statuses[eid]).includes(status);
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

test("reset 후 새 world bootstrap은 persisted Monster Book state를 복원해 기존 reached monster를 다시 공개한다", async () => {
  const originalGetData = StorageManager.getData.bind(StorageManager);
  const originalRemoveData = StorageManager.removeData.bind(StorageManager);
  const seededMonsterBookState = {
    reached: {
      [CharacterKeyECS.GreenSlimeA1]: [
        {
          name: "초기 슬라임",
          reached_at: 1111,
          object_id: 1,
          source: "hatch" as const,
        },
      ],
      [CharacterKeyECS.GreenSlimeB1]: [
        {
          name: "진화 슬라임",
          reached_at: 2222,
          object_id: 2,
          source: "evolution" as const,
        },
      ],
    },
  };
  const storage = new Map<string, unknown>([
    [
      WORLD_DATA_STORAGE_KEY,
      {
        world_metadata: {
          monster_name: "Before Reset",
        },
        entities: [],
      },
    ],
    [MONSTER_BOOK_STORAGE_KEY, seededMonsterBookState],
  ]);

  (StorageManager as {
    getData: typeof StorageManager.getData;
    removeData: typeof StorageManager.removeData;
  }).getData = async (key) => {
    return (storage.has(key) ? storage.get(key)! : null) as never;
  };
  (StorageManager as {
    removeData: typeof StorageManager.removeData;
  }).removeData = async (key) => {
    storage.delete(key);
  };

  try {
    const resetWorld = {
      _persistentData: {
        world_metadata: {
          monster_name: "Before Reset",
        },
        entities: [],
      },
      _pendingStorageWrite: Promise.resolve(),
      _enqueueStorageWrite: MainSceneWorld.prototype["_enqueueStorageWrite"],
    } as unknown as MainSceneWorld & {
      _persistentData: unknown;
      _pendingStorageWrite: Promise<void>;
      _enqueueStorageWrite: (
        work: () => Promise<void>,
      ) => Promise<void>;
    };

    await MainSceneWorld.prototype.clearData.call(resetWorld);

    assert.equal(storage.has(WORLD_DATA_STORAGE_KEY), false);
    assert.deepEqual(storage.get(MONSTER_BOOK_STORAGE_KEY), seededMonsterBookState);

    const world = createMainSceneWorld();
    createWorld(world as any, 16);
    const loadedData = await world.getData();
    const monsterBookStorageState = await migrateLegacyMonsterBookIfNeeded(
      StorageManager,
      loadedData,
    );

    assert.equal(loadedData, null);
    assert.equal(world._hasPlayableSavedData(loadedData), false);

    const initialGameData = world._requireInitialGameData({
      name: "Reset Egg",
      useLocalTime: true,
      cachedSunTimes: null,
    });
    world._persistentData = world._initializeData(initialGameData);
    world._applyPersistedMonsterBookState(monsterBookStorageState.state);

    const restoredMonsterBookState =
      world.getInMemoryData().world_metadata.app_state?.monster_book;

    assert.equal(
      hasReachedMonster(restoredMonsterBookState, CharacterKeyECS.GreenSlimeA1),
      true,
    );
    assert.equal(
      hasReachedMonster(restoredMonsterBookState, CharacterKeyECS.GreenSlimeB1),
      true,
    );
    assert.equal(
      hasReachedMonster(restoredMonsterBookState, CharacterKeyECS.SkullSlimeA1),
      false,
    );

    const firstReachedCard = createMonsterBookCardInfo({
      characterKey: CharacterKeyECS.GreenSlimeA1,
      monsterBookState: restoredMonsterBookState!,
    });
    const secondReachedCard = createMonsterBookCardInfo({
      characterKey: CharacterKeyECS.GreenSlimeB1,
      monsterBookState: restoredMonsterBookState!,
    });
    const hiddenCard = createMonsterBookCardInfo({
      characterKey: CharacterKeyECS.SkullSlimeA1,
      monsterBookState: restoredMonsterBookState!,
    });

    assert.equal(firstReachedCard.isReached, true);
    assert.notEqual(firstReachedCard.details, null);
    assert.equal(secondReachedCard.isReached, true);
    assert.notEqual(secondReachedCard.details, null);
    assert.equal(hiddenCard.isReached, false);
    assert.equal(hiddenCard.details, null);
  } finally {
    (StorageManager as {
      getData: typeof StorageManager.getData;
      removeData: typeof StorageManager.removeData;
    }).getData = originalGetData;
    (StorageManager as {
      removeData: typeof StorageManager.removeData;
    }).removeData = originalRemoveData;
  }
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

function buildTrustedClock(nowRef: { value: number }) {
  const buildSnapshot = (time: number) => ({
    trustedUtcMs: time,
    osUptimeMs: time + 10_000,
    source: "ntp" as const,
    uncertaintyMs: 10,
    capturedWallMs: time,
  });

  return {
    refresh: async () => buildSnapshot(nowRef.value),
    now: () => nowRef.value,
    elapsedSince: (anchor: { trustedUtcMs: number }) => ({
      elapsedMs: Math.max(0, nowRef.value - anchor.trustedUtcMs),
      trusted: true,
      currentSnapshot: buildSnapshot(nowRef.value),
    }),
    captureAnchor: () => buildSnapshot(nowRef.value),
  };
}

function setupRunningStatusWorld(options?: {
  now?: number;
  lastActiveTime?: number;
  stamina?: number;
  state?: CharacterState;
  sick?: boolean;
  onNativeWorldDataUpdateForReentry?: ConstructorParameters<
    typeof MainSceneWorld
  >[0]["onNativeWorldDataUpdateForReentry"];
}): {
  world: TestableMainSceneWorld;
  eid: number;
  nowRef: { value: number };
} {
  resetCharacterManageSystemStateForTests();

  const nowRef = { value: options?.now ?? 1_000 };
  const trustedClock = buildTrustedClock(nowRef);
  const world = createMainSceneWorld({
    trustedClock,
    onNativeWorldDataUpdateForReentry:
      options?.onNativeWorldDataUpdateForReentry,
  });

  createWorld(world as any, 512);

  const eid = withMockedDateNow(nowRef.value, () =>
    createTestCharacter(world as any, {
      state: options?.state ?? CharacterState.IDLE,
      stamina: options?.stamina ?? 5,
      x: 160,
      y: 160,
    }),
  );

  if (options?.sick) {
    CharacterStatusComp.statuses[eid][0] = CharacterStatus.SICK;
    ObjectComp.state[eid] = CharacterState.SICK;
    DiseaseSystemComp.sickStartTime[eid] = nowRef.value;
  }

  world._findMainCharacterEntity = () => eid;
  world._isPersistenceDisabled = true;
  world._persistentData = {
    world_metadata: {
      name: "MainScene",
      monster_name: "Test",
      last_ecs_saved: options?.lastActiveTime ?? nowRef.value,
      version: "1.0.0",
      app_state: {
        last_active_time: options?.lastActiveTime ?? nowRef.value,
        last_active_time_anchor: {
          trustedUtcMs: options?.lastActiveTime ?? nowRef.value,
          osUptimeMs: (options?.lastActiveTime ?? nowRef.value) + 5_000,
          source: "ntp" as const,
          uncertaintyMs: 10,
          capturedWallMs: options?.lastActiveTime ?? nowRef.value,
        },
        is_first_load: false,
        use_local_time: true,
      },
    },
    entities: [],
  };

  return {
    world,
    eid,
    nowRef,
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

test("native reentry callback 이후 저장본이 sick이면 앱 ECS와 저장 상태도 sick를 유지한다", async () => {
  const lastActiveTime = 1_000;
  const nowRef = lastActiveTime + GAME_CONSTANTS.DISEASE_CHECK_INTERVAL;
  const buildSnapshot = () => ({
    trustedUtcMs: nowRef,
    osUptimeMs: nowRef + 10_000,
    source: "ntp" as const,
    uncertaintyMs: 10,
    capturedWallMs: nowRef,
  });
  const lastActiveAnchor = {
    trustedUtcMs: lastActiveTime,
    osUptimeMs: 10_000,
    source: "ntp" as const,
    uncertaintyMs: 10,
    capturedWallMs: lastActiveTime,
  };
  const trustedClock = {
    refresh: async () => buildSnapshot(),
    now: () => nowRef,
    elapsedSince: () => ({
      elapsedMs: nowRef - lastActiveTime,
      trusted: true,
      currentSnapshot: buildSnapshot(),
    }),
    captureAnchor: () => buildSnapshot(),
  };
  const originalGetData = StorageManager.getData.bind(StorageManager);
  const world = createMainSceneWorld({
    trustedClock,
    onNativeWorldDataUpdateForReentry: async () => ({
      status: "native_world_data_update_completed",
      worldDataChanged: true,
    }),
  });

  createWorld(world as any, 32);

  const storedWorldData: MainSceneWorldData = {
    world_metadata: {
      name: "MainScene",
      monster_name: "Test",
      last_ecs_saved: nowRef,
      version: "1.0.0",
      app_state: {
        last_active_time: lastActiveTime,
        last_active_time_anchor: lastActiveAnchor,
        is_first_load: false,
        use_local_time: true,
      },
    },
    entities: [
      {
        components: {
          object: {
            id: 303,
            type: ObjectType.CHARACTER,
            state: CharacterState.SICK,
          },
          characterStatus: {
            characterKey: CharacterKeyECS.GreenSlimeA1,
            stamina: 5,
            evolutionGage: 0,
            evolutionPhase: 1,
            statuses: [CharacterStatus.SICK],
          },
          position: {
            x: 160,
            y: 160,
          },
          diseaseSystem: {
            nextCheckTime: nowRef + GAME_CONSTANTS.DISEASE_CHECK_INTERVAL,
            sickStartTime: nowRef,
          },
        },
      },
    ],
  };

  world._persistentData = {
    ...storedWorldData,
    world_metadata: {
      ...storedWorldData.world_metadata,
      last_ecs_saved: lastActiveTime,
    },
    entities: [],
  };
  world._saveCurrentState = async () => {};

  (StorageManager as {
    getData: typeof StorageManager.getData;
  }).getData = async (key) => {
    return key === WORLD_DATA_STORAGE_KEY ? (storedWorldData as never) : null;
  };

  try {
    await world._processReentrySimulation("app_resume");
  } finally {
    (StorageManager as {
      getData: typeof StorageManager.getData;
    }).getData = originalGetData;
  }

  const reloadedEid = world._findMainCharacterEntity();

  assert.equal(ObjectComp.state[reloadedEid], CharacterState.SICK);
  assert.equal(hasCharacterStatus(reloadedEid, CharacterStatus.SICK), true);
  assert.equal(DiseaseSystemComp.sickStartTime[reloadedEid], nowRef);
  assert.equal((world as any)._entryStatusSuppression, null);
  assert.equal(
    world.getInMemoryData().entities[0]?.components.object?.state,
    CharacterState.SICK,
  );
  assert.deepEqual(
    world.getInMemoryData().entities[0]?.components.characterStatus?.statuses,
    [CharacterStatus.SICK],
  );
});

test("앱 복귀 reentry에서 새로 생긴 sleeping 상태는 즉시 노출하지 않고 자연 변화 뒤에만 다시 허용한다", async () => {
  const lastActiveTime = 0;
  let nowRef = GAME_CONSTANTS.NIGHT_SLEEP_MIN_DELAY + 1;
  const buildSnapshot = () => ({
    trustedUtcMs: nowRef,
    osUptimeMs: nowRef + 20_000,
    source: "ntp" as const,
    uncertaintyMs: 10,
    capturedWallMs: nowRef,
  });
  const trustedClock = {
    refresh: async () => buildSnapshot(),
    now: () => nowRef,
    elapsedSince: () => ({
      elapsedMs: nowRef - lastActiveTime,
      trusted: true,
      currentSnapshot: buildSnapshot(),
    }),
    captureAnchor: () => buildSnapshot(),
  };
  const world = createMainSceneWorld({ trustedClock });

  createWorld(world as any, 32);
  const eid = createTestCharacter(world as any, {
    state: CharacterState.IDLE,
    stamina: 5,
    x: 160,
    y: 160,
  });
  world._findMainCharacterEntity = () => eid;
  (world as any)._timeOfDay = TimeOfDay.Night;
  world._persistentData = {
    world_metadata: {
      name: "MainScene",
      monster_name: "Test",
      last_ecs_saved: lastActiveTime,
      version: "1.0.0",
      app_state: {
        last_active_time: lastActiveTime,
        last_active_time_anchor: {
          trustedUtcMs: lastActiveTime,
          osUptimeMs: 5_000,
          source: "ntp" as const,
          uncertaintyMs: 10,
          capturedWallMs: lastActiveTime,
        },
        is_first_load: false,
        use_local_time: true,
      },
    },
    entities: [],
  };
  world._saveCurrentState = async () => {};
  (world as any)._isPersistenceDisabled = true;

  await withMockedRandomAsync(0, async () => {
    await world._processReentrySimulation("app_resume");
  });

  assert.notEqual(ObjectComp.state[eid], CharacterState.SLEEPING);
  assert.equal(SleepSystemComp.sleepMode[eid], SleepMode.AWAKE);

  ObjectComp.state[eid] = CharacterState.MOVING;
  world.update(0);

  (world as any)._timeOfDay = TimeOfDay.Day;
  world.update(0);

  (world as any)._timeOfDay = TimeOfDay.Night;
  withMockedRandom(0, () => {
    world.update(0);
  });

  nowRef += GAME_CONSTANTS.NIGHT_SLEEP_MIN_DELAY;
  withMockedRandom(0, () => {
    world.update(0);
  });

  assert.equal(ObjectComp.state[eid], CharacterState.SLEEPING);
});

test("reentry는 투척 중이던 음식이 완료되면 landed 시각 상태로 정규화한다", async () => {
  const lastActiveTime = 3_000_000;
  const elapsedMs = 1_500;
  const currentTime = lastActiveTime + elapsedMs;
  const currentSnapshot = {
    trustedUtcMs: currentTime,
    osUptimeMs: 30_000,
    source: "ntp" as const,
    uncertaintyMs: 10,
    capturedWallMs: currentTime,
  };
  const lastActiveAnchor = {
    trustedUtcMs: lastActiveTime,
    osUptimeMs: 20_000,
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
  const foodEid = addEntity(world as any);
  addComponent(world as any, ObjectComp, foodEid);
  addComponent(world as any, PositionComp, foodEid);
  addComponent(world as any, RenderComp, foodEid);
  addComponent(world as any, FreshnessComp, foodEid);
  addComponent(world as any, ThrowAnimationComp, foodEid);

  ObjectComp.id[foodEid] = 30_000 + foodEid;
  ObjectComp.type[foodEid] = ObjectType.FOOD;
  ObjectComp.state[foodEid] = FoodState.BEING_THROWING;
  PositionComp.x[foodEid] = -120;
  PositionComp.y[foodEid] = 420;
  RenderComp.storeIndex[foodEid] = ECS_NULL_VALUE;
  RenderComp.textureKey[foodEid] = TextureKey.FOOD1;
  RenderComp.scale[foodEid] = 5;
  RenderComp.zIndex[foodEid] = 999_999;
  FreshnessComp.freshness[foodEid] = Freshness.NORMAL;
  ThrowAnimationComp.initialX[foodEid] = -120;
  ThrowAnimationComp.initialY[foodEid] = 420;
  ThrowAnimationComp.finalX[foodEid] = 180;
  ThrowAnimationComp.finalY[foodEid] = 140;
  ThrowAnimationComp.elapsedTime[foodEid] = 0;
  ThrowAnimationComp.isActive[foodEid] = 1;

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
      },
    },
    entities: [],
  };
  world._saveCurrentState = async () => {};

  await world._processReentrySimulation();

  assert.equal(hasComponent(world as any, ThrowAnimationComp, foodEid), false);
  assert.equal(ObjectComp.state[foodEid], FoodState.LANDED);
  assert.equal(PositionComp.x[foodEid], 180);
  assert.equal(PositionComp.y[foodEid], 140);
  assert.ok(Math.abs(RenderComp.scale[foodEid] - 1.4) < 1e-6);
  assert.equal(RenderComp.zIndex[foodEid], 0);
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

test("init/app_resume reentry는 native update 후 저장본을 다시 읽어 ECS에 반영하고 web simulator를 실행하지 않는다", async () => {
  const originalGetData = StorageManager.getData.bind(StorageManager);
  const originalSetData = StorageManager.setData.bind(StorageManager);
  const lastActiveTime = 1_000;
  const currentTime = 2_500;
  const currentSnapshot = {
    trustedUtcMs: currentTime,
    osUptimeMs: 12_500,
    source: "ntp" as const,
    uncertaintyMs: 10,
    capturedWallMs: currentTime,
  };
  const trustedClock = {
    refresh: async () => currentSnapshot,
    now: () => currentTime,
    elapsedSince: () => ({
      elapsedMs: currentTime - lastActiveTime,
      trusted: true,
      currentSnapshot,
    }),
    captureAnchor: () => currentSnapshot,
  };
  let nativeUpdateCalls = 0;
  const world = createMainSceneWorld({
    trustedClock,
    onNativeWorldDataUpdateForReentry: async (source) => {
      nativeUpdateCalls += 1;
      assert.equal(source, "app_resume");
      return {
        status: "native_authoritative_completion_completed",
        worldDataChanged: true,
        hatched: true,
        previousCharacterState: CharacterState.EGG,
        nextCharacterState: CharacterState.IDLE,
        selectedCharacterKey: CharacterKeyECS.GreenSlimeA1,
      };
    },
  });

  createWorld(world as any, 32);
  const staleEid = createTestCharacter(world as any, {
    state: CharacterState.EGG,
    stamina: 1,
    x: 40,
    y: 40,
  });
  ObjectComp.id[staleEid] = 101;
  world._createSimulationPipeline = () => {
    throw new Error("web simulator should not run for native reentry");
  };
  world._persistentData = {
    world_metadata: {
      name: "MainScene",
      monster_name: "Test",
      last_ecs_saved: lastActiveTime,
      version: "1.0.0",
      app_state: {
        last_active_time: lastActiveTime,
        last_active_time_anchor: {
          trustedUtcMs: lastActiveTime,
          osUptimeMs: 11_000,
          source: "ntp" as const,
          uncertaintyMs: 10,
          capturedWallMs: lastActiveTime,
        },
        is_first_load: false,
        use_local_time: true,
        suspend_food_interaction_until_reentry: true,
      },
    },
    entities: [],
  };

  const nativeUpdatedData = {
    world_metadata: {
      name: "MainScene",
      monster_name: "Test",
      last_ecs_saved: currentTime,
      version: "1.0.0",
      app_state: {
        last_active_time: currentTime,
        is_first_load: false,
        use_local_time: true,
        suspend_food_interaction_until_reentry: true,
      },
    },
    entities: [
      {
        components: {
          object: {
            id: 202,
            type: ObjectType.CHARACTER,
            state: CharacterState.IDLE,
          },
          characterStatus: {
            characterKey: CharacterKeyECS.GreenSlimeA1,
            stamina: 7,
            evolutionGage: 12,
            evolutionPhase: 1,
            statuses: [
              ECS_NULL_VALUE,
              ECS_NULL_VALUE,
              ECS_NULL_VALUE,
              ECS_NULL_VALUE,
            ],
          },
          position: {
            x: 160,
            y: 140,
          },
          render: {
            storeIndex: ECS_NULL_VALUE,
            textureKey: TextureKey.NULL,
            scale: 3,
            zIndex: ECS_NULL_VALUE,
          },
        },
      },
    ],
  };
  const writes: unknown[] = [];

  (StorageManager as {
    getData: typeof StorageManager.getData;
    setData: typeof StorageManager.setData;
  }).getData = async (key) => {
    return key === WORLD_DATA_STORAGE_KEY ? (nativeUpdatedData as never) : null;
  };
  (StorageManager as {
    setData: typeof StorageManager.setData;
  }).setData = async (_key, data) => {
    writes.push(data);
  };

  try {
    await world._processReentrySimulation("app_resume");
  } finally {
    (StorageManager as {
      getData: typeof StorageManager.getData;
      setData: typeof StorageManager.setData;
    }).getData = originalGetData;
    (StorageManager as {
      setData: typeof StorageManager.setData;
    }).setData = originalSetData;
  }

  const characterEid = world._findMainCharacterEntity();

  assert.equal(nativeUpdateCalls, 1);
  assert.equal(ObjectComp.id[characterEid], 202);
  assert.equal(ObjectComp.state[characterEid], CharacterState.IDLE);
  assert.equal(CharacterStatusComp.stamina[characterEid], 7);
  assert.equal(PositionComp.x[characterEid], 160);
  assert.equal(PositionComp.y[characterEid], 140);
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
  assert.equal(writes.length, 2);

  world._isPersistenceDisabled = true;
  resetCharacterManageSystemStateForTests();
  withMockedRandom(1, () => {
    withMockedDateNow(currentTime + GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL, () => {
      world.update(GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL);
    });
  });

  assert.equal(
    CharacterStatusComp.stamina[characterEid],
    7 - GAME_CONSTANTS.STAMINA_DECREASE_AMOUNT,
  );
  assert.equal(
    world.getInMemoryData().entities[0]?.components.characterStatus?.stamina,
    CharacterStatusComp.stamina[characterEid],
  );
});

test("init/app_resume reentry는 native callback이 없으면 failed로 끝나고 web simulator fallback을 실행하지 않는다", async () => {
  const events: Array<{
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
  let simulatorRequested = false;

  createWorld(world as any, 16);
  createTestCharacter(world as any, {
    state: CharacterState.IDLE,
    stamina: 5,
    x: 100,
    y: 100,
  });
  world._createSimulationPipeline = () => {
    simulatorRequested = true;
    throw new Error("web simulator should not be requested");
  };
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

  await world._processReentrySimulation("app_resume");

  assert.equal(simulatorRequested, false);
  assert.deepEqual(events, [
    {
      phase: "started",
      hasError: false,
    },
    {
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

test("앱 실행 중 update는 상태 시스템과 dataSyncSystem까지 도달해 스테미나와 저장본을 갱신한다", () => {
  const { world, eid, nowRef } = setupRunningStatusWorld({
    now: 10_000,
    stamina: 5,
  });

  nowRef.value += GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL;
  withMockedRandom(1, () => {
    withMockedDateNow(nowRef.value, () => {
      world.update(GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL);
    });
  });

  assert.equal(
    CharacterStatusComp.stamina[eid],
    5 - GAME_CONSTANTS.STAMINA_DECREASE_AMOUNT,
  );
  assert.equal(
    world.getInMemoryData().world_metadata.last_ecs_saved,
    nowRef.value,
  );
  assert.equal(
    world.getInMemoryData().entities[0]?.components.characterStatus?.stamina,
    CharacterStatusComp.stamina[eid],
  );
});

test("sick 상태에서는 진화 게이지가 멈추지만 스테미나와 저장본은 계속 갱신된다", () => {
  const { world, eid, nowRef } = setupRunningStatusWorld({
    now: 20_000,
    stamina: 5,
    sick: true,
  });
  const initialEvolutionGauge = CharacterStatusComp.evolutionGage[eid];

  nowRef.value += GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL;
  withMockedRandom(1, () => {
    withMockedDateNow(nowRef.value, () => {
      world.update(GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL);
    });
  });

  assert.equal(CharacterStatusComp.evolutionGage[eid], initialEvolutionGauge);
  assert.equal(
    CharacterStatusComp.stamina[eid],
    5 - GAME_CONSTANTS.STAMINA_DECREASE_AMOUNT,
  );
  assert.equal(
    world.getInMemoryData().entities[0]?.components.characterStatus?.stamina,
    CharacterStatusComp.stamina[eid],
  );
  assert.deepEqual(
    world.getInMemoryData().entities[0]?.components.characterStatus?.statuses,
    [CharacterStatus.SICK, ECS_NULL_VALUE, ECS_NULL_VALUE, ECS_NULL_VALUE],
  );
});

test("status heartbeat는 60초 간격으로 현재 상태와 last_ecs_saved age를 진단 로그에 남긴다", () => {
  const { world, eid, nowRef } = setupRunningStatusWorld({
    now: 30_000,
    stamina: 5,
  });
  const originalWarn = console.warn;
  const heartbeatLogs: unknown[][] = [];

  console.warn = (...args: unknown[]) => {
    if (args[0] === "[ImportantDiagnostics][MainSceneStatusHeartbeat]") {
      heartbeatLogs.push(args);
    }
  };

  try {
    withMockedRandom(1, () => {
      withMockedDateNow(nowRef.value, () => {
        world.update(0);
      });

      nowRef.value += 60_000 - 1;
      withMockedDateNow(nowRef.value, () => {
        world.update(0);
      });

      assert.equal(heartbeatLogs.length, 1);

      nowRef.value += 1;
      withMockedDateNow(nowRef.value, () => {
        world.update(0);
      });
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(heartbeatLogs.length, 2);
  assert.equal(
    heartbeatLogs[1][0],
    "[ImportantDiagnostics][MainSceneStatusHeartbeat]",
  );
  assert.deepEqual(heartbeatLogs[1][1], {
    isPaused: false,
    isRunningReentrySimulation: false,
    statusSystemsEnabled: true,
    delta: 0,
    currentTime: nowRef.value,
    lastEcsSaved: nowRef.value - 1,
    lastEcsSavedAgeMs: 1,
    mainCharacter: {
      eid,
      objectId: ObjectComp.id[eid],
      stamina: CharacterStatusComp.stamina[eid],
      evolutionGauge: CharacterStatusComp.evolutionGage[eid],
      statuses: [],
      state: ObjectComp.state[eid],
      stateName: CharacterState[ObjectComp.state[eid] as CharacterState],
    },
  });
});

test("native reentry 실패 후에도 런타임 reentry 상태를 복구하고 다음 update를 실행한다", async () => {
  const lastActiveTime = 40_000;
  const { world, eid, nowRef } = setupRunningStatusWorld({
    now: lastActiveTime + 1_000,
    lastActiveTime,
    stamina: 5,
    onNativeWorldDataUpdateForReentry: async () => {
      throw new Error("native callback failed");
    },
  });

  await world._processReentrySimulation("app_resume");

  assert.equal(world._isRunningReentrySimulation, false);
  assert.equal(world._simulationTime, null);

  nowRef.value += GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL;
  resetCharacterManageSystemStateForTests();
  withMockedRandom(1, () => {
    withMockedDateNow(nowRef.value, () => {
      world.update(GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL);
    });
  });

  assert.equal(
    CharacterStatusComp.stamina[eid],
    5 - GAME_CONSTANTS.STAMINA_DECREASE_AMOUNT,
  );
  assert.equal(
    world.getInMemoryData().entities[0]?.components.characterStatus?.stamina,
    CharacterStatusComp.stamina[eid],
  );
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
