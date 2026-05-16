import type { CharacterClass } from "../../types/Character";
import {
  type EvolutionCandidate,
  getEvolutionSpec,
  MONSTER_CHARACTER_KEYS,
} from "./evolutionConfig";
import { CharacterKeyECS } from "./types";

export const MUTATION_BASE_RATE = 0.01;
export const MUTATION_STACK_CAP = 10;
export const MUTATION_DIRTY_EXPOSURE_STACK_INTERVAL_MS = 4 * 60 * 60 * 1000;
export const MUTATION_DETOX_INTERVAL_BY_CLASS_CODE = {
  A: 2 * 60 * 60 * 1000,
  B: 4 * 60 * 60 * 1000,
  C: 4 * 60 * 60 * 1000,
  D: 4 * 60 * 60 * 1000,
} as const;

const MUTATION_BONUS_RATE_BY_GENE_LINE = {
  "green-slime": 0.005,
  "soil-slime": 0.01,
  "skull-slime": 0.015,
} as const;

export type MutationRiskInput = {
  characterKey: CharacterKeyECS | number;
  unnecessaryInjectionStacks: number;
  dirtyExposureStacks: number;
};

function normalizeStackCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.min(MUTATION_STACK_CAP, Math.floor(value));
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

export function getMutationDetoxIntervalMs(
  characterKey: CharacterKeyECS | number,
): number {
  const spec = getEvolutionSpec(characterKey);

  if (!spec) {
    return MUTATION_DETOX_INTERVAL_BY_CLASS_CODE.D;
  }

  return MUTATION_DETOX_INTERVAL_BY_CLASS_CODE[spec.classCode];
}

export function getMutationDetoxIntervalMsByClass(
  characterClass: CharacterClass,
): number {
  const spec = MONSTER_CHARACTER_KEYS.map((characterKey) =>
    getEvolutionSpec(characterKey),
  ).find((candidate) => candidate?.class === characterClass);

  return spec
    ? MUTATION_DETOX_INTERVAL_BY_CLASS_CODE[spec.classCode]
    : MUTATION_DETOX_INTERVAL_BY_CLASS_CODE.D;
}

export function calculateMutationRate(input: MutationRiskInput): number {
  const spec = getEvolutionSpec(input.characterKey);

  if (!spec) {
    return 0;
  }

  const injectionStacks = normalizeStackCount(input.unnecessaryInjectionStacks);
  const dirtyStacks = normalizeStackCount(input.dirtyExposureStacks);
  const stackBonusRate = MUTATION_BONUS_RATE_BY_GENE_LINE[spec.geneLine];

  return Math.min(
    1,
    MUTATION_BASE_RATE + (injectionStacks + dirtyStacks) * stackBonusRate,
  );
}

export function getSameClassCrossGeneMutationTargets(
  characterKey: CharacterKeyECS | number,
): CharacterKeyECS[] {
  const sourceSpec = getEvolutionSpec(characterKey);

  if (!sourceSpec) {
    return [];
  }

  return MONSTER_CHARACTER_KEYS.filter((targetKey) => {
    const targetSpec = getEvolutionSpec(targetKey);

    return (
      targetSpec &&
      targetSpec.classCode === sourceSpec.classCode &&
      targetSpec.geneLine !== sourceSpec.geneLine
    );
  });
}

export function resolveSameClassCrossGeneMutationTarget(
  characterKey: CharacterKeyECS | number,
  randomValue: number = Math.random(),
): CharacterKeyECS | null {
  const candidates = getSameClassCrossGeneMutationTargets(characterKey);

  if (candidates.length === 0) {
    return null;
  }

  const index = Math.floor(normalizeRandom(randomValue) * candidates.length);

  return candidates[index] ?? candidates[candidates.length - 1] ?? null;
}

export function resolveMutationEvolutionCandidate(params: {
  characterKey: CharacterKeyECS | number;
  unnecessaryInjectionStacks: number;
  dirtyExposureStacks: number;
  mutationRoll?: number;
  targetRoll?: number;
}): EvolutionCandidate | null {
  const mutationRate = calculateMutationRate(params);

  if (normalizeRandom(params.mutationRoll ?? Math.random()) >= mutationRate) {
    return null;
  }

  const target = resolveSameClassCrossGeneMutationTarget(
    params.characterKey,
    params.targetRoll ?? Math.random(),
  );

  if (!target) {
    return null;
  }

  return {
    to: target,
    weight: 1,
    kind: "same_class_cross_line_mutation",
  };
}
