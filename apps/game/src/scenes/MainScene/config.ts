import { CharacterClass } from "../../types/Character";
import { getEvolutionSpec } from "./evolutionConfig";
import { CharacterKeyECS } from "./types";

type TriangularDelayConfig = {
  min: number;
  mode: number;
  max: number;
};

const SECOND_IN_MILLISECONDS = 1_000;
const MINUTE_IN_MILLISECONDS = 60 * SECOND_IN_MILLISECONDS;
const HOUR_IN_MILLISECONDS = 60 * MINUTE_IN_MILLISECONDS;

function calculatePerCheckChanceFromNightlyProbability(
  nightlyProbability: number,
  checksPerNight: number,
): number {
  if (checksPerNight <= 0) {
    return 0;
  }

  if (nightlyProbability <= 0) {
    return 0;
  }

  if (nightlyProbability >= 1) {
    return 1;
  }

  return 1 - (1 - nightlyProbability) ** (1 / checksPerNight);
}

// 기대값: representative 8시간 night 동안 1회 이상 각성할 확률 50% -> 약 2박에 1번꼴.
// 계산식: perCheck = 1 - (1 - nightlyProbability) ^ (1 / checksPerNight)
// 가정: 30분마다 1회 check, 8시간 night = 16회 check.
const PRODUCTION_NIGHT_WAKE_REFERENCE = {
  representativeNightDuration: 8 * HOUR_IN_MILLISECONDS,
  checkInterval: 30 * MINUTE_IN_MILLISECONDS,
  nightlyWakeProbability: 0.5,
} as const;

const PRODUCTION_NIGHT_WAKE_CHECKS_PER_REPRESENTATIVE_NIGHT =
  PRODUCTION_NIGHT_WAKE_REFERENCE.representativeNightDuration /
  PRODUCTION_NIGHT_WAKE_REFERENCE.checkInterval;
const PRODUCTION_NIGHT_WAKE_PER_CHECK_CHANCE =
  calculatePerCheckChanceFromNightlyProbability(
    PRODUCTION_NIGHT_WAKE_REFERENCE.nightlyWakeProbability,
    PRODUCTION_NIGHT_WAKE_CHECKS_PER_REPRESENTATIVE_NIGHT,
  );

export const PRODUCTION_BALANCE_REFERENCE = {
  NIGHT_WAKE_REPRESENTATIVE_NIGHT_DURATION:
    PRODUCTION_NIGHT_WAKE_REFERENCE.representativeNightDuration,
  NIGHT_WAKE_CHECK_INTERVAL: PRODUCTION_NIGHT_WAKE_REFERENCE.checkInterval,
  NIGHT_WAKE_CHECKS_PER_REPRESENTATIVE_NIGHT:
    PRODUCTION_NIGHT_WAKE_CHECKS_PER_REPRESENTATIVE_NIGHT,
  NIGHT_WAKE_TARGET_NIGHTLY_PROBABILITY:
    PRODUCTION_NIGHT_WAKE_REFERENCE.nightlyWakeProbability,
  NIGHT_WAKE_EXPECTED_NIGHTS_PER_WAKE:
    1 / PRODUCTION_NIGHT_WAKE_REFERENCE.nightlyWakeProbability,
  NIGHT_WAKE_PRODUCTION_PER_CHECK_CHANCE:
    PRODUCTION_NIGHT_WAKE_PER_CHECK_CHANCE,
} as const;

const PRODUCTION_GAME_CONSTANTS = {
  // 알 부화 관련
  EGG_HATCH_TIME: 30 * MINUTE_IN_MILLISECONDS,
  EGG_HATCH_MIN_TIME: 15 * MINUTE_IN_MILLISECONDS,
  EGG_HATCH_MODE_TIME: 30 * MINUTE_IN_MILLISECONDS,
  EGG_HATCH_MAX_TIME: 45 * MINUTE_IN_MILLISECONDS,

  // 소화기관 관련
  DIGESTIVE_CAPACITY: 5.0,
  DIGESTIVE_MULTIPLIER: 0.5, // debug/legacy용 stamina 비례 증가 배수
  DIGESTIVE_LOAD_PER_MEAL: 2,
  POOP_DELAY: 20 * MINUTE_IN_MILLISECONDS,
  DIGESTIVE_SMALL_POOP_DELAY: 8 * HOUR_IN_MILLISECONDS,

  // 질병 관련
  DISEASE_CHECK_INTERVAL: 10 * SECOND_IN_MILLISECONDS,
  BASE_DISEASE_RATE: 0.0001862601875783909,
  LOW_STAMINA_DISEASE_BONUS: 0.000279,
  POOP_DISEASE_RATE: 0.000093,
  STALE_FOOD_DISEASE_RATE: 0.000093,

  // 음식 신선도 관련
  FRESH_TO_NORMAL_TIME: 3 * MINUTE_IN_MILLISECONDS,
  NORMAL_TO_STALE_TIME: 10 * MINUTE_IN_MILLISECONDS,
  FRESH_STAMINA_BONUS: 2,
  NORMAL_STAMINA_BONUS: 1,

  // 캐릭터 상태 관련
  UNHAPPY_STAMINA_THRESHOLD: 4,
  URGENT_STAMINA_THRESHOLD: 0,
  DEATH_DELAY: 6 * HOUR_IN_MILLISECONDS,
  DEATH_DELAY_CLASS_A: 6 * HOUR_IN_MILLISECONDS,
  DEATH_DELAY_CLASS_B: 14 * HOUR_IN_MILLISECONDS,
  DEATH_DELAY_CLASS_C: 22 * HOUR_IN_MILLISECONDS,
  DEATH_DELAY_CLASS_D: 30 * HOUR_IN_MILLISECONDS,

  // 캐릭터 스테미나 관련
  MAX_STAMINA: 10,
  // 기대값: awake 기준 12분마다 0.25 감소 -> 시간당 1.25 감소 -> 10 -> 0 약 8시간.
  STAMINA_DECREASE_INTERVAL: 12 * MINUTE_IN_MILLISECONDS,
  STAMINA_DECREASE_AMOUNT: 0.25,

  // 수면 관련
  NIGHT_SLEEP_MIN_DELAY: 10 * MINUTE_IN_MILLISECONDS,
  NIGHT_SLEEP_MAX_DELAY: 60 * MINUTE_IN_MILLISECONDS,
  TARGET_NIGHT_SLEEP_DURATION:
    PRODUCTION_BALANCE_REFERENCE.NIGHT_WAKE_REPRESENTATIVE_NIGHT_DURATION,
  TARGET_NIGHT_SLEEP_JITTER: 30 * MINUTE_IN_MILLISECONDS,
  // 기상은 sunrise 구간 시작(sunrise -20m) 이후 10~60분 = 실제 sunrise 기준 -10m ~ +40m 근처.
  SUNRISE_WAKE_MIN_DELAY: 10 * MINUTE_IN_MILLISECONDS,
  SUNRISE_WAKE_MAX_DELAY: 60 * MINUTE_IN_MILLISECONDS,
  SUNRISE_WAKE_OFFSET_MIN: -10 * MINUTE_IN_MILLISECONDS,
  SUNRISE_WAKE_OFFSET_MAX: 40 * MINUTE_IN_MILLISECONDS,
  NIGHT_RESLEEP_MIN_DELAY: 10 * MINUTE_IN_MILLISECONDS,
  NIGHT_RESLEEP_MAX_DELAY: 30 * MINUTE_IN_MILLISECONDS,
  DAY_NAP_CHANCE: 0.07,
  DAY_NAP_CHECK_INTERVAL: 20 * MINUTE_IN_MILLISECONDS,
  NIGHT_WAKE_CHANCE:
    PRODUCTION_BALANCE_REFERENCE.NIGHT_WAKE_PRODUCTION_PER_CHECK_CHANCE,
  NIGHT_WAKE_CHECK_INTERVAL:
    PRODUCTION_BALANCE_REFERENCE.NIGHT_WAKE_CHECK_INTERVAL,
  DAY_NAP_MIN_DURATION: 10 * MINUTE_IN_MILLISECONDS,
  DAY_NAP_MAX_DURATION: 30 * MINUTE_IN_MILLISECONDS,
  FATIGUE_MAX: 100,
  FATIGUE_DEFAULT: 35,
  FATIGUE_AWAKE_GAIN_PER_HOUR: 9,
  FATIGUE_SLEEP_RECOVERY_PER_HOUR: 12,
  FATIGUE_SLEEP_RECOVERY_PER_HOUR_WHEN_SICK: 4,
  FATIGUE_DAY_NAP_MIN_THRESHOLD: 55,
  FATIGUE_DAY_NAP_WAKE_THRESHOLD: 28,
  // sleeping 기준 실효 30분마다 0.25 감소 -> 시간당 0.5 감소 -> 10 -> 0 약 20시간.
  SLEEPING_STAMINA_DECAY_MULTIPLIER: 0.4,
  SLEEPING_DISEASE_RATE_MULTIPLIER: 0.1,
} as const;

export const DEV_BALANCE_COEFFICIENTS = {
  // DEV에서는 production 기준 시간을 나눠서 빠르게 재현한다.
  timeDivisors: {
    EGG_HATCH_TIME: 360,
    EGG_HATCH_MIN_TIME: 180,
    EGG_HATCH_MODE_TIME: 360,
    EGG_HATCH_MAX_TIME: 540,
    POOP_DELAY: 1,
    DIGESTIVE_SMALL_POOP_DELAY: 480,
    DISEASE_CHECK_INTERVAL: 1,
    FRESH_TO_NORMAL_TIME: 18,
    NORMAL_TO_STALE_TIME: 60,
    DEATH_DELAY: 360,
    DEATH_DELAY_CLASS_A: 360,
    DEATH_DELAY_CLASS_B: 360,
    DEATH_DELAY_CLASS_C: 360,
    DEATH_DELAY_CLASS_D: 360,
    STAMINA_DECREASE_INTERVAL: 24,
    NIGHT_SLEEP_MIN_DELAY: 60,
    NIGHT_SLEEP_MAX_DELAY: 60,
    TARGET_NIGHT_SLEEP_DURATION: 60,
    TARGET_NIGHT_SLEEP_JITTER: 60,
    SUNRISE_WAKE_MIN_DELAY: 60,
    SUNRISE_WAKE_MAX_DELAY: 60,
    SUNRISE_WAKE_OFFSET_MIN: 60,
    SUNRISE_WAKE_OFFSET_MAX: 60,
    NIGHT_RESLEEP_MIN_DELAY: 60,
    NIGHT_RESLEEP_MAX_DELAY: 60,
    DAY_NAP_CHECK_INTERVAL: 60,
    NIGHT_WAKE_CHECK_INTERVAL: 120,
    DAY_NAP_MIN_DURATION: 60,
    DAY_NAP_MAX_DURATION: 60,
  },
  // DEV에서는 production 기준 확률을 곱해서 빠르게 상태를 관찰한다.
  probabilityMultipliers: {
    BASE_DISEASE_RATE: 0.02 / PRODUCTION_GAME_CONSTANTS.BASE_DISEASE_RATE,
    LOW_STAMINA_DISEASE_BONUS:
      0.03 / PRODUCTION_GAME_CONSTANTS.LOW_STAMINA_DISEASE_BONUS,
    POOP_DISEASE_RATE: 0.01 / PRODUCTION_GAME_CONSTANTS.POOP_DISEASE_RATE,
    STALE_FOOD_DISEASE_RATE:
      0.01 / PRODUCTION_GAME_CONSTANTS.STALE_FOOD_DISEASE_RATE,
    DAY_NAP_CHANCE: 0.6 / PRODUCTION_GAME_CONSTANTS.DAY_NAP_CHANCE,
    NIGHT_WAKE_CHANCE: 0.3 / PRODUCTION_GAME_CONSTANTS.NIGHT_WAKE_CHANCE,
  },
  // DEV에서는 fatigue 관련 rate를 키워서 nap/sleep 회귀를 빠르게 본다.
  rateMultipliers: {
    FATIGUE_AWAKE_GAIN_PER_HOUR:
      1_800 / PRODUCTION_GAME_CONSTANTS.FATIGUE_AWAKE_GAIN_PER_HOUR,
    FATIGUE_SLEEP_RECOVERY_PER_HOUR:
      2_400 / PRODUCTION_GAME_CONSTANTS.FATIGUE_SLEEP_RECOVERY_PER_HOUR,
    FATIGUE_SLEEP_RECOVERY_PER_HOUR_WHEN_SICK:
      800 / PRODUCTION_GAME_CONSTANTS.FATIGUE_SLEEP_RECOVERY_PER_HOUR_WHEN_SICK,
  },
} as const;

type DevTimeConstantKey = keyof typeof DEV_BALANCE_COEFFICIENTS.timeDivisors;
type DevProbabilityConstantKey =
  keyof typeof DEV_BALANCE_COEFFICIENTS.probabilityMultipliers;
type DevRateConstantKey = keyof typeof DEV_BALANCE_COEFFICIENTS.rateMultipliers;

function deriveTimeConstant(key: DevTimeConstantKey): number {
  const baseValue = PRODUCTION_GAME_CONSTANTS[key];
  if (!import.meta.env.DEV) {
    return baseValue;
  }

  const divisor = DEV_BALANCE_COEFFICIENTS.timeDivisors[key];
  if (divisor <= 0) {
    return baseValue;
  }

  const derivedValue = Math.round(baseValue / divisor);
  if (derivedValue === 0) {
    return 0;
  }

  return derivedValue > 0
    ? Math.max(1, derivedValue)
    : Math.min(-1, derivedValue);
}

function deriveProbabilityConstant(key: DevProbabilityConstantKey): number {
  const baseValue = PRODUCTION_GAME_CONSTANTS[key];
  if (!import.meta.env.DEV) {
    return baseValue;
  }

  return Math.min(
    1,
    baseValue * DEV_BALANCE_COEFFICIENTS.probabilityMultipliers[key],
  );
}

function deriveRateConstant(key: DevRateConstantKey): number {
  const baseValue = PRODUCTION_GAME_CONSTANTS[key];
  if (!import.meta.env.DEV) {
    return baseValue;
  }

  return baseValue * DEV_BALANCE_COEFFICIENTS.rateMultipliers[key];
}

/**
 * 게임 설정 상수들
 */
export const GAME_CONSTANTS = {
  ...PRODUCTION_GAME_CONSTANTS,
  EGG_HATCH_TIME: deriveTimeConstant("EGG_HATCH_TIME"),
  EGG_HATCH_MIN_TIME: deriveTimeConstant("EGG_HATCH_MIN_TIME"),
  EGG_HATCH_MODE_TIME: deriveTimeConstant("EGG_HATCH_MODE_TIME"),
  EGG_HATCH_MAX_TIME: deriveTimeConstant("EGG_HATCH_MAX_TIME"),
  POOP_DELAY: deriveTimeConstant("POOP_DELAY"),
  DIGESTIVE_SMALL_POOP_DELAY: deriveTimeConstant("DIGESTIVE_SMALL_POOP_DELAY"),
  DISEASE_CHECK_INTERVAL: deriveTimeConstant("DISEASE_CHECK_INTERVAL"),
  FRESH_TO_NORMAL_TIME: deriveTimeConstant("FRESH_TO_NORMAL_TIME"),
  NORMAL_TO_STALE_TIME: deriveTimeConstant("NORMAL_TO_STALE_TIME"),
  DEATH_DELAY: deriveTimeConstant("DEATH_DELAY"),
  DEATH_DELAY_CLASS_A: deriveTimeConstant("DEATH_DELAY_CLASS_A"),
  DEATH_DELAY_CLASS_B: deriveTimeConstant("DEATH_DELAY_CLASS_B"),
  DEATH_DELAY_CLASS_C: deriveTimeConstant("DEATH_DELAY_CLASS_C"),
  DEATH_DELAY_CLASS_D: deriveTimeConstant("DEATH_DELAY_CLASS_D"),
  STAMINA_DECREASE_INTERVAL: deriveTimeConstant("STAMINA_DECREASE_INTERVAL"),
  NIGHT_SLEEP_MIN_DELAY: deriveTimeConstant("NIGHT_SLEEP_MIN_DELAY"),
  NIGHT_SLEEP_MAX_DELAY: deriveTimeConstant("NIGHT_SLEEP_MAX_DELAY"),
  TARGET_NIGHT_SLEEP_DURATION: deriveTimeConstant(
    "TARGET_NIGHT_SLEEP_DURATION",
  ),
  TARGET_NIGHT_SLEEP_JITTER: deriveTimeConstant("TARGET_NIGHT_SLEEP_JITTER"),
  SUNRISE_WAKE_MIN_DELAY: deriveTimeConstant("SUNRISE_WAKE_MIN_DELAY"),
  SUNRISE_WAKE_MAX_DELAY: deriveTimeConstant("SUNRISE_WAKE_MAX_DELAY"),
  SUNRISE_WAKE_OFFSET_MIN: deriveTimeConstant("SUNRISE_WAKE_OFFSET_MIN"),
  SUNRISE_WAKE_OFFSET_MAX: deriveTimeConstant("SUNRISE_WAKE_OFFSET_MAX"),
  NIGHT_RESLEEP_MIN_DELAY: deriveTimeConstant("NIGHT_RESLEEP_MIN_DELAY"),
  NIGHT_RESLEEP_MAX_DELAY: deriveTimeConstant("NIGHT_RESLEEP_MAX_DELAY"),
  DAY_NAP_CHECK_INTERVAL: deriveTimeConstant("DAY_NAP_CHECK_INTERVAL"),
  NIGHT_WAKE_CHECK_INTERVAL: deriveTimeConstant("NIGHT_WAKE_CHECK_INTERVAL"),
  DAY_NAP_MIN_DURATION: deriveTimeConstant("DAY_NAP_MIN_DURATION"),
  DAY_NAP_MAX_DURATION: deriveTimeConstant("DAY_NAP_MAX_DURATION"),
  BASE_DISEASE_RATE: deriveProbabilityConstant("BASE_DISEASE_RATE"),
  LOW_STAMINA_DISEASE_BONUS: deriveProbabilityConstant(
    "LOW_STAMINA_DISEASE_BONUS",
  ),
  POOP_DISEASE_RATE: deriveProbabilityConstant("POOP_DISEASE_RATE"),
  STALE_FOOD_DISEASE_RATE: deriveProbabilityConstant("STALE_FOOD_DISEASE_RATE"),
  DAY_NAP_CHANCE: deriveProbabilityConstant("DAY_NAP_CHANCE"),
  NIGHT_WAKE_CHANCE: deriveProbabilityConstant("NIGHT_WAKE_CHANCE"),
  FATIGUE_AWAKE_GAIN_PER_HOUR: deriveRateConstant(
    "FATIGUE_AWAKE_GAIN_PER_HOUR",
  ),
  FATIGUE_SLEEP_RECOVERY_PER_HOUR: deriveRateConstant(
    "FATIGUE_SLEEP_RECOVERY_PER_HOUR",
  ),
  FATIGUE_SLEEP_RECOVERY_PER_HOUR_WHEN_SICK: deriveRateConstant(
    "FATIGUE_SLEEP_RECOVERY_PER_HOUR_WHEN_SICK",
  ),
} as const;

function getTriangularDistributedDelayMs(
  config: TriangularDelayConfig,
  randomValue: number = Math.random(),
): number {
  const { min, mode, max } = config;

  if (max <= min) {
    return min;
  }

  const clampedMode = Math.max(min, Math.min(max, mode));
  const clampedRandom = Math.max(0, Math.min(1, randomValue));
  const pivot = (clampedMode - min) / (max - min);

  if (clampedRandom <= pivot) {
    return Math.round(
      min + Math.sqrt(clampedRandom * (max - min) * (clampedMode - min)),
    );
  }

  return Math.round(
    max - Math.sqrt((1 - clampedRandom) * (max - min) * (max - clampedMode)),
  );
}

export function getEggHatchDelayMs(
  randomValue: number = Math.random(),
): number {
  return getTriangularDistributedDelayMs(
    {
      min: GAME_CONSTANTS.EGG_HATCH_MIN_TIME,
      mode: GAME_CONSTANTS.EGG_HATCH_MODE_TIME,
      max: GAME_CONSTANTS.EGG_HATCH_MAX_TIME,
    },
    randomValue,
  );
}

export function createEggHatchTimestamp(
  now: number = Date.now(),
  randomValue: number = Math.random(),
): number {
  return now + getEggHatchDelayMs(randomValue);
}

export function getUrgentDeathDelayMsByCharacterKey(
  characterKey: CharacterKeyECS | number,
): number {
  const characterClass = getEvolutionSpec(characterKey)?.class;

  switch (characterClass) {
    case CharacterClass.A:
      return GAME_CONSTANTS.DEATH_DELAY_CLASS_A;
    case CharacterClass.B:
      return GAME_CONSTANTS.DEATH_DELAY_CLASS_B;
    case CharacterClass.C:
      return GAME_CONSTANTS.DEATH_DELAY_CLASS_C;
    case CharacterClass.D:
      return GAME_CONSTANTS.DEATH_DELAY_CLASS_D;
    default:
      return GAME_CONSTANTS.DEATH_DELAY;
  }
}
