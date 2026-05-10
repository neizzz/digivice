import assert from "node:assert/strict";
import test from "node:test";
import {
  DestinationComp,
  PositionComp,
  RenderComp,
  SpeedComp,
} from "../raw-components";
import { commonMovementSystem } from "../systems/CommonMovementSystem";
import { getCharacterWorldBounds } from "../systems/CharacterDisplayBounds";
import { DestinationType } from "../types";
import { moveTowardsTarget } from "../utils/movementUtils";
import { createTestCharacter, createTestWorld } from "../../../test-utils/mainSceneTestUtils";

const SMALL_BOUNDARY = {
  x: 0,
  y: 0,
  width: 100,
  height: 100,
} as const;

test("idle 캐릭터도 화면 가장자리에서 실제 실루엣 기준 10px까지만 가려지도록 clamp된다", () => {
  const world = createTestWorld({
    now: 0,
    positionBoundary: SMALL_BOUNDARY,
  });
  const eid = createTestCharacter(world, {
    x: 0,
    y: 50,
  });

  RenderComp.scale[eid] = 4;

  commonMovementSystem({
    world: world as any,
    delta: 16,
  });

  const bounds = getCharacterWorldBounds(eid);

  assert.equal(PositionComp.x[eid], 22);
  assert.equal(bounds.leftX, -10);
  assert.equal(bounds.rightX, 54);
});

test("idle 캐릭터는 화면 상단에서 실제 실루엣 기준 20px까지 더 올라갈 수 있다", () => {
  const world = createTestWorld({
    now: 0,
    positionBoundary: SMALL_BOUNDARY,
  });
  const eid = createTestCharacter(world, {
    x: 50,
    y: 0,
  });

  RenderComp.scale[eid] = 4;

  commonMovementSystem({
    world: world as any,
    delta: 16,
  });

  const bounds = getCharacterWorldBounds(eid);

  assert.equal(PositionComp.y[eid], 12);
  assert.equal(bounds.topY, -20);
  assert.equal(bounds.bottomY, 44);
});

test("화면보다 큰 캐릭터는 허용 경계가 붕괴하면 비대칭 overflow를 반영한 축 기준점으로 고정된다", () => {
  const world = createTestWorld({
    now: 0,
    positionBoundary: SMALL_BOUNDARY,
  });
  const eid = createTestCharacter(world, {
    x: -200,
    y: -150,
  });

  RenderComp.scale[eid] = 30;

  commonMovementSystem({
    world: world as any,
    delta: 16,
  });

  assert.equal(PositionComp.x[eid], 50);
  assert.equal(PositionComp.y[eid], 45);
});

test("targeted movement도 캐릭터 허용 경계 안으로 clamp된 목적지로 이동한다", () => {
  const world = createTestWorld({
    now: 0,
    positionBoundary: SMALL_BOUNDARY,
  });
  const eid = createTestCharacter(world, {
    x: 50,
    y: 50,
  });

  RenderComp.scale[eid] = 4;
  SpeedComp.value[eid] = 1;
  DestinationComp.type[eid] = DestinationType.TARGETED;
  DestinationComp.x[eid] = 0;
  DestinationComp.y[eid] = 50;

  commonMovementSystem({
    world: world as any,
    delta: 100,
  });

  assert.equal(PositionComp.x[eid], 22);
  assert.equal(PositionComp.y[eid], 50);
});

test("moveTowardsTarget는 화면 밖 목적지도 clamp된 지점 기준으로 도착 판정한다", () => {
  const world = createTestWorld({
    now: 0,
    positionBoundary: SMALL_BOUNDARY,
  });
  const eid = createTestCharacter(world, {
    x: 22,
    y: 50,
  });

  RenderComp.scale[eid] = 4;
  DestinationComp.type[eid] = DestinationType.TARGETED;
  DestinationComp.x[eid] = 0;
  DestinationComp.y[eid] = 50;

  const result = moveTowardsTarget(world as any, eid, 16);

  assert.equal(result.distance, 0);
  assert.equal(result.hasArrived, true);
});
