/**
 * 게임에서 사용되는 모든 시간 관련 설정을 관리하는 파일
 */

/**
 * 캐릭터 움직임 관련 시간 상수 (밀리초 단위)
 */
export const CHARACTER_MOVEMENT = {
  MIN_IDLE_TIME: 3000, // 최소 대기 시간
  MAX_IDLE_TIME: 8000, // 최대 대기 시간
  MIN_MOVE_TIME: 2000, // 최소 이동 시간
  MAX_MOVE_TIME: 7000, // 최대 이동 시간
};

/**
 * 캐릭터 진화 관련 상수
 */
export const CHARACTER_EVOLUTION = {
  // 알에서 유년기로 진화 (30분)
  EGG_END_TIME: 5000,
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
 */
export const CHARACTER_STATUS = {
  SICKNESS_CHECK_INTERVAL: 5000,
  SICKNESS_PROBABILITY: 0.04, // 질병 발생 확률: 5%

  STAMINA_DECREASE_INTERVAL: 5000, // 스태미나 감소 주기: 30분
  STAMINA_DECREASE_AMOUNT: 1, // 한 번에 감소하는 스태미나 양

  DEATH_CHECK_INTERVAL: 15000, // 죽음 체크 주기: 1시간
  DEATH_PROBABILITY_SICK: 0.1, // 아픈 상태에서 죽음 확률: 10%
};
