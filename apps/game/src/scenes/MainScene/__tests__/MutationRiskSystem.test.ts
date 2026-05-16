import assert from "node:assert/strict";
import test from "node:test";
import { addComponent, addEntity, hasComponent } from "bitecs";
import {
  DirtyExposureComp,
  FreshnessComp,
  MutationRiskComp,
  ObjectComp,
  PositionComp,
} from "../raw-components";
import {
  finalizeDirtyExposureForEntity,
  getMutationRiskStacks,
  mutationRiskSystem,
  recordUnnecessaryMutationInjection,
} from "../systems/MutationRiskSystem";
import {
  CharacterKeyECS,
  CharacterState,
  FoodState,
  Freshness,
  ObjectType,
} from "../types";
import {
  createTestCharacter,
  createTestWorld,
  withMockedDateNow,
} from "../../../test-utils/mainSceneTestUtils";

const HOUR_MS = 60 * 60 * 1000;

function createDirtyFood(world: ReturnType<typeof createTestWorld>): number {
  const eid = addEntity(world);
  addComponent(world, ObjectComp, eid);
  addComponent(world, PositionComp, eid);
  addComponent(world, FreshnessComp, eid);

  ObjectComp.id[eid] = 10_000 + eid;
  ObjectComp.type[eid] = ObjectType.FOOD;
  ObjectComp.state[eid] = FoodState.LANDED;
  PositionComp.x[eid] = 100;
  PositionComp.y[eid] = 100;
  FreshnessComp.freshness[eid] = Freshness.STALE;

  return eid;
}

test("성체 비질병 주사는 주사 스택을 최대 10까지 누적하고 클래스별 주기로 디톡스된다", () => {
  const world = createTestWorld({ now: 0 });
  const characterEid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      characterKey: CharacterKeyECS.GreenSlimeA1,
    }),
  );

  for (let i = 0; i < 12; i++) {
    recordUnnecessaryMutationInjection(world as any, characterEid, 0);
  }

  assert.equal(
    MutationRiskComp.unnecessaryInjectionStacks[characterEid],
    10,
  );

  mutationRiskSystem({
    world: world as any,
    currentTime: 2 * HOUR_MS,
  });

  assert.equal(MutationRiskComp.unnecessaryInjectionStacks[characterEid], 9);
});

test("오염물별 4시간 노출마다 스택을 쌓고 제거 후 캐릭터 잔여 스택으로 이전한다", () => {
  const world = createTestWorld({ now: 0 });
  const characterEid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      characterKey: CharacterKeyECS.SoilSlimeB1,
    }),
  );
  const dirtyFoodEid = createDirtyFood(world);

  mutationRiskSystem({
    world: world as any,
    currentTime: 0,
  });
  mutationRiskSystem({
    world: world as any,
    currentTime: 8 * HOUR_MS,
  });

  assert.equal(DirtyExposureComp.stackCount[dirtyFoodEid], 2);
  assert.deepEqual(getMutationRiskStacks(world as any, characterEid), {
    unnecessaryInjectionStacks: 0,
    dirtyExposureStacks: 2,
  });

  finalizeDirtyExposureForEntity(world as any, dirtyFoodEid, 8 * HOUR_MS);

  assert.equal(hasComponent(world, DirtyExposureComp, dirtyFoodEid), false);
  assert.equal(MutationRiskComp.dirtyExposureStacks[characterEid], 2);

  mutationRiskSystem({
    world: world as any,
    currentTime: 12 * HOUR_MS,
  });

  assert.equal(MutationRiskComp.dirtyExposureStacks[characterEid], 1);
});
