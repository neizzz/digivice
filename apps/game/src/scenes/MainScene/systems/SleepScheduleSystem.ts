import { addComponent, defineQuery, hasComponent } from "bitecs";
import {
  CharacterStatusComp,
  DestinationComp,
  FreshnessComp,
  ObjectComp,
  RandomMovementComp,
  SleepSystemComp,
  SpeedComp,
} from "../raw-components";
import {
  GAME_CONSTANTS,
  getStaminaFatigueAwakeGainMultiplier,
} from "../config";
import {
  CharacterState,
  CharacterStatus,
  DestinationType,
  FoodState,
  ObjectType,
  SleepMode,
  SleepReason,
} from "../types";
import { MainSceneWorld } from "../world";
import { TimeOfDay, TimeOfDayMode } from "../timeOfDay";
import { isFoodEdible } from "./FreshnessSystem";
import { clearTemporaryStatuses } from "./CharacterManageSystem";
import { getTargetedFoodEntityRef } from "../foodEntityRef";

const characterSleepQuery = defineQuery([
  ObjectComp,
  CharacterStatusComp,
  SleepSystemComp,
]);
const objectQuery = defineQuery([ObjectComp]);

const HOUR_IN_MILLISECONDS = 60 * 60 * 1000;
const lastTimeOfDayByWorld = new WeakMap<MainSceneWorld, TimeOfDay>();
const debugLog = (..._args: unknown[]): void => {};

export function sleepScheduleSystem(params: {
  world: MainSceneWorld;
  delta: number;
  currentTime: number;
  entryStatusSuppression?: {
    suppressSleep?: boolean;
  };
}): typeof params {
  const { world, delta, currentTime, entryStatusSuppression } = params;
  const currentTimeOfDay = world.timeOfDay;
  const suppressSleep = entryStatusSuppression?.suppressSleep === true;
  const entities = characterSleepQuery(world);
  const previousTimeOfDay = lastTimeOfDayByWorld.get(world);

  if (!previousTimeOfDay) {
    bootstrapSleepRuntime(
      world,
      entities,
      currentTime,
      currentTimeOfDay,
      suppressSleep,
    );
    lastTimeOfDayByWorld.set(world, currentTimeOfDay);
  } else if (previousTimeOfDay !== currentTimeOfDay) {
    handleTimeOfDayTransition(
      world,
      entities,
      currentTime,
      previousTimeOfDay,
      currentTimeOfDay,
      suppressSleep,
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
    handleUrgentWakeForFood(world, eid, currentTime);
    handleScheduledSleep(
      world,
      eid,
      currentTime,
      currentTimeOfDay,
      suppressSleep,
    );
    handleDayNapChecks(
      world,
      eid,
      currentTime,
      currentTimeOfDay,
      suppressSleep,
    );
    handleNapWake(world, eid, currentTime, currentTimeOfDay);
  }

  return params;
}

function bootstrapSleepRuntime(
  world: MainSceneWorld,
  entities: number[],
  currentTime: number,
  currentTimeOfDay: TimeOfDay,
  suppressSleep: boolean,
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

      if (
        currentTimeOfDay === TimeOfDay.Sunrise ||
        currentTimeOfDay === TimeOfDay.Day
      ) {
        scheduleWakeFromSunrise(eid, currentTime);
      }
      continue;
    }

    if (currentTimeOfDay === TimeOfDay.Night && !suppressSleep) {
      scheduleNightSleep(world, eid, currentTime);
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
  world: MainSceneWorld,
  entities: number[],
  currentTime: number,
  previousTimeOfDay: TimeOfDay,
  currentTimeOfDay: TimeOfDay,
  suppressSleep: boolean,
): void {
  debugLog(
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
        } else if (!suppressSleep) {
          scheduleNightSleep(world, eid, currentTime);
        }
        break;
      case TimeOfDay.Sunrise:
        clearPendingNightSleep(eid);
        clearDeferredResleepIntentIfStale(eid);
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
        clearDeferredResleepIntentIfStale(eid);
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
  const staminaFatigueMultiplier =
    getStaminaFatigueAwakeGainMultiplier(CharacterStatusComp.stamina[eid]);
  const awakeGainPerMillisecond =
    (GAME_CONSTANTS.FATIGUE_AWAKE_GAIN_PER_HOUR * staminaFatigueMultiplier) /
    HOUR_IN_MILLISECONDS;
  const sleepRecoveryPerMillisecond =
    (isSick
      ? GAME_CONSTANTS.FATIGUE_SLEEP_RECOVERY_PER_HOUR_WHEN_SICK
      : GAME_CONSTANTS.FATIGUE_SLEEP_RECOVERY_PER_HOUR) / HOUR_IN_MILLISECONDS;

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

function handleUrgentWakeForFood(
  world: MainSceneWorld,
  eid: number,
  currentTime: number,
): void {
  if (ObjectComp.state[eid] !== CharacterState.SLEEPING) {
    return;
  }

  if (hasStatus(eid, CharacterStatus.SICK)) {
    return;
  }

  if (
    CharacterStatusComp.stamina[eid] >=
    GAME_CONSTANTS.UNHAPPY_STAMINA_THRESHOLD
  ) {
    return;
  }

  if (!hasEdibleLandedFood(world)) {
    return;
  }

  wakeCharacterForFood(world, eid, currentTime);
}

function handleScheduledSleep(
  world: MainSceneWorld,
  eid: number,
  currentTime: number,
  currentTimeOfDay: TimeOfDay,
  suppressSleep: boolean,
): void {
  if (suppressSleep) {
    SleepSystemComp.nextSleepTime[eid] = 0;
    SleepSystemComp.pendingSleepReason[eid] = SleepReason.NONE;
    return;
  }

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

  if (!canEnterSleep(world, eid)) {
    return;
  }

  const mode =
    SleepSystemComp.pendingSleepReason[eid] === SleepReason.NAP
      ? SleepMode.DAY_NAP
      : SleepMode.NIGHT_SLEEP;
  enterSleep(world, eid, currentTime, mode);
}

function handleDayNapChecks(
  world: MainSceneWorld,
  eid: number,
  currentTime: number,
  currentTimeOfDay: TimeOfDay,
  suppressSleep: boolean,
): void {
  if (suppressSleep) {
    return;
  }

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

    const fatigue = SleepSystemComp.fatigue[eid];
    const fatigueRatio = clamp(fatigue / GAME_CONSTANTS.FATIGUE_MAX, 0, 1);
    const fatigueMultiplier = 0.5 + fatigueRatio;
    const baseChance = GAME_CONSTANTS.DAY_NAP_CHANCE;
    const appliedChance = getDayNapChance(eid);
    const roll = Math.random();
    const shouldNap = roll < appliedChance;

    logSleepCheck(world, "Day nap check", {
      eid,
      timeOfDay: currentTimeOfDay,
      fatigue: roundForLog(fatigue),
      fatigueThreshold: GAME_CONSTANTS.FATIGUE_DAY_NAP_MIN_THRESHOLD,
      fatigueMax: GAME_CONSTANTS.FATIGUE_MAX,
      fatigueRatio: roundForLog(fatigueRatio),
      fatigueMultiplier: roundForLog(fatigueMultiplier),
      checkIntervalMs: GAME_CONSTANTS.DAY_NAP_CHECK_INTERVAL,
      baseChance,
      baseChancePercent: toPercent(baseChance),
      appliedChance,
      appliedChancePercent: toPercent(appliedChance),
      roll,
      rollPercent: toPercent(roll),
      result: shouldNap ? "nap" : "stay_awake",
    });

    if (shouldNap) {
      SleepSystemComp.nextSleepTime[eid] = currentTime;
      SleepSystemComp.pendingSleepReason[eid] = SleepReason.NAP;

      if (canEnterSleep(world, eid)) {
        enterSleep(world, eid, currentTime, SleepMode.DAY_NAP);
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
    return;
  }

  const elapsed = currentTime - SleepSystemComp.sleepSessionStartedAt[eid];
  const hasReachedMinDuration = elapsed >= GAME_CONSTANTS.DAY_NAP_MIN_DURATION;
  const hasRecoveredEnough =
    SleepSystemComp.fatigue[eid] <=
    GAME_CONSTANTS.FATIGUE_DAY_NAP_WAKE_THRESHOLD;
  const hasReachedMaxDuration = elapsed >= GAME_CONSTANTS.DAY_NAP_MAX_DURATION;

  if (hasReachedMaxDuration || (hasReachedMinDuration && hasRecoveredEnough)) {
    wakeCharacter(world, eid, currentTime);
  }
}

function getAutoNightSleepPlan(
  world: MainSceneWorld,
  currentTime: number,
): {
  nextSleepTime: number;
  nextWakeTime: number;
} | null {
  if (world.timeOfDayMode !== TimeOfDayMode.Auto) {
    return null;
  }

  const projectedUpcomingSunTimes =
    world.getProjectedUpcomingSunTimes(currentTime);

  if (!projectedUpcomingSunTimes) {
    return null;
  }

  const nextWakeTime = Math.round(
    projectedUpcomingSunTimes.nextSunriseAt +
      randomBetween(
        GAME_CONSTANTS.SUNRISE_WAKE_OFFSET_MIN,
        GAME_CONSTANTS.SUNRISE_WAKE_OFFSET_MAX,
      ),
  );

  if (nextWakeTime <= currentTime) {
    return null;
  }

  const targetSleepDuration =
    GAME_CONSTANTS.TARGET_NIGHT_SLEEP_DURATION +
    randomBetween(
      -GAME_CONSTANTS.TARGET_NIGHT_SLEEP_JITTER,
      GAME_CONSTANTS.TARGET_NIGHT_SLEEP_JITTER,
    );
  const latestSleepTime = nextWakeTime - 1;

  if (latestSleepTime <= currentTime) {
    return null;
  }

  const earliestSleepTime = Math.min(
    currentTime + GAME_CONSTANTS.NIGHT_SLEEP_MIN_DELAY,
    latestSleepTime,
  );
  const nextSleepTime = Math.round(
    clamp(
      nextWakeTime - targetSleepDuration,
      earliestSleepTime,
      latestSleepTime,
    ),
  );

  return {
    nextSleepTime,
    nextWakeTime,
  };
}

function scheduleNightSleep(
  world: MainSceneWorld,
  eid: number,
  currentTime: number,
): void {
  const autoNightSleepPlan = getAutoNightSleepPlan(world, currentTime);

  if (autoNightSleepPlan) {
    SleepSystemComp.nextSleepTime[eid] = autoNightSleepPlan.nextSleepTime;
    SleepSystemComp.pendingSleepReason[eid] = SleepReason.NIGHT;
    SleepSystemComp.nextWakeTime[eid] = autoNightSleepPlan.nextWakeTime;
    SleepSystemComp.pendingWakeReason[eid] = SleepReason.SUNRISE;
    return;
  }

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

export function scheduleResleep(eid: number, currentTime: number): void {
  SleepSystemComp.sleepMode[eid] = SleepMode.INTERRUPTED_AWAKE;
  SleepSystemComp.interruptedSleepMode[eid] = SleepMode.NIGHT_SLEEP;
  SleepSystemComp.nextSleepTime[eid] =
    currentTime +
    randomBetween(
      GAME_CONSTANTS.NIGHT_RESLEEP_MIN_DELAY,
      GAME_CONSTANTS.NIGHT_RESLEEP_MAX_DELAY,
    );
  SleepSystemComp.pendingSleepReason[eid] = SleepReason.RESLEEP;
}

function enterSleep(
  world: MainSceneWorld,
  eid: number,
  currentTime: number,
  mode: SleepMode,
): void {
  const reservedWakeTime =
    mode === SleepMode.NIGHT_SLEEP ? SleepSystemComp.nextWakeTime[eid] : 0;
  const reservedWakeReason =
    mode === SleepMode.NIGHT_SLEEP
      ? SleepSystemComp.pendingWakeReason[eid]
      : SleepReason.NONE;

  clearTemporaryStatuses(world, eid);
  ObjectComp.state[eid] = CharacterState.SLEEPING;
  SpeedComp.value[eid] = 0;
  SleepSystemComp.sleepMode[eid] = mode;
  SleepSystemComp.interruptedSleepMode[eid] = SleepMode.AWAKE;
  SleepSystemComp.sleepSessionStartedAt[eid] = currentTime;
  SleepSystemComp.nextSleepTime[eid] = 0;
  SleepSystemComp.pendingSleepReason[eid] = SleepReason.NONE;
  SleepSystemComp.nextWakeTime[eid] =
    reservedWakeTime > 0 ? Math.max(currentTime, reservedWakeTime) : 0;
  SleepSystemComp.pendingWakeReason[eid] =
    reservedWakeTime > 0 ? reservedWakeReason : SleepReason.NONE;
  SleepSystemComp.nextNightWakeCheckTime[eid] = 0;
}

export function wakeCharacter(
  world: MainSceneWorld,
  eid: number,
  currentTime: number,
  options: {
    preserveDeferredNightResleep?: boolean;
  } = {},
): void {
  const isSick = hasStatus(eid, CharacterStatus.SICK);
  const { preserveDeferredNightResleep = false } = options;

  ObjectComp.state[eid] = isSick ? CharacterState.SICK : CharacterState.IDLE;
  SpeedComp.value[eid] = 0;
  SleepSystemComp.sleepMode[eid] = preserveDeferredNightResleep
    ? SleepMode.INTERRUPTED_AWAKE
    : SleepMode.AWAKE;
  SleepSystemComp.interruptedSleepMode[eid] = SleepMode.AWAKE;
  SleepSystemComp.nextSleepTime[eid] = 0;
  SleepSystemComp.nextWakeTime[eid] = 0;
  SleepSystemComp.nextNightWakeCheckTime[eid] = 0;
  SleepSystemComp.pendingSleepReason[eid] = preserveDeferredNightResleep
    ? SleepReason.RESLEEP
    : SleepReason.NONE;
  SleepSystemComp.pendingWakeReason[eid] = SleepReason.NONE;
  SleepSystemComp.sleepSessionStartedAt[eid] = 0;
  SleepSystemComp.nextNapCheckTime[eid] =
    currentTime + GAME_CONSTANTS.DAY_NAP_CHECK_INTERVAL;

  if (!isSick) {
    restoreRandomMovementIfNeeded(world, eid, currentTime);
  }
}

function wakeCharacterForFood(
  world: MainSceneWorld,
  eid: number,
  currentTime: number,
): void {
  const interruptedSleepMode = SleepSystemComp.sleepMode[eid];
  const canResumeInterruptedSleep =
    interruptedSleepMode === SleepMode.NIGHT_SLEEP ||
    interruptedSleepMode === SleepMode.DAY_NAP;
  const reservedWakeTime =
    interruptedSleepMode === SleepMode.NIGHT_SLEEP
      ? SleepSystemComp.nextWakeTime[eid]
      : 0;
  const reservedWakeReason =
    interruptedSleepMode === SleepMode.NIGHT_SLEEP
      ? SleepSystemComp.pendingWakeReason[eid]
      : SleepReason.NONE;

  wakeCharacter(world, eid, currentTime, {
    preserveDeferredNightResleep: canResumeInterruptedSleep,
  });

  if (!canResumeInterruptedSleep) {
    return;
  }

  SleepSystemComp.interruptedSleepMode[eid] = interruptedSleepMode;
  SleepSystemComp.nextWakeTime[eid] = reservedWakeTime;
  SleepSystemComp.pendingWakeReason[eid] = reservedWakeReason;
}

export function resumeSleepInterruptedForFood(
  world: MainSceneWorld,
  eid: number,
  currentTime: number,
): boolean {
  if (
    SleepSystemComp.sleepMode[eid] !== SleepMode.INTERRUPTED_AWAKE ||
    SleepSystemComp.pendingSleepReason[eid] !== SleepReason.RESLEEP ||
    SleepSystemComp.nextSleepTime[eid] > 0
  ) {
    return false;
  }

  const interruptedSleepMode = SleepSystemComp.interruptedSleepMode[eid];
  if (interruptedSleepMode === SleepMode.DAY_NAP) {
    SleepSystemComp.sleepMode[eid] = SleepMode.AWAKE;
    SleepSystemComp.interruptedSleepMode[eid] = SleepMode.AWAKE;
    SleepSystemComp.pendingSleepReason[eid] = SleepReason.NONE;
    SleepSystemComp.nextNapCheckTime[eid] =
      currentTime + GAME_CONSTANTS.DAY_NAP_CHECK_INTERVAL;
    return false;
  }

  const sleepModeToResume =
    interruptedSleepMode === SleepMode.NIGHT_SLEEP
      ? interruptedSleepMode
      : world.timeOfDay === TimeOfDay.Night
        ? SleepMode.NIGHT_SLEEP
        : null;

  if (sleepModeToResume === null) {
    return false;
  }

  enterSleep(world, eid, currentTime, sleepModeToResume);
  return true;
}

function hasEdibleLandedFood(world: MainSceneWorld): boolean {
  const entities = objectQuery(world);

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    if (ObjectComp.type[eid] !== ObjectType.FOOD) {
      continue;
    }

    if (ObjectComp.state[eid] !== FoodState.LANDED) {
      continue;
    }

    if (
      hasComponent(world, FreshnessComp, eid) &&
      !isFoodEdible(FreshnessComp.freshness[eid])
    ) {
      continue;
    }

    return true;
  }

  return false;
}

function clearPendingNightSleep(eid: number): void {
  if (
    SleepSystemComp.pendingSleepReason[eid] === SleepReason.NIGHT ||
    SleepSystemComp.pendingSleepReason[eid] === SleepReason.RESLEEP
  ) {
    SleepSystemComp.nextSleepTime[eid] = 0;
    SleepSystemComp.pendingSleepReason[eid] = SleepReason.NONE;
    SleepSystemComp.interruptedSleepMode[eid] = SleepMode.AWAKE;
    SleepSystemComp.nextWakeTime[eid] = 0;
    SleepSystemComp.pendingWakeReason[eid] = SleepReason.NONE;
  }
}

function clearDeferredResleepIntentIfStale(eid: number): void {
  if (
    ObjectComp.state[eid] === CharacterState.SLEEPING ||
    SleepSystemComp.pendingSleepReason[eid] !== SleepReason.RESLEEP ||
    SleepSystemComp.nextSleepTime[eid] > 0
  ) {
    return;
  }

  SleepSystemComp.sleepMode[eid] = SleepMode.AWAKE;
  SleepSystemComp.interruptedSleepMode[eid] = SleepMode.AWAKE;
  SleepSystemComp.pendingSleepReason[eid] = SleepReason.NONE;
}

function canEnterSleep(world: MainSceneWorld, eid: number): boolean {
  const state = ObjectComp.state[eid];
  const isMovingToTargetedFood =
    hasComponent(world, DestinationComp, eid) &&
    DestinationComp.type[eid] === DestinationType.TARGETED &&
    getTargetedFoodEntityRef(world, eid) !== null;

  return (
    state !== CharacterState.EGG &&
    state !== CharacterState.DEAD &&
    state !== CharacterState.EATING &&
    !isMovingToTargetedFood
  );
}

function getDayNapChance(eid: number): number {
  const fatigueRatio = clamp(
    SleepSystemComp.fatigue[eid] / GAME_CONSTANTS.FATIGUE_MAX,
    0,
    1,
  );

  return Math.min(1, GAME_CONSTANTS.DAY_NAP_CHANCE * (0.5 + fatigueRatio));
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

function logSleepCheck(
  world: MainSceneWorld,
  event: string,
  payload: Record<string, unknown>,
): void {
  if (!shouldLogSleepChecks(world)) {
    return;
  }

  debugLog(`[SleepScheduleSystem] ${event}`, payload);
}

function shouldLogSleepChecks(world: MainSceneWorld): boolean {
  return import.meta.env.DEV && !world.isSimulationMode;
}

function toPercent(value: number): number {
  return roundForLog(value * 100, 2);
}

function roundForLog(value: number, digits = 3): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}
