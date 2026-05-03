import assert from "node:assert/strict";
import test from "node:test";
import { addComponent, addEntity, removeComponent } from "bitecs";
import {
  CharacterStatusComp,
  DestinationComp,
  ObjectComp,
  SleepSystemComp,
} from "../raw-components";
import {
  DEV_BALANCE_COEFFICIENTS,
  GAME_CONSTANTS,
  PRODUCTION_BALANCE_REFERENCE,
} from "../config";
import { sleepScheduleSystem } from "../systems/SleepScheduleSystem";
import {
  CharacterState,
  CharacterStatus,
  DestinationType,
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

test("밤 수면 중 낮은 확률로 깨면 다시 잠들 시각을 예약한다", () => {
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

  SleepSystemComp.sleepMode[eid] = SleepMode.NIGHT_SLEEP;
  sleepScheduleSystem({
    world: world as any,
    delta: 0,
    currentTime: 0,
  });

  SleepSystemComp.nextNightWakeCheckTime[eid] =
    GAME_CONSTANTS.NIGHT_WAKE_CHECK_INTERVAL;

  withMockedRandom(0, () => {
    sleepScheduleSystem({
      world: world as any,
      delta: 0,
      currentTime: GAME_CONSTANTS.NIGHT_WAKE_CHECK_INTERVAL,
    });
  });

  assert.equal(ObjectComp.state[eid], CharacterState.IDLE);
  assert.equal(SleepSystemComp.sleepMode[eid], SleepMode.INTERRUPTED_AWAKE);
  assert.equal(
    SleepSystemComp.nextSleepTime[eid],
    GAME_CONSTANTS.NIGHT_WAKE_CHECK_INTERVAL +
      GAME_CONSTANTS.NIGHT_RESLEEP_MIN_DELAY,
  );
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

test("production 밤중 각성 기대값은 2박에 1번꼴 기준으로 계산된다", () => {
  const expectedProductionChance =
    1 -
    (1 - PRODUCTION_BALANCE_REFERENCE.NIGHT_WAKE_TARGET_NIGHTLY_PROBABILITY) **
      (1 /
        PRODUCTION_BALANCE_REFERENCE.NIGHT_WAKE_CHECKS_PER_REPRESENTATIVE_NIGHT);

  assert.equal(
    PRODUCTION_BALANCE_REFERENCE.NIGHT_WAKE_CHECKS_PER_REPRESENTATIVE_NIGHT,
    16,
  );
  assert.equal(
    PRODUCTION_BALANCE_REFERENCE.NIGHT_WAKE_EXPECTED_NIGHTS_PER_WAKE,
    2,
  );
  assert.ok(
    Math.abs(
      PRODUCTION_BALANCE_REFERENCE.NIGHT_WAKE_PRODUCTION_PER_CHECK_CHANCE -
        expectedProductionChance,
    ) < 1e-12,
  );
  assert.ok(
    Math.abs(
      GAME_CONSTANTS.NIGHT_WAKE_CHANCE -
        Math.min(
          1,
          PRODUCTION_BALANCE_REFERENCE.NIGHT_WAKE_PRODUCTION_PER_CHECK_CHANCE *
            DEV_BALANCE_COEFFICIENTS.probabilityMultipliers.NIGHT_WAKE_CHANCE,
        ),
    ) < 1e-12,
  );
  assert.equal(
    GAME_CONSTANTS.TARGET_NIGHT_SLEEP_DURATION,
    Math.round(
      PRODUCTION_BALANCE_REFERENCE.NIGHT_WAKE_REPRESENTATIVE_NIGHT_DURATION /
        DEV_BALANCE_COEFFICIENTS.timeDivisors.TARGET_NIGHT_SLEEP_DURATION,
    ),
  );
});
