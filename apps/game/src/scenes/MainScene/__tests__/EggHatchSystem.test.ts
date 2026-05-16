import assert from "node:assert/strict";
import test from "node:test";
import { addComponent, addEntity } from "bitecs";
import {
  CharacterStatusComp,
  EggHatchComp,
  FreshnessComp,
  ObjectComp,
} from "../raw-components";
import { eggHatchSystem } from "../systems/EggHatchSystem";
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
