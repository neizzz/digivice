import { CharacterClass } from "../../types/Character";
import { getEvolutionSpec } from "./evolutionConfig";
import { CharacterKeyECS as CharacterKey } from "./types";

/**
 * 캐릭터별 기본 스탯 정의
 */
export type CharacterStats = {
  speed: number; // 기본 이동 속도 (pixels per millisecond)
  scale: number; // 캐릭터 크기 배율
  power: number; // 공격력
};

const CHARACTER_STATS_BY_CLASS: Record<CharacterClass, CharacterStats> = {
  [CharacterClass.A]: {
    speed: 0.1,
    scale: 0.8,
    power: 1,
  },
  [CharacterClass.B]: {
    speed: 0.11,
    scale: 1.0,
    power: 1.4,
  },
  [CharacterClass.C]: {
    speed: 0.13,
    scale: 1.1,
    power: 1.8,
  },
  [CharacterClass.D]: {
    speed: 0.15,
    scale: 1.2,
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

  const evolutionSpec = getEvolutionSpec(characterKey);
  if (!evolutionSpec) {
    throw new Error(
      `[getCharacterStats]: Unknown character key: ${characterKey}`,
    );
  }

  return CHARACTER_STATS_BY_CLASS[evolutionSpec.class];
}
