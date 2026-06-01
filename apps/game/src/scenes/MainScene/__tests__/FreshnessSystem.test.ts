import assert from "node:assert/strict";
import test from "node:test";
import { addComponent, addEntity } from "bitecs";
import {
  FreshnessComp,
  FreshnessTimerComp,
  ObjectComp,
  PositionComp,
} from "../raw-components";
import { GAME_CONSTANTS } from "../config";
import { freshnessSystem } from "../systems/FreshnessSystem";
import { FoodState, Freshness, ObjectType } from "../types";
import { createTestWorld } from "../../../test-utils/mainSceneTestUtils";

test("freshness는 새 음식이 NORMAL로 시작하고 생성 후 10분 전까지 NORMAL을 유지한다", () => {
  const world = createTestWorld({ now: 0 });
  const foodEid = addEntity(world);

  addComponent(world, ObjectComp, foodEid);
  addComponent(world, PositionComp, foodEid);
  addComponent(world, FreshnessComp, foodEid);

  ObjectComp.id[foodEid] = 10_000 + foodEid;
  ObjectComp.type[foodEid] = ObjectType.FOOD;
  ObjectComp.state[foodEid] = FoodState.LANDED;
  PositionComp.x[foodEid] = 100;
  PositionComp.y[foodEid] = 100;
  FreshnessComp.freshness[foodEid] = Freshness.NORMAL;

  freshnessSystem({
    world: world as any,
    currentTime: 0,
  });
  assert.equal(FreshnessComp.freshness[foodEid], Freshness.NORMAL);

  freshnessSystem({
    world: world as any,
    currentTime:
      GAME_CONSTANTS.NORMAL_TO_STALE_TIME - 1,
  });
  assert.equal(FreshnessComp.freshness[foodEid], Freshness.NORMAL);

  freshnessSystem({
    world: world as any,
    currentTime: GAME_CONSTANTS.NORMAL_TO_STALE_TIME,
  });
  assert.equal(FreshnessComp.freshness[foodEid], Freshness.STALE);
  assert.equal(ObjectComp.state[foodEid], FoodState.LANDED);
});

test("저장된 freshness timer도 createdTime 기준 10분에 STALE로 전환된다", () => {
  const world = createTestWorld({ now: 0 });
  const foodEid = addEntity(world);
  const createdTime = 1_000;

  addComponent(world, ObjectComp, foodEid);
  addComponent(world, PositionComp, foodEid);
  addComponent(world, FreshnessComp, foodEid);
  addComponent(world, FreshnessTimerComp, foodEid);

  ObjectComp.id[foodEid] = 15_000 + foodEid;
  ObjectComp.type[foodEid] = ObjectType.FOOD;
  ObjectComp.state[foodEid] = FoodState.LANDED;
  PositionComp.x[foodEid] = 140;
  PositionComp.y[foodEid] = 95;
  FreshnessComp.freshness[foodEid] = Freshness.NORMAL;
  FreshnessTimerComp.createdTime[foodEid] = createdTime;
  FreshnessTimerComp.normalTime[foodEid] = GAME_CONSTANTS.FRESH_TO_NORMAL_TIME;
  FreshnessTimerComp.staleTime[foodEid] = GAME_CONSTANTS.NORMAL_TO_STALE_TIME;
  FreshnessTimerComp.isBeingEaten[foodEid] = 0;

  freshnessSystem({
    world: world as any,
    currentTime: createdTime + GAME_CONSTANTS.NORMAL_TO_STALE_TIME - 1,
  });
  assert.equal(FreshnessComp.freshness[foodEid], Freshness.NORMAL);

  freshnessSystem({
    world: world as any,
    currentTime: createdTime + GAME_CONSTANTS.NORMAL_TO_STALE_TIME,
  });
  assert.equal(FreshnessComp.freshness[foodEid], Freshness.STALE);
});

test("legacy fresh 저장값은 첫 tick에 NORMAL로 정규화된다", () => {
  const world = createTestWorld({ now: 0 });
  const foodEid = addEntity(world);

  addComponent(world, ObjectComp, foodEid);
  addComponent(world, PositionComp, foodEid);
  addComponent(world, FreshnessComp, foodEid);

  ObjectComp.id[foodEid] = 20_000 + foodEid;
  ObjectComp.type[foodEid] = ObjectType.FOOD;
  ObjectComp.state[foodEid] = FoodState.LANDED;
  PositionComp.x[foodEid] = 120;
  PositionComp.y[foodEid] = 80;
  FreshnessComp.freshness[foodEid] = Freshness.FRESH;

  freshnessSystem({
    world: world as any,
    currentTime: 0,
  });

  assert.equal(FreshnessComp.freshness[foodEid], Freshness.NORMAL);
});
