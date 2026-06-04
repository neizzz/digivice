import { CharacterKeyECS } from "./types";

const BASE_GREEN_PERCENT = 65;
const BASE_SOIL_PERCENT = 20;
const BASE_SKULL_PERCENT = 15;
const BONUS_PER_COUNT_PERCENT = 2;
const BONUS_COUNT_CAP = 10;

export type EggHatchGeneProbabilities = {
  green: number;
  soil: number;
  skull: number;
};

export type EggHatchGeneSelectionInput = {
  staleFoodCountAtHatch: number;
  syringeCount: number;
  random: number;
};

export type EggHatchGeneSelectionDiagnostics = {
  normalizedStaleFoodCountAtHatch: number;
  normalizedSyringeCount: number;
  normalizedRandom: number;
  rollPercent: number;
  probabilities: EggHatchGeneProbabilities;
  selectedCharacterKey: CharacterKeyECS;
};

function normalizeBonusCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.min(BONUS_COUNT_CAP, Math.floor(value));
}

function normalizeRandom(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1 - Number.EPSILON;
  }

  return value;
}

export function calculateEggHatchGeneProbabilities(params: {
  staleFoodCountAtHatch: number;
  syringeCount: number;
}): EggHatchGeneProbabilities {
  const staleFoodCount = normalizeBonusCount(params.staleFoodCountAtHatch);
  const syringeCount = normalizeBonusCount(params.syringeCount);
  const soilBonus = staleFoodCount * BONUS_PER_COUNT_PERCENT;
  const skullBonus = syringeCount * BONUS_PER_COUNT_PERCENT;

  return {
    green: BASE_GREEN_PERCENT - soilBonus - skullBonus,
    soil: BASE_SOIL_PERCENT + soilBonus,
    skull: BASE_SKULL_PERCENT + skullBonus,
  };
}

export function resolveEggHatchStartingGeneSelection(
  params: EggHatchGeneSelectionInput,
): EggHatchGeneSelectionDiagnostics {
  const normalizedStaleFoodCountAtHatch = normalizeBonusCount(
    params.staleFoodCountAtHatch,
  );
  const normalizedSyringeCount = normalizeBonusCount(params.syringeCount);
  const normalizedRandom = normalizeRandom(params.random);
  const probabilities = calculateEggHatchGeneProbabilities({
    staleFoodCountAtHatch: normalizedStaleFoodCountAtHatch,
    syringeCount: normalizedSyringeCount,
  });
  const rollPercent = normalizedRandom * 100;

  let selectedCharacterKey: CharacterKeyECS;

  if (rollPercent < probabilities.green) {
    selectedCharacterKey = CharacterKeyECS.GreenSlimeA1;
  } else if (rollPercent < probabilities.green + probabilities.soil) {
    selectedCharacterKey = CharacterKeyECS.SoilSlimeA1;
  } else {
    selectedCharacterKey = CharacterKeyECS.SkullSlimeA1;
  }

  return {
    normalizedStaleFoodCountAtHatch,
    normalizedSyringeCount,
    normalizedRandom,
    rollPercent,
    probabilities,
    selectedCharacterKey,
  };
}

export function selectEggHatchStartingGene(
  params: EggHatchGeneSelectionInput,
): CharacterKeyECS {
  return resolveEggHatchStartingGeneSelection(params).selectedCharacterKey;
}
