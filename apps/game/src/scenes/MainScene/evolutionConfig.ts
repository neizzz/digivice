import { CharacterClass } from "../../types/Character";
import evolutionOverrideData from "./evolution-overrides.v1.json";
import {
	DEV_EVOLUTION_GAUGE_CONFIG as GENERATED_DEV_EVOLUTION_GAUGE_CONFIG,
	EVOLUTION_GAUGE_CONFIG as GENERATED_EVOLUTION_GAUGE_CONFIG,
	MONSTER_EVOLUTION_SPECS,
	PRODUCTION_EVOLUTION_GAUGE_CONFIG as GENERATED_PRODUCTION_EVOLUTION_GAUGE_CONFIG,
	type GeneratedEvolutionCandidateKind,
} from "./generated/worldDataConstants.generated";
import { CharacterKeyECS } from "./types";
import { resolveWeightedCandidate } from "./weightedSelection";

// Evolution balance/spec constants are generated from Dart
// (virtual_bridge/lib/world_data/world_data_constants.dart). Keep this file as
// a typed adapter/helper layer, not a separate source of truth.

export type MonsterGeneLine = "green-slime" | "skull-slime" | "soil-slime";
export type MonsterClassCode = "A" | "B" | "C" | "D";
export type MonsterCharacterKey = Exclude<
	CharacterKeyECS,
	CharacterKeyECS.NULL
>;
export type EvolutionCandidateKind = GeneratedEvolutionCandidateKind;

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

export type EvolutionOverrideConfig = {
	schemaVersion: 1;
	overrides: Record<string, unknown>;
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

function toEvolutionGaugeConfig(value: unknown): EvolutionGaugeConfig {
	return value as EvolutionGaugeConfig;
}

export const PRODUCTION_EVOLUTION_GAUGE_CONFIG: EvolutionGaugeConfig =
	toEvolutionGaugeConfig(GENERATED_PRODUCTION_EVOLUTION_GAUGE_CONFIG);

export const DEV_EVOLUTION_GAUGE_CONFIG: EvolutionGaugeConfig =
	toEvolutionGaugeConfig(GENERATED_DEV_EVOLUTION_GAUGE_CONFIG);

export const EVOLUTION_GAUGE_CONFIG: EvolutionGaugeConfig =
	toEvolutionGaugeConfig(GENERATED_EVOLUTION_GAUGE_CONFIG);

export const PRODUCTION_EVOLUTION_TARGET_DURATION_BY_CLASS_MS =
	PRODUCTION_EVOLUTION_GAUGE_CONFIG.targetDurationByClassMs;

export const PRODUCTION_EVOLUTION_TARGET_DURATION_VARIANCE_BY_CLASS_MS =
	PRODUCTION_EVOLUTION_GAUGE_CONFIG.targetDurationVarianceByClassMs;

function getStableSeededUnitValue(seed: string): number {
	let hash = 2166136261;

	for (let i = 0; i < seed.length; i++) {
		hash ^= seed.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}

	return (hash >>> 0) / 4294967296;
}

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

function createMonsterEvolutionSpec(
	generatedSpec: (typeof MONSTER_EVOLUTION_SPECS)[keyof typeof MONSTER_EVOLUTION_SPECS],
): MonsterEvolutionSpec {
	const code =
		`${generatedSpec.geneLine}_${generatedSpec.classCode}${generatedSpec.variant}` as MonsterEvolutionCode;

	return {
		key: generatedSpec.key as CharacterKeyECS,
		code,
		geneLine: generatedSpec.geneLine,
		classCode: generatedSpec.classCode,
		class: MONSTER_CLASS_BY_CODE[generatedSpec.classCode],
		variant: generatedSpec.variant,
		phase: generatedSpec.phase,
		displayName: createDisplayName(
			generatedSpec.geneLine,
			generatedSpec.classCode,
			generatedSpec.variant,
		),
		spritesheetName: code,
		evolutionCandidates: generatedSpec.candidates.map((candidate) => ({
			to: candidate.to as CharacterKeyECS,
			weight: candidate.weight,
			kind: candidate.kind,
		})),
	};
}

function createMonsterEvolutionCatalogFromGenerated(): Record<
	MonsterCharacterKey,
	MonsterEvolutionSpec
> {
	return Object.fromEntries(
		Object.values(MONSTER_EVOLUTION_SPECS).map((generatedSpec) => [
			generatedSpec.key,
			createMonsterEvolutionSpec(generatedSpec),
		]),
	) as Record<MonsterCharacterKey, MonsterEvolutionSpec>;
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
	catalog: Record<MonsterCharacterKey, MonsterEvolutionSpec>;
	overrideConfig: EvolutionOverrideConfig;
}): Partial<Record<MonsterEvolutionCode, EvolutionRarityEntry>> {
	const { catalog, overrideConfig } = params;
	const rarityConfig = overrideConfig.rarities ?? {};
	const specsByCode = new Map(
		Object.values(catalog).map((spec) => [spec.code, spec]),
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

export const MONSTER_EVOLUTION_CATALOG: Record<
	MonsterCharacterKey,
	MonsterEvolutionSpec
> = createMonsterEvolutionCatalogFromGenerated();

export const MONSTER_EVOLUTION_RARITIES = validateEvolutionRarityConfig({
	catalog: MONSTER_EVOLUTION_CATALOG,
	overrideConfig: evolutionOverrideData,
});

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

	const durationMs = getProductionEvolutionTargetDurationMsForEntity(params);
	if (durationMs <= 0) {
		return 0;
	}

	return (
		(PRODUCTION_EVOLUTION_GAUGE_CONFIG.maxGauge *
			PRODUCTION_EVOLUTION_GAUGE_CONFIG.checkIntervalMs) /
		durationMs
	);
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
