/**
 * 게임에서 사용되는 모든 시간 관련 설정을 관리하는 파일
 */
import { CharacterClass } from "./types/Character";

export const INTENTED_FRONT_Z_INDEX = 9999; // 의도된 앞쪽 zIndex

/**
 * 캐릭터 움직임 관련 시간 상수 (밀리초 단위)
 */
export const CHARACTER_MOVEMENT = {
  MIN_IDLE_TIME: 2000, // 최소 대기 시간
  MAX_IDLE_TIME: 9000, // 최대 대기 시간
  MIN_MOVE_TIME: 2000, // 최소 이동 시간
  MAX_MOVE_TIME: 7000, // 최대 이동 시간
};

/**
 * 게임 루프 관련 시간 상수 (밀리초 단위)
 */
export const GAME_LOOP = {
  DELTA_MS: 1000 / 60, // 프레임당 경과 시간 (ms)
};

/**
 * 음식 신선도 관련 시간 상수 (밀리초 단위)
 */
export const FOOD_FRESHNESS = {
  FRESH_DURATION: 5000, // 신선한 상태 지속 시간 (30초)
  NORMAL_DURATION: 5000, // 일반 상태 지속 시간 (60초)
};

/**
 * 캐릭터 상태 관련 시간 상수 및 확률 (밀리초 단위)
 * NOTE: interval은 최소 5분 이상이어야 함.
 */
const isDebugMode = import.meta.env.DEV;
export const CHARACTER_STATUS = isDebugMode
  ? ({
      EGG_HATCH_TIMEOUT: 3 * 1000,
      DIGESTION_CAPACITY: 5, // 소화기관 용량
      DIGESTION_INCREASE_AMOUNT: 2, // 음식 섭취 시 증가량
      DIGESTION_POOB_DELAY: 3000, // 똥 생성 지연(ms)

      // 스태미나가 4 이상일 때 진화 게이지가 오름
      EVOLUTION_GAUGE_CHECK_INTERVAL: 10 * 1000,
      EVOLUTION_GAUGE_STATMINA_THRESHOLD: 4,
      EVOLUTION_GAUGE_INCREASE_AMOUNT: {
        [CharacterClass.A]: 40,
        [CharacterClass.B]: 20,
        [CharacterClass.C]: 10,
        [CharacterClass.D]: 0.0,
      },
      STAMINA_DECREASE_INTERVAL: 10 * 1000,
      STAMINA_DECREASE_AMOUNT: 1, // 한 번에 감소하는 스태미나 양
      MAX_STAMINA: 10, // 최대 스태미나

      SICKNESS_CHECK_INTERVAL: 5 * 1000,
      SICKNESS_PROBABILITY: 0.1,

      TIMEOUT_AFTER_STAMINA_ZERO: 20 * 1000,
    } as const)
  : ({
      EGG_HATCH_TIMEOUT: 30 * 60 * 1000, // 알 부화 (30분)
      DIGESTION_CAPACITY: 5, // 소화기관 용량
      DIGESTION_INCREASE_AMOUNT: 2, // 음식 섭취 시 증가량
      DIGESTION_POOB_DELAY: 20 * 60 * 1000, // 똥 생성 지연 (20분)
      // 스태미나가 4 이상일 때 진화 게이지가 오름
      EVOLUTION_GAUGE_CHECK_INTERVAL: 20 * 60 * 1000, // 20분,
      EVOLUTION_GAUGE_STATMINA_THRESHOLD: 4,
      EVOLUTION_GAUGE_INCREASE_AMOUNT: {
        [CharacterClass.A]: 0.6,
        [CharacterClass.B]: 0.4,
        [CharacterClass.C]: 0.3,
        [CharacterClass.D]: 0.0,
      },

      STAMINA_DECREASE_INTERVAL: 60 * 60 * 1000, // 1시간
      STAMINA_DECREASE_AMOUNT: 1, // 한 번에 감소하는 스태미나 양
      MAX_STAMINA: 10,

      SICKNESS_CHECK_INTERVAL: 30 * 60 * 1000, // 30분
      SICKNESS_PROBABILITY: 0.03,

      TIMEOUT_AFTER_STAMINA_ZERO: 60 * 60 * 1000, // 1시간
    } as const);
