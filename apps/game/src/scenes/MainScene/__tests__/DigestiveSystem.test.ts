import assert from "node:assert/strict";
import test from "node:test";
import { addComponent, addEntity, defineQuery } from "bitecs";
import {
  DigestiveSystemComp,
  ObjectComp,
  PositionComp,
  RenderComp,
} from "../raw-components";
import { GAME_CONSTANTS } from "../config";
import {
  addDigestiveLoadAmount,
  createPoop,
  digestiveSystem,
} from "../systems/DigestiveSystem";
import { FoodState, ObjectType } from "../types";
import {
  createTestCharacter,
  createTestWorld,
  withMockedDateNow,
  withMockedRandom,
} from "../../../test-utils/mainSceneTestUtils";

const objectQuery = defineQuery([ObjectComp]);

test("최대 용량을 넘는 소화 부하는 초과분을 2배로 반영한다", () => {
  const world = createTestWorld({ now: 1_000 });
  const characterEid = withMockedDateNow(1_000, () =>
    createTestCharacter(world, {
      stamina: 5,
      x: 100,
      y: 100,
    }),
  );

  DigestiveSystemComp.currentLoad[characterEid] = 4;

  addDigestiveLoadAmount(world as any, characterEid, 3, 1_000);

  assert.equal(DigestiveSystemComp.currentLoad[characterEid], 9);
  assert.equal(
    DigestiveSystemComp.nextPoopTime[characterEid],
    1_000 + GAME_CONSTANTS.POOP_DELAY,
  );
  assert.equal(DigestiveSystemComp.nextSmallPoopTime[characterEid], 0);
});

test("이미 최대 용량을 넘긴 상태에서 추가되는 소화 부하는 전부 2배로 반영한다", () => {
  const world = createTestWorld({ now: 2_000 });
  const characterEid = withMockedDateNow(2_000, () =>
    createTestCharacter(world, {
      stamina: 5,
      x: 120,
      y: 100,
    }),
  );

  DigestiveSystemComp.currentLoad[characterEid] = 6;

  addDigestiveLoadAmount(world as any, characterEid, 2, 2_000);

  assert.equal(DigestiveSystemComp.currentLoad[characterEid], 10);
  assert.equal(
    DigestiveSystemComp.nextPoopTime[characterEid],
    2_000 + GAME_CONSTANTS.POOP_DELAY,
  );
  assert.equal(DigestiveSystemComp.nextSmallPoopTime[characterEid], 0);
});

test("용량 이하 digestive load가 생기면 작은 똥 타이머를 예약한다", () => {
  const world = createTestWorld({ now: 3_000 });
  const characterEid = withMockedDateNow(3_000, () =>
    createTestCharacter(world, {
      stamina: 5,
      x: 140,
      y: 120,
    }),
  );

  addDigestiveLoadAmount(world as any, characterEid, 2, 3_000);

  assert.equal(DigestiveSystemComp.currentLoad[characterEid], 2);
  assert.equal(DigestiveSystemComp.nextPoopTime[characterEid], 0);
  assert.equal(
    DigestiveSystemComp.nextSmallPoopTime[characterEid],
    3_000 + GAME_CONSTANTS.DIGESTIVE_SMALL_POOP_DELAY,
  );
});

test("용량 이하 상태에서 추가 식사를 해도 작은 똥 타이머는 최초 예약 시각을 유지한다", () => {
  const world = createTestWorld({ now: 4_000 });
  const characterEid = withMockedDateNow(4_000, () =>
    createTestCharacter(world, {
      stamina: 5,
      x: 160,
      y: 120,
    }),
  );

  addDigestiveLoadAmount(world as any, characterEid, 1, 4_000);
  const initialSmallPoopTime =
    DigestiveSystemComp.nextSmallPoopTime[characterEid];

  addDigestiveLoadAmount(world as any, characterEid, 2, 5_000);

  assert.equal(DigestiveSystemComp.currentLoad[characterEid], 3);
  assert.equal(DigestiveSystemComp.nextPoopTime[characterEid], 0);
  assert.equal(
    DigestiveSystemComp.nextSmallPoopTime[characterEid],
    initialSmallPoopTime,
  );
});

test("용량 이하 타이머가 있던 상태에서 용량을 초과하면 작은 똥 타이머가 취소되고 일반 똥 타이머로 전환된다", () => {
  const world = createTestWorld({ now: 5_000 });
  const characterEid = withMockedDateNow(5_000, () =>
    createTestCharacter(world, {
      stamina: 5,
      x: 180,
      y: 120,
    }),
  );

  addDigestiveLoadAmount(world as any, characterEid, 2, 5_000);
  addDigestiveLoadAmount(world as any, characterEid, 4, 6_000);

  assert.equal(DigestiveSystemComp.currentLoad[characterEid], 7);
  assert.equal(
    DigestiveSystemComp.nextPoopTime[characterEid],
    6_000 + GAME_CONSTANTS.POOP_DELAY,
  );
  assert.equal(DigestiveSystemComp.nextSmallPoopTime[characterEid], 0);
});

test("8시간 동안 용량을 넘지 않은 digestive load는 작은 똥으로 배출되고 0으로 초기화된다", () => {
  const world = createTestWorld({ now: 6_000 });
  const characterEid = withMockedDateNow(6_000, () =>
    createTestCharacter(world, {
      stamina: 5,
      x: 200,
      y: 120,
    }),
  );

  addDigestiveLoadAmount(world as any, characterEid, 2, 6_000);

  digestiveSystem({
    world: world as any,
    currentTime: 6_000 + GAME_CONSTANTS.DIGESTIVE_SMALL_POOP_DELAY - 1,
  });

  const beforePoopPoobs = objectQuery(world).filter(
    (eid) => ObjectComp.type[eid] === ObjectType.POOB,
  );
  assert.equal(beforePoopPoobs.length, 0);
  assert.equal(DigestiveSystemComp.currentLoad[characterEid], 2);

  withMockedRandom(0, () => {
    digestiveSystem({
      world: world as any,
      currentTime: 6_000 + GAME_CONSTANTS.DIGESTIVE_SMALL_POOP_DELAY,
    });
  });

  const afterPoopPoobs = objectQuery(world).filter(
    (eid) => ObjectComp.type[eid] === ObjectType.POOB,
  );
  assert.equal(afterPoopPoobs.length, 1);
  assert.equal(DigestiveSystemComp.currentLoad[characterEid], 0);
  assert.equal(DigestiveSystemComp.nextPoopTime[characterEid], 0);
  assert.equal(DigestiveSystemComp.nextSmallPoopTime[characterEid], 0);
  assert.ok(RenderComp.scale[afterPoopPoobs[0]] >= 2.0);
  assert.ok(RenderComp.scale[afterPoopPoobs[0]] <= 2.4);
});

test("일반 똥 배출 후 남은 load가 용량 이하이면 그 시점부터 작은 똥 타이머를 다시 잡는다", () => {
  const world = createTestWorld({ now: 7_000 });
  const characterEid = withMockedDateNow(7_000, () =>
    createTestCharacter(world, {
      stamina: 5,
      x: 220,
      y: 120,
    }),
  );

  DigestiveSystemComp.currentLoad[characterEid] = 9;
  DigestiveSystemComp.nextPoopTime[characterEid] =
    7_000 + GAME_CONSTANTS.POOP_DELAY;
  DigestiveSystemComp.nextSmallPoopTime[characterEid] = 0;

  digestiveSystem({
    world: world as any,
    currentTime: 7_000 + GAME_CONSTANTS.POOP_DELAY,
  });

  assert.equal(DigestiveSystemComp.currentLoad[characterEid], 4);
  assert.equal(DigestiveSystemComp.nextPoopTime[characterEid], 0);
  assert.equal(
    DigestiveSystemComp.nextSmallPoopTime[characterEid],
    7_000 +
      GAME_CONSTANTS.POOP_DELAY +
      GAME_CONSTANTS.DIGESTIVE_SMALL_POOP_DELAY,
  );
});

test("기본 poop 위치에 food가 있으면 재시도 후보 위치를 선택한다", () => {
  const world = createTestWorld({ now: 8_000 });
  const characterEid = withMockedDateNow(8_000, () =>
    createTestCharacter(world, {
      stamina: 5,
      x: 200,
      y: 200,
    }),
  );
  const blockingFoodEid = createPositionedObject(world, {
    type: ObjectType.FOOD,
    x: 175,
    y: 200,
    state: FoodState.LANDED,
  });

  withMockedRandomSequence([1, 1, 0], () => {
    createPoop(world as any, characterEid);
  });

  const spawnedPoopEid = objectQuery(world).find(
    (eid) => ObjectComp.type[eid] === ObjectType.POOB,
  );
  assert.notEqual(spawnedPoopEid, undefined);

  const distanceFromBlockingFood = getDistanceBetweenEntities(
    spawnedPoopEid as number,
    blockingFoodEid,
  );

  assert.ok(
    distanceFromBlockingFood >= GAME_CONSTANTS.POOP_SPAWN_MIN_OBJECT_SPACING,
    `expected spawned poop to keep at least ${GAME_CONSTANTS.POOP_SPAWN_MIN_OBJECT_SPACING}px from blocking food, got ${distanceFromBlockingFood}`,
  );
  assert.notEqual(PositionComp.x[spawnedPoopEid as number], 175);
});

test("재시도 후보가 모두 실패하면 기존 poop 위치로 폴백한다", () => {
  const world = createTestWorld({ now: 9_000 });
  const characterEid = withMockedDateNow(9_000, () =>
    createTestCharacter(world, {
      stamina: 5,
      x: 200,
      y: 200,
    }),
  );
  const blockingPoobEid = createPositionedObject(world, {
    type: ObjectType.POOB,
    x: 175,
    y: 200,
  });

  withMockedRandom(0.5, () => {
    createPoop(world as any, characterEid);
  });

  const spawnedPoopEid = objectQuery(world).find(
    (eid) => ObjectComp.type[eid] === ObjectType.POOB && eid !== blockingPoobEid,
  );
  assert.notEqual(spawnedPoopEid, undefined);
  assert.equal(PositionComp.x[spawnedPoopEid as number], 175);
  assert.equal(PositionComp.y[spawnedPoopEid as number], 200);
});

function createPositionedObject(
  world: ReturnType<typeof createTestWorld>,
  options: {
    type: ObjectType;
    x: number;
    y: number;
    state?: number;
  },
): number {
  const eid = addEntity(world);

  addComponent(world, ObjectComp, eid);
  addComponent(world, PositionComp, eid);

  ObjectComp.id[eid] = 10_000 + eid;
  ObjectComp.type[eid] = options.type;
  ObjectComp.state[eid] = options.state ?? 0;
  PositionComp.x[eid] = options.x;
  PositionComp.y[eid] = options.y;

  return eid;
}

function withMockedRandomSequence<T>(values: number[], fn: () => T): T {
  const originalRandom = Math.random;
  let index = 0;

  Math.random = () => {
    const value = values[Math.min(index, values.length - 1)] ?? 0;
    index += 1;
    return value;
  };

  try {
    return fn();
  } finally {
    Math.random = originalRandom;
  }
}

function getDistanceBetweenEntities(firstEid: number, secondEid: number): number {
  const deltaX = PositionComp.x[firstEid] - PositionComp.x[secondEid];
  const deltaY = PositionComp.y[firstEid] - PositionComp.y[secondEid];

  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}
