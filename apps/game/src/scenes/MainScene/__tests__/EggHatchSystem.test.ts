import assert from "node:assert/strict";
import test from "node:test";
import { addComponent, addEntity } from "bitecs";
import {
  CharacterStatusComp,
  EggHatchComp,
  FreshnessComp,
  FreshnessTimerComp,
  ObjectComp,
} from "../raw-components";
import { GAME_CONSTANTS } from "../config";
import { applySavedEntityToECS, convertECSEntityToSavedEntity } from "../entityDataHelpers";
import { eggHatchSystem } from "../systems/EggHatchSystem";
import { freshnessSystem } from "../systems/FreshnessSystem";
import {
  CharacterKeyECS,
  CharacterState,
  FoodState,
  Freshness,
  ObjectType,
} from "../types";
import {
  createTestCharacter,
  createTestWorld,
  mockLoadedSpritesheetAliases,
  withMockedDateNow,
  withMockedRandom,
} from "../../../test-utils/mainSceneTestUtils";

function addFood(world: ReturnType<typeof createTestWorld>, freshness: Freshness): number {
  const eid = addEntity(world);

  addComponent(world, ObjectComp, eid);
  ObjectComp.id[eid] = 100_000 + eid;
  ObjectComp.type[eid] = ObjectType.FOOD;
  ObjectComp.state[eid] = FoodState.LANDED;

  addComponent(world, FreshnessComp, eid);
  FreshnessComp.freshness[eid] = freshness;

  return eid;
}

function addFoodWithTimer(
  world: ReturnType<typeof createTestWorld>,
  params: {
    freshness: Freshness;
    createdTime: number;
    normalTime?: number;
    staleTime?: number;
  },
): number {
  const eid = addFood(world, params.freshness);

  addComponent(world, FreshnessTimerComp, eid);
  FreshnessTimerComp.createdTime[eid] = params.createdTime;
  FreshnessTimerComp.normalTime[eid] =
    params.normalTime ?? GAME_CONSTANTS.FRESH_TO_NORMAL_TIME;
  FreshnessTimerComp.staleTime[eid] =
    params.staleTime ?? GAME_CONSTANTS.NORMAL_TO_STALE_TIME;
  FreshnessTimerComp.isBeingEaten[eid] = 0;

  return eid;
}

test("EggHatchSystem은 부화 시점의 STALE 음식 수로 soil 선택 구간을 늘린다", () => {
  const world = createTestWorld({ now: 0, isSimulationMode: true });
  const eggEid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.EGG,
    }),
  );
  EggHatchComp.hatchTime[eggEid] = 0;

  for (let i = 0; i < 10; i++) {
    addFood(world, Freshness.STALE);
  }
  addFood(world, Freshness.NORMAL);

  const restoreSpritesheet = mockLoadedSpritesheetAliases(["soil-slime_A1"]);
  try {
    withMockedRandom(0.46, () => {
      eggHatchSystem({
        world: world as any,
        currentTime: 0,
      });
    });
  } finally {
    restoreSpritesheet();
  }

  assert.equal(ObjectComp.state[eggEid], CharacterState.IDLE);
  assert.equal(
    CharacterStatusComp.characterKey[eggEid],
    CharacterKeyECS.SoilSlimeA1,
  );
  assert.equal(CharacterStatusComp.evolutionPhase[eggEid], 1);
});

test("EggHatchSystem은 egg syringeCount로 skull 선택 구간을 늘린다", () => {
  const world = createTestWorld({ now: 0, isSimulationMode: true });
  const eggEid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.EGG,
    }),
  );
  EggHatchComp.hatchTime[eggEid] = 0;
  EggHatchComp.syringeCount[eggEid] = 10;

  const restoreSpritesheet = mockLoadedSpritesheetAliases(["skull-slime_A1"]);
  try {
    withMockedRandom(0.7, () => {
      eggHatchSystem({
        world: world as any,
        currentTime: 0,
      });
    });
  } finally {
    restoreSpritesheet();
  }

  assert.equal(ObjectComp.state[eggEid], CharacterState.IDLE);
  assert.equal(
    CharacterStatusComp.characterKey[eggEid],
    CharacterKeyECS.SkullSlimeA1,
  );
  assert.equal(CharacterStatusComp.evolutionPhase[eggEid], 1);
});

test("EggHatchSystem은 부화 시점에 생성 후 10분이 지난 음식만 stale 개수에 포함한다", () => {
  const currentTime = GAME_CONSTANTS.NORMAL_TO_STALE_TIME;
  const world = createTestWorld({ now: currentTime, isSimulationMode: true });
  const eggEid = withMockedDateNow(currentTime, () =>
    createTestCharacter(world, {
      state: CharacterState.EGG,
    }),
  );
  EggHatchComp.hatchTime[eggEid] = currentTime;

  for (let i = 0; i < 9; i++) {
    addFoodWithTimer(world, {
      freshness: Freshness.NORMAL,
      createdTime: 0,
    });
  }

  const recentFoodEid = addFoodWithTimer(world, {
    freshness: Freshness.NORMAL,
    createdTime: 1,
  });

  freshnessSystem({
    world: world as any,
    currentTime,
  });

  assert.equal(FreshnessComp.freshness[recentFoodEid], Freshness.NORMAL);

  const restoreSpritesheet = mockLoadedSpritesheetAliases(["green-slime_A1"]);
  try {
    withMockedRandom(0.46, () => {
      eggHatchSystem({
        world: world as any,
        currentTime,
      });
    });
  } finally {
    restoreSpritesheet();
  }

  assert.equal(ObjectComp.state[eggEid], CharacterState.IDLE);
  assert.equal(
    CharacterStatusComp.characterKey[eggEid],
    CharacterKeyECS.GreenSlimeA1,
  );
  assert.equal(CharacterStatusComp.evolutionPhase[eggEid], 1);
});

test("EggHatchSystem은 asset 지연과 저장/복원 이후에도 최초 pending 부화 결과를 재사용한다", () => {
  const currentTime = 5_000;
  const world = createTestWorld({ now: currentTime, isSimulationMode: true });
  const eggEid = withMockedDateNow(currentTime, () =>
    createTestCharacter(world, {
      state: CharacterState.EGG,
    }),
  );
  EggHatchComp.hatchTime[eggEid] = currentTime;

  for (let i = 0; i < 10; i++) {
    addFood(world, Freshness.STALE);
  }

  const originalWarn = console.warn;
  let selectionLogCount = 0;
  console.warn = (...args: unknown[]) => {
    if (args[0] === "[ImportantDiagnostics][EggHatchSelection]") {
      selectionLogCount += 1;
    }
    originalWarn(...args);
  };

  try {
    withMockedRandom(0.46, () => {
      eggHatchSystem({
        world: world as any,
        currentTime,
      });
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(ObjectComp.state[eggEid], CharacterState.EGG);
  assert.equal(EggHatchComp.isReadyToHatch[eggEid], 1);
  assert.equal(
    EggHatchComp.pendingCharacterKey[eggEid],
    CharacterKeyECS.SoilSlimeA1,
  );
  assert.equal(selectionLogCount, 1);

  const savedEntity = convertECSEntityToSavedEntity(world, eggEid);
  assert.equal(
    savedEntity.components.eggHatch?.pendingCharacterKey,
    CharacterKeyECS.SoilSlimeA1,
  );

  const restoredWorld = createTestWorld({
    now: currentTime,
    isSimulationMode: true,
  });
  const restoredEid = addEntity(restoredWorld);
  withMockedDateNow(currentTime, () => {
    applySavedEntityToECS(restoredWorld, restoredEid, savedEntity);
  });

  const restoreSpritesheet = mockLoadedSpritesheetAliases(["soil-slime_A1"]);
  try {
    withMockedRandom(0.99, () => {
      eggHatchSystem({
        world: restoredWorld as any,
        currentTime,
      });
    });
  } finally {
    restoreSpritesheet();
  }

  assert.equal(ObjectComp.state[restoredEid], CharacterState.IDLE);
  assert.equal(
    CharacterStatusComp.characterKey[restoredEid],
    CharacterKeyECS.SoilSlimeA1,
  );
  assert.equal(CharacterStatusComp.evolutionPhase[restoredEid], 1);
  assert.equal(EggHatchComp.pendingCharacterKey[restoredEid], CharacterKeyECS.NULL);
});
