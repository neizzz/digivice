import assert from "node:assert/strict";
import test from "node:test";
import { addComponent, addEntity, hasComponent } from "bitecs";
import {
  CharacterStatusComp,
  DestinationComp,
  FreshnessComp,
  ObjectComp,
  PositionComp,
  RandomMovementComp,
} from "../raw-components";
import { diseaseSystem } from "../systems/DiseaseSystem";
import { foodEatingSystem } from "../systems/FoodEatingSystem";
import { CharacterState, CharacterStatus, FoodState, Freshness, ObjectType } from "../types";
import {
  createTestCharacter,
  createTestWorld,
  setWorldTime,
  withMockedDateNow,
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
