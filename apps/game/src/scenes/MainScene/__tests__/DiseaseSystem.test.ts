import assert from "node:assert/strict";
import test from "node:test";
import { addComponent, addEntity, hasComponent, removeComponent } from "bitecs";
import {
  CharacterStatusComp,
  DestinationComp,
  DiseaseSystemComp,
  FoodEatingComp,
  FoodMaskComp,
  FreshnessComp,
  ObjectComp,
  PositionComp,
  RandomMovementComp,
  SpeedComp,
} from "../raw-components";
import { diseaseSystem } from "../systems/DiseaseSystem";
import { foodEatingSystem } from "../systems/FoodEatingSystem";
import {
  CharacterState,
  CharacterStatus,
  FoodState,
  Freshness,
  ObjectType,
} from "../types";
import {
  createTestCharacter,
  createTestWorld,
  setWorldTime,
  withMockedDateNow,
  withMockedRandom,
} from "../../../test-utils/mainSceneTestUtils";

test("sick 상태는 현재 movement restriction을 걸고 회복되면 복원한다", () => {
  const world = createTestWorld({ now: 20_000 });
  const eid = withMockedDateNow(20_000, () =>
    createTestCharacter(world, {
      state: CharacterState.SICK,
      stamina: 5,
    }),
  );

  CharacterStatusComp.statuses[eid][0] = CharacterStatus.SICK;

  diseaseSystem({
    world: world as any,
    currentTime: 20_000,
  });

  assert.equal(hasComponent(world, RandomMovementComp, eid), false);
  assert.equal(hasComponent(world, DestinationComp, eid), false);

  CharacterStatusComp.statuses[eid][0] = ECS_NULL_VALUE;
  ObjectComp.state[eid] = CharacterState.IDLE;

  diseaseSystem({
    world: world as any,
    currentTime: 20_001,
  });

  assert.equal(hasComponent(world, RandomMovementComp, eid), true);
});

test("음식을 먹으러 가다 sick 상태가 되면 orphaned TARGETED food를 다시 LANDED로 돌린다", () => {
  const world = createTestWorld({ now: 30_000 });
  const characterEid = withMockedDateNow(30_000, () =>
    createTestCharacter(world, {
      state: CharacterState.MOVING,
      stamina: 3,
      x: 100,
      y: 100,
    }),
  );

  const foodEid = addEntity(world);
  addComponent(world, ObjectComp, foodEid);
  addComponent(world, PositionComp, foodEid);
  addComponent(world, FreshnessComp, foodEid);

  ObjectComp.id[foodEid] = 10_000 + foodEid;
  ObjectComp.type[foodEid] = ObjectType.FOOD;
  ObjectComp.state[foodEid] = FoodState.TARGETED;
  PositionComp.x[foodEid] = 140;
  PositionComp.y[foodEid] = 120;
  FreshnessComp.freshness[foodEid] = Freshness.NORMAL;

  addComponent(world, DestinationComp, characterEid);
  DestinationComp.target[characterEid] = foodEid;

  CharacterStatusComp.statuses[characterEid][0] = CharacterStatus.SICK;
  ObjectComp.state[characterEid] = CharacterState.SICK;

  diseaseSystem({
    world: world as any,
    currentTime: 30_000,
  });

  assert.equal(hasComponent(world, DestinationComp, characterEid), false);
  assert.equal(ObjectComp.state[foodEid], FoodState.LANDED);
});

test("sick 치료 후에는 다시 주변 LANDED food를 탐색한다", () => {
  const world = createTestWorld({ now: 40_000 });
  const characterEid = withMockedDateNow(40_000, () =>
    createTestCharacter(world, {
      state: CharacterState.MOVING,
      stamina: 3,
      x: 100,
      y: 100,
    }),
  );

  const foodEid = addEntity(world);
  addComponent(world, ObjectComp, foodEid);
  addComponent(world, PositionComp, foodEid);
  addComponent(world, FreshnessComp, foodEid);

  ObjectComp.id[foodEid] = 20_000 + foodEid;
  ObjectComp.type[foodEid] = ObjectType.FOOD;
  ObjectComp.state[foodEid] = FoodState.TARGETED;
  PositionComp.x[foodEid] = 180;
  PositionComp.y[foodEid] = 100;
  FreshnessComp.freshness[foodEid] = Freshness.NORMAL;

  addComponent(world, DestinationComp, characterEid);
  DestinationComp.target[characterEid] = foodEid;

  CharacterStatusComp.statuses[characterEid][0] = CharacterStatus.SICK;
  ObjectComp.state[characterEid] = CharacterState.SICK;

  diseaseSystem({
    world: world as any,
    currentTime: 40_000,
  });

  CharacterStatusComp.statuses[characterEid][0] = ECS_NULL_VALUE;
  ObjectComp.state[characterEid] = CharacterState.IDLE;
  setWorldTime(world, 40_001);

  diseaseSystem({
    world: world as any,
    currentTime: 40_001,
  });

  foodEatingSystem({
    world: world as any,
    delta: 0,
    currentTime: 40_001,
  });

  assert.equal(hasComponent(world, DestinationComp, characterEid), true);
  assert.equal(DestinationComp.target[characterEid], foodEid);
  assert.equal(ObjectComp.state[foodEid], FoodState.TARGETED);
});

test("음식을 먹는 도중 sick 상태가 되면 식사를 즉시 취소하고 음식을 되돌린다", () => {
  const now = 50_000;
  const world = createTestWorld({ now });
  const characterEid = withMockedDateNow(now, () =>
    createTestCharacter(world, {
      state: CharacterState.EATING,
      stamina: 3,
      x: 100,
      y: 100,
    }),
  );

  const foodEid = addEntity(world);
  addComponent(world, ObjectComp, foodEid);
  addComponent(world, PositionComp, foodEid);
  addComponent(world, FreshnessComp, foodEid);
  addComponent(world, FoodMaskComp, foodEid);

  ObjectComp.id[foodEid] = 30_000 + foodEid;
  ObjectComp.type[foodEid] = ObjectType.FOOD;
  ObjectComp.state[foodEid] = FoodState.BEING_INTAKEN;
  PositionComp.x[foodEid] = 112;
  PositionComp.y[foodEid] = 112;
  FreshnessComp.freshness[foodEid] = Freshness.NORMAL;
  FoodMaskComp.progress[foodEid] = 0.5;
  FoodMaskComp.isInitialized[foodEid] = 1;
  FoodMaskComp.maskStoreIndex[foodEid] = ECS_NULL_VALUE;

  addComponent(world, FoodEatingComp, characterEid);
  FoodEatingComp.targetFood[characterEid] = foodEid;
  FoodEatingComp.progress[characterEid] = 0.5;
  FoodEatingComp.duration[characterEid] = 3200;
  FoodEatingComp.elapsedTime[characterEid] = 1600;
  FoodEatingComp.isActive[characterEid] = 1;

  if (hasComponent(world, RandomMovementComp, characterEid)) {
    removeComponent(world, RandomMovementComp, characterEid);
  }
  if (hasComponent(world, DestinationComp, characterEid)) {
    removeComponent(world, DestinationComp, characterEid);
  }

  SpeedComp.value[characterEid] = 0;
  DiseaseSystemComp.nextCheckTime[characterEid] = now;

  const staminaBefore = CharacterStatusComp.stamina[characterEid];

  withMockedRandom(0, () => {
    diseaseSystem({
      world: world as any,
      currentTime: now,
    });
  });

  assert.equal(ObjectComp.state[characterEid], CharacterState.SICK);
  assert.equal(
    CharacterStatusComp.statuses[characterEid][0],
    CharacterStatus.SICK,
  );
  assert.equal(hasComponent(world, FoodEatingComp, characterEid), false);
  assert.equal(hasComponent(world, FoodMaskComp, foodEid), false);
  assert.equal(ObjectComp.state[foodEid], FoodState.LANDED);

  foodEatingSystem({
    world: world as any,
    delta: 3200,
    currentTime: now + 3200,
  });

  assert.equal(CharacterStatusComp.stamina[characterEid], staminaBefore);
  assert.equal(hasComponent(world, ObjectComp, foodEid), true);
  assert.equal(ObjectComp.state[foodEid], FoodState.LANDED);
});
