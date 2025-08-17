/**
 * 게임 설정 상수들
 */
export const GAME_CONSTANTS = {
  // 캐릭터 기본 수치
  MAX_STAMINA: 10, // 최대 스테미나

  // 알 부화 관련
  EGG_HATCH_TIME: 5000,

  // 소화기관 관련
  DIGESTIVE_CAPACITY: 5.0,
  DIGESTIVE_MULTIPLIER: 0.5, // 스테미나 증가량의 0.5배만큼 소화기관 차게됨
  POOP_DELAY: 10000, // 소화기관 초과 후 똥 싸는 시간 (10초)

  // 질병 관련
  DISEASE_CHECK_INTERVAL: 10000,
  BASE_DISEASE_RATE: 0.02, // 기본 질병 확률 2%
  LOW_STAMINA_DISEASE_BONUS: 0.03, // 스테미나 3이하일 때 추가 3%
  POOP_DISEASE_RATE: 0.01, // 똥 1개당 1%
  STALE_FOOD_DISEASE_RATE: 0.01, // 상한음식 1개당 1%

  // 음식 신선도 관련
  // FRESH_TO_NORMAL_TIME: 60000, // 60초 후 FRESH -> NORMAL
  FRESH_TO_NORMAL_TIME: 10000, // NOTE: DEBUG
  // NORMAL_TO_STALE_TIME: 120000, // 120초 후 NORMAL -> STALE
  NORMAL_TO_STALE_TIME: 10000, // NOTE: DEBUG
  FRESH_STAMINA_BONUS: 3, // 신선한 음식 스테미나 증가량
  NORMAL_STAMINA_BONUS: 1, // 보통 음식 스테미나 증가량

  // 캐릭터 상태 관련
  UNHAPPY_STAMINA_THRESHOLD: 4,
  URGENT_STAMINA_THRESHOLD: 0,
  DEATH_DELAY: 300000, // urgent 상태에서 5분 후 죽음
} as const;
