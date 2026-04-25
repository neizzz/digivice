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
import { getCharacterWorldBounds } from "../systems/CharacterDisplayBounds";

const EATING_POSE_FOOD_Y_OFFSET_PX = 1;
const FOOD_CHARACTER_BOUNDARY_OVERLAP_PX = 20;
const FALLBACK_SOURCE_SIZE = 16;
const DEFAULT_LANDED_FOOD_SCALE = 1.4;
const ZERO_DISTANCE_EPSILON = 0.001;

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

function getEatingTargetY(foodEid: number): number {
  return PositionComp.y[foodEid] - EATING_POSE_FOOD_Y_OFFSET_PX;
}

function getFallbackHalfWidth(eid: number): number {
  return (RenderComp.scale[eid] * FALLBACK_SOURCE_SIZE) / 2;
}

function getExpectedEatingTargetForSide(
  characterEid: number,
  foodEid: number,
  side: "left" | "right",
  overlapPx = FOOD_CHARACTER_BOUNDARY_OVERLAP_PX,
): { x: number; y: number } {
  const characterBounds = getCharacterWorldBounds(characterEid);
  const characterLeftOffset =
    characterBounds.leftX - PositionComp.x[characterEid];
  const characterRightOffset =
    characterBounds.rightX - PositionComp.x[characterEid];
  const foodHalfWidth = getFallbackHalfWidth(foodEid);

  const x =
    side === "left"
      ? PositionComp.x[foodEid] -
        foodHalfWidth +
        overlapPx -
        characterRightOffset
      : PositionComp.x[foodEid] +
        foodHalfWidth -
        overlapPx -
        characterLeftOffset;

  return {
    x: Math.round(x),
    y: Math.round(getEatingTargetY(foodEid)),
  };
}

function getExpectedEatingTargetX(
  world: ReturnType<typeof createTestWorld>,
  characterEid: number,
  foodEid: number,
  overlapPx = FOOD_CHARACTER_BOUNDARY_OVERLAP_PX,
): number {
  return getExpectedEatingTarget(world, characterEid, foodEid, overlapPx).x;
}

function getExpectedEatingTarget(
  world: ReturnType<typeof createTestWorld>,
  characterEid: number,
  foodEid: number,
  overlapPx = FOOD_CHARACTER_BOUNDARY_OVERLAP_PX,
): { x: number; y: number } {
  const leftTarget = getExpectedEatingTargetForSide(
    characterEid,
    foodEid,
    "left",
    overlapPx,
  );
  const rightTarget = getExpectedEatingTargetForSide(
    characterEid,
    foodEid,
    "right",
    overlapPx,
  );
  const leftDistance = getSquaredDistanceFromCharacter(
    characterEid,
    leftTarget,
  );
  const rightDistance = getSquaredDistanceFromCharacter(
    characterEid,
    rightTarget,
  );

  if (Math.abs(leftDistance - rightDistance) > ZERO_DISTANCE_EPSILON) {
    return leftDistance < rightDistance ? leftTarget : rightTarget;
  }

  const deltaX = PositionComp.x[characterEid] - PositionComp.x[foodEid];
  if (Math.abs(deltaX) > ZERO_DISTANCE_EPSILON) {
    return deltaX < 0 ? leftTarget : rightTarget;
  }

  if (hasComponent(world, AngleComp, characterEid)) {
    return Math.cos(AngleComp.value[characterEid]) < 0
      ? rightTarget
      : leftTarget;
  }

  return leftTarget;
}

function getApproachAngleToEatingTarget(
  from: { x: number; y: number },
  target: { x: number; y: number },
): number {
  return Math.atan2(target.y - from.y, target.x - from.x);
}

function getApproachAngleToFood(characterEid: number, foodEid: number): number {
  return Math.atan2(
    PositionComp.y[foodEid] - PositionComp.y[characterEid],
    PositionComp.x[foodEid] - PositionComp.x[characterEid],
  );
}

function getSquaredDistanceFromCharacter(
  characterEid: number,
  target: { x: number; y: number },
): number {
  const deltaX = target.x - PositionComp.x[characterEid];
  const deltaY = target.y - PositionComp.y[characterEid];

  return deltaX * deltaX + deltaY * deltaY;
}

function assertCharacterAtPosition(
  characterEid: number,
  expected: { x: number; y: number },
): void {
  assert.equal(PositionComp.x[characterEid], expected.x);
  assert.equal(
    PositionComp.y[characterEid],
    expected.y,
    `expected character position (${PositionComp.x[characterEid]}, ${PositionComp.y[characterEid]}) to equal (${expected.x}, ${expected.y})`,
  );
}

function assertHorizontalBoundaryOverlap(
  characterEid: number,
  foodEid: number,
): void {
  const characterBounds = getCharacterWorldBounds(characterEid);
  const foodHalfWidth = getFallbackHalfWidth(foodEid);
  const foodLeftX = PositionComp.x[foodEid] - foodHalfWidth;
  const foodRightX = PositionComp.x[foodEid] + foodHalfWidth;
  const characterIsLeftOfFood =
    PositionComp.x[characterEid] <= PositionComp.x[foodEid];
  const overlap = characterIsLeftOfFood
    ? characterBounds.rightX - foodLeftX
    : foodRightX - characterBounds.leftX;

  assert.ok(
    Math.abs(overlap - FOOD_CHARACTER_BOUNDARY_OVERLAP_PX) <= 0.5,
    `expected horizontal overlap to be ~${FOOD_CHARACTER_BOUNDARY_OVERLAP_PX}px, got ${overlap}`,
  );
}

function assertAngleClose(actual: number, expected: number): void {
  assert.ok(
    Math.abs(actual - expected) < 1e-6,
    `expected ${expected}, got ${actual}`,
  );
}

function moveToDestinationAndStartEating(
  world: ReturnType<typeof createTestWorld>,
  characterEid: number,
): {
  x: number;
  y: number;
  approachAngle: number;
  eatingAngle: number;
  foodEid: number;
} {
  assert.ok(hasComponent(world, DestinationComp, characterEid));
  const foodEid = DestinationComp.target[characterEid];
  const destination = {
    x: DestinationComp.x[characterEid],
    y: DestinationComp.y[characterEid],
  };
  const approachAngle = AngleComp.value[characterEid];

  PositionComp.x[characterEid] = destination.x;
  PositionComp.y[characterEid] = destination.y;
  const expectedEatingAngle = getApproachAngleToFood(characterEid, foodEid);

  foodEatingSystem({
    world: world as any,
    delta: 0,
    currentTime: world.currentTime,
  });

  assert.equal(ObjectComp.state[characterEid], CharacterState.EATING);
  assert.equal(ObjectComp.state[foodEid], FoodState.BEING_INTAKEN);
  assertCharacterAtPosition(characterEid, destination);
  assertAngleClose(AngleComp.value[characterEid], expectedEatingAngle);

  return {
    ...destination,
    approachAngle,
    eatingAngle: AngleComp.value[characterEid],
    foodEid,
  };
}

test("근처 음식도 가운데로 순간이동하지 않고 경계가 겹치는 접근 지점을 목표로 이동한다", () => {
  const world = createTestWorld({ now: 10_000 });
  const characterEid = withMockedDateNow(10_000, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 3,
      x: 100,
      y: 130,
    }),
  );
  const foodEid = createLandedFood(world, { x: 112, y: 115 });
  const initialPosition = {
    x: PositionComp.x[characterEid],
    y: PositionComp.y[characterEid],
  };
  const expectedTarget = getExpectedEatingTarget(world, characterEid, foodEid);
  const expectedAngle = getApproachAngleToEatingTarget(
    initialPosition,
    expectedTarget,
  );

  foodEatingSystem({
    world: world as any,
    delta: 0,
    currentTime: world.currentTime,
  });

  assert.equal(ObjectComp.state[characterEid], CharacterState.MOVING);
  assert.equal(ObjectComp.state[foodEid], FoodState.TARGETED);
  assert.ok(hasComponent(world, DestinationComp, characterEid));
  assert.equal(DestinationComp.target[characterEid], foodEid);
  assert.equal(DestinationComp.x[characterEid], expectedTarget.x);
  assert.equal(DestinationComp.y[characterEid], expectedTarget.y);
  assert.notEqual(DestinationComp.x[characterEid], PositionComp.x[foodEid]);
  assertCharacterAtPosition(characterEid, initialPosition);
  assert.ok(hasComponent(world, AngleComp, characterEid));
  assertAngleClose(AngleComp.value[characterEid], expectedAngle);
});

test("접근 지점에 도착해서 먹기 시작할 때 위치 보정 없이 음식 방향을 바라본다", () => {
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
  const expectedTarget = getExpectedEatingTarget(world, characterEid, foodEid);
  const expectedAngle = getApproachAngleToEatingTarget(
    {
      x: PositionComp.x[characterEid],
      y: PositionComp.y[characterEid],
    },
    expectedTarget,
  );

  foodEatingSystem({
    world: world as any,
    delta: 0,
    currentTime: world.currentTime,
  });

  assert.ok(hasComponent(world, DestinationComp, characterEid));
  assert.equal(DestinationComp.target[characterEid], foodEid);
  assert.equal(DestinationComp.x[characterEid], expectedTarget.x);
  assert.equal(DestinationComp.y[characterEid], expectedTarget.y);
  assert.notEqual(DestinationComp.x[characterEid], PositionComp.x[foodEid]);
  assertAngleClose(AngleComp.value[characterEid], expectedAngle);

  const arrived = moveToDestinationAndStartEating(world, characterEid);
  assert.equal(arrived.x, expectedTarget.x);
  assert.equal(arrived.y, expectedTarget.y);
  assertHorizontalBoundaryOverlap(characterEid, foodEid);
});

test("좌우 후보 중 현재 위치에서 더 가까운 접근 지점을 선택한다", () => {
  const world = createTestWorld({ now: 25_000 });
  const characterEid = withMockedDateNow(25_000, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 3,
      x: 100,
      y: 130,
    }),
  );
  const foodEid = createLandedFood(world, { x: 112, y: 115 });
  const leftTarget = getExpectedEatingTargetForSide(
    characterEid,
    foodEid,
    "left",
  );
  const rightTarget = getExpectedEatingTargetForSide(
    characterEid,
    foodEid,
    "right",
  );
  const expectedTarget =
    getSquaredDistanceFromCharacter(characterEid, leftTarget) <
    getSquaredDistanceFromCharacter(characterEid, rightTarget)
      ? leftTarget
      : rightTarget;

  foodEatingSystem({
    world: world as any,
    delta: 0,
    currentTime: world.currentTime,
  });

  assert.ok(hasComponent(world, DestinationComp, characterEid));
  assert.equal(DestinationComp.x[characterEid], expectedTarget.x);
  assert.equal(DestinationComp.y[characterEid], expectedTarget.y);
});

test("먹기 시작 시 이동 방향이 음식 반대쪽이어도 음식 방향으로 전환한다", () => {
  const world = createTestWorld({ now: 26_000 });
  const characterEid = withMockedDateNow(26_000, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 3,
      x: 100,
      y: 130,
    }),
  );
  const foodEid = createLandedFood(world, { x: 112, y: 115 });

  foodEatingSystem({
    world: world as any,
    delta: 0,
    currentTime: world.currentTime,
  });

  const approachAngle = AngleComp.value[characterEid];
  assert.ok(
    Math.cos(approachAngle) < 0,
    "fixture should approach left before eating",
  );

  const arrived = moveToDestinationAndStartEating(world, characterEid);
  assert.ok(
    Math.cos(arrived.eatingAngle) > 0,
    "character should face right toward food while eating",
  );
  assert.notEqual(arrived.approachAngle, arrived.eatingAngle);
});

test("캐릭터 크기별 식사 접근 위치는 음식 경계와 약 20px 겹친다", () => {
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
    assert.equal(
      DestinationComp.x[characterEid],
      getExpectedEatingTargetX(world, characterEid, foodEid),
    );
    assert.equal(DestinationComp.y[characterEid], getEatingTargetY(foodEid));
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

  moveToDestinationAndStartEating(world, characterEid);

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

  moveToDestinationAndStartEating(world, characterEid);

  foodEatingSystem({
    world: world as any,
    delta: 3_200,
    currentTime: 43_200,
  });

  assert.equal(CharacterStatusComp.stamina[characterEid], 4);
  assert.equal(DigestiveSystemComp.currentLoad[characterEid], 2);
});
