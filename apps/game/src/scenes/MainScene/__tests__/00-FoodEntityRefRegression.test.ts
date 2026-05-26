import assert from "node:assert/strict";
import test from "node:test";
import {
  addEntity,
  addComponent,
  hasComponent,
} from "bitecs";
import {
  CharacterStatusComp,
  DestinationComp,
  DiseaseSystemComp,
  FoodEatingComp,
  FreshnessComp,
  ObjectComp,
  PositionComp,
  RenderComp,
  SleepSystemComp,
} from "../raw-components";
import { GAME_CONSTANTS } from "../config";
import { repairLoadedFoodInteractionState } from "../entityDataHelpers";
import {
  foodEatingSystem,
  releaseTargetedFoodForCharacter,
} from "../systems/FoodEatingSystem";
import { diseaseSystem } from "../systems/DiseaseSystem";
import {
  CharacterState,
  DestinationType,
  FoodState,
  Freshness,
  ObjectType,
  TextureKey,
} from "../types";
import {
  createTestCharacter,
  createTestWorld,
  withMockedDateNow,
  withMockedRandom,
} from "../../../test-utils/mainSceneTestUtils";

function createFoodEntityAtEid(
  world: ReturnType<typeof createTestWorld>,
  foodEid: number,
  options: { x: number; y: number },
): number {
  const createdEid = addEntity(world);
  assert.equal(createdEid, foodEid);
  addComponent(world, ObjectComp, foodEid);
  addComponent(world, PositionComp, foodEid);
  addComponent(world, RenderComp, foodEid);
  addComponent(world, FreshnessComp, foodEid);

  ObjectComp.id[foodEid] = 10_000 + foodEid;
  ObjectComp.type[foodEid] = ObjectType.FOOD;
  ObjectComp.state[foodEid] = FoodState.LANDED;
  PositionComp.x[foodEid] = options.x;
  PositionComp.y[foodEid] = options.y;
  RenderComp.storeIndex[foodEid] = ECS_NULL_VALUE;
  RenderComp.textureKey[foodEid] = TextureKey.FOOD1;
  RenderComp.scale[foodEid] = 1.4;
  RenderComp.zIndex[foodEid] = ECS_NULL_VALUE;
  FreshnessComp.freshness[foodEid] = Freshness.NORMAL;

  return foodEid;
}

test("food entity ref는 eid 0이어도 target/release/disease/eating/repair 경로에서 유효하게 유지된다", () => {
  const now = 10_000;
  const world = createTestWorld({ now });
  const foodEid = createFoodEntityAtEid(world, 0, { x: 160, y: 120 });

  const characterEid = withMockedDateNow(now, () =>
    createTestCharacter(world, {
      state: CharacterState.MOVING,
      stamina: 1.5,
      x: 100,
      y: 120,
    }),
  );

  addComponent(world, DestinationComp, characterEid);
  DestinationComp.type[characterEid] = DestinationType.TARGETED;
  DestinationComp.target[characterEid] = foodEid;
  DestinationComp.x[characterEid] = 140;
  DestinationComp.y[characterEid] = 120;
  ObjectComp.state[foodEid] = FoodState.TARGETED;

  assert.equal(ObjectComp.state[foodEid], FoodState.TARGETED);

  let repaired = repairLoadedFoodInteractionState(world, now);
  assert.deepEqual(repaired.repairedFoods, []);
  assert.equal(ObjectComp.state[foodEid], FoodState.TARGETED);

  DiseaseSystemComp.nextCheckTime[characterEid] = now;
  SleepSystemComp.fatigue[characterEid] =
    GAME_CONSTANTS.FATIGUE_DISEASE_THRESHOLD_EXHAUSTED;

  withMockedRandom(0, () => {
    diseaseSystem({
      world: world as any,
      currentTime: now,
    });
  });

  assert.equal(ObjectComp.state[characterEid], CharacterState.MOVING);
  assert.equal(CharacterStatusComp.statuses[characterEid][0], ECS_NULL_VALUE);
  assert.equal(DestinationComp.target[characterEid], 0);
  assert.equal(ObjectComp.state[foodEid], FoodState.TARGETED);

  releaseTargetedFoodForCharacter(world as any, characterEid);
  assert.equal(ObjectComp.state[foodEid], FoodState.LANDED);

  ObjectComp.state[foodEid] = FoodState.TARGETED;
  repaired = repairLoadedFoodInteractionState(world, now);
  assert.deepEqual(repaired.repairedFoods, []);
  assert.equal(ObjectComp.state[foodEid], FoodState.TARGETED);

  PositionComp.x[characterEid] = DestinationComp.x[characterEid];
  PositionComp.y[characterEid] = DestinationComp.y[characterEid];

  foodEatingSystem({
    world: world as any,
    delta: 0,
    currentTime: now,
  });

  assert.equal(ObjectComp.state[characterEid], CharacterState.EATING);
  assert.equal(ObjectComp.state[foodEid], FoodState.BEING_INTAKEN);
  assert.ok(hasComponent(world, FoodEatingComp, characterEid));
  assert.equal(FoodEatingComp.targetFood[characterEid], 0);

  repaired = repairLoadedFoodInteractionState(world, now);
  assert.deepEqual(repaired.repairedFoods, []);
  assert.equal(ObjectComp.state[foodEid], FoodState.BEING_INTAKEN);
});
