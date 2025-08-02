import { CharacterKey } from "./types";

/**
 * 캐릭터별 기본 스탯 정의
 */
export type CharacterStats = {
  speed: number; // 기본 이동 속도 (pixels per millisecond)
  scale: number; // 캐릭터 크기 배율
};

/**
 * 캐릭터 키별 스탯 정의
 */
export const CHARACTER_STATS: Record<CharacterKey, CharacterStats> = {
  [CharacterKey.NULL]: {
    speed: 0.08,
    scale: 1.0,
  },
  [CharacterKey.TestGreenSlimeA1]: {
    speed: 0.1, // 느린 슬라임
    scale: 0.8, // 작은 크기
  },
  [CharacterKey.TestGreenSlimeB1]: {
    speed: 0.1, // 보통 속도
    scale: 1.0, // 기본 크기
  },
  [CharacterKey.TestGreenSlimeC1]: {
    speed: 0.11, // 빠른 슬라임
    scale: 1.1, // 조금 큰 크기
  },
  [CharacterKey.TestGreenSlimeD1]: {
    speed: 0.12, // 매우 빠른 슬라임
    scale: 1.2, // 큰 크기
  },
};

/**
 * 캐릭터 키로 스탯을 가져오는 헬퍼 함수
 */
export function getCharacterStats(characterKey: CharacterKey): CharacterStats {
  return CHARACTER_STATS[characterKey] || CHARACTER_STATS[CharacterKey.NULL];
}
