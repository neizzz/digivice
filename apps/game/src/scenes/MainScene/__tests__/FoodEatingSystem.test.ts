import assert from "node:assert/strict";
import test from "node:test";
import { addComponent, addEntity, hasComponent } from "bitecs";
import {
  AngleComp,
  DestinationComp,
  FreshnessComp,
  ObjectComp,
  PositionComp,
} from "../raw-components";
import { foodEatingSystem } from "../systems/FoodEatingSystem";
import { CharacterState, FoodState, Freshness, ObjectType } from "../types";
import {
  createTestCharacter,
  createTestWorld,
  withMockedDateNow,
} from "../../../test-utils/mainSceneTestUtils";

function createLandedFood(
  world: ReturnType<typeof createTestWorld>,
  options: { x: number; y: number; freshness?: Freshness },
): number {
  const foodEid = addEntity(world);

  addComponent(world, ObjectComp, foodEid);
  addComponent(world, PositionComp, foodEid);
  addComponent(world, FreshnessComp, foodEid);

  ObjectComp.id[foodEid] = 10_000 + foodEid;
  ObjectComp.type[foodEid] = ObjectType.FOOD;
  ObjectComp.state[foodEid] = FoodState.LANDED;
  PositionComp.x[foodEid] = options.x;
  PositionComp.y[foodEid] = options.y;
  FreshnessComp.freshness[foodEid] = options.freshness ?? Freshness.NORMAL;

  return foodEid;
}

test("근처 음식을 바로 먹기 시작할 때 실제 음식 좌표를 바라본다", () => {
  const world = createTestWorld({ now: 10_000 });
  const characterEid = withMockedDateNow(10_000, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 3,
      x: 100,
      y: 100,
    }),
  );
  const foodEid = createLandedFood(world, { x: 112, y: 115 });

  foodEatingSystem({
    world: world as any,
    delta: 0,
    currentTime: world.currentTime,
  });

  assert.equal(ObjectComp.state[characterEid], CharacterState.EATING);
  assert.equal(ObjectComp.state[foodEid], FoodState.BEING_INTAKEN);
  assert.ok(hasComponent(world, AngleComp, characterEid));

  const expectedAngle = Math.atan2(15, 12);
  assert.ok(
    Math.abs(AngleComp.value[characterEid] - expectedAngle) < 1e-6,
    `expected ${expectedAngle}, got ${AngleComp.value[characterEid]}`,
  );
});

test("음식에 도착해서 먹기 시작할 때도 목적지 오프셋이 아닌 실제 음식 좌표를 바라본다", () => {
  const world = createTestWorld({ now: 20_000 });
  const characterEid = withMockedDateNow(20_000, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 3,
      x: 40,
      y: 40,
    }),
  );
  const foodEid = createLandedFood(world, { x: 120, y: 96 });

  foodEatingSystem({
    world: world as any,
    delta: 0,
    currentTime: world.currentTime,
  });

  assert.ok(hasComponent(world, DestinationComp, characterEid));
  assert.equal(DestinationComp.target[characterEid], foodEid);

  const arrivedX = DestinationComp.x[characterEid];
  const arrivedY = DestinationComp.y[characterEid];
  PositionComp.x[characterEid] = arrivedX;
  PositionComp.y[characterEid] = arrivedY;

  foodEatingSystem({
    world: world as any,
    delta: 0,
    currentTime: world.currentTime,
  });

  assert.equal(ObjectComp.state[characterEid], CharacterState.EATING);
  assert.equal(ObjectComp.state[foodEid], FoodState.BEING_INTAKEN);

  const expectedAngle = Math.atan2(96 - arrivedY, 120 - arrivedX);
  assert.ok(
    Math.abs(AngleComp.value[characterEid] - expectedAngle) < 1e-6,
    `expected ${expectedAngle}, got ${AngleComp.value[characterEid]}`,
  );
});
