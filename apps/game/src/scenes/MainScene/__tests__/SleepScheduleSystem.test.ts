import assert from "node:assert/strict";
import test from "node:test";
import { addComponent, addEntity, removeComponent } from "bitecs";
import {
  CharacterStatusComp,
  DestinationComp,
  DiseaseSystemComp,
  FreshnessComp,
  ObjectComp,
  PositionComp,
  SleepSystemComp,
  TemporaryStatusComp,
} from "../raw-components";
import {
  GAME_CONSTANTS,
  PRODUCTION_BALANCE_REFERENCE,
} from "../config";
import { sleepScheduleSystem } from "../systems/SleepScheduleSystem";
import { foodEatingSystem } from "../systems/FoodEatingSystem";
import {
  CharacterState,
  CharacterStatus,
  DestinationType,
  Freshness,
  FoodState,
  ObjectType,
  SleepMode,
  SleepReason,
} from "../types";
import { TimeOfDay, TimeOfDayMode } from "../timeOfDay";
import {
  createTestCharacter,
  createTestWorld,
  setWorldTime,
  setWorldTimeOfDay,
  withMockedDateNow,
  withMockedRandom,
} from "../../../test-utils/mainSceneTestUtils";

const HOUR_IN_MILLISECONDS = 60 * 60 * 1000;
const TEST_FOOD_EATING_DURATION = 3200;

function createLandedFood(
  world: ReturnType<typeof createTestWorld>,
  options: {
    id: number;
    x: number;
    y: number;
    freshness?: Freshness;
  },
): number {
  const foodEid = addEntity(world);
  addComponent(world, ObjectComp, foodEid);
  addComponent(world, PositionComp, foodEid);
  addComponent(world, FreshnessComp, foodEid);
  ObjectComp.id[foodEid] = options.id;
  ObjectComp.type[foodEid] = ObjectType.FOOD;
  ObjectComp.state[foodEid] = FoodState.LANDED;
  PositionComp.x[foodEid] = options.x;
  PositionComp.y[foodEid] = options.y;
  FreshnessComp.freshness[foodEid] = options.freshness ?? Freshness.NORMAL;
  return foodEid;
}

function completeTargetedFoodMeal(
  world: ReturnType<typeof createTestWorld>,
  characterEid: number,
  currentTime: number,
): void {
  foodEatingSystem({
    world: world as any,
    delta: 0,
    currentTime,
  });

  assert.equal(ObjectComp.state[characterEid], CharacterState.MOVING);

  PositionComp.x[characterEid] = DestinationComp.x[characterEid];
  PositionComp.y[characterEid] = DestinationComp.y[characterEid];

  foodEatingSystem({
    world: world as any,
    delta: 0,
    currentTime,
  });

  assert.equal(ObjectComp.state[characterEid], CharacterState.EATING);

  foodEatingSystem({
    world: world as any,
    delta: TEST_FOOD_EATING_DURATION,
    currentTime,
  });
}

test("밤이 되면 10분~1시간 사이 랜덤 시각에 잠들도록 예약한다", () => {
  const world = createTestWorld({
    now: 0,
    timeOfDay: TimeOfDay.Day,
  });

  const eid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 5,
    }),
  );

  sleepScheduleSystem({
    world: world as any,
    delta: 0,
    currentTime: 0,
  });

  setWorldTimeOfDay(world, TimeOfDay.Night);

  withMockedRandom(0, () => {
    sleepScheduleSystem({
      world: world as any,
      delta: 0,
      currentTime: 0,
    });
  });

  assert.equal(
    SleepSystemComp.nextSleepTime[eid],
    GAME_CONSTANTS.NIGHT_SLEEP_MIN_DELAY,
  );

  setWorldTime(world, GAME_CONSTANTS.NIGHT_SLEEP_MIN_DELAY);
  sleepScheduleSystem({
    world: world as any,
    delta: 0,
    currentTime: GAME_CONSTANTS.NIGHT_SLEEP_MIN_DELAY,
  });

  assert.equal(ObjectComp.state[eid], CharacterState.SLEEPING);
  assert.equal(SleepSystemComp.sleepMode[eid], SleepMode.NIGHT_SLEEP);
});

test("잠들 때 기존 happy 임시 상태는 즉시 제거된다", () => {
  const world = createTestWorld({
    now: 0,
    timeOfDay: TimeOfDay.Day,
  });

  const eid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 5,
    }),
  );

  CharacterStatusComp.statuses[eid][0] = CharacterStatus.HAPPY;
  TemporaryStatusComp.statusType[eid] = CharacterStatus.HAPPY;
  TemporaryStatusComp.startTime[eid] = 0;

  sleepScheduleSystem({
    world: world as any,
    delta: 0,
    currentTime: 0,
  });

  setWorldTimeOfDay(world, TimeOfDay.Night);

  withMockedRandom(0, () => {
    sleepScheduleSystem({
      world: world as any,
      delta: 0,
      currentTime: 0,
    });
  });

  setWorldTime(world, GAME_CONSTANTS.NIGHT_SLEEP_MIN_DELAY);
  sleepScheduleSystem({
    world: world as any,
    delta: 0,
    currentTime: GAME_CONSTANTS.NIGHT_SLEEP_MIN_DELAY,
  });

  assert.equal(ObjectComp.state[eid], CharacterState.SLEEPING);
  assert.equal(
    Array.from(CharacterStatusComp.statuses[eid]).includes(
      CharacterStatus.HAPPY,
    ),
    false,
  );
  assert.equal(TemporaryStatusComp.statusType[eid], 0);
  assert.equal(TemporaryStatusComp.startTime[eid], 0);
});

test("일출이 되면 10분~1시간 사이 랜덤 시각에 잠에서 깬다", () => {
  const world = createTestWorld({
    now: 0,
    timeOfDay: TimeOfDay.Night,
  });

  const eid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.SLEEPING,
      stamina: 5,
    }),
  );

  sleepScheduleSystem({
    world: world as any,
    delta: 0,
    currentTime: 0,
  });

  setWorldTimeOfDay(world, TimeOfDay.Sunrise);

  withMockedRandom(0, () => {
    sleepScheduleSystem({
      world: world as any,
      delta: 0,
      currentTime: 0,
    });
  });

  assert.equal(
    SleepSystemComp.nextWakeTime[eid],
    GAME_CONSTANTS.SUNRISE_WAKE_MIN_DELAY,
  );

  setWorldTime(world, GAME_CONSTANTS.SUNRISE_WAKE_MIN_DELAY);
  sleepScheduleSystem({
    world: world as any,
    delta: 0,
    currentTime: GAME_CONSTANTS.SUNRISE_WAKE_MIN_DELAY,
  });

  assert.equal(ObjectComp.state[eid], CharacterState.IDLE);
  assert.equal(SleepSystemComp.sleepMode[eid], SleepMode.AWAKE);
});

test("auto local time night sleep은 다음 sunrise 기준으로 약 8시간 수면을 역산 예약한다", () => {
  const world = createTestWorld({
    now: 0,
    timeOfDay: TimeOfDay.Night,
    timeOfDayMode: TimeOfDayMode.Auto,
    projectedUpcomingSunTimes: {
      sunriseAt: GAME_CONSTANTS.TARGET_NIGHT_SLEEP_DURATION,
      sunsetAt: -GAME_CONSTANTS.TARGET_NIGHT_SLEEP_DURATION,
      nextSunriseAt: GAME_CONSTANTS.TARGET_NIGHT_SLEEP_DURATION,
      nextSunsetAt: GAME_CONSTANTS.TARGET_NIGHT_SLEEP_DURATION * 2,
    },
  });

  const eid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 5,
    }),
  );

  const expectedWakeOffset =
    GAME_CONSTANTS.SUNRISE_WAKE_OFFSET_MIN +
    0.5 *
      (GAME_CONSTANTS.SUNRISE_WAKE_OFFSET_MAX -
        GAME_CONSTANTS.SUNRISE_WAKE_OFFSET_MIN);
  const expectedWakeTime = Math.round(
    GAME_CONSTANTS.TARGET_NIGHT_SLEEP_DURATION + expectedWakeOffset,
  );
  const expectedSleepTime = Math.round(
    expectedWakeTime - GAME_CONSTANTS.TARGET_NIGHT_SLEEP_DURATION,
  );

  withMockedRandom(0.5, () => {
    sleepScheduleSystem({
      world: world as any,
      delta: 0,
      currentTime: 0,
    });
  });

  assert.equal(SleepSystemComp.nextSleepTime[eid], expectedSleepTime);
  assert.equal(SleepSystemComp.nextWakeTime[eid], expectedWakeTime);
  assert.equal(SleepSystemComp.pendingSleepReason[eid], SleepReason.NIGHT);

  setWorldTime(world, expectedSleepTime);
  sleepScheduleSystem({
    world: world as any,
    delta: 0,
    currentTime: expectedSleepTime,
  });

  assert.equal(ObjectComp.state[eid], CharacterState.SLEEPING);
  assert.equal(SleepSystemComp.sleepMode[eid], SleepMode.NIGHT_SLEEP);
  assert.equal(SleepSystemComp.nextWakeTime[eid], expectedWakeTime);
});

test("낮에는 피로도가 높고 확률이 맞으면 낮잠을 잔다", () => {
  const world = createTestWorld({
    now: 0,
    timeOfDay: TimeOfDay.Day,
  });

  const eid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 5,
    }),
  );

  SleepSystemComp.fatigue[eid] = GAME_CONSTANTS.FATIGUE_MAX;
  sleepScheduleSystem({
    world: world as any,
    delta: 0,
    currentTime: 0,
  });

  SleepSystemComp.nextNapCheckTime[eid] = GAME_CONSTANTS.DAY_NAP_CHECK_INTERVAL;

  withMockedRandom(0, () => {
    sleepScheduleSystem({
      world: world as any,
      delta: 0,
      currentTime: GAME_CONSTANTS.DAY_NAP_CHECK_INTERVAL,
    });
  });

  assert.equal(ObjectComp.state[eid], CharacterState.SLEEPING);
  assert.equal(SleepSystemComp.sleepMode[eid], SleepMode.DAY_NAP);
});

test("먹이를 찾아가는 도중에는 예약된 수면 시각이 되어도 잠들지 않는다", () => {
  const world = createTestWorld({
    now: 0,
    timeOfDay: TimeOfDay.Day,
  });

  const eid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 5,
    }),
  );

  sleepScheduleSystem({
    world: world as any,
    delta: 0,
    currentTime: 0,
  });

  setWorldTimeOfDay(world, TimeOfDay.Night);

  withMockedRandom(0, () => {
    sleepScheduleSystem({
      world: world as any,
      delta: 0,
      currentTime: 0,
    });
  });

  const foodEid = addEntity(world);
  addComponent(world, ObjectComp, foodEid);
  ObjectComp.id[foodEid] = 999;
  ObjectComp.type[foodEid] = ObjectType.FOOD;
  ObjectComp.state[foodEid] = FoodState.TARGETED;

  addComponent(world, DestinationComp, eid);
  DestinationComp.type[eid] = DestinationType.TARGETED;
  DestinationComp.target[eid] = foodEid;
  DestinationComp.x[eid] = 120;
  DestinationComp.y[eid] = 120;
  ObjectComp.state[eid] = CharacterState.MOVING;

  setWorldTime(world, GAME_CONSTANTS.NIGHT_SLEEP_MIN_DELAY);
  sleepScheduleSystem({
    world: world as any,
    delta: 0,
    currentTime: GAME_CONSTANTS.NIGHT_SLEEP_MIN_DELAY,
  });

  assert.equal(ObjectComp.state[eid], CharacterState.MOVING);
  assert.equal(SleepSystemComp.sleepMode[eid], SleepMode.AWAKE);
  assert.equal(
    SleepSystemComp.nextSleepTime[eid],
    GAME_CONSTANTS.NIGHT_SLEEP_MIN_DELAY,
  );

  removeComponent(world, DestinationComp, eid);
  ObjectComp.state[eid] = CharacterState.IDLE;

  sleepScheduleSystem({
    world: world as any,
    delta: 0,
    currentTime: GAME_CONSTANTS.NIGHT_SLEEP_MIN_DELAY,
  });

  assert.equal(ObjectComp.state[eid], CharacterState.SLEEPING);
  assert.equal(SleepSystemComp.sleepMode[eid], SleepMode.NIGHT_SLEEP);
});

test("수면 중 스태미나가 빨간 구간이고 먹을 수 있는 음식이 있으면 깨서 음식 목표 추적으로 전환한다", () => {
  const world = createTestWorld({
    now: 60_000,
    timeOfDay: TimeOfDay.Night,
  });

  const eid = withMockedDateNow(60_000, () =>
    createTestCharacter(world, {
      state: CharacterState.SLEEPING,
      stamina: GAME_CONSTANTS.UNHAPPY_STAMINA_THRESHOLD - 0.1,
      x: 100,
      y: 100,
    }),
  );

  SleepSystemComp.sleepMode[eid] = SleepMode.NIGHT_SLEEP;
  SleepSystemComp.fatigue[eid] = 40;

  const foodEid = createLandedFood(world, {
    id: 40_000,
    x: 160,
    y: 100,
  });

  sleepScheduleSystem({
    world: world as any,
    delta: 0,
    currentTime: 60_000,
  });

  assert.equal(ObjectComp.state[eid], CharacterState.IDLE);
  assert.equal(SleepSystemComp.sleepMode[eid], SleepMode.INTERRUPTED_AWAKE);
  assert.equal(
    SleepSystemComp.interruptedSleepMode[eid],
    SleepMode.NIGHT_SLEEP,
  );
  assert.equal(SleepSystemComp.pendingSleepReason[eid], SleepReason.RESLEEP);
  assert.equal(SleepSystemComp.nextSleepTime[eid], 0);

  foodEatingSystem({
    world: world as any,
    delta: 0,
    currentTime: 60_000,
  });

  assert.equal(ObjectComp.state[eid], CharacterState.MOVING);
  assert.equal(ObjectComp.state[foodEid], FoodState.TARGETED);
  assert.equal(DestinationComp.target[eid], foodEid);
});

test("수면 중 스태미나가 빨간 구간이 아니면 음식이 있어도 깨지 않는다", () => {
  const world = createTestWorld({
    now: 65_000,
    timeOfDay: TimeOfDay.Night,
  });

  const eid = withMockedDateNow(65_000, () =>
    createTestCharacter(world, {
      state: CharacterState.SLEEPING,
      stamina: GAME_CONSTANTS.UNHAPPY_STAMINA_THRESHOLD,
      x: 100,
      y: 100,
    }),
  );

  SleepSystemComp.sleepMode[eid] = SleepMode.NIGHT_SLEEP;
  const foodEid = createLandedFood(world, {
    id: 45_000,
    x: 150,
    y: 100,
  });

  sleepScheduleSystem({
    world: world as any,
    delta: 0,
    currentTime: 65_000,
  });

  assert.equal(ObjectComp.state[eid], CharacterState.SLEEPING);
  assert.equal(SleepSystemComp.sleepMode[eid], SleepMode.NIGHT_SLEEP);
  assert.equal(ObjectComp.state[foodEid], FoodState.LANDED);
});

test("밤잠 중 음식 때문에 깬 뒤 식사를 완료하면 즉시 밤잠으로 복귀한다", () => {
  const world = createTestWorld({
    now: 66_000,
    timeOfDay: TimeOfDay.Night,
  });

  const eid = withMockedDateNow(66_000, () =>
    createTestCharacter(world, {
      state: CharacterState.SLEEPING,
      stamina: GAME_CONSTANTS.UNHAPPY_STAMINA_THRESHOLD - 0.1,
      x: 100,
      y: 100,
    }),
  );

  SleepSystemComp.sleepMode[eid] = SleepMode.NIGHT_SLEEP;
  createLandedFood(world, {
    id: 46_000,
    x: 150,
    y: 100,
  });

  sleepScheduleSystem({
    world: world as any,
    delta: 0,
    currentTime: 66_000,
  });

  completeTargetedFoodMeal(world, eid, 66_000);

  assert.equal(ObjectComp.state[eid], CharacterState.SLEEPING);
  assert.equal(SleepSystemComp.sleepMode[eid], SleepMode.NIGHT_SLEEP);
  assert.equal(SleepSystemComp.nextSleepTime[eid], 0);
  assert.equal(SleepSystemComp.pendingSleepReason[eid], SleepReason.NONE);
});

test("낮잠 중 음식 때문에 깬 뒤 식사를 완료하면 깨어 있는 상태로 전환한다", () => {
  const world = createTestWorld({
    now: 67_000,
    timeOfDay: TimeOfDay.Day,
  });

  const eid = withMockedDateNow(67_000, () =>
    createTestCharacter(world, {
      state: CharacterState.SLEEPING,
      stamina: GAME_CONSTANTS.UNHAPPY_STAMINA_THRESHOLD - 0.1,
      x: 100,
      y: 100,
    }),
  );

  SleepSystemComp.sleepMode[eid] = SleepMode.DAY_NAP;
  SleepSystemComp.sleepSessionStartedAt[eid] = 67_000;
  SleepSystemComp.fatigue[eid] = 40;
  createLandedFood(world, {
    id: 47_000,
    x: 150,
    y: 100,
  });

  sleepScheduleSystem({
    world: world as any,
    delta: 0,
    currentTime: 67_000,
  });

  assert.equal(ObjectComp.state[eid], CharacterState.IDLE);
  assert.equal(SleepSystemComp.sleepMode[eid], SleepMode.INTERRUPTED_AWAKE);
  assert.equal(SleepSystemComp.interruptedSleepMode[eid], SleepMode.DAY_NAP);

  completeTargetedFoodMeal(world, eid, 67_000);

  assert.equal(ObjectComp.state[eid], CharacterState.IDLE);
  assert.equal(SleepSystemComp.sleepMode[eid], SleepMode.AWAKE);
  assert.equal(SleepSystemComp.interruptedSleepMode[eid], SleepMode.AWAKE);
  assert.equal(SleepSystemComp.nextSleepTime[eid], 0);
  assert.equal(SleepSystemComp.pendingSleepReason[eid], SleepReason.NONE);
  assert.equal(
    SleepSystemComp.nextNapCheckTime[eid],
    67_000 + GAME_CONSTANTS.DAY_NAP_CHECK_INTERVAL,
  );
});

test("수면 중 스태미나가 빨간 구간이어도 sick 상태면 음식 때문에 깨지 않는다", () => {
  const world = createTestWorld({
    now: 70_000,
    timeOfDay: TimeOfDay.Night,
  });

  const eid = withMockedDateNow(70_000, () =>
    createTestCharacter(world, {
      state: CharacterState.SLEEPING,
      stamina: GAME_CONSTANTS.UNHAPPY_STAMINA_THRESHOLD - 0.1,
      x: 100,
      y: 100,
    }),
  );

  SleepSystemComp.sleepMode[eid] = SleepMode.NIGHT_SLEEP;
  CharacterStatusComp.statuses[eid][0] = CharacterStatus.SICK;

  const foodEid = createLandedFood(world, {
    id: 50_000,
    x: 150,
    y: 100,
  });

  sleepScheduleSystem({
    world: world as any,
    delta: 0,
    currentTime: 70_000,
  });

  assert.equal(ObjectComp.state[eid], CharacterState.SLEEPING);
  assert.equal(SleepSystemComp.sleepMode[eid], SleepMode.NIGHT_SLEEP);
  assert.equal(ObjectComp.state[foodEid], FoodState.LANDED);
});

test("수면 중 sickness가 남아 있으면 피로 회복이 느리다", () => {
  const world = createTestWorld({
    now: 0,
    timeOfDay: TimeOfDay.Night,
  });

  const normalEid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.SLEEPING,
      stamina: 5,
      x: 100,
      y: 100,
    }),
  );
  const sickEid = withMockedDateNow(1, () =>
    createTestCharacter(world, {
      state: CharacterState.SLEEPING,
      stamina: 5,
      x: 140,
      y: 100,
    }),
  );

  SleepSystemComp.fatigue[normalEid] = 80;
  SleepSystemComp.fatigue[sickEid] = 80;
  CharacterStatusComp.statuses[sickEid][0] = CharacterStatus.SICK;
  const delta = 10 * 1000;

  sleepScheduleSystem({
    world: world as any,
    delta,
    currentTime: delta,
  });

  assert.ok(
    SleepSystemComp.fatigue[normalEid] < SleepSystemComp.fatigue[sickEid],
  );
});

test("깨어 있는 동안 피로도는 스테미나와 무관하게 동일하게 쌓인다", () => {
  const world = createTestWorld({
    now: 0,
    timeOfDay: TimeOfDay.Day,
  });

  const normalEid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 5,
      x: 100,
      y: 100,
    }),
  );
  const lowEid = withMockedDateNow(1, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 2.5,
      x: 140,
      y: 100,
    }),
  );
  const criticalEid = withMockedDateNow(2, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 1.5,
      x: 180,
      y: 100,
    }),
  );
  const delta = HOUR_IN_MILLISECONDS / 100;

  SleepSystemComp.fatigue[normalEid] = 0;
  SleepSystemComp.fatigue[lowEid] = 0;
  SleepSystemComp.fatigue[criticalEid] = 0;

  sleepScheduleSystem({
    world: world as any,
    delta,
    currentTime: delta,
  });

  const baseGain =
    (GAME_CONSTANTS.FATIGUE_AWAKE_GAIN_PER_HOUR * delta) /
    HOUR_IN_MILLISECONDS;

  assert.ok(
    Math.abs(SleepSystemComp.fatigue[normalEid] - baseGain) < 0.000001,
  );
  assert.ok(
    Math.abs(SleepSystemComp.fatigue[lowEid] - baseGain) < 0.000001,
  );
  assert.ok(
    Math.abs(SleepSystemComp.fatigue[criticalEid] - baseGain) < 0.000001,
  );
});

test("낮잠은 최소 30분 뒤 fatigue가 48 이하이면 깬다", () => {
  const world = createTestWorld({
    now: 0,
    timeOfDay: TimeOfDay.Day,
  });

  const eid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.SLEEPING,
      stamina: 5,
      x: 100,
      y: 100,
    }),
  );

  SleepSystemComp.sleepMode[eid] = SleepMode.DAY_NAP;
  SleepSystemComp.sleepSessionStartedAt[eid] = 1;
  SleepSystemComp.fatigue[eid] =
    GAME_CONSTANTS.FATIGUE_DAY_NAP_WAKE_THRESHOLD;

  sleepScheduleSystem({
    world: world as any,
    delta: 0,
    currentTime: 1 + GAME_CONSTANTS.DAY_NAP_MIN_DURATION - 1,
  });

  assert.equal(ObjectComp.state[eid], CharacterState.SLEEPING);
  assert.equal(SleepSystemComp.sleepMode[eid], SleepMode.DAY_NAP);

  sleepScheduleSystem({
    world: world as any,
    delta: 0,
    currentTime: 1 + GAME_CONSTANTS.DAY_NAP_MIN_DURATION,
  });

  assert.equal(ObjectComp.state[eid], CharacterState.IDLE);
  assert.equal(SleepSystemComp.sleepMode[eid], SleepMode.AWAKE);
});

test("낮잠 fatigue가 높으면 최대 90분까지 잔 뒤 깬다", () => {
  const world = createTestWorld({
    now: 0,
    timeOfDay: TimeOfDay.Day,
  });

  const eid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.SLEEPING,
      stamina: 5,
      x: 100,
      y: 100,
    }),
  );

  SleepSystemComp.sleepMode[eid] = SleepMode.DAY_NAP;
  SleepSystemComp.sleepSessionStartedAt[eid] = 1;
  SleepSystemComp.fatigue[eid] =
    GAME_CONSTANTS.FATIGUE_DAY_NAP_WAKE_THRESHOLD + 1;

  sleepScheduleSystem({
    world: world as any,
    delta: 0,
    currentTime: 1 + GAME_CONSTANTS.DAY_NAP_MAX_DURATION - 1,
  });

  assert.equal(ObjectComp.state[eid], CharacterState.SLEEPING);
  assert.equal(SleepSystemComp.sleepMode[eid], SleepMode.DAY_NAP);

  sleepScheduleSystem({
    world: world as any,
    delta: 0,
    currentTime: 1 + GAME_CONSTANTS.DAY_NAP_MAX_DURATION,
  });

  assert.equal(ObjectComp.state[eid], CharacterState.IDLE);
  assert.equal(SleepSystemComp.sleepMode[eid], SleepMode.AWAKE);
});

test("충분히 오래 자고 피로가 낮아져도 sick 상태는 수면 중 자연 회복되지 않는다", () => {
  const world = createTestWorld({
    now: GAME_CONSTANTS.NATURAL_SICK_RECOVERY_MIN_DURATION,
    timeOfDay: TimeOfDay.Night,
  });

  const eid = withMockedDateNow(
    GAME_CONSTANTS.NATURAL_SICK_RECOVERY_MIN_DURATION,
    () =>
      createTestCharacter(world, {
        state: CharacterState.SLEEPING,
        stamina: GAME_CONSTANTS.MAX_STAMINA,
        x: 100,
        y: 100,
      }),
  );

  CharacterStatusComp.statuses[eid][0] = CharacterStatus.SICK;
  DiseaseSystemComp.sickStartTime[eid] = 1;
  SleepSystemComp.fatigue[eid] =
    GAME_CONSTANTS.NATURAL_SICK_RECOVERY_FATIGUE_THRESHOLD;
  SleepSystemComp.sleepMode[eid] = SleepMode.NIGHT_SLEEP;

  sleepScheduleSystem({
    world: world as any,
    delta: 0,
    currentTime: GAME_CONSTANTS.NATURAL_SICK_RECOVERY_MIN_DURATION + 1,
  });

  assert.equal(
    Array.from(CharacterStatusComp.statuses[eid]).includes(
      CharacterStatus.SICK,
    ),
    true,
  );
  assert.equal(DiseaseSystemComp.sickStartTime[eid], 1);
  assert.equal(ObjectComp.state[eid], CharacterState.SLEEPING);
  assert.equal(SleepSystemComp.sleepMode[eid], SleepMode.NIGHT_SLEEP);
  assert.equal(
    Array.from(CharacterStatusComp.statuses[eid]).includes(
      CharacterStatus.HAPPY,
    ),
    false,
  );
});

test("production 밤잠 목표 길이는 대표 8시간 기준이다", () => {
  assert.equal(
    GAME_CONSTANTS.TARGET_NIGHT_SLEEP_DURATION,
    PRODUCTION_BALANCE_REFERENCE.TARGET_NIGHT_SLEEP_DURATION,
  );
});
