import { addComponent, defineQuery, hasComponent } from "bitecs";
import {
  CharacterStatusComp,
  ObjectComp,
  RandomMovementComp,
  SleepSystemComp,
  SpeedComp,
} from "../raw-components";
import { GAME_CONSTANTS } from "../config";
import {
  CharacterState,
  CharacterStatus,
  ObjectType,
  SleepMode,
  SleepReason,
} from "../types";
import { MainSceneWorld } from "../world";
import { TimeOfDay } from "../timeOfDay";

const characterSleepQuery = defineQuery([
  ObjectComp,
  CharacterStatusComp,
  SleepSystemComp,
]);

const HOUR_IN_MILLISECONDS = 60 * 60 * 1000;
const lastTimeOfDayByWorld = new WeakMap<MainSceneWorld, TimeOfDay>();

export function sleepScheduleSystem(params: {
  world: MainSceneWorld;
  delta: number;
  currentTime: number;
}): typeof params {
  const { world, delta, currentTime } = params;
  const currentTimeOfDay = world.timeOfDay;
  const entities = characterSleepQuery(world);
  const previousTimeOfDay = lastTimeOfDayByWorld.get(world);

  if (!previousTimeOfDay) {
    bootstrapSleepRuntime(entities, currentTime, currentTimeOfDay);
    lastTimeOfDayByWorld.set(world, currentTimeOfDay);
  } else if (previousTimeOfDay !== currentTimeOfDay) {
    handleTimeOfDayTransition(
      entities,
      currentTime,
      previousTimeOfDay,
      currentTimeOfDay,
    );
    lastTimeOfDayByWorld.set(world, currentTimeOfDay);
  }

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
      continue;
    }

    if (
      ObjectComp.state[eid] === CharacterState.EGG ||
      ObjectComp.state[eid] === CharacterState.DEAD
    ) {
      continue;
    }

    updateFatigue(eid, delta);
    reconcileExternalSleepExit(eid, currentTime, currentTimeOfDay);
    handleScheduledWake(world, eid, currentTime);
    handleNightWakeChecks(world, eid, currentTime, currentTimeOfDay);
    handleScheduledSleep(eid, currentTime, currentTimeOfDay);
    handleDayNapChecks(eid, currentTime, currentTimeOfDay);
    handleNapWake(world, eid, currentTime, currentTimeOfDay);
  }

  return params;
}

function bootstrapSleepRuntime(
  entities: number[],
  currentTime: number,
  currentTimeOfDay: TimeOfDay,
): void {
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
      continue;
    }

    if (
      ObjectComp.state[eid] === CharacterState.EGG ||
      ObjectComp.state[eid] === CharacterState.DEAD
    ) {
      continue;
    }

    if (SleepSystemComp.nextNapCheckTime[eid] <= 0) {
      SleepSystemComp.nextNapCheckTime[eid] =
        currentTime + GAME_CONSTANTS.DAY_NAP_CHECK_INTERVAL;
    }

    if (ObjectComp.state[eid] === CharacterState.SLEEPING) {
      if (SleepSystemComp.sleepMode[eid] === SleepMode.AWAKE) {
        SleepSystemComp.sleepMode[eid] =
          currentTimeOfDay === TimeOfDay.Day
            ? SleepMode.DAY_NAP
            : SleepMode.NIGHT_SLEEP;
      }

      if (SleepSystemComp.sleepSessionStartedAt[eid] <= 0) {
        SleepSystemComp.sleepSessionStartedAt[eid] = currentTime;
      }

      if (currentTimeOfDay === TimeOfDay.Night) {
        ensureNightWakeCheckTime(eid, currentTime);
      } else if (
        currentTimeOfDay === TimeOfDay.Sunrise ||
        currentTimeOfDay === TimeOfDay.Day
      ) {
        scheduleWakeFromSunrise(eid, currentTime);
      }
      continue;
    }

    if (currentTimeOfDay === TimeOfDay.Night) {
      scheduleNightSleep(eid, currentTime);
      continue;
    }

    if (currentTimeOfDay === TimeOfDay.Day) {
      SleepSystemComp.nextNapCheckTime[eid] = Math.max(
        SleepSystemComp.nextNapCheckTime[eid],
        currentTime + GAME_CONSTANTS.DAY_NAP_CHECK_INTERVAL,
      );
    }
  }
}

function handleTimeOfDayTransition(
  entities: number[],
  currentTime: number,
  previousTimeOfDay: TimeOfDay,
  currentTimeOfDay: TimeOfDay,
): void {
  console.log(
    `[SleepScheduleSystem] Time of day changed: ${previousTimeOfDay} -> ${currentTimeOfDay}`,
  );

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
      continue;
    }

    if (
      ObjectComp.state[eid] === CharacterState.EGG ||
      ObjectComp.state[eid] === CharacterState.DEAD
    ) {
      continue;
    }

    switch (currentTimeOfDay) {
      case TimeOfDay.Night:
        if (ObjectComp.state[eid] === CharacterState.SLEEPING) {
          SleepSystemComp.sleepMode[eid] = SleepMode.NIGHT_SLEEP;
          ensureNightWakeCheckTime(eid, currentTime);
        } else {
          scheduleNightSleep(eid, currentTime);
        }
        break;
      case TimeOfDay.Sunrise:
        clearPendingNightSleep(eid);
        if (ObjectComp.state[eid] === CharacterState.SLEEPING) {
          scheduleWakeFromSunrise(eid, currentTime);
        }
        break;
      case TimeOfDay.Day:
        if (
          ObjectComp.state[eid] === CharacterState.SLEEPING &&
          SleepSystemComp.sleepMode[eid] === SleepMode.NIGHT_SLEEP
        ) {
          SleepSystemComp.nextWakeTime[eid] = currentTime;
          SleepSystemComp.pendingWakeReason[eid] = SleepReason.SUNRISE;
        }

        if (SleepSystemComp.nextNapCheckTime[eid] <= currentTime) {
          SleepSystemComp.nextNapCheckTime[eid] =
            currentTime + GAME_CONSTANTS.DAY_NAP_CHECK_INTERVAL;
        }
        break;
      case TimeOfDay.Sunset:
      default:
        break;
    }
  }
}

function updateFatigue(eid: number, delta: number): void {
  const currentFatigue = SleepSystemComp.fatigue[eid];
  const isSleeping = ObjectComp.state[eid] === CharacterState.SLEEPING;
  const isSick = hasStatus(eid, CharacterStatus.SICK);
  const awakeGainPerMillisecond =
    GAME_CONSTANTS.FATIGUE_AWAKE_GAIN_PER_HOUR / HOUR_IN_MILLISECONDS;
  const sleepRecoveryPerMillisecond =
    (isSick
      ? GAME_CONSTANTS.FATIGUE_SLEEP_RECOVERY_PER_HOUR_WHEN_SICK
      : GAME_CONSTANTS.FATIGUE_SLEEP_RECOVERY_PER_HOUR) /
    HOUR_IN_MILLISECONDS;

  const nextFatigue = isSleeping
    ? currentFatigue - delta * sleepRecoveryPerMillisecond
    : currentFatigue + delta * awakeGainPerMillisecond;

  SleepSystemComp.fatigue[eid] = clamp(
    nextFatigue,
    0,
    GAME_CONSTANTS.FATIGUE_MAX,
  );
}

function reconcileExternalSleepExit(
  eid: number,
  currentTime: number,
  currentTimeOfDay: TimeOfDay,
): void {
  if (ObjectComp.state[eid] === CharacterState.SLEEPING) {
    return;
  }

  if (
    SleepSystemComp.sleepMode[eid] === SleepMode.AWAKE ||
    SleepSystemComp.sleepMode[eid] === SleepMode.INTERRUPTED_AWAKE
  ) {
    return;
  }

  SleepSystemComp.nextWakeTime[eid] = 0;
  SleepSystemComp.pendingWakeReason[eid] = SleepReason.NONE;
  SleepSystemComp.nextNightWakeCheckTime[eid] = 0;
  SleepSystemComp.sleepSessionStartedAt[eid] = 0;

  if (currentTimeOfDay === TimeOfDay.Night) {
    scheduleResleep(eid, currentTime);
    return;
  }

  SleepSystemComp.sleepMode[eid] = SleepMode.AWAKE;
  SleepSystemComp.pendingSleepReason[eid] = SleepReason.NONE;
  SleepSystemComp.nextNapCheckTime[eid] =
    currentTime + GAME_CONSTANTS.DAY_NAP_CHECK_INTERVAL;
}

function handleScheduledWake(
  world: MainSceneWorld,
  eid: number,
  currentTime: number,
): void {
  const nextWakeTime = SleepSystemComp.nextWakeTime[eid];
  if (
    ObjectComp.state[eid] !== CharacterState.SLEEPING ||
    nextWakeTime <= 0 ||
    currentTime < nextWakeTime
  ) {
    return;
  }

  wakeCharacter(world, eid, currentTime);
}

function handleNightWakeChecks(
  world: MainSceneWorld,
  eid: number,
  currentTime: number,
  currentTimeOfDay: TimeOfDay,
): void {
  if (
    ObjectComp.state[eid] !== CharacterState.SLEEPING ||
    SleepSystemComp.sleepMode[eid] !== SleepMode.NIGHT_SLEEP ||
    currentTimeOfDay !== TimeOfDay.Night
  ) {
    if (currentTimeOfDay !== TimeOfDay.Night) {
      SleepSystemComp.nextNightWakeCheckTime[eid] = 0;
    }
    return;
  }

  ensureNightWakeCheckTime(eid, currentTime);

  while (currentTime >= SleepSystemComp.nextNightWakeCheckTime[eid]) {
    SleepSystemComp.nextNightWakeCheckTime[eid] +=
      GAME_CONSTANTS.NIGHT_WAKE_CHECK_INTERVAL;

    if (Math.random() < GAME_CONSTANTS.NIGHT_WAKE_CHANCE) {
      SleepSystemComp.pendingWakeReason[eid] = SleepReason.NIGHT_INTERRUPT;
      wakeCharacter(world, eid, currentTime);
      scheduleResleep(eid, currentTime);
      break;
    }
  }
}

function handleScheduledSleep(
  eid: number,
  currentTime: number,
  currentTimeOfDay: TimeOfDay,
): void {
  const nextSleepTime = SleepSystemComp.nextSleepTime[eid];
  if (nextSleepTime <= 0 || currentTime < nextSleepTime) {
    return;
  }

  if (currentTimeOfDay === TimeOfDay.Day) {
    const isNightSleepReservation =
      SleepSystemComp.pendingSleepReason[eid] === SleepReason.NIGHT ||
      SleepSystemComp.pendingSleepReason[eid] === SleepReason.RESLEEP;
    if (isNightSleepReservation) {
      clearPendingNightSleep(eid);
      return;
    }
  }

  if (!canEnterSleep(eid)) {
    return;
  }

  const mode =
    SleepSystemComp.pendingSleepReason[eid] === SleepReason.NAP
      ? SleepMode.DAY_NAP
      : SleepMode.NIGHT_SLEEP;
  enterSleep(eid, currentTime, mode);
}

function handleDayNapChecks(
  eid: number,
  currentTime: number,
  currentTimeOfDay: TimeOfDay,
): void {
  if (
    currentTimeOfDay !== TimeOfDay.Day ||
    ObjectComp.state[eid] === CharacterState.SLEEPING ||
    SleepSystemComp.nextSleepTime[eid] > 0 ||
    SleepSystemComp.fatigue[eid] < GAME_CONSTANTS.FATIGUE_DAY_NAP_MIN_THRESHOLD
  ) {
    return;
  }

  if (SleepSystemComp.nextNapCheckTime[eid] <= 0) {
    SleepSystemComp.nextNapCheckTime[eid] =
      currentTime + GAME_CONSTANTS.DAY_NAP_CHECK_INTERVAL;
  }

  while (currentTime >= SleepSystemComp.nextNapCheckTime[eid]) {
    SleepSystemComp.nextNapCheckTime[eid] +=
      GAME_CONSTANTS.DAY_NAP_CHECK_INTERVAL;

    if (Math.random() < getDayNapChance(eid)) {
      SleepSystemComp.nextSleepTime[eid] = currentTime;
      SleepSystemComp.pendingSleepReason[eid] = SleepReason.NAP;

      if (canEnterSleep(eid)) {
        enterSleep(eid, currentTime, SleepMode.DAY_NAP);
      }
      break;
    }
  }
}

function handleNapWake(
  world: MainSceneWorld,
  eid: number,
  currentTime: number,
  currentTimeOfDay: TimeOfDay,
): void {
  if (
    ObjectComp.state[eid] !== CharacterState.SLEEPING ||
    SleepSystemComp.sleepMode[eid] !== SleepMode.DAY_NAP
  ) {
    return;
  }

  if (currentTimeOfDay === TimeOfDay.Night) {
    SleepSystemComp.sleepMode[eid] = SleepMode.NIGHT_SLEEP;
    ensureNightWakeCheckTime(eid, currentTime);
    return;
  }

  const elapsed = currentTime - SleepSystemComp.sleepSessionStartedAt[eid];
  const hasReachedMinDuration =
    elapsed >= GAME_CONSTANTS.DAY_NAP_MIN_DURATION;
  const hasRecoveredEnough =
    SleepSystemComp.fatigue[eid] <= GAME_CONSTANTS.FATIGUE_DAY_NAP_WAKE_THRESHOLD;
  const hasReachedMaxDuration =
    elapsed >= GAME_CONSTANTS.DAY_NAP_MAX_DURATION;

  if (
    hasReachedMaxDuration ||
    (hasReachedMinDuration && hasRecoveredEnough)
  ) {
    wakeCharacter(world, eid, currentTime);
  }
}

function scheduleNightSleep(eid: number, currentTime: number): void {
  SleepSystemComp.nextSleepTime[eid] =
    currentTime +
    randomBetween(
      GAME_CONSTANTS.NIGHT_SLEEP_MIN_DELAY,
      GAME_CONSTANTS.NIGHT_SLEEP_MAX_DELAY,
    );
  SleepSystemComp.pendingSleepReason[eid] = SleepReason.NIGHT;
  SleepSystemComp.nextWakeTime[eid] = 0;
  SleepSystemComp.pendingWakeReason[eid] = SleepReason.NONE;
}

function scheduleWakeFromSunrise(eid: number, currentTime: number): void {
  if (ObjectComp.state[eid] !== CharacterState.SLEEPING) {
    return;
  }

  if (SleepSystemComp.nextWakeTime[eid] > 0) {
    return;
  }

  SleepSystemComp.nextWakeTime[eid] =
    currentTime +
    randomBetween(
      GAME_CONSTANTS.SUNRISE_WAKE_MIN_DELAY,
      GAME_CONSTANTS.SUNRISE_WAKE_MAX_DELAY,
    );
  SleepSystemComp.pendingWakeReason[eid] = SleepReason.SUNRISE;
  SleepSystemComp.nextSleepTime[eid] = 0;
  SleepSystemComp.pendingSleepReason[eid] = SleepReason.NONE;
}

function scheduleResleep(eid: number, currentTime: number): void {
  SleepSystemComp.sleepMode[eid] = SleepMode.INTERRUPTED_AWAKE;
  SleepSystemComp.nextSleepTime[eid] =
    currentTime +
    randomBetween(
      GAME_CONSTANTS.NIGHT_RESLEEP_MIN_DELAY,
      GAME_CONSTANTS.NIGHT_RESLEEP_MAX_DELAY,
    );
  SleepSystemComp.pendingSleepReason[eid] = SleepReason.RESLEEP;
}

function enterSleep(
  eid: number,
  currentTime: number,
  mode: SleepMode,
): void {
  ObjectComp.state[eid] = CharacterState.SLEEPING;
  SpeedComp.value[eid] = 0;
  SleepSystemComp.sleepMode[eid] = mode;
  SleepSystemComp.sleepSessionStartedAt[eid] = currentTime;
  SleepSystemComp.nextSleepTime[eid] = 0;
  SleepSystemComp.pendingSleepReason[eid] = SleepReason.NONE;
  SleepSystemComp.nextWakeTime[eid] = 0;
  SleepSystemComp.pendingWakeReason[eid] = SleepReason.NONE;
  SleepSystemComp.nextNightWakeCheckTime[eid] =
    mode === SleepMode.NIGHT_SLEEP
      ? currentTime + GAME_CONSTANTS.NIGHT_WAKE_CHECK_INTERVAL
      : 0;
}

function wakeCharacter(
  world: MainSceneWorld,
  eid: number,
  currentTime: number,
): void {
  const isSick = hasStatus(eid, CharacterStatus.SICK);

  ObjectComp.state[eid] = isSick ? CharacterState.SICK : CharacterState.IDLE;
  SpeedComp.value[eid] = 0;
  SleepSystemComp.sleepMode[eid] = SleepMode.AWAKE;
  SleepSystemComp.nextSleepTime[eid] = 0;
  SleepSystemComp.nextWakeTime[eid] = 0;
  SleepSystemComp.nextNightWakeCheckTime[eid] = 0;
  SleepSystemComp.pendingSleepReason[eid] = SleepReason.NONE;
  SleepSystemComp.pendingWakeReason[eid] = SleepReason.NONE;
  SleepSystemComp.sleepSessionStartedAt[eid] = 0;
  SleepSystemComp.nextNapCheckTime[eid] =
    currentTime + GAME_CONSTANTS.DAY_NAP_CHECK_INTERVAL;

  if (!isSick) {
    restoreRandomMovementIfNeeded(world, eid, currentTime);
  }
}

function clearPendingNightSleep(eid: number): void {
  if (
    SleepSystemComp.pendingSleepReason[eid] === SleepReason.NIGHT ||
    SleepSystemComp.pendingSleepReason[eid] === SleepReason.RESLEEP
  ) {
    SleepSystemComp.nextSleepTime[eid] = 0;
    SleepSystemComp.pendingSleepReason[eid] = SleepReason.NONE;
  }
}

function ensureNightWakeCheckTime(eid: number, currentTime: number): void {
  if (SleepSystemComp.nextNightWakeCheckTime[eid] > 0) {
    return;
  }

  SleepSystemComp.nextNightWakeCheckTime[eid] =
    currentTime + GAME_CONSTANTS.NIGHT_WAKE_CHECK_INTERVAL;
}

function canEnterSleep(eid: number): boolean {
  const state = ObjectComp.state[eid];
  return (
    state !== CharacterState.EGG &&
    state !== CharacterState.DEAD &&
    state !== CharacterState.EATING
  );
}

function getDayNapChance(eid: number): number {
  const fatigueRatio = clamp(
    SleepSystemComp.fatigue[eid] / GAME_CONSTANTS.FATIGUE_MAX,
    0,
    1,
  );

  return Math.min(
    1,
    GAME_CONSTANTS.DAY_NAP_CHANCE * (0.5 + fatigueRatio),
  );
}

function hasStatus(eid: number, status: CharacterStatus): boolean {
  return Array.from(CharacterStatusComp.statuses[eid]).includes(status);
}

function randomBetween(min: number, max: number): number {
  if (max <= min) {
    return min;
  }

  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function restoreRandomMovementIfNeeded(
  world: MainSceneWorld,
  eid: number,
  currentTime: number,
): void {
  if (hasComponent(world, RandomMovementComp, eid)) {
    return;
  }

  addComponent(world, RandomMovementComp, eid);
  RandomMovementComp.minIdleTime[eid] = 3000;
  RandomMovementComp.maxIdleTime[eid] = 6000;
  RandomMovementComp.minMoveTime[eid] = 2000;
  RandomMovementComp.maxMoveTime[eid] = 4000;
  RandomMovementComp.nextChange[eid] = currentTime + 1000;
}
