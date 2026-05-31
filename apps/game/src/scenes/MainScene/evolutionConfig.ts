import { CharacterClass } from "../../types/Character";
import evolutionOverrideData from "./evolution-overrides.v1.json";
import { CharacterKeyECS } from "./types";
import { resolveWeightedCandidate } from "./weightedSelection";

export type MonsterGeneLine = "green-slime" | "skull-slime" | "soil-slime";
export type MonsterClassCode = "A" | "B" | "C" | "D";
export type MonsterCharacterKey = Exclude<
  CharacterKeyECS,
  CharacterKeyECS.NULL
>;
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

export type MonsterEvolutionCode = MonsterEvolutionSpec["code"];
export type EvolutionRarity = 1 | 2 | 3 | 4 | 5;
export type EvolutionRarityEntry = {
  reachProbability: number;
  rarity: EvolutionRarity;
};

type EvolutionOverrideCandidate = {
  toCode: MonsterEvolutionCode;
  weight: number;
  kind?: EvolutionCandidateKind;
};

type EvolutionOverrideEntry = {
  evolutionCandidates: EvolutionOverrideCandidate[];
};

export type EvolutionOverrideConfig = {
  schemaVersion: 1;
  overrides: Partial<Record<MonsterEvolutionCode, EvolutionOverrideEntry>>;
  rarities?: Partial<Record<MonsterEvolutionCode, EvolutionRarityEntry>>;
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

export type EvolutionPhaseDurationEstimate = {
  phase: number;
  classCode: MonsterClassCode;
  expectedDurationMs: number | null;
  varianceMs: number | null;
  minDurationMs: number | null;
  maxDurationMs: number | null;
  canEvolve: boolean;
};

const DEFAULT_MAX_GAUGE = 100;
const HOUR_MS = 60 * 60 * 1000;
export const EVOLUTION_GAUGE_GAIN_MULTIPLIER = 1.1;

const PRODUCTION_EVOLUTION_TARGET_DURATION_BY_CLASS_MS: Record<
  CharacterClass,
  number
> = {
  [CharacterClass.A]: 20 * HOUR_MS,
  [CharacterClass.B]: 40 * HOUR_MS,
  [CharacterClass.C]: 60 * HOUR_MS,
  [CharacterClass.D]: 80 * HOUR_MS,
};

const PRODUCTION_EVOLUTION_TARGET_DURATION_VARIANCE_BY_CLASS_MS: Record<
  CharacterClass,
  number
> = {
  [CharacterClass.A]: 2 * HOUR_MS,
  [CharacterClass.B]: 4 * HOUR_MS,
  [CharacterClass.C]: 6 * HOUR_MS,
  [CharacterClass.D]: 8 * HOUR_MS,
};

const DEV_GAUGE_GAIN_BY_CLASS: Record<CharacterClass, number> = {
  [CharacterClass.A]: 1.0 * EVOLUTION_GAUGE_GAIN_MULTIPLIER,
  [CharacterClass.B]: 1.0 * EVOLUTION_GAUGE_GAIN_MULTIPLIER,
  [CharacterClass.C]: 1.0 * EVOLUTION_GAUGE_GAIN_MULTIPLIER,
  [CharacterClass.D]: 1.0 * EVOLUTION_GAUGE_GAIN_MULTIPLIER,
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

  return (
    ((maxGauge * checkIntervalMs) / durationMs) *
    EVOLUTION_GAUGE_GAIN_MULTIPLIER
  );
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
  staminaThreshold: 3,
  boostedStaminaThreshold: 7,
  boostedGaugeGainMultiplier: 1.2,
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
  staminaThreshold: 3,
  boostedStaminaThreshold: 7,
  boostedGaugeGainMultiplier: 1.2,
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

type MonsterLineDefinition = {
  geneLine: MonsterGeneLine;
  classes: Record<MonsterClassCode, CharacterKeyECS[]>;
};

type MonsterVariantDefinition = {
  key: CharacterKeyECS;
  geneLine: MonsterGeneLine;
  classCode: MonsterClassCode;
  class: CharacterClass;
  variant: number;
  phase: number;
};

const MONSTER_CLASS_BY_CODE: Record<MonsterClassCode, CharacterClass> = {
  A: CharacterClass.A,
  B: CharacterClass.B,
  C: CharacterClass.C,
  D: CharacterClass.D,
};

const MONSTER_PHASE_BY_CLASS_CODE: Record<MonsterClassCode, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
};

const MONSTER_CLASS_CODE_BY_PHASE: Partial<Record<number, MonsterClassCode>> =
  Object.fromEntries(
    Object.entries(MONSTER_PHASE_BY_CLASS_CODE).map(([classCode, phase]) => [
      phase,
      classCode as MonsterClassCode,
    ]),
  );

const MAX_EVOLUTION_RARITY_BY_CLASS_CODE: Record<
  MonsterClassCode,
  EvolutionRarity
> = {
  A: 2,
  B: 3,
  C: 4,
  D: 5,
};

const MIN_EVOLUTION_RARITY_BY_CLASS_CODE: Record<
  MonsterClassCode,
  EvolutionRarity
> = {
  A: 1,
  B: 1,
  C: 2,
  D: 2,
};

const DEFAULT_CANDIDATE_WEIGHTS: Record<number, number[]> = {
  1: [100],
  2: [70, 30],
  3: [55, 25, 20],
  4: [50, 20, 15, 15],
};

const MONSTER_LINE_DEFINITIONS: MonsterLineDefinition[] = [
  {
    geneLine: "green-slime",
    classes: {
      A: [CharacterKeyECS.GreenSlimeA1],
      B: [
        CharacterKeyECS.GreenSlimeB1,
        CharacterKeyECS.GreenSlimeB2,
        CharacterKeyECS.GreenSlimeB3,
      ],
      C: [
        CharacterKeyECS.GreenSlimeC1,
        CharacterKeyECS.GreenSlimeC2,
        CharacterKeyECS.GreenSlimeC3,
        CharacterKeyECS.GreenSlimeC4,
      ],
      D: [
        CharacterKeyECS.GreenSlimeD1,
        CharacterKeyECS.GreenSlimeD2,
        CharacterKeyECS.GreenSlimeD3,
        CharacterKeyECS.GreenSlimeD4,
      ],
    },
  },
  {
    geneLine: "skull-slime",
    classes: {
      A: [CharacterKeyECS.SkullSlimeA1],
      B: [CharacterKeyECS.SkullSlimeB1, CharacterKeyECS.SkullSlimeB2],
      C: [CharacterKeyECS.SkullSlimeC1, CharacterKeyECS.SkullSlimeC2],
      D: [CharacterKeyECS.SkullSlimeD1, CharacterKeyECS.SkullSlimeD2],
    },
  },
  {
    geneLine: "soil-slime",
    classes: {
      A: [CharacterKeyECS.SoilSlimeA1],
      B: [CharacterKeyECS.SoilSlimeB1, CharacterKeyECS.SoilSlimeB2],
      C: [
        CharacterKeyECS.SoilSlimeC1,
        CharacterKeyECS.SoilSlimeC2,
        CharacterKeyECS.SoilSlimeC3,
      ],
      D: [
        CharacterKeyECS.SoilSlimeD1,
        CharacterKeyECS.SoilSlimeD2,
        CharacterKeyECS.SoilSlimeD3,
      ],
    },
  },
];

function getNextClassCode(
  classCode: MonsterClassCode,
): MonsterClassCode | null {
  switch (classCode) {
    case "A":
      return "B";
    case "B":
      return "C";
    case "C":
      return "D";
    case "D":
      return null;
  }
}

function getDefaultCandidateWeights(candidateCount: number): number[] {
  const presetWeights = DEFAULT_CANDIDATE_WEIGHTS[candidateCount];

  if (presetWeights) {
    return presetWeights;
  }

  return Array.from({ length: candidateCount }, () =>
    Math.max(1, Math.floor(100 / candidateCount)),
  );
}

function createMonsterVariantDefinition(params: {
  geneLine: MonsterGeneLine;
  classCode: MonsterClassCode;
  key: CharacterKeyECS;
  variant: number;
}): MonsterVariantDefinition {
  return {
    key: params.key,
    geneLine: params.geneLine,
    classCode: params.classCode,
    class: MONSTER_CLASS_BY_CODE[params.classCode],
    variant: params.variant,
    phase: MONSTER_PHASE_BY_CLASS_CODE[params.classCode],
  };
}

function getVariantDefinitionsByClass(
  lineDefinition: MonsterLineDefinition,
): Record<MonsterClassCode, MonsterVariantDefinition[]> {
  return {
    A: lineDefinition.classes.A.map((key, index) =>
      createMonsterVariantDefinition({
        geneLine: lineDefinition.geneLine,
        classCode: "A",
        key,
        variant: index + 1,
      }),
    ),
    B: lineDefinition.classes.B.map((key, index) =>
      createMonsterVariantDefinition({
        geneLine: lineDefinition.geneLine,
        classCode: "B",
        key,
        variant: index + 1,
      }),
    ),
    C: lineDefinition.classes.C.map((key, index) =>
      createMonsterVariantDefinition({
        geneLine: lineDefinition.geneLine,
        classCode: "C",
        key,
        variant: index + 1,
      }),
    ),
    D: lineDefinition.classes.D.map((key, index) =>
      createMonsterVariantDefinition({
        geneLine: lineDefinition.geneLine,
        classCode: "D",
        key,
        variant: index + 1,
      }),
    ),
  };
}

function getOrderedNextVariantDefinitions(params: {
  sourceDefinition: MonsterVariantDefinition;
  nextDefinitions: MonsterVariantDefinition[];
}): MonsterVariantDefinition[] {
  const { sourceDefinition, nextDefinitions } = params;
  const baseVariant = Math.min(
    sourceDefinition.variant,
    nextDefinitions.length,
  );
  const baseDefinition = nextDefinitions.find(
    (definition) => definition.variant === baseVariant,
  );

  if (!baseDefinition) {
    return nextDefinitions;
  }

  return [
    baseDefinition,
    ...nextDefinitions.filter((definition) => definition !== baseDefinition),
  ];
}

function createEvolutionCandidates(params: {
  sourceDefinition: MonsterVariantDefinition;
  definitionsByClass: Record<MonsterClassCode, MonsterVariantDefinition[]>;
}): EvolutionCandidate[] {
  const { sourceDefinition, definitionsByClass } = params;
  const nextClassCode = getNextClassCode(sourceDefinition.classCode);

  if (!nextClassCode) {
    return [];
  }

  const nextDefinitions = getOrderedNextVariantDefinitions({
    sourceDefinition,
    nextDefinitions: definitionsByClass[nextClassCode],
  });
  const weights = getDefaultCandidateWeights(nextDefinitions.length);

  return nextDefinitions.map((definition, index) => ({
    to: definition.key,
    weight: weights[index] ?? 1,
    kind: index === 0 ? "base" : "same_line_variant_mutation",
  }));
}

function createMonsterEvolutionSpec(params: {
  definition: MonsterVariantDefinition;
  definitionsByClass: Record<MonsterClassCode, MonsterVariantDefinition[]>;
}): MonsterEvolutionSpec {
  const { definition, definitionsByClass } = params;
  const code =
    `${definition.geneLine}_${definition.classCode}${definition.variant}` as MonsterEvolutionCode;

  return {
    key: definition.key,
    code,
    geneLine: definition.geneLine,
    classCode: definition.classCode,
    class: definition.class,
    variant: definition.variant,
    phase: definition.phase,
    displayName: createDisplayName(
      definition.geneLine,
      definition.classCode,
      definition.variant,
    ),
    spritesheetName: code,
    evolutionCandidates: createEvolutionCandidates({
      sourceDefinition: definition,
      definitionsByClass,
    }),
  };
}

function createMonsterEvolutionCatalog(): Record<
  MonsterCharacterKey,
  MonsterEvolutionSpec
> {
  const entries = MONSTER_LINE_DEFINITIONS.flatMap((lineDefinition) => {
    const definitionsByClass = getVariantDefinitionsByClass(lineDefinition);
    const definitions = Object.values(definitionsByClass).flat();

    return definitions.map((definition) => [
      definition.key,
      createMonsterEvolutionSpec({ definition, definitionsByClass }),
    ]);
  });

  return Object.fromEntries(entries) as Record<
    MonsterCharacterKey,
    MonsterEvolutionSpec
  >;
}

function cloneEvolutionSpec(spec: MonsterEvolutionSpec): MonsterEvolutionSpec {
  return {
    ...spec,
    evolutionCandidates: spec.evolutionCandidates.map((candidate) => ({
      ...candidate,
    })),
  };
}

function assertEvolutionOverrideConfig(
  value: unknown,
): asserts value is EvolutionOverrideConfig {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (value as { schemaVersion?: unknown }).schemaVersion !== 1 ||
    !(value as { overrides?: unknown }).overrides ||
    typeof (value as { overrides?: unknown }).overrides !== "object" ||
    Array.isArray((value as { overrides?: unknown }).overrides)
  ) {
    throw new Error(
      "[evolution] evolution-overrides.v1.json must match schemaVersion 1.",
    );
  }

  const rarities = (value as { rarities?: unknown }).rarities;

  if (
    rarities !== undefined &&
    (!rarities || typeof rarities !== "object" || Array.isArray(rarities))
  ) {
    throw new Error(
      "[evolution] evolution-overrides.v1.json rarities must be an object.",
    );
  }
}

function validateEvolutionRarityConfig(params: {
  baseCatalog: Record<MonsterCharacterKey, MonsterEvolutionSpec>;
  overrideConfig: EvolutionOverrideConfig;
}): Partial<Record<MonsterEvolutionCode, EvolutionRarityEntry>> {
  const { baseCatalog, overrideConfig } = params;
  const rarityConfig = overrideConfig.rarities ?? {};
  const specsByCode = new Map(
    Object.values(baseCatalog).map((spec) => [spec.code, spec]),
  );
  const result: Partial<Record<MonsterEvolutionCode, EvolutionRarityEntry>> =
    {};

  for (const [rawCode, rawEntry] of Object.entries(rarityConfig)) {
    const code = rawCode as MonsterEvolutionCode;

    const spec = specsByCode.get(code);

    if (!spec) {
      throw new Error(`[evolution] Unknown rarity source code: ${rawCode}`);
    }

    if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
      throw new Error(`[evolution] Invalid rarity entry for ${rawCode}.`);
    }

    const { reachProbability, rarity } = rawEntry;

    if (
      typeof reachProbability !== "number" ||
      !Number.isFinite(reachProbability) ||
      reachProbability < 0 ||
      reachProbability > 1
    ) {
      throw new Error(
        `[evolution] Invalid reachProbability for ${rawCode}: ${reachProbability}`,
      );
    }

    if (!Number.isInteger(rarity) || rarity < 1 || rarity > 5) {
      throw new Error(`[evolution] Invalid rarity for ${rawCode}: ${rarity}`);
    }

    const minRarity = getMinEvolutionRarityForClass(spec.classCode);
    const maxRarity = getMaxEvolutionRarityForClass(spec.classCode);

    if (rarity < minRarity || rarity > maxRarity) {
      throw new Error(
        `[evolution] Invalid rarity for ${rawCode}: ${rarity}. Class ${spec.classCode} supports ${minRarity}-${maxRarity}.`,
      );
    }

    result[code] = {
      reachProbability,
      rarity: rarity as EvolutionRarity,
    };
  }

  return result;
}

export function applyEvolutionOverrideConfig(
  baseCatalog: Record<MonsterCharacterKey, MonsterEvolutionSpec>,
  overrideConfig: EvolutionOverrideConfig,
): Record<MonsterCharacterKey, MonsterEvolutionSpec> {
  const nextCatalog = Object.fromEntries(
    Object.entries(baseCatalog).map(([key, spec]) => [
      key,
      cloneEvolutionSpec(spec),
    ]),
  ) as Record<MonsterCharacterKey, MonsterEvolutionSpec>;
  const specsByCode = new Map(
    Object.values(nextCatalog).map((spec) => [spec.code, spec]),
  );

  for (const [sourceCode, overrideEntry] of Object.entries(
    overrideConfig.overrides,
  )) {
    if (
      !overrideEntry ||
      typeof overrideEntry !== "object" ||
      Array.isArray(overrideEntry)
    ) {
      throw new Error(`[evolution] Invalid override entry for ${sourceCode}.`);
    }

    const sourceSpec = specsByCode.get(sourceCode as MonsterEvolutionCode);

    if (!sourceSpec) {
      throw new Error(
        `[evolution] Unknown override source code: ${sourceCode}`,
      );
    }

    if (sourceSpec.evolutionCandidates.length === 0) {
      throw new Error(
        `[evolution] Terminal monster cannot be overridden: ${sourceCode}`,
      );
    }

    if (
      !Array.isArray(overrideEntry.evolutionCandidates) ||
      overrideEntry.evolutionCandidates.length !==
        sourceSpec.evolutionCandidates.length
    ) {
      throw new Error(
        `[evolution] Candidate count mismatch for ${sourceCode}. Expected ${sourceSpec.evolutionCandidates.length}.`,
      );
    }

    const overrideCandidatesByCode = new Map<
      MonsterEvolutionCode,
      EvolutionOverrideCandidate
    >();

    for (const overrideCandidate of overrideEntry.evolutionCandidates) {
      const baselineCandidate = sourceSpec.evolutionCandidates.find(
        (candidate) => {
          const targetSpec = nextCatalog[candidate.to as MonsterCharacterKey];
          return targetSpec?.code === overrideCandidate.toCode;
        },
      );

      if (!baselineCandidate) {
        throw new Error(
          `[evolution] Unknown override target for ${sourceCode}: ${overrideCandidate.toCode}`,
        );
      }

      if (
        !Number.isInteger(overrideCandidate.weight) ||
        overrideCandidate.weight < 0 ||
        overrideCandidate.weight > 100
      ) {
        throw new Error(
          `[evolution] Invalid override weight for ${sourceCode} -> ${overrideCandidate.toCode}: ${overrideCandidate.weight}`,
        );
      }

      if (
        overrideCandidate.kind !== undefined &&
        overrideCandidate.kind !== baselineCandidate.kind
      ) {
        throw new Error(
          `[evolution] Override kind mismatch for ${sourceCode} -> ${overrideCandidate.toCode}.`,
        );
      }

      if (overrideCandidatesByCode.has(overrideCandidate.toCode)) {
        throw new Error(
          `[evolution] Duplicate override target for ${sourceCode}: ${overrideCandidate.toCode}`,
        );
      }

      overrideCandidatesByCode.set(overrideCandidate.toCode, overrideCandidate);
    }

    sourceSpec.evolutionCandidates = sourceSpec.evolutionCandidates.map(
      (candidate) => {
        const targetSpec = nextCatalog[candidate.to as MonsterCharacterKey];
        const overrideCandidate = targetSpec
          ? overrideCandidatesByCode.get(targetSpec.code)
          : undefined;

        return {
          ...candidate,
          weight: overrideCandidate?.weight ?? candidate.weight,
        };
      },
    );
  }

  return nextCatalog;
}

export function getMaxEvolutionRarityForClass(
  classCode: MonsterClassCode,
): EvolutionRarity {
  return MAX_EVOLUTION_RARITY_BY_CLASS_CODE[classCode];
}

export function getMinEvolutionRarityForClass(
  classCode: MonsterClassCode,
): EvolutionRarity {
  return MIN_EVOLUTION_RARITY_BY_CLASS_CODE[classCode];
}

assertEvolutionOverrideConfig(evolutionOverrideData);

const BASE_MONSTER_EVOLUTION_CATALOG = createMonsterEvolutionCatalog();

export const MONSTER_EVOLUTION_RARITIES = validateEvolutionRarityConfig({
  baseCatalog: BASE_MONSTER_EVOLUTION_CATALOG,
  overrideConfig: evolutionOverrideData,
});

export const MONSTER_EVOLUTION_CATALOG: Record<
  MonsterCharacterKey,
  MonsterEvolutionSpec
> = applyEvolutionOverrideConfig(
  BASE_MONSTER_EVOLUTION_CATALOG,
  evolutionOverrideData,
);

export const MONSTER_CHARACTER_KEYS = Object.keys(
  MONSTER_EVOLUTION_CATALOG,
).map((value) => Number(value) as MonsterCharacterKey);

export function isMonsterCharacterKey(
  characterKey: CharacterKeyECS | number,
): characterKey is MonsterCharacterKey {
  return (
    characterKey !== CharacterKeyECS.NULL &&
    characterKey in MONSTER_EVOLUTION_CATALOG
  );
}

export function getEvolutionSpec(
  characterKey: CharacterKeyECS | number,
): MonsterEvolutionSpec | null {
  if (!isMonsterCharacterKey(characterKey)) {
    return null;
  }

  return MONSTER_EVOLUTION_CATALOG[characterKey];
}

export function getEvolutionRarity(
  characterKey: CharacterKeyECS | number,
): EvolutionRarityEntry | null {
  const spec = getEvolutionSpec(characterKey);

  if (!spec) {
    return null;
  }

  return MONSTER_EVOLUTION_RARITIES[spec.code] ?? null;
}

export function getCharacterDisplayName(
  characterKey: CharacterKeyECS | number,
): string {
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

export function getEvolutionPhaseDurationEstimate(
  phase: number,
): EvolutionPhaseDurationEstimate | null {
  const normalizedPhase = Math.trunc(phase);
  const classCode = MONSTER_CLASS_CODE_BY_PHASE[normalizedPhase];

  if (!classCode) {
    return null;
  }

  if (classCode === "D") {
    return {
      phase: normalizedPhase,
      classCode,
      expectedDurationMs: null,
      varianceMs: null,
      minDurationMs: null,
      maxDurationMs: null,
      canEvolve: false,
    };
  }

  const characterClass = MONSTER_CLASS_BY_CODE[classCode];
  const expectedDurationMs =
    PRODUCTION_EVOLUTION_GAUGE_CONFIG.targetDurationByClassMs[characterClass];
  const varianceMs =
    PRODUCTION_EVOLUTION_GAUGE_CONFIG.targetDurationVarianceByClassMs[
      characterClass
    ];

  return {
    phase: normalizedPhase,
    classCode,
    expectedDurationMs,
    varianceMs,
    minDurationMs: Math.max(0, expectedDurationMs - varianceMs),
    maxDurationMs: expectedDurationMs + varianceMs,
    canEvolve: true,
  };
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

export function canEvolveFromConfig(
  characterKey: CharacterKeyECS | number,
): boolean {
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

  return spec.evolutionCandidates.every(
    (candidate) =>
      Number.isInteger(candidate.weight) &&
      candidate.weight >= 0 &&
      candidate.weight <= 100,
  );
}

export function resolveEvolutionCandidate(
  characterKey: CharacterKeyECS | number,
  randomValue: number = Math.random(),
): EvolutionCandidate | null {
  const spec = getEvolutionSpec(characterKey);
  if (!spec || spec.evolutionCandidates.length === 0) {
    return null;
  }

  return resolveWeightedCandidate(spec.evolutionCandidates, randomValue);
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
