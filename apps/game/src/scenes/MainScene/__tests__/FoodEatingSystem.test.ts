import assert from "node:assert/strict";
import test from "node:test";
import { addComponent, addEntity, hasComponent, removeComponent } from "bitecs";
import * as PIXI from "pixi.js";
import {
  AngleComp,
  CharacterStatusComp,
  DestinationComp,
  FoodEatingComp,
  FoodMaskComp,
  FreshnessComp,
  ObjectComp,
  PositionComp,
  RandomMovementComp,
  RenderComp,
  SleepSystemComp,
  SpeedComp,
  StatusIconRenderComp,
  TemporaryStatusComp,
} from "../raw-components";
import { GAME_CONSTANTS } from "../config";
import { getCharacterStats } from "../characterStats";
import {
  applySavedEntityToECS,
  convertECSEntityToSavedEntity,
  repairLoadedFoodInteractionState,
} from "../entityDataHelpers";
import {
  foodEatingSystem,
  getStaminaBonusForFoodTexture,
} from "../systems/FoodEatingSystem";
import { commonMovementSystem } from "../systems/CommonMovementSystem";
import {
  CharacterKeyECS,
  CharacterState,
  CharacterStatus,
  SleepMode,
  SleepReason,
  FoodState,
  Freshness,
  ObjectType,
  TextureKey,
} from "../types";
import {
  createTestCharacter,
  createTestWorld,
  setWorldTime,
  withMockedDateNow,
} from "../../../test-utils/mainSceneTestUtils";
import { getCharacterWorldBounds } from "../systems/CharacterDisplayBounds";
import { TimeOfDay } from "../timeOfDay";
import {
  cleanupStatusIconRenderStateForTests,
  statusIconRenderSystem,
} from "../systems/StatusIconRenderSystem";

const EATING_POSE_FOOD_Y_OFFSET_PX = 1;
const FOOD_CHARACTER_BOUNDARY_OVERLAP_PX = 30;
const FALLBACK_SOURCE_SIZE = 16;
const DEFAULT_LANDED_FOOD_SCALE = 1.4;
const ZERO_DISTANCE_EPSILON = 0.001;
const MOCK_HAPPY_STATUS_TEXTURE = PIXI.Texture.WHITE;
const MOCK_DISCOVER_STATUS_TEXTURE = PIXI.Texture.EMPTY;

function createLandedFood(
  world: ReturnType<typeof createTestWorld>,
  options: {
    x: number;
    y: number;
    freshness?: Freshness;
    scale?: number;
    textureKey?: TextureKey;
  },
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
  RenderComp.textureKey[foodEid] = options.textureKey ?? TextureKey.FOOD1;
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

function withMockedStatusIconSprites<T>(fn: () => T): T {
  const originalGet = PIXI.Assets.get.bind(PIXI.Assets);
  const dummySpritesheet = {
    textures: {
      happy: MOCK_HAPPY_STATUS_TEXTURE,
      discover: MOCK_DISCOVER_STATUS_TEXTURE,
      sick: PIXI.Texture.WHITE,
      sleeping: PIXI.Texture.WHITE,
    },
  } as unknown as PIXI.Spritesheet;

  (PIXI.Assets as typeof PIXI.Assets & { get: typeof PIXI.Assets.get }).get = ((
    key: string,
  ) => {
    if (key === "common16x16") {
      return dummySpritesheet;
    }

    return originalGet(key);
  }) as typeof PIXI.Assets.get;

  try {
    return fn();
  } finally {
    (PIXI.Assets as typeof PIXI.Assets & { get: typeof PIXI.Assets.get }).get =
      originalGet;
    cleanupStatusIconRenderStateForTests();
  }
}

function renderStatusIcons(
  world: ReturnType<typeof createTestWorld>,
  characterEid: number,
  expectedTexture: PIXI.Texture,
): void {
  const renderWorld = world as ReturnType<typeof createTestWorld> & {
    stage: PIXI.Container;
  };
  renderWorld.stage = new PIXI.Container();

  statusIconRenderSystem({
    world: world as any,
    delta: 16,
  });

  assert.equal(StatusIconRenderComp.visibleCount[characterEid], 1);
  assert.equal(renderWorld.stage.children.length, 1);
  const sprite = renderWorld.stage.children[0];
  assert.ok(sprite instanceof PIXI.Sprite);
  assert.equal(sprite.texture, expectedTexture);
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

test("배고픈 캐릭터가 근처 음식을 발견하면 discover 임시 상태가 렌더링된다", () => {
  withMockedStatusIconSprites(() => {
    const world = createTestWorld({ now: 60_000 });
    const characterEid = withMockedDateNow(60_000, () =>
      createTestCharacter(world, {
        state: CharacterState.IDLE,
        stamina: 3,
        x: 100,
        y: 130,
      }),
    );
    createLandedFood(world, { x: 104, y: 115 });

    CharacterStatusComp.statuses[characterEid][0] = CharacterStatus.DISCOVER;
    TemporaryStatusComp.statusType[characterEid] = ECS_NULL_VALUE;
    TemporaryStatusComp.startTime[characterEid] = 0;

    foodEatingSystem({
      world: world as any,
      delta: 0,
      currentTime: world.currentTime,
    });

    assert.ok(
      Array.from(CharacterStatusComp.statuses[characterEid]).includes(
        CharacterStatus.DISCOVER,
      ),
    );
    assert.equal(
      TemporaryStatusComp.statusType[characterEid],
      CharacterStatus.DISCOVER,
    );
    assert.equal(TemporaryStatusComp.startTime[characterEid], 60_000);

    renderStatusIcons(world, characterEid, MOCK_DISCOVER_STATUS_TEXTURE);
  });
});

test("음식 섭취로 스태미나가 MAX가 되면 happy 임시 상태가 discover보다 우선 렌더링된다", () => {
  withMockedStatusIconSprites(() => {
    const world = createTestWorld({ now: 70_000 });
    const characterEid = withMockedDateNow(70_000, () =>
      createTestCharacter(world, {
        state: CharacterState.IDLE,
        stamina: GAME_CONSTANTS.MAX_STAMINA - 1,
        x: 100,
        y: 130,
      }),
    );
    createLandedFood(world, {
      x: 104,
      y: 115,
      textureKey: TextureKey.FOOD1,
    });

    CharacterStatusComp.statuses[characterEid][0] = CharacterStatus.HAPPY;
    TemporaryStatusComp.statusType[characterEid] = ECS_NULL_VALUE;
    TemporaryStatusComp.startTime[characterEid] = 0;
    TemporaryStatusComp.lastHappyStatusTime[characterEid] = 0;

    foodEatingSystem({
      world: world as any,
      delta: 0,
      currentTime: world.currentTime,
    });
    moveToDestinationAndStartEating(world, characterEid);
    setWorldTime(world, 73_200);
    foodEatingSystem({
      world: world as any,
      delta: 3_200,
      currentTime: world.currentTime,
    });

    assert.equal(
      CharacterStatusComp.stamina[characterEid],
      GAME_CONSTANTS.MAX_STAMINA,
    );
    assert.ok(
      Array.from(CharacterStatusComp.statuses[characterEid]).includes(
        CharacterStatus.HAPPY,
      ),
    );
    assert.equal(
      TemporaryStatusComp.statusType[characterEid],
      CharacterStatus.HAPPY,
    );
    assert.equal(TemporaryStatusComp.startTime[characterEid], 73_200);

    renderStatusIcons(world, characterEid, MOCK_HAPPY_STATUS_TEXTURE);
  });
});

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
  const foodEid = createLandedFood(world, { x: 104, y: 115 });
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

test("urgent 상태 캐릭터는 음식 목표로 이동할 때 20% 감속된 속도를 사용한다", () => {
  const world = createTestWorld({ now: 15_000 });
  const characterEid = withMockedDateNow(15_000, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 0,
      x: 80,
      y: 120,
    }),
  );
  const foodEid = createLandedFood(world, { x: 180, y: 120 });
  const expectedSpeed =
    getCharacterStats(CharacterStatusComp.characterKey[characterEid]).speed *
    GAME_CONSTANTS.URGENT_SPEED_MULTIPLIER;

  foodEatingSystem({
    world: world as any,
    delta: 0,
    currentTime: world.currentTime,
  });

  assert.equal(ObjectComp.state[characterEid], CharacterState.MOVING);
  assert.equal(ObjectComp.state[foodEid], FoodState.TARGETED);
  assert.ok(hasComponent(world, DestinationComp, characterEid));
  assert.ok(Math.abs(SpeedComp.value[characterEid] - expectedSpeed) < 0.000001);
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

test("TARGETED 이동은 마지막 프레임에 목적지로 클램프된 뒤 먹기 시작한다", () => {
  const world = createTestWorld({ now: 21_000 });
  const characterEid = withMockedDateNow(21_000, () =>
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
  const destination = {
    x: DestinationComp.x[characterEid],
    y: DestinationComp.y[characterEid],
  };

  PositionComp.x[characterEid] = destination.x;
  PositionComp.y[characterEid] = destination.y + 2;

  foodEatingSystem({
    world: world as any,
    delta: 0,
    currentTime: world.currentTime,
  });

  assert.equal(ObjectComp.state[characterEid], CharacterState.MOVING);
  assert.equal(ObjectComp.state[foodEid], FoodState.TARGETED);

  SpeedComp.value[characterEid] = 10;
  commonMovementSystem({
    world: world as any,
    delta: 1,
  });
  foodEatingSystem({
    world: world as any,
    delta: 0,
    currentTime: world.currentTime,
  });

  assertCharacterAtPosition(characterEid, destination);
  assert.equal(ObjectComp.state[characterEid], CharacterState.EATING);
  assert.equal(ObjectComp.state[foodEid], FoodState.BEING_INTAKEN);
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
  const foodEid = createLandedFood(world, { x: 104, y: 115 });
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
  createLandedFood(world, { x: 104, y: 115 });

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

test("로드 시 legacy eating 상태는 BEING_INTAKEN food를 추론해 이어간다", () => {
  const world = createTestWorld({ now: 27_000 });
  const characterEid = withMockedDateNow(27_000, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 3,
      x: 100,
      y: 130,
    }),
  );
  const foodEid = createLandedFood(world, { x: 104, y: 115 });

  foodEatingSystem({
    world: world as any,
    delta: 0,
    currentTime: world.currentTime,
  });
  moveToDestinationAndStartEating(world, characterEid);

  assert.equal(ObjectComp.state[characterEid], CharacterState.EATING);
  assert.equal(ObjectComp.state[foodEid], FoodState.BEING_INTAKEN);
  assert.equal(hasComponent(world, RandomMovementComp, characterEid), false);

  removeComponent(world, FoodEatingComp, characterEid);

  const { repairedCharacters, repairedFoods } =
    repairLoadedFoodInteractionState(world, world.currentTime);

  assert.deepEqual(repairedCharacters, [characterEid]);
  assert.deepEqual(repairedFoods, []);
  assert.equal(ObjectComp.state[characterEid], CharacterState.EATING);
  assert.equal(hasComponent(world, RandomMovementComp, characterEid), false);
  assert.ok(hasComponent(world, FoodEatingComp, characterEid));
  assert.equal(FoodEatingComp.targetFood[characterEid], foodEid);
  assert.equal(ObjectComp.state[foodEid], FoodState.BEING_INTAKEN);
});

test("캐릭터 크기별 식사 접근 위치는 음식 경계와 약 30px 겹친다", () => {
  const scenarios = [
    { characterKey: CharacterKeyECS.GreenSlimeA1, scale: 0.8 },
    { characterKey: CharacterKeyECS.GreenSlimeD1, scale: 1.2 },
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

test("음식 종류별 회복량 helper는 같은 texture에 대해 1~4 범위의 고정값을 반환한다", () => {
  const bonuses = Array.from({ length: 64 }, (_, index) =>
    getStaminaBonusForFoodTexture(TextureKey.FOOD1 + index),
  );
  const counts = new Map<number, number>();

  bonuses.forEach((bonus) => {
    assert.ok(bonus >= 1 && bonus <= 4);
    counts.set(bonus, (counts.get(bonus) ?? 0) + 1);
  });

  assert.equal(
    getStaminaBonusForFoodTexture(TextureKey.FOOD1),
    bonuses[0],
  );
  assert.equal(
    getStaminaBonusForFoodTexture(TextureKey.FOOD64),
    bonuses[63],
  );
  assert.ok(new Set(bonuses).size > 1);
  assert.ok((counts.get(2) ?? 0) > (counts.get(1) ?? 0));
  assert.ok((counts.get(3) ?? 0) > (counts.get(4) ?? 0));
});

test("FoodEatingComp와 FoodMaskComp는 저장-로드 시 round-trip된다", () => {
  const world = createTestWorld({ now: 30_000 });
  const characterEid = withMockedDateNow(30_000, () =>
    createTestCharacter(world, {
      state: CharacterState.EATING,
      stamina: 2,
      x: 100,
      y: 100,
    }),
  );
  const foodEid = createLandedFood(world, {
    x: 112,
    y: 112,
    freshness: Freshness.NORMAL,
  });

  ObjectComp.state[foodEid] = FoodState.BEING_INTAKEN;
  addComponent(world, FoodEatingComp, characterEid);
  FoodEatingComp.targetFood[characterEid] = foodEid;
  FoodEatingComp.targetFoodObjectId[characterEid] = ObjectComp.id[foodEid];
  FoodEatingComp.progress[characterEid] = 0.5;
  FoodEatingComp.duration[characterEid] = 3200;
  FoodEatingComp.elapsedTime[characterEid] = 1600;
  FoodEatingComp.isActive[characterEid] = 1;
  addComponent(world, FoodMaskComp, foodEid);
  FoodMaskComp.maskStoreIndex[foodEid] = 777;
  FoodMaskComp.progress[foodEid] = 0.5;
  FoodMaskComp.isInitialized[foodEid] = 1;

  const savedCharacter = convertECSEntityToSavedEntity(world, characterEid);
  const savedFood = convertECSEntityToSavedEntity(world, foodEid);

  assert.deepEqual(savedCharacter.components.foodEating, {
    targetFood: foodEid,
    targetFoodObjectId: ObjectComp.id[foodEid],
    progress: 0.5,
    duration: 3200,
    elapsedTime: 1600,
    isActive: true,
  });
  assert.deepEqual(savedFood.components.foodMask, {
    maskStoreIndex: ECS_NULL_VALUE,
    progress: 0.5,
    isInitialized: true,
  });

  const restoredWorld = createTestWorld({ now: 31_000 });
  const restoredCharacterEid = addEntity(restoredWorld);
  const restoredFoodEid = addEntity(restoredWorld);
  const staleSavedFood = {
    components: {
      ...savedFood.components,
      foodMask: {
        ...savedFood.components.foodMask!,
        maskStoreIndex: 777,
      },
    },
  };
  applySavedEntityToECS(restoredWorld, restoredCharacterEid, savedCharacter);
  applySavedEntityToECS(restoredWorld, restoredFoodEid, staleSavedFood);

  assert.ok(hasComponent(restoredWorld, FoodEatingComp, restoredCharacterEid));
  assert.ok(hasComponent(restoredWorld, FoodMaskComp, restoredFoodEid));
  assert.equal(FoodEatingComp.targetFood[restoredCharacterEid], foodEid);
  assert.equal(FoodEatingComp.progress[restoredCharacterEid], 0.5);
  assert.equal(FoodEatingComp.elapsedTime[restoredCharacterEid], 1600);
  assert.equal(FoodEatingComp.isActive[restoredCharacterEid], 1);
  assert.equal(FoodMaskComp.maskStoreIndex[restoredFoodEid], ECS_NULL_VALUE);
  assert.equal(FoodMaskComp.progress[restoredFoodEid], 0.5);
  assert.equal(FoodMaskComp.isInitialized[restoredFoodEid], 1);
});

test("음식 때문에 수면에서 깬 뒤 식사를 마치면 즉시 다시 잠든다", () => {
  const world = createTestWorld({
    now: 45_000,
    timeOfDay: TimeOfDay.Night,
  });
  const characterEid = withMockedDateNow(45_000, () =>
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
    currentTime: 45_000,
  });

  moveToDestinationAndStartEating(world, characterEid);
  SleepSystemComp.sleepMode[characterEid] = SleepMode.INTERRUPTED_AWAKE;
  SleepSystemComp.interruptedSleepMode[characterEid] = SleepMode.NIGHT_SLEEP;
  SleepSystemComp.pendingSleepReason[characterEid] = SleepReason.RESLEEP;
  SleepSystemComp.nextSleepTime[characterEid] = 0;

  foodEatingSystem({
    world: world as any,
    delta: 3_200,
    currentTime: 48_200,
  });

  assert.equal(ObjectComp.state[characterEid], CharacterState.SLEEPING);
  assert.equal(SleepSystemComp.sleepMode[characterEid], SleepMode.NIGHT_SLEEP);
  assert.equal(
    SleepSystemComp.pendingSleepReason[characterEid],
    SleepReason.NONE,
  );
  assert.equal(SleepSystemComp.nextSleepTime[characterEid], 0);
});
