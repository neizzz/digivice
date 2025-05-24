import {
  CharacterClass,
  CharacterDictionary,
  CharacterKey,
} from "../types/Character";

export function getCharacterClassFrom(
  characterKey: CharacterKey
): CharacterClass {
  return CharacterDictionary[characterKey].class;
}

export function nextCharacterClassOf(
  characterClass: CharacterClass
): CharacterClass | undefined {
  if (characterClass === CharacterClass.A) {
    return CharacterClass.B;
  }
  if (characterClass === CharacterClass.B) {
    return CharacterClass.C;
  }
  if (characterClass === CharacterClass.C) {
    return CharacterClass.D;
  }
  return undefined;
}

export const EvolutionMap: Partial<
  Record<CharacterKey, Partial<Record<CharacterKey, number>>>
> = import.meta.env.DEV
  ? {
      [CharacterKey.TestGreenSlimeA1]: {
        [CharacterKey.TestGreenSlimeB1]: 1.0, // 100% chance to evolve to B1
      },
      [CharacterKey.TestGreenSlimeB1]: {
        [CharacterKey.TestGreenSlimeC1]: 1.0, // 100% chance to evolve to C1
      },
      [CharacterKey.TestGreenSlimeC1]: {
        [CharacterKey.TestGreenSlimeD1]: 1.0, // 100% chance to evolve to D1
      },
      [CharacterKey.TestGreenSlimeD1]: {}, // No further evolution
    }
  : {};

export function hatch(): CharacterKey {
  // TODO: 알에서 태어날 캐릭터를 랜덤으로 선택하는 로직 추가
  return CharacterKey.TestGreenSlimeA1; // Default to A1 for now
}

/**
 * Returns the next evolution character based on probability distribution
 * @param characterKey Current character key
 * @returns Next character key or undefined if no evolution is possible
 */
// TODO: 돌연변이
export function evolve(characterKey: CharacterKey): CharacterKey | undefined {
  const evolutionOptions = EvolutionMap[characterKey];

  // If no evolution options exist, return undefined
  if (!evolutionOptions || Object.keys(evolutionOptions).length === 0) {
    console.warn(`[evolution] No evolution options for '${characterKey}'`);
    return undefined;
  }

  // Calculate total probability
  const totalProbability = Object.values(evolutionOptions).reduce(
    (sum, prob) => sum + prob,
    0
  );

  // Generate random number between 0 and totalProbability
  const random = Math.random() * totalProbability;

  // Select evolution based on probability
  let cumulativeProbability = 0;
  for (const [nextCharKey, probability] of Object.entries(evolutionOptions)) {
    cumulativeProbability += probability;
    if (random < cumulativeProbability) {
      return nextCharKey as CharacterKey;
    }
  }

  // Fallback (shouldn't reach here unless there's floating point precision issues)
  console.warn(`[evolution] No evolution selected for '${characterKey}'`);
  return Object.keys(evolutionOptions)[0] as CharacterKey;
}
