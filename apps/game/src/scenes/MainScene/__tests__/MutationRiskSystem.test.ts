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
import { calculateMutationRate } from "../mutationConfig";

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

function createPoob(world: ReturnType<typeof createTestWorld>): number {
  const eid = addEntity(world);
  addComponent(world, ObjectComp, eid);

  ObjectComp.id[eid] = 20_000 + eid;
  ObjectComp.type[eid] = ObjectType.POOB;
  ObjectComp.state[eid] = 0;

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
    currentTime: HOUR_MS,
  });

  assert.equal(MutationRiskComp.unnecessaryInjectionStacks[characterEid], 9);
});

test("청소 가능한 오염원은 생성 직후부터 최소 1 dirty stack으로 반영된다", () => {
  const world = createTestWorld({ now: 0 });
  const characterEid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      characterKey: CharacterKeyECS.GreenSlimeA1,
    }),
  );
  const dirtyFoodEid = createDirtyFood(world);

  mutationRiskSystem({
    world: world as any,
    currentTime: 0,
  });

  assert.equal(DirtyExposureComp.stackCount[dirtyFoodEid], 0);
  assert.deepEqual(getMutationRiskStacks(world as any, characterEid), {
    unnecessaryInjectionStacks: 0,
    dirtyExposureStacks: 1,
  });
  assert.equal(
    calculateMutationRate({
      characterKey: CharacterKeyECS.GreenSlimeA1,
      unnecessaryInjectionStacks: 0,
      dirtyExposureStacks: 1,
    }),
    0.015,
  );
});

test("POOB는 DirtyExposureComp가 아직 없어도 active dirty stack으로 계산된다", () => {
  const world = createTestWorld({ now: 0 });
  const characterEid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      characterKey: CharacterKeyECS.GreenSlimeA1,
    }),
  );

  createPoob(world);

  assert.deepEqual(getMutationRiskStacks(world as any, characterEid), {
    unnecessaryInjectionStacks: 0,
    dirtyExposureStacks: 1,
  });
});

test("청소 완료 시 2시간 미만 노출 오염원도 최소 1 stack으로 이전한다", () => {
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
  finalizeDirtyExposureForEntity(world as any, dirtyFoodEid, HOUR_MS);

  assert.equal(hasComponent(world, DirtyExposureComp, dirtyFoodEid), false);
  assert.equal(MutationRiskComp.dirtyExposureStacks[characterEid], 1);
});

test("오염물별 2시간 노출마다 스택을 쌓고 제거 후 캐릭터 잔여 스택으로 이전한다", () => {
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
    currentTime: 4 * HOUR_MS,
  });

  assert.equal(DirtyExposureComp.stackCount[dirtyFoodEid], 2);
  assert.deepEqual(getMutationRiskStacks(world as any, characterEid), {
    unnecessaryInjectionStacks: 0,
    dirtyExposureStacks: 2,
  });

  finalizeDirtyExposureForEntity(world as any, dirtyFoodEid, 4 * HOUR_MS);

  assert.equal(hasComponent(world, DirtyExposureComp, dirtyFoodEid), false);
  assert.equal(MutationRiskComp.dirtyExposureStacks[characterEid], 2);

  mutationRiskSystem({
    world: world as any,
    currentTime: 6 * HOUR_MS,
  });

  assert.equal(MutationRiskComp.dirtyExposureStacks[characterEid], 2);
});
