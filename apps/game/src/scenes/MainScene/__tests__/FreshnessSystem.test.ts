import assert from "node:assert/strict";
import test from "node:test";
import { addComponent, addEntity } from "bitecs";
import {
  FreshnessComp,
  ObjectComp,
  PositionComp,
} from "../raw-components";
import { GAME_CONSTANTS } from "../config";
import { freshnessSystem } from "../systems/FreshnessSystem";
import { FoodState, Freshness, ObjectType } from "../types";
import { createTestWorld } from "../../../test-utils/mainSceneTestUtils";

test("freshness는 설정된 FRESH/NORMAL 지속시간을 기준으로 단계 전환된다", () => {
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
  FreshnessComp.freshness[foodEid] = Freshness.FRESH;

  freshnessSystem({
    world: world as any,
    currentTime: 0,
  });

  freshnessSystem({
    world: world as any,
    currentTime: GAME_CONSTANTS.FRESH_TO_NORMAL_TIME - 1,
  });
  assert.equal(FreshnessComp.freshness[foodEid], Freshness.FRESH);

  freshnessSystem({
    world: world as any,
    currentTime: GAME_CONSTANTS.FRESH_TO_NORMAL_TIME,
  });
  assert.equal(FreshnessComp.freshness[foodEid], Freshness.NORMAL);

  freshnessSystem({
    world: world as any,
    currentTime:
      GAME_CONSTANTS.FRESH_TO_NORMAL_TIME +
      GAME_CONSTANTS.NORMAL_TO_STALE_TIME -
      1,
  });
  assert.equal(FreshnessComp.freshness[foodEid], Freshness.NORMAL);

  freshnessSystem({
    world: world as any,
    currentTime:
      GAME_CONSTANTS.FRESH_TO_NORMAL_TIME +
      GAME_CONSTANTS.NORMAL_TO_STALE_TIME,
  });
  assert.equal(FreshnessComp.freshness[foodEid], Freshness.STALE);
  assert.equal(ObjectComp.state[foodEid], FoodState.LANDED);
});
