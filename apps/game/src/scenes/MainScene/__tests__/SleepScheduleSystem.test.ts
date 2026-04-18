import assert from "node:assert/strict";
import test from "node:test";
import { CharacterStatusComp, ObjectComp, SleepSystemComp } from "../raw-components";
import { GAME_CONSTANTS } from "../config";
import { sleepScheduleSystem } from "../systems/SleepScheduleSystem";
import { CharacterState, CharacterStatus, SleepMode } from "../types";
import { TimeOfDay } from "../timeOfDay";
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

  SleepSystemComp.nextNapCheckTime[eid] =
    GAME_CONSTANTS.DAY_NAP_CHECK_INTERVAL;

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

  assert.ok(SleepSystemComp.fatigue[normalEid] < SleepSystemComp.fatigue[sickEid]);
});
