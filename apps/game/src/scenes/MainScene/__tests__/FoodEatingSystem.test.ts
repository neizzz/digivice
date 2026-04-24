import assert from "node:assert/strict";
import test from "node:test";
import { addComponent, addEntity, hasComponent } from "bitecs";
import {
  AngleComp,
  CharacterStatusComp,
  DestinationComp,
  DigestiveSystemComp,
  FreshnessComp,
  ObjectComp,
  PositionComp,
  RenderComp,
} from "../raw-components";
import { foodEatingSystem } from "../systems/FoodEatingSystem";
import {
  CharacterKeyECS,
  CharacterState,
  FoodState,
  Freshness,
  ObjectType,
  TextureKey,
} from "../types";
import {
  createTestCharacter,
  createTestWorld,
  withMockedDateNow,
} from "../../../test-utils/mainSceneTestUtils";

const FOOD_CHARACTER_BOUNDARY_OVERLAP_PX = 10;
const FALLBACK_SOURCE_SIZE = 16;
const DEFAULT_LANDED_FOOD_SCALE = 1.4;
const OVERLAP_TOLERANCE_PX = 1;

function createLandedFood(
  world: ReturnType<typeof createTestWorld>,
  options: { x: number; y: number; freshness?: Freshness; scale?: number },
): number {
  const foodEid = addEntity(world);

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
  RenderComp.scale[foodEid] = options.scale ?? DEFAULT_LANDED_FOOD_SCALE;
  RenderComp.zIndex[foodEid] = ECS_NULL_VALUE;
  FreshnessComp.freshness[foodEid] = options.freshness ?? Freshness.NORMAL;

  return foodEid;
}

function getFallbackHalfHeight(eid: number): number {
  const scale = RenderComp.scale[eid] > 0 ? RenderComp.scale[eid] : 1;
  return (FALLBACK_SOURCE_SIZE * scale) / 2;
}

function getVerticalOverlapPx(characterEid: number, foodEid: number): number {
  const characterBottomY =
    PositionComp.y[characterEid] + getFallbackHalfHeight(characterEid);
  const foodTopY = PositionComp.y[foodEid] - getFallbackHalfHeight(foodEid);

  return characterBottomY - foodTopY;
}

function assertEatingPose(characterEid: number, foodEid: number): void {
  assert.equal(PositionComp.x[characterEid], PositionComp.x[foodEid]);
  assert.ok(
    PositionComp.y[characterEid] < PositionComp.y[foodEid],
    `expected character y ${PositionComp.y[characterEid]} to be above food y ${PositionComp.y[foodEid]}`,
  );

  const overlap = getVerticalOverlapPx(characterEid, foodEid);
  assert.ok(
    Math.abs(overlap - FOOD_CHARACTER_BOUNDARY_OVERLAP_PX) <=
      OVERLAP_TOLERANCE_PX,
    `expected overlap around ${FOOD_CHARACTER_BOUNDARY_OVERLAP_PX}px, got ${overlap}px`,
  );
}

test("근처 음식을 바로 먹기 시작할 때 캐릭터를 음식 위쪽 10px 겹침 위치로 보정하고 실제 음식 좌표를 바라본다", () => {
  const world = createTestWorld({ now: 10_000 });
  const characterEid = withMockedDateNow(10_000, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 3,
      x: 112,
      y: 130,
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
  assertEatingPose(characterEid, foodEid);

  const expectedAngle = Math.atan2(
    PositionComp.y[foodEid] - PositionComp.y[characterEid],
    PositionComp.x[foodEid] - PositionComp.x[characterEid],
  );
  assert.ok(
    Math.abs(AngleComp.value[characterEid] - expectedAngle) < 1e-6,
    `expected ${expectedAngle}, got ${AngleComp.value[characterEid]}`,
  );
});

test("음식에 도착해서 먹기 시작할 때도 음식 위쪽 10px 겹침 위치에서 실제 음식 좌표를 바라본다", () => {
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
  assert.equal(DestinationComp.x[characterEid], PositionComp.x[foodEid]);
  assert.ok(
    DestinationComp.y[characterEid] < PositionComp.y[foodEid],
    `expected destination y ${DestinationComp.y[characterEid]} to be above food y ${PositionComp.y[foodEid]}`,
  );

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
  assertEatingPose(characterEid, foodEid);

  const expectedAngle = Math.atan2(
    PositionComp.y[foodEid] - PositionComp.y[characterEid],
    PositionComp.x[foodEid] - PositionComp.x[characterEid],
  );
  assert.ok(
    Math.abs(AngleComp.value[characterEid] - expectedAngle) < 1e-6,
    `expected ${expectedAngle}, got ${AngleComp.value[characterEid]}`,
  );
});

test("캐릭터 크기별 식사 접근 위치는 음식 경계와 약 10px 겹친다", () => {
  const scenarios = [
    { characterKey: CharacterKeyECS.TestGreenSlimeA1, scale: 0.8 },
    { characterKey: CharacterKeyECS.TestGreenSlimeD1, scale: 1.2 },
  ];

  for (const [index, scenario] of scenarios.entries()) {
    const now = 50_000 + index * 1_000;
    const world = createTestWorld({ now });
    const characterEid = withMockedDateNow(now, () =>
      createTestCharacter(world, {
        state: CharacterState.IDLE,
        stamina: 3,
        x: 40,
        y: 40,
        characterKey: scenario.characterKey,
      }),
    );
    RenderComp.scale[characterEid] = scenario.scale;

    const foodEid = createLandedFood(world, { x: 180, y: 120 });

    foodEatingSystem({
      world: world as any,
      delta: 0,
      currentTime: world.currentTime,
    });

    assert.ok(hasComponent(world, DestinationComp, characterEid));

    PositionComp.x[characterEid] = DestinationComp.x[characterEid];
    PositionComp.y[characterEid] = DestinationComp.y[characterEid];

    foodEatingSystem({
      world: world as any,
      delta: 0,
      currentTime: world.currentTime,
    });

    assert.equal(ObjectComp.state[characterEid], CharacterState.EATING);
    assert.equal(ObjectComp.state[foodEid], FoodState.BEING_INTAKEN);
    assertEatingPose(characterEid, foodEid);
  }
});

test("신선한 음식은 스테미나를 2 올리고 소화 부하는 고정 2만 증가시킨다", () => {
  const world = createTestWorld({ now: 30_000 });
  const characterEid = withMockedDateNow(30_000, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 3,
      x: 100,
      y: 100,
    }),
  );

  createLandedFood(world, {
    x: 112,
    y: 112,
    freshness: Freshness.FRESH,
  });

  foodEatingSystem({
    world: world as any,
    delta: 0,
    currentTime: 30_000,
  });

  foodEatingSystem({
    world: world as any,
    delta: 3_200,
    currentTime: 33_200,
  });

  assert.equal(CharacterStatusComp.stamina[characterEid], 5);
  assert.equal(DigestiveSystemComp.currentLoad[characterEid], 2);
});

test("보통 음식도 소화 부하는 신선도와 무관하게 고정 2만 증가시킨다", () => {
  const world = createTestWorld({ now: 40_000 });
  const characterEid = withMockedDateNow(40_000, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 3,
      x: 100,
      y: 100,
    }),
  );

  createLandedFood(world, {
    x: 112,
    y: 112,
    freshness: Freshness.NORMAL,
  });

  foodEatingSystem({
    world: world as any,
    delta: 0,
    currentTime: 40_000,
  });

  foodEatingSystem({
    world: world as any,
    delta: 3_200,
    currentTime: 43_200,
  });

  assert.equal(CharacterStatusComp.stamina[characterEid], 4);
  assert.equal(DigestiveSystemComp.currentLoad[characterEid], 2);
});
