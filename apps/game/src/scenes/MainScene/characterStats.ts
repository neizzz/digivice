import { CharacterKeyECS as CharacterKey } from "./types";

/**
 * 캐릭터별 기본 스탯 정의
 */
export type CharacterStats = {
  speed: number; // 기본 이동 속도 (pixels per millisecond)
  scale: number; // 캐릭터 크기 배율
  power: number; // 공격력
};

/**
 * 캐릭터 키별 스탯 정의
 */
export const CHARACTER_STATS: Record<
  Exclude<CharacterKey, CharacterKey.NULL>,
  CharacterStats
> = {
  [CharacterKey.TestGreenSlimeA1]: {
    speed: 0.1, // 느린 슬라임 (30 pixels/sec)
    scale: 0.8, // 작은 크기
    power: 1, // 기본 공격력
  },
  [CharacterKey.TestGreenSlimeB1]: {
    speed: 0.11, // 보통 속도 (35 pixels/sec)
    scale: 1.0, // 기본 크기
    power: 1.4,
  },
  [CharacterKey.TestGreenSlimeC1]: {
    speed: 0.13, // 빠른 슬라임 (40 pixels/sec)
    scale: 1.1, // 조금 큰 크기
    power: 1.8,
  },
  [CharacterKey.TestGreenSlimeD1]: {
    speed: 0.15, // 매우 빠른 슬라임 (45 pixels/sec)
    scale: 1.2, // 큰 크기
    power: 2.0,
  },
};

/**
 * 캐릭터 키로 스탯을 가져오는 헬퍼 함수
 */
export function getCharacterStats(characterKey: CharacterKey): CharacterStats {
  if (characterKey === CharacterKey.NULL) {
    throw new Error("[getCharacterStats]: Invalid character key: NULL");
  }
  return CHARACTER_STATS[characterKey];
}
