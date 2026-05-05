import assert from "node:assert/strict";
import test from "node:test";
import { addComponent, addEntity, hasComponent, removeComponent } from "bitecs";
import {
  CharacterStatusComp,
  DestinationComp,
  DiseaseSystemComp,
  FoodEatingComp,
  FoodMaskComp,
  FreshnessComp,
  ObjectComp,
  PositionComp,
  RandomMovementComp,
  SleepSystemComp,
  SpeedComp,
} from "../raw-components";
import { GAME_CONSTANTS } from "../config";
import {
  calculateDiseaseRate,
  diseaseSystem,
} from "../systems/DiseaseSystem";
import { foodEatingSystem } from "../systems/FoodEatingSystem";
import {
  CharacterState,
  CharacterStatus,
  DestinationType,
  FoodState,
  Freshness,
  ObjectType,
} from "../types";
import {
  createTestCharacter,
  createTestWorld,
  setWorldTime,
  withMockedDateNow,
  withMockedRandom,
} from "../../../test-utils/mainSceneTestUtils";

test("sick 상태는 현재 movement restriction을 걸고 회복되면 복원한다", () => {
  const world = createTestWorld({ now: 20_000 });
  const eid = withMockedDateNow(20_000, () =>
    createTestCharacter(world, {
      state: CharacterState.SICK,
      stamina: 5,
    }),
  );

  CharacterStatusComp.statuses[eid][0] = CharacterStatus.SICK;

  diseaseSystem({
    world: world as any,
    currentTime: 20_000,
  });

  assert.equal(hasComponent(world, RandomMovementComp, eid), false);
  assert.equal(hasComponent(world, DestinationComp, eid), false);

  CharacterStatusComp.statuses[eid][0] = ECS_NULL_VALUE;
  ObjectComp.state[eid] = CharacterState.IDLE;

  diseaseSystem({
    world: world as any,
    currentTime: 20_001,
  });

  assert.equal(hasComponent(world, RandomMovementComp, eid), true);
});

test("이미 sick 상태면 TARGETED food를 다시 LANDED로 돌린다", () => {
  const world = createTestWorld({ now: 30_000 });
  const characterEid = withMockedDateNow(30_000, () =>
    createTestCharacter(world, {
      state: CharacterState.MOVING,
      stamina: 3,
      x: 100,
      y: 100,
    }),
  );

  const foodEid = addEntity(world);
  addComponent(world, ObjectComp, foodEid);
  addComponent(world, PositionComp, foodEid);
  addComponent(world, FreshnessComp, foodEid);

  ObjectComp.id[foodEid] = 10_000 + foodEid;
  ObjectComp.type[foodEid] = ObjectType.FOOD;
  ObjectComp.state[foodEid] = FoodState.TARGETED;
  PositionComp.x[foodEid] = 140;
  PositionComp.y[foodEid] = 120;
  FreshnessComp.freshness[foodEid] = Freshness.NORMAL;

  addComponent(world, DestinationComp, characterEid);
  DestinationComp.type[characterEid] = DestinationType.TARGETED;
  DestinationComp.target[characterEid] = foodEid;

  CharacterStatusComp.statuses[characterEid][0] = CharacterStatus.SICK;
  ObjectComp.state[characterEid] = CharacterState.SICK;

  diseaseSystem({
    world: world as any,
    currentTime: 30_000,
  });

  assert.equal(hasComponent(world, DestinationComp, characterEid), false);
  assert.equal(ObjectComp.state[foodEid], FoodState.LANDED);
});

test("sick 치료 후에는 다시 주변 LANDED food를 탐색한다", () => {
  const world = createTestWorld({ now: 40_000 });
  const characterEid = withMockedDateNow(40_000, () =>
    createTestCharacter(world, {
      state: CharacterState.MOVING,
      stamina: 3,
      x: 100,
      y: 100,
    }),
  );

  const foodEid = addEntity(world);
  addComponent(world, ObjectComp, foodEid);
  addComponent(world, PositionComp, foodEid);
  addComponent(world, FreshnessComp, foodEid);

  ObjectComp.id[foodEid] = 20_000 + foodEid;
  ObjectComp.type[foodEid] = ObjectType.FOOD;
  ObjectComp.state[foodEid] = FoodState.TARGETED;
  PositionComp.x[foodEid] = 180;
  PositionComp.y[foodEid] = 100;
  FreshnessComp.freshness[foodEid] = Freshness.NORMAL;

  addComponent(world, DestinationComp, characterEid);
  DestinationComp.target[characterEid] = foodEid;

  CharacterStatusComp.statuses[characterEid][0] = CharacterStatus.SICK;
  ObjectComp.state[characterEid] = CharacterState.SICK;

  diseaseSystem({
    world: world as any,
    currentTime: 40_000,
  });

  CharacterStatusComp.statuses[characterEid][0] = ECS_NULL_VALUE;
  ObjectComp.state[characterEid] = CharacterState.IDLE;
  setWorldTime(world, 40_001);

  diseaseSystem({
    world: world as any,
    currentTime: 40_001,
  });

  foodEatingSystem({
    world: world as any,
    delta: 0,
    currentTime: 40_001,
  });

  assert.equal(hasComponent(world, DestinationComp, characterEid), true);
  assert.equal(DestinationComp.target[characterEid], foodEid);
  assert.equal(ObjectComp.state[foodEid], FoodState.TARGETED);
});

test("음식을 먹으러 가는 중에는 disease check로 sick가 되지 않는다", () => {
  const now = 50_000;
  const world = createTestWorld({ now });
  const characterEid = withMockedDateNow(now, () =>
    createTestCharacter(world, {
      state: CharacterState.MOVING,
      stamina: 1.5,
      x: 100,
      y: 100,
    }),
  );

  const foodEid = addEntity(world);
  addComponent(world, ObjectComp, foodEid);
  addComponent(world, PositionComp, foodEid);
  addComponent(world, FreshnessComp, foodEid);
  ObjectComp.id[foodEid] = 30_000 + foodEid;
  ObjectComp.type[foodEid] = ObjectType.FOOD;
  ObjectComp.state[foodEid] = FoodState.TARGETED;
  PositionComp.x[foodEid] = 140;
  PositionComp.y[foodEid] = 120;
  FreshnessComp.freshness[foodEid] = Freshness.NORMAL;

  addComponent(world, DestinationComp, characterEid);
  DestinationComp.type[characterEid] = DestinationType.TARGETED;
  DestinationComp.target[characterEid] = foodEid;
  DiseaseSystemComp.nextCheckTime[characterEid] = now;
  SleepSystemComp.fatigue[characterEid] =
    GAME_CONSTANTS.FATIGUE_DISEASE_THRESHOLD_EXHAUSTED;

  withMockedRandom(0, () => {
    diseaseSystem({
      world: world as any,
      currentTime: now,
    });
  });

  assert.equal(ObjectComp.state[characterEid], CharacterState.MOVING);
  assert.equal(CharacterStatusComp.statuses[characterEid][0], ECS_NULL_VALUE);
  assert.equal(hasComponent(world, DestinationComp, characterEid), true);
  assert.equal(ObjectComp.state[foodEid], FoodState.TARGETED);
  assert.equal(
    DiseaseSystemComp.nextCheckTime[characterEid],
    now + GAME_CONSTANTS.DISEASE_CHECK_INTERVAL,
  );

  removeComponent(world, DestinationComp, characterEid);
  ObjectComp.state[characterEid] = CharacterState.IDLE;
  setWorldTime(world, now + GAME_CONSTANTS.DISEASE_CHECK_INTERVAL);

  withMockedRandom(0, () => {
    diseaseSystem({
      world: world as any,
      currentTime: now + GAME_CONSTANTS.DISEASE_CHECK_INTERVAL,
    });
  });

  assert.equal(ObjectComp.state[characterEid], CharacterState.SICK);
  assert.equal(
    CharacterStatusComp.statuses[characterEid][0],
    CharacterStatus.SICK,
  );
});

test("이미 sick 상태인 캐릭터가 음식을 먹고 있으면 식사를 즉시 취소하고 음식을 되돌린다", () => {
  const now = 55_000;
  const world = createTestWorld({ now });
  const characterEid = withMockedDateNow(now, () =>
    createTestCharacter(world, {
      state: CharacterState.EATING,
      stamina: 3,
      x: 100,
      y: 100,
    }),
  );

  const foodEid = addEntity(world);
  addComponent(world, ObjectComp, foodEid);
  addComponent(world, PositionComp, foodEid);
  addComponent(world, FreshnessComp, foodEid);
  addComponent(world, FoodMaskComp, foodEid);

  ObjectComp.id[foodEid] = 35_000 + foodEid;
  ObjectComp.type[foodEid] = ObjectType.FOOD;
  ObjectComp.state[foodEid] = FoodState.BEING_INTAKEN;
  PositionComp.x[foodEid] = 112;
  PositionComp.y[foodEid] = 112;
  FreshnessComp.freshness[foodEid] = Freshness.NORMAL;
  FoodMaskComp.progress[foodEid] = 0.5;
  FoodMaskComp.isInitialized[foodEid] = 1;
  FoodMaskComp.maskStoreIndex[foodEid] = ECS_NULL_VALUE;

  addComponent(world, FoodEatingComp, characterEid);
  FoodEatingComp.targetFood[characterEid] = foodEid;
  FoodEatingComp.progress[characterEid] = 0.5;
  FoodEatingComp.duration[characterEid] = 3200;
  FoodEatingComp.elapsedTime[characterEid] = 1600;
  FoodEatingComp.isActive[characterEid] = 1;

  CharacterStatusComp.statuses[characterEid][0] = CharacterStatus.SICK;
  ObjectComp.state[characterEid] = CharacterState.SICK;
  SpeedComp.value[characterEid] = 0;

  const staminaBefore = CharacterStatusComp.stamina[characterEid];

  diseaseSystem({
    world: world as any,
    currentTime: now,
  });

  assert.equal(hasComponent(world, FoodEatingComp, characterEid), false);
  assert.equal(hasComponent(world, FoodMaskComp, foodEid), false);
  assert.equal(ObjectComp.state[foodEid], FoodState.LANDED);

  foodEatingSystem({
    world: world as any,
    delta: 3200,
    currentTime: now + 3200,
  });

  assert.equal(CharacterStatusComp.stamina[characterEid], staminaBefore);
  assert.equal(hasComponent(world, ObjectComp, foodEid), true);
  assert.equal(ObjectComp.state[foodEid], FoodState.LANDED);
});

test("음식을 먹는 중에는 disease check로 sick가 되지 않는다", () => {
  const now = 57_000;
  const world = createTestWorld({ now });
  const characterEid = withMockedDateNow(now, () =>
    createTestCharacter(world, {
      state: CharacterState.EATING,
      stamina: 1.5,
      x: 100,
      y: 100,
    }),
  );

  const foodEid = addEntity(world);
  addComponent(world, ObjectComp, foodEid);
  addComponent(world, PositionComp, foodEid);
  addComponent(world, FreshnessComp, foodEid);
  addComponent(world, FoodMaskComp, foodEid);

  ObjectComp.id[foodEid] = 37_000 + foodEid;
  ObjectComp.type[foodEid] = ObjectType.FOOD;
  ObjectComp.state[foodEid] = FoodState.BEING_INTAKEN;
  PositionComp.x[foodEid] = 112;
  PositionComp.y[foodEid] = 112;
  FreshnessComp.freshness[foodEid] = Freshness.NORMAL;
  FoodMaskComp.progress[foodEid] = 0.5;
  FoodMaskComp.isInitialized[foodEid] = 1;
  FoodMaskComp.maskStoreIndex[foodEid] = ECS_NULL_VALUE;

  addComponent(world, FoodEatingComp, characterEid);
  FoodEatingComp.targetFood[characterEid] = foodEid;
  FoodEatingComp.progress[characterEid] = 0.5;
  FoodEatingComp.duration[characterEid] = 3200;
  FoodEatingComp.elapsedTime[characterEid] = 1600;
  FoodEatingComp.isActive[characterEid] = 1;

  DiseaseSystemComp.nextCheckTime[characterEid] = now;
  SleepSystemComp.fatigue[characterEid] =
    GAME_CONSTANTS.FATIGUE_DISEASE_THRESHOLD_EXHAUSTED;

  withMockedRandom(0, () => {
    diseaseSystem({
      world: world as any,
      currentTime: now,
    });
  });

  assert.equal(ObjectComp.state[characterEid], CharacterState.EATING);
  assert.equal(CharacterStatusComp.statuses[characterEid][0], ECS_NULL_VALUE);
  assert.equal(hasComponent(world, FoodEatingComp, characterEid), true);
  assert.equal(hasComponent(world, FoodMaskComp, foodEid), true);
  assert.equal(ObjectComp.state[foodEid], FoodState.BEING_INTAKEN);
});

test("egg 상태 캐릭터는 disease check로 sick가 되지 않는다", () => {
  const now = 58_000;
  const world = createTestWorld({ now });
  const eid = withMockedDateNow(now, () =>
    createTestCharacter(world, {
      state: CharacterState.EGG,
      stamina: 1,
      x: 100,
      y: 100,
    }),
  );

  DiseaseSystemComp.nextCheckTime[eid] = now;
  SleepSystemComp.fatigue[eid] =
    GAME_CONSTANTS.FATIGUE_DISEASE_THRESHOLD_EXHAUSTED;

  withMockedRandom(0, () => {
    diseaseSystem({
      world: world as any,
      currentTime: now,
    });
  });

  assert.equal(ObjectComp.state[eid], CharacterState.EGG);
  assert.equal(CharacterStatusComp.statuses[eid][0], 0);
  assert.equal(DiseaseSystemComp.sickStartTime[eid], 0);
  assert.equal(hasComponent(world, RandomMovementComp, eid), false);
  assert.equal(
    DiseaseSystemComp.nextCheckTime[eid],
    now + GAME_CONSTANTS.DISEASE_CHECK_INTERVAL,
  );
});

test("egg 상태에 남아 있던 sick 흔적은 즉시 정리된다", () => {
  const now = 59_000;
  const world = createTestWorld({ now });
  const eid = withMockedDateNow(now, () =>
    createTestCharacter(world, {
      state: CharacterState.EGG,
      stamina: 2,
      x: 100,
      y: 100,
    }),
  );

  CharacterStatusComp.statuses[eid][0] = CharacterStatus.SICK;
  DiseaseSystemComp.sickStartTime[eid] = now - 1_000;
  DiseaseSystemComp.nextCheckTime[eid] = now;

  diseaseSystem({
    world: world as any,
    currentTime: now,
  });

  assert.equal(ObjectComp.state[eid], CharacterState.EGG);
  assert.equal(CharacterStatusComp.statuses[eid][0], 0);
  assert.equal(DiseaseSystemComp.sickStartTime[eid], 0);
  assert.equal(hasComponent(world, RandomMovementComp, eid), false);
  assert.equal(
    DiseaseSystemComp.nextCheckTime[eid],
    now + GAME_CONSTANTS.DISEASE_CHECK_INTERVAL,
  );
});

test("질병 확률은 낮은 스테미나와 높은 피로도 구간 보정을 함께 반영한다", () => {
  const world = createTestWorld({ now: 60_000 });
  const eid = withMockedDateNow(60_000, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 1.5,
    }),
  );

  SleepSystemComp.fatigue[eid] =
    GAME_CONSTANTS.FATIGUE_DISEASE_THRESHOLD_EXHAUSTED;

  const { rate, breakdown } = calculateDiseaseRate(world as any, eid);
  const expectedRate =
    GAME_CONSTANTS.BASE_DISEASE_RATE +
    GAME_CONSTANTS.VERY_LOW_STAMINA_DISEASE_BONUS +
    GAME_CONSTANTS.FATIGUE_DISEASE_BONUS_EXHAUSTED;

  assert.equal(breakdown.stamina, 1.5);
  assert.equal(
    breakdown.lowStaminaBonus,
    GAME_CONSTANTS.VERY_LOW_STAMINA_DISEASE_BONUS,
  );
  assert.equal(
    breakdown.fatigueBonus,
    GAME_CONSTANTS.FATIGUE_DISEASE_BONUS_EXHAUSTED,
  );
  assert.equal(
    breakdown.staminaFatigueMultiplier,
    GAME_CONSTANTS.CRITICAL_STAMINA_FATIGUE_AWAKE_GAIN_MULTIPLIER,
  );
  assert.equal(rate, expectedRate);
});

test("잠자는 도중 sick가 되면 수면 상태를 유지한 채 sickness만 추가한다", () => {
  const now = 70_000;
  const world = createTestWorld({ now });
  const eid = withMockedDateNow(now, () =>
    createTestCharacter(world, {
      state: CharacterState.SLEEPING,
      stamina: 1,
    }),
  );

  SleepSystemComp.fatigue[eid] =
    GAME_CONSTANTS.FATIGUE_DISEASE_THRESHOLD_EXHAUSTED;
  DiseaseSystemComp.nextCheckTime[eid] = now;

  withMockedRandom(0, () => {
    diseaseSystem({
      world: world as any,
      currentTime: now,
    });
  });

  assert.equal(ObjectComp.state[eid], CharacterState.SLEEPING);
  assert.equal(CharacterStatusComp.statuses[eid][0], CharacterStatus.SICK);
  assert.equal(DiseaseSystemComp.sickStartTime[eid], now);
});
