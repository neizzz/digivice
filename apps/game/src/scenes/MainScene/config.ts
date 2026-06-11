import { CharacterClass } from "../../types/Character";
import {
	GAME_CONSTANTS,
	PRODUCTION_BALANCE_REFERENCE,
} from "./generated/worldDataConstants.generated";
import { EVOLUTION_GAUGE_CONFIG, getEvolutionSpec } from "./evolutionConfig";
import { CharacterKeyECS } from "./types";

// World-data/gameplay balance constants are generated from the Dart canonical
// source at virtual_bridge/lib/world_data/world_data_constants.dart.
// Do not reintroduce local hard-coded production constants in this file.
type DelayRangeConfig = {
	min: number;
	mode: number;
	max: number;
};

export { GAME_CONSTANTS, PRODUCTION_BALANCE_REFERENCE };

export const BOOSTED_STAMINA_THRESHOLD =
	GAME_CONSTANTS.BOOSTED_STAMINA_THRESHOLD;
export const UNHAPPY_STAMINA_THRESHOLD =
	GAME_CONSTANTS.UNHAPPY_STAMINA_THRESHOLD;

export function getStaminaDecayRateMultiplier(stamina: number): number {
	if (stamina >= GAME_CONSTANTS.BOOSTED_STAMINA_THRESHOLD) {
		return GAME_CONSTANTS.HIGH_STAMINA_DECAY_MULTIPLIER;
	}

	if (stamina < GAME_CONSTANTS.UNHAPPY_STAMINA_THRESHOLD) {
		return GAME_CONSTANTS.LOW_STAMINA_DECAY_MULTIPLIER;
	}

	return 1;
}

function approximateInverseNormalCdf(probability: number): number {
	const a = [
		-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269,
		-30.66479806614716, 2.506628277459239,
	] as const;
	const b = [
		-54.47609879822406, 161.5858368580409, -155.6989798598866,
		66.80131188771972, -13.28068155288572,
	] as const;
	const c = [
		-0.007784894002430293, -0.3223964580411365, -2.400758277161838,
		-2.549732539343734, 4.374664141464968, 2.938163982698783,
	] as const;
	const d = [
		0.007784695709041462, 0.3224671290700398, 2.445134137142996,
		3.754408661907416,
	] as const;
	const low = 0.02425;
	const high = 1 - low;

	if (probability < low) {
		const q = Math.sqrt(-2 * Math.log(probability));
		return (
			(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
			((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
		);
	}

	if (probability <= high) {
		const q = probability - 0.5;
		const r = q * q;
		return (
			((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
				q) /
			(((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
		);
	}

	const q = Math.sqrt(-2 * Math.log(1 - probability));
	return -(
		(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
		((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
	);
}

function getNormalLikeDistributedDelayMs(
	config: DelayRangeConfig,
	randomValue: number = Math.random(),
): number {
	const { min, mode, max } = config;

	if (max <= min) {
		return min;
	}

	const mean = Math.max(min, Math.min(max, mode));
	const radius = Math.min(mean - min, max - mean);
	if (radius <= 0) {
		return mean;
	}

	// +/- 3 sigma가 min/max와 맞도록 자른 truncated normal
	const sigma = radius / 3;
	const lowerZ = -3;
	const upperZ = 3;
	const lowerCdf = 0.0013498980316301035;
	const upperCdf = 0.9986501019683699;
	const clampedRandom = Math.max(0, Math.min(1, randomValue));
	const probability = lowerCdf + clampedRandom * (upperCdf - lowerCdf);
	const zScore = approximateInverseNormalCdf(probability);
	const boundedZ = Math.max(lowerZ, Math.min(upperZ, zScore));

	return Math.round(Math.max(min, Math.min(max, mean + boundedZ * sigma)));
}

export function getEggHatchDelayMs(
	randomValue: number = Math.random(),
): number {
	return getNormalLikeDistributedDelayMs(
		{
			min: GAME_CONSTANTS.EGG_HATCH_MIN_TIME,
			mode: GAME_CONSTANTS.EGG_HATCH_MODE_TIME,
			max: GAME_CONSTANTS.EGG_HATCH_MAX_TIME,
		},
		randomValue,
	);
}

function clampProgress(value: number): number {
	return Math.max(0, Math.min(1, value));
}

export function getDefaultEggHatchDurationMs(): number {
	return GAME_CONSTANTS.EGG_HATCH_MODE_TIME;
}

export function createEggHatchSchedule(
	now: number = Date.now(),
	randomValue: number = Math.random(),
): {
	hatchTime: number;
	hatchDurationMs: number;
} {
	const hatchDurationMs = getEggHatchDelayMs(randomValue);

	return {
		hatchTime: now + hatchDurationMs,
		hatchDurationMs,
	};
}

export function createEggHatchTimestamp(
	now: number = Date.now(),
	randomValue: number = Math.random(),
): number {
	return createEggHatchSchedule(now, randomValue).hatchTime;
}

function normalizePositiveEggHatchValue(value?: number): number | null {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		return null;
	}

	return value;
}

export type ResolvedEggHatchTiming = {
	hatchTime: number;
	hatchDurationMs: number;
	hatchStartTime: number;
	remainingTimeMs: number;
	progress: number;
};

const EGG_HATCH_CLOCK_DRIFT_TOLERANCE_MS = 1000;

export function resolveEggHatchTiming(params: {
	currentTime: number;
	hatchTime?: number;
	hatchDurationMs?: number;
	fallbackDurationMs?: number;
}): ResolvedEggHatchTiming {
	const currentTime = Number.isFinite(params.currentTime)
		? params.currentTime
		: Date.now();
	const fallbackDurationMs = Math.max(
		0,
		params.fallbackDurationMs ?? getDefaultEggHatchDurationMs(),
	);
	const normalizedHatchTime = normalizePositiveEggHatchValue(params.hatchTime);
	const normalizedDurationMs = normalizePositiveEggHatchValue(
		params.hatchDurationMs,
	);

	let hatchTime: number;
	let hatchDurationMs: number;

	if (normalizedDurationMs !== null && normalizedHatchTime !== null) {
		hatchTime = normalizedHatchTime;
		hatchDurationMs = normalizedDurationMs;
		if (
			hatchTime - currentTime >
			hatchDurationMs + EGG_HATCH_CLOCK_DRIFT_TOLERANCE_MS
		) {
			hatchTime = currentTime + hatchDurationMs;
		}
	} else if (normalizedHatchTime !== null) {
		hatchTime = normalizedHatchTime;
		hatchDurationMs = Math.max(0, normalizedHatchTime - currentTime);
	} else if (normalizedDurationMs !== null) {
		hatchDurationMs = normalizedDurationMs;
		hatchTime = currentTime + normalizedDurationMs;
	} else {
		hatchDurationMs = fallbackDurationMs;
		hatchTime = currentTime + hatchDurationMs;
	}

	const remainingTimeMs = Math.max(0, hatchTime - currentTime);
	const hatchStartTime =
		hatchDurationMs > 0 ? hatchTime - hatchDurationMs : hatchTime;
	const progress =
		hatchDurationMs <= 0
			? currentTime >= hatchTime
				? 1
				: 0
			: clampProgress((currentTime - hatchStartTime) / hatchDurationMs);

	return {
		hatchTime,
		hatchDurationMs,
		hatchStartTime,
		remainingTimeMs,
		progress,
	};
}

export function getResolvedEggHatchDurationMs(params: {
	currentTime: number;
	hatchTime?: number;
	hatchDurationMs?: number;
	fallbackDurationMs?: number;
}): number {
	return resolveEggHatchTiming(params).hatchDurationMs;
}

export function getRemainingEggHatchTime(params: {
	currentTime: number;
	hatchTime?: number;
	hatchDurationMs?: number;
	fallbackDurationMs?: number;
}): number {
	return resolveEggHatchTiming(params).remainingTimeMs;
}

export function getEggHatchProgress(params: {
	currentTime: number;
	hatchTime: number;
	hatchDurationMs?: number;
}): number {
	return resolveEggHatchTiming(params).progress;
}

export function getEggCrackStage(progress: number): 0 | 1 | 2 | 3 {
	if (progress >= 0.75) {
		return 3;
	}

	if (progress >= 0.5) {
		return 2;
	}

	if (progress >= 0.25) {
		return 1;
	}

	return 0;
}

export function getUrgentDeathDelayMsByCharacterKey(
	characterKey: CharacterKeyECS | number,
): number {
	const characterClass = getEvolutionSpec(characterKey)?.class;

	switch (characterClass) {
		case CharacterClass.A:
			return GAME_CONSTANTS.DEATH_DELAY_CLASS_A;
		case CharacterClass.B:
			return GAME_CONSTANTS.DEATH_DELAY_CLASS_B;
		case CharacterClass.C:
			return GAME_CONSTANTS.DEATH_DELAY_CLASS_C;
		case CharacterClass.D:
			return GAME_CONSTANTS.DEATH_DELAY_CLASS_D;
		default:
			return GAME_CONSTANTS.DEATH_DELAY;
	}
}
