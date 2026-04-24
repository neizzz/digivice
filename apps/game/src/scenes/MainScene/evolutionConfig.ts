import { CharacterClass } from "../../types/Character";
import { CharacterKeyECS } from "./types";

export type MonsterGeneLine = "green-slime";
export type MonsterClassCode = "A" | "B" | "C" | "D";
export type MonsterCharacterKey = Exclude<CharacterKeyECS, CharacterKeyECS.NULL>;
export type EvolutionCandidateKind =
  | "base"
  | "same_line_variant_mutation"
  | "same_class_cross_line_mutation";

export type EvolutionCandidate = {
  to: CharacterKeyECS;
  weight: number;
  kind: EvolutionCandidateKind;
};

export type MonsterEvolutionSpec = {
  key: CharacterKeyECS;
  code: `${MonsterGeneLine}_${MonsterClassCode}${number}`;
  geneLine: MonsterGeneLine;
  classCode: MonsterClassCode;
  class: CharacterClass;
  variant: number;
  phase: number;
  displayName: string;
  spritesheetName: string;
  evolutionCandidates: EvolutionCandidate[];
};

export type EvolutionGaugeConfig = {
  maxGauge: number;
  staminaThreshold: number;
  boostedStaminaThreshold: number;
  boostedGaugeGainMultiplier: number;
  checkIntervalMs: number;
  sleepingGaugeTimeProgressMultiplier: number;
  gaugeGainByClass: Record<CharacterClass, number>;
  targetDurationByClassMs: Record<CharacterClass, number>;
  targetDurationVarianceByClassMs: Record<CharacterClass, number>;
};

const DEFAULT_MAX_GAUGE = 100;
const HOUR_MS = 60 * 60 * 1000;

const PRODUCTION_EVOLUTION_TARGET_DURATION_BY_CLASS_MS: Record<
  CharacterClass,
  number
> = {
  [CharacterClass.A]: 20 * HOUR_MS,
  [CharacterClass.B]: 40 * HOUR_MS,
  [CharacterClass.C]: 80 * HOUR_MS,
  [CharacterClass.D]: 80 * HOUR_MS,
};

const PRODUCTION_EVOLUTION_TARGET_DURATION_VARIANCE_BY_CLASS_MS: Record<
  CharacterClass,
  number
> = {
  [CharacterClass.A]: 2 * HOUR_MS,
  [CharacterClass.B]: 4 * HOUR_MS,
  [CharacterClass.C]: 8 * HOUR_MS,
  [CharacterClass.D]: 8 * HOUR_MS,
};

const DEV_GAUGE_GAIN_BY_CLASS: Record<CharacterClass, number> = {
  [CharacterClass.A]: 1.0,
  [CharacterClass.B]: 1.0,
  [CharacterClass.C]: 1.0,
  [CharacterClass.D]: 1.0,
};

function getGaugeGainForDurationMs(params: {
  maxGauge: number;
  checkIntervalMs: number;
  durationMs: number;
}): number {
  const { maxGauge, checkIntervalMs, durationMs } = params;

  if (durationMs <= 0) {
    return 0;
  }

  return (maxGauge * checkIntervalMs) / durationMs;
}

function getAverageGaugeGainByClass(params: {
  maxGauge: number;
  checkIntervalMs: number;
  targetDurationByClassMs: Record<CharacterClass, number>;
}): Record<CharacterClass, number> {
  const { maxGauge, checkIntervalMs, targetDurationByClassMs } = params;

  return {
    [CharacterClass.A]: getGaugeGainForDurationMs({
      maxGauge,
      checkIntervalMs,
      durationMs: targetDurationByClassMs[CharacterClass.A],
    }),
    [CharacterClass.B]: getGaugeGainForDurationMs({
      maxGauge,
      checkIntervalMs,
      durationMs: targetDurationByClassMs[CharacterClass.B],
    }),
    [CharacterClass.C]: getGaugeGainForDurationMs({
      maxGauge,
      checkIntervalMs,
      durationMs: targetDurationByClassMs[CharacterClass.C],
    }),
    [CharacterClass.D]: getGaugeGainForDurationMs({
      maxGauge,
      checkIntervalMs,
      durationMs: targetDurationByClassMs[CharacterClass.D],
    }),
  };
}

function getStableSeededUnitValue(seed: string): number {
  let hash = 2166136261;

  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967296;
}

export const PRODUCTION_EVOLUTION_GAUGE_CONFIG: EvolutionGaugeConfig = {
  maxGauge: DEFAULT_MAX_GAUGE,
  staminaThreshold: 4,
  boostedStaminaThreshold: 8,
  boostedGaugeGainMultiplier: 1.1,
  checkIntervalMs: 10_000,
  sleepingGaugeTimeProgressMultiplier: 1 / 3,
  gaugeGainByClass: getAverageGaugeGainByClass({
    maxGauge: DEFAULT_MAX_GAUGE,
    checkIntervalMs: 10_000,
    targetDurationByClassMs: PRODUCTION_EVOLUTION_TARGET_DURATION_BY_CLASS_MS,
  }),
  targetDurationByClassMs: PRODUCTION_EVOLUTION_TARGET_DURATION_BY_CLASS_MS,
  targetDurationVarianceByClassMs:
    PRODUCTION_EVOLUTION_TARGET_DURATION_VARIANCE_BY_CLASS_MS,
};

export const DEV_EVOLUTION_GAUGE_CONFIG: EvolutionGaugeConfig = {
  maxGauge: DEFAULT_MAX_GAUGE,
  staminaThreshold: 4,
  boostedStaminaThreshold: 8,
  boostedGaugeGainMultiplier: 1.1,
  checkIntervalMs: 10_000,
  sleepingGaugeTimeProgressMultiplier: 1 / 3,
  gaugeGainByClass: DEV_GAUGE_GAIN_BY_CLASS,
  targetDurationByClassMs: PRODUCTION_EVOLUTION_TARGET_DURATION_BY_CLASS_MS,
  targetDurationVarianceByClassMs:
    PRODUCTION_EVOLUTION_TARGET_DURATION_VARIANCE_BY_CLASS_MS,
};

export const EVOLUTION_GAUGE_CONFIG: EvolutionGaugeConfig = import.meta.env.DEV
  ? DEV_EVOLUTION_GAUGE_CONFIG
  : PRODUCTION_EVOLUTION_GAUGE_CONFIG;

function createDisplayName(
  geneLine: MonsterGeneLine,
  classCode: MonsterClassCode,
  variant: number,
): string {
  const baseName = geneLine
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return `${baseName} ${classCode}${variant}`;
}

function createBaseCandidate(
  to: CharacterKeyECS,
  weight: number,
): EvolutionCandidate {
  return { to, weight, kind: "base" };
}

function createVariantMutationCandidate(
  to: CharacterKeyECS,
  weight: number,
): EvolutionCandidate {
  return { to, weight, kind: "same_line_variant_mutation" };
}

export const MONSTER_EVOLUTION_CATALOG: Record<MonsterCharacterKey, MonsterEvolutionSpec> = {
  [CharacterKeyECS.TestGreenSlimeA1]: {
    key: CharacterKeyECS.TestGreenSlimeA1,
    code: "green-slime_A1",
    geneLine: "green-slime",
    classCode: "A",
    class: CharacterClass.A,
    variant: 1,
    phase: 1,
    displayName: createDisplayName("green-slime", "A", 1),
    spritesheetName: "green-slime_A1",
    evolutionCandidates: [
      createBaseCandidate(CharacterKeyECS.TestGreenSlimeB1, 80),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeB2, 10),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeB3, 10),
    ],
  },
  [CharacterKeyECS.TestGreenSlimeB1]: {
    key: CharacterKeyECS.TestGreenSlimeB1,
    code: "green-slime_B1",
    geneLine: "green-slime",
    classCode: "B",
    class: CharacterClass.B,
    variant: 1,
    phase: 2,
    displayName: createDisplayName("green-slime", "B", 1),
    spritesheetName: "green-slime_B1",
    evolutionCandidates: [
      createBaseCandidate(CharacterKeyECS.TestGreenSlimeC1, 70),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeC2, 10),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeC3, 10),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeC4, 10),
    ],
  },
  [CharacterKeyECS.TestGreenSlimeB2]: {
    key: CharacterKeyECS.TestGreenSlimeB2,
    code: "green-slime_B2",
    geneLine: "green-slime",
    classCode: "B",
    class: CharacterClass.B,
    variant: 2,
    phase: 2,
    displayName: createDisplayName("green-slime", "B", 2),
    spritesheetName: "green-slime_B2",
    evolutionCandidates: [
      createBaseCandidate(CharacterKeyECS.TestGreenSlimeC2, 70),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeC1, 10),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeC3, 10),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeC4, 10),
    ],
  },
  [CharacterKeyECS.TestGreenSlimeB3]: {
    key: CharacterKeyECS.TestGreenSlimeB3,
    code: "green-slime_B3",
    geneLine: "green-slime",
    classCode: "B",
    class: CharacterClass.B,
    variant: 3,
    phase: 2,
    displayName: createDisplayName("green-slime", "B", 3),
    spritesheetName: "green-slime_B3",
    evolutionCandidates: [
      createBaseCandidate(CharacterKeyECS.TestGreenSlimeC3, 70),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeC1, 10),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeC2, 10),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeC4, 10),
    ],
  },
  [CharacterKeyECS.TestGreenSlimeC1]: {
    key: CharacterKeyECS.TestGreenSlimeC1,
    code: "green-slime_C1",
    geneLine: "green-slime",
    classCode: "C",
    class: CharacterClass.C,
    variant: 1,
    phase: 3,
    displayName: createDisplayName("green-slime", "C", 1),
    spritesheetName: "green-slime_C1",
    evolutionCandidates: [
      createBaseCandidate(CharacterKeyECS.TestGreenSlimeD1, 70),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeD2, 10),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeD3, 10),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeD4, 10),
    ],
  },
  [CharacterKeyECS.TestGreenSlimeC2]: {
    key: CharacterKeyECS.TestGreenSlimeC2,
    code: "green-slime_C2",
    geneLine: "green-slime",
    classCode: "C",
    class: CharacterClass.C,
    variant: 2,
    phase: 3,
    displayName: createDisplayName("green-slime", "C", 2),
    spritesheetName: "green-slime_C2",
    evolutionCandidates: [
      createBaseCandidate(CharacterKeyECS.TestGreenSlimeD2, 70),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeD1, 10),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeD3, 10),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeD4, 10),
    ],
  },
  [CharacterKeyECS.TestGreenSlimeC3]: {
    key: CharacterKeyECS.TestGreenSlimeC3,
    code: "green-slime_C3",
    geneLine: "green-slime",
    classCode: "C",
    class: CharacterClass.C,
    variant: 3,
    phase: 3,
    displayName: createDisplayName("green-slime", "C", 3),
    spritesheetName: "green-slime_C3",
    evolutionCandidates: [
      createBaseCandidate(CharacterKeyECS.TestGreenSlimeD3, 70),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeD1, 10),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeD2, 10),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeD4, 10),
    ],
  },
  [CharacterKeyECS.TestGreenSlimeC4]: {
    key: CharacterKeyECS.TestGreenSlimeC4,
    code: "green-slime_C4",
    geneLine: "green-slime",
    classCode: "C",
    class: CharacterClass.C,
    variant: 4,
    phase: 3,
    displayName: createDisplayName("green-slime", "C", 4),
    spritesheetName: "green-slime_C4",
    evolutionCandidates: [
      createBaseCandidate(CharacterKeyECS.TestGreenSlimeD4, 70),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeD1, 10),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeD2, 10),
      createVariantMutationCandidate(CharacterKeyECS.TestGreenSlimeD3, 10),
    ],
  },
  [CharacterKeyECS.TestGreenSlimeD1]: {
    key: CharacterKeyECS.TestGreenSlimeD1,
    code: "green-slime_D1",
    geneLine: "green-slime",
    classCode: "D",
    class: CharacterClass.D,
    variant: 1,
    phase: 4,
    displayName: createDisplayName("green-slime", "D", 1),
    spritesheetName: "green-slime_D1",
    evolutionCandidates: [],
  },
  [CharacterKeyECS.TestGreenSlimeD2]: {
    key: CharacterKeyECS.TestGreenSlimeD2,
    code: "green-slime_D2",
    geneLine: "green-slime",
    classCode: "D",
    class: CharacterClass.D,
    variant: 2,
    phase: 4,
    displayName: createDisplayName("green-slime", "D", 2),
    spritesheetName: "green-slime_D2",
    evolutionCandidates: [],
  },
  [CharacterKeyECS.TestGreenSlimeD3]: {
    key: CharacterKeyECS.TestGreenSlimeD3,
    code: "green-slime_D3",
    geneLine: "green-slime",
    classCode: "D",
    class: CharacterClass.D,
    variant: 3,
    phase: 4,
    displayName: createDisplayName("green-slime", "D", 3),
    spritesheetName: "green-slime_D3",
    evolutionCandidates: [],
  },
  [CharacterKeyECS.TestGreenSlimeD4]: {
    key: CharacterKeyECS.TestGreenSlimeD4,
    code: "green-slime_D4",
    geneLine: "green-slime",
    classCode: "D",
    class: CharacterClass.D,
    variant: 4,
    phase: 4,
    displayName: createDisplayName("green-slime", "D", 4),
    spritesheetName: "green-slime_D4",
    evolutionCandidates: [],
  },
};

export const MONSTER_CHARACTER_KEYS = Object.keys(
  MONSTER_EVOLUTION_CATALOG,
).map((value) => Number(value) as MonsterCharacterKey);

export function isMonsterCharacterKey(
  characterKey: CharacterKeyECS | number,
): characterKey is MonsterCharacterKey {
  return characterKey !== CharacterKeyECS.NULL && characterKey in MONSTER_EVOLUTION_CATALOG;
}

export function getEvolutionSpec(
  characterKey: CharacterKeyECS | number,
): MonsterEvolutionSpec | null {
  if (!isMonsterCharacterKey(characterKey)) {
    return null;
  }

  return MONSTER_EVOLUTION_CATALOG[characterKey];
}

export function getCharacterDisplayName(characterKey: CharacterKeyECS | number): string {
  return getEvolutionSpec(characterKey)?.displayName ?? "Unknown Character";
}

export function getCharacterSpritesheetName(
  characterKey: CharacterKeyECS | number,
): string | null {
  return getEvolutionSpec(characterKey)?.spritesheetName ?? null;
}

export function getEvolutionGaugeIncreaseAmount(
  characterKey: CharacterKeyECS | number,
): number {
  const spec = getEvolutionSpec(characterKey);
  if (!spec) {
    return 0;
  }

  return EVOLUTION_GAUGE_CONFIG.gaugeGainByClass[spec.class] ?? 0;
}

export function getProductionEvolutionTargetDurationMsForEntity(params: {
  characterKey: CharacterKeyECS | number;
  objectId: number;
}): number {
  const { characterKey, objectId } = params;
  const spec = getEvolutionSpec(characterKey);

  if (!spec) {
    return 0;
  }

  const targetDurationMs =
    PRODUCTION_EVOLUTION_GAUGE_CONFIG.targetDurationByClassMs[spec.class];
  const varianceMs =
    PRODUCTION_EVOLUTION_GAUGE_CONFIG.targetDurationVarianceByClassMs[
      spec.class
    ];
  const seedValue = getStableSeededUnitValue(
    `${Math.trunc(objectId)}:${spec.classCode}:${spec.phase}`,
  );
  const jitterRatio = seedValue * 2 - 1;

  return targetDurationMs + varianceMs * jitterRatio;
}

export function getEvolutionGaugeIncreaseAmountForEntity(params: {
  characterKey: CharacterKeyECS | number;
  objectId: number;
}): number {
  if (import.meta.env.DEV) {
    return getEvolutionGaugeIncreaseAmount(params.characterKey);
  }

  return getGaugeGainForDurationMs({
    maxGauge: PRODUCTION_EVOLUTION_GAUGE_CONFIG.maxGauge,
    checkIntervalMs: PRODUCTION_EVOLUTION_GAUGE_CONFIG.checkIntervalMs,
    durationMs: getProductionEvolutionTargetDurationMsForEntity(params),
  });
}

export function canEvolveFromConfig(characterKey: CharacterKeyECS | number): boolean {
  const spec = getEvolutionSpec(characterKey);
  return !!spec && spec.evolutionCandidates.length > 0;
}

export function hasReachedEvolutionGaugeMax(gauge: number): boolean {
  return gauge >= EVOLUTION_GAUGE_CONFIG.maxGauge;
}

export function validateEvolutionWeights(
  characterKey: CharacterKeyECS | number,
): boolean {
  const spec = getEvolutionSpec(characterKey);
  if (!spec) {
    return false;
  }

  const totalWeight = spec.evolutionCandidates.reduce(
    (sum, candidate) => sum + candidate.weight,
    0,
  );

  return spec.evolutionCandidates.length === 0 || totalWeight === 100;
}

export function resolveEvolutionCandidate(
  characterKey: CharacterKeyECS | number,
  randomValue: number = Math.random(),
): EvolutionCandidate | null {
  const spec = getEvolutionSpec(characterKey);
  if (!spec || spec.evolutionCandidates.length === 0) {
    return null;
  }

  const normalizedRandom = Math.min(Math.max(randomValue, 0), 0.999999);
  const roll = normalizedRandom * 100;
  let accumulatedWeight = 0;

  for (const candidate of spec.evolutionCandidates) {
    accumulatedWeight += candidate.weight;
    if (roll < accumulatedWeight) {
      return candidate;
    }
  }

  return spec.evolutionCandidates[spec.evolutionCandidates.length - 1] ?? null;
}

export function resolveEvolutionTarget(
  characterKey: CharacterKeyECS | number,
  randomValue?: number,
): CharacterKeyECS | null {
  return resolveEvolutionCandidate(characterKey, randomValue)?.to ?? null;
}

export function resolveEvolutionPhase(params: {
  currentCharacterKey: CharacterKeyECS;
  targetCharacterKey: CharacterKeyECS;
  candidateKind: EvolutionCandidateKind;
}): number {
  const { currentCharacterKey, targetCharacterKey, candidateKind } = params;
  const currentSpec = getEvolutionSpec(currentCharacterKey);
  const targetSpec = getEvolutionSpec(targetCharacterKey);

  if (!currentSpec || !targetSpec) {
    return currentSpec?.phase ?? 1;
  }

  if (candidateKind === "same_class_cross_line_mutation") {
    return currentSpec.phase;
  }

  return targetSpec.phase;
}
