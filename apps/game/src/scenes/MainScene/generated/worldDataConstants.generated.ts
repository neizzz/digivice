// AUTO-GENERATED FILE. DO NOT EDIT.
// Source of truth: virtual_bridge/lib/world_data/world_data_constants.dart
// Run: pnpm run sync:world-data-constants
// For gameplay balance changes, edit the Dart source of truth above.

export const PRODUCTION_BALANCE_REFERENCE = {
	"TARGET_NIGHT_SLEEP_DURATION": 28800000
} as const;

export const GAME_CONSTANTS = {
	"EGG_HATCH_MIN_TIME": 300000,
	"EGG_HATCH_MODE_TIME": 300000,
	"EGG_HATCH_MAX_TIME": 300000,
	"DIGESTIVE_CAPACITY": 5.0,
	"DIGESTIVE_MULTIPLIER": 0.5,
	"DIGESTIVE_LOAD_PER_MEAL": 1.5,
	"POOP_DELAY": 1200000,
	"DIGESTIVE_SMALL_POOP_DELAY": 28800000,
	"POOP_SPAWN_DISTANCE": 25,
	"POOP_SPAWN_MIN_OBJECT_SPACING": 20,
	"POOP_SPAWN_RETRY_COUNT": 6,
	"POOP_SPAWN_DISTANCE_JITTER": 20,
	"POOP_SPAWN_ANGLE_JITTER_RAD": 1.5707963267948966,
	"MAX_ACTIVE_OBJECT_COUNT": 50,
	"MAX_ACTIVE_FOOD_COUNT": 30,
	"DISEASE_CHECK_INTERVAL": 10000,
	"BASE_DISEASE_RATE": 0.0001862601875783909,
	"POOP_DISEASE_RATE": 0.000093,
	"STALE_FOOD_DISEASE_RATE": 0.000093,
	"FRESH_TO_NORMAL_TIME": 180000,
	"NORMAL_TO_STALE_TIME": 600000,
	"UNHAPPY_STAMINA_THRESHOLD": 3.0,
	"HAPPY_EMOTION_COOLDOWN_MS": 600000,
	"URGENT_STAMINA_THRESHOLD": 0.0,
	"URGENT_SPEED_MULTIPLIER": 0.8,
	"DEATH_DELAY": 21600000,
	"DEATH_DELAY_CLASS_A": 21600000,
	"DEATH_DELAY_CLASS_B": 50400000,
	"DEATH_DELAY_CLASS_C": 79200000,
	"DEATH_DELAY_CLASS_D": 108000000,
	"MAX_STAMINA": 10.0,
	"BOOSTED_STAMINA_THRESHOLD": 7.0,
	"STAMINA_DECREASE_INTERVAL": 720000,
	"STAMINA_DECREASE_AMOUNT": 0.25,
	"HIGH_STAMINA_DECAY_MULTIPLIER": 1.3,
	"LOW_STAMINA_DECAY_MULTIPLIER": 0.7,
	"NIGHT_SLEEP_MIN_DELAY": 600000,
	"NIGHT_SLEEP_MAX_DELAY": 3600000,
	"TARGET_NIGHT_SLEEP_DURATION": 28800000,
	"TARGET_NIGHT_SLEEP_JITTER": 1800000,
	"SUNRISE_WAKE_MIN_DELAY": 600000,
	"SUNRISE_WAKE_MAX_DELAY": 3600000,
	"SUNRISE_WAKE_OFFSET_MIN": -600000,
	"SUNRISE_WAKE_OFFSET_MAX": 2400000,
	"NIGHT_RESLEEP_MIN_DELAY": 300000,
	"NIGHT_RESLEEP_MAX_DELAY": 900000,
	"DAY_NAP_CHANCE": 0.07,
	"DAY_NAP_CHECK_INTERVAL": 1200000,
	"DAY_NAP_MIN_DURATION": 1800000,
	"DAY_NAP_MAX_DURATION": 5400000,
	"FATIGUE_MAX": 100.0,
	"FATIGUE_DEFAULT": 35.0,
	"FATIGUE_AWAKE_GAIN_PER_HOUR": 9.5,
	"FATIGUE_SLEEP_RECOVERY_PER_HOUR": 12.0,
	"FATIGUE_SLEEP_RECOVERY_PER_HOUR_WHEN_SICK": 6.0,
	"FATIGUE_DAY_NAP_MIN_THRESHOLD": 55.0,
	"FATIGUE_DAY_NAP_WAKE_THRESHOLD": 48.0,
	"NATURAL_SICK_RECOVERY_FATIGUE_THRESHOLD": 28.0,
	"NATURAL_SICK_RECOVERY_MIN_DURATION": 1800000,
	"MINI_GAME_SLEEP_INTERRUPT_FATIGUE": 10.0,
	"MINI_GAME_SLEEP_INTERRUPT_STAMINA": 1.0,
	"SLEEPING_STAMINA_DECAY_MULTIPLIER": 0.2,
	"SLEEPING_DISEASE_RATE_MULTIPLIER": 0.1
} as const;

export const PRODUCTION_EVOLUTION_TARGET_DURATION_BY_CLASS_MS = {
	"character-class-a": 600000,
	"character-class-b": 600000,
	"character-class-c": 600000,
	"character-class-d": 600000
} as const;

export const PRODUCTION_EVOLUTION_TARGET_DURATION_VARIANCE_BY_CLASS_MS = {
	"character-class-a": 0,
	"character-class-b": 0,
	"character-class-c": 0,
	"character-class-d": 0
} as const;

export const PRODUCTION_EVOLUTION_GAUGE_CONFIG = {
	"maxGauge": 100.0,
	"staminaThreshold": 3.0,
	"boostedStaminaThreshold": 7.0,
	"boostedGaugeGainMultiplier": 1.3,
	"checkIntervalMs": 10000,
	"sleepingGaugeTimeProgressMultiplier": 0.3333333333333333,
	"gaugeGainByClass": {
		"character-class-a": 1.6666666666666667,
		"character-class-b": 1.6666666666666667,
		"character-class-c": 1.6666666666666667,
		"character-class-d": 1.6666666666666667
	},
	"targetDurationByClassMs": {
		"character-class-a": 600000,
		"character-class-b": 600000,
		"character-class-c": 600000,
		"character-class-d": 600000
	},
	"targetDurationVarianceByClassMs": {
		"character-class-a": 0,
		"character-class-b": 0,
		"character-class-c": 0,
		"character-class-d": 0
	}
} as const;

export const DEV_EVOLUTION_GAUGE_CONFIG = {
	"maxGauge": 100.0,
	"staminaThreshold": 3.0,
	"boostedStaminaThreshold": 7.0,
	"boostedGaugeGainMultiplier": 1.3,
	"checkIntervalMs": 10000,
	"sleepingGaugeTimeProgressMultiplier": 0.3333333333333333,
	"gaugeGainByClass": {
		"character-class-a": 1.6666666666666667,
		"character-class-b": 1.6666666666666667,
		"character-class-c": 1.6666666666666667,
		"character-class-d": 1.6666666666666667
	},
	"targetDurationByClassMs": {
		"character-class-a": 600000,
		"character-class-b": 600000,
		"character-class-c": 600000,
		"character-class-d": 600000
	},
	"targetDurationVarianceByClassMs": {
		"character-class-a": 0,
		"character-class-b": 0,
		"character-class-c": 0,
		"character-class-d": 0
	}
} as const;

export const EVOLUTION_GAUGE_CONFIG = import.meta.env.DEV
	? DEV_EVOLUTION_GAUGE_CONFIG
	: PRODUCTION_EVOLUTION_GAUGE_CONFIG;

export const HATCH_GENE_CONFIG = {
	"maxBonusCount": 10,
	"baseGreenPercent": 65,
	"baseSoilPercent": 20,
	"baseSkullPercent": 15,
	"bonusPerCountPercent": 2,
	"greenSlimeA1CharacterKey": 1,
	"soilSlimeA1CharacterKey": 22,
	"skullSlimeA1CharacterKey": 14
} as const;

export type GeneratedEvolutionCandidateKind =
	| "base"
	| "same_line_variant_mutation"
	| "same_class_cross_line_mutation";

export type GeneratedMonsterEvolutionSpec = {
	key: number;
	geneLine: "green-slime" | "skull-slime" | "soil-slime";
	classCode: "A" | "B" | "C" | "D";
	variant: number;
	phase: number;
	candidates: readonly {
		to: number;
		weight: number;
		kind: GeneratedEvolutionCandidateKind;
	}[];
};

export const MONSTER_EVOLUTION_SPECS = {
	"1": {
		"key": 1,
		"geneLine": "green-slime",
		"classCode": "A",
		"variant": 1,
		"phase": 1,
		"candidates": [
			{
				"to": 2,
				"weight": 55,
				"kind": "base"
			},
			{
				"to": 5,
				"weight": 25,
				"kind": "same_line_variant_mutation"
			},
			{
				"to": 6,
				"weight": 20,
				"kind": "same_line_variant_mutation"
			}
		]
	},
	"2": {
		"key": 2,
		"geneLine": "green-slime",
		"classCode": "B",
		"variant": 1,
		"phase": 2,
		"candidates": [
			{
				"to": 3,
				"weight": 50,
				"kind": "base"
			},
			{
				"to": 7,
				"weight": 20,
				"kind": "same_line_variant_mutation"
			},
			{
				"to": 8,
				"weight": 15,
				"kind": "same_line_variant_mutation"
			},
			{
				"to": 9,
				"weight": 15,
				"kind": "same_line_variant_mutation"
			}
		]
	},
	"5": {
		"key": 5,
		"geneLine": "green-slime",
		"classCode": "B",
		"variant": 2,
		"phase": 2,
		"candidates": [
			{
				"to": 7,
				"weight": 50,
				"kind": "base"
			},
			{
				"to": 3,
				"weight": 20,
				"kind": "same_line_variant_mutation"
			},
			{
				"to": 8,
				"weight": 15,
				"kind": "same_line_variant_mutation"
			},
			{
				"to": 9,
				"weight": 15,
				"kind": "same_line_variant_mutation"
			}
		]
	},
	"6": {
		"key": 6,
		"geneLine": "green-slime",
		"classCode": "B",
		"variant": 3,
		"phase": 2,
		"candidates": [
			{
				"to": 8,
				"weight": 50,
				"kind": "base"
			},
			{
				"to": 3,
				"weight": 20,
				"kind": "same_line_variant_mutation"
			},
			{
				"to": 7,
				"weight": 15,
				"kind": "same_line_variant_mutation"
			},
			{
				"to": 9,
				"weight": 15,
				"kind": "same_line_variant_mutation"
			}
		]
	},
	"3": {
		"key": 3,
		"geneLine": "green-slime",
		"classCode": "C",
		"variant": 1,
		"phase": 3,
		"candidates": [
			{
				"to": 4,
				"weight": 50,
				"kind": "base"
			},
			{
				"to": 10,
				"weight": 20,
				"kind": "same_line_variant_mutation"
			},
			{
				"to": 11,
				"weight": 15,
				"kind": "same_line_variant_mutation"
			},
			{
				"to": 12,
				"weight": 15,
				"kind": "same_line_variant_mutation"
			}
		]
	},
	"7": {
		"key": 7,
		"geneLine": "green-slime",
		"classCode": "C",
		"variant": 2,
		"phase": 3,
		"candidates": [
			{
				"to": 10,
				"weight": 50,
				"kind": "base"
			},
			{
				"to": 4,
				"weight": 20,
				"kind": "same_line_variant_mutation"
			},
			{
				"to": 11,
				"weight": 15,
				"kind": "same_line_variant_mutation"
			},
			{
				"to": 12,
				"weight": 15,
				"kind": "same_line_variant_mutation"
			}
		]
	},
	"8": {
		"key": 8,
		"geneLine": "green-slime",
		"classCode": "C",
		"variant": 3,
		"phase": 3,
		"candidates": [
			{
				"to": 11,
				"weight": 50,
				"kind": "base"
			},
			{
				"to": 4,
				"weight": 20,
				"kind": "same_line_variant_mutation"
			},
			{
				"to": 10,
				"weight": 15,
				"kind": "same_line_variant_mutation"
			},
			{
				"to": 12,
				"weight": 15,
				"kind": "same_line_variant_mutation"
			}
		]
	},
	"9": {
		"key": 9,
		"geneLine": "green-slime",
		"classCode": "C",
		"variant": 4,
		"phase": 3,
		"candidates": [
			{
				"to": 12,
				"weight": 50,
				"kind": "base"
			},
			{
				"to": 4,
				"weight": 20,
				"kind": "same_line_variant_mutation"
			},
			{
				"to": 10,
				"weight": 15,
				"kind": "same_line_variant_mutation"
			},
			{
				"to": 11,
				"weight": 15,
				"kind": "same_line_variant_mutation"
			}
		]
	},
	"4": {
		"key": 4,
		"geneLine": "green-slime",
		"classCode": "D",
		"variant": 1,
		"phase": 4,
		"candidates": []
	},
	"10": {
		"key": 10,
		"geneLine": "green-slime",
		"classCode": "D",
		"variant": 2,
		"phase": 4,
		"candidates": []
	},
	"11": {
		"key": 11,
		"geneLine": "green-slime",
		"classCode": "D",
		"variant": 3,
		"phase": 4,
		"candidates": []
	},
	"12": {
		"key": 12,
		"geneLine": "green-slime",
		"classCode": "D",
		"variant": 4,
		"phase": 4,
		"candidates": []
	},
	"14": {
		"key": 14,
		"geneLine": "skull-slime",
		"classCode": "A",
		"variant": 1,
		"phase": 1,
		"candidates": [
			{
				"to": 16,
				"weight": 70,
				"kind": "base"
			},
			{
				"to": 17,
				"weight": 30,
				"kind": "same_line_variant_mutation"
			}
		]
	},
	"16": {
		"key": 16,
		"geneLine": "skull-slime",
		"classCode": "B",
		"variant": 1,
		"phase": 2,
		"candidates": [
			{
				"to": 18,
				"weight": 70,
				"kind": "base"
			},
			{
				"to": 19,
				"weight": 30,
				"kind": "same_line_variant_mutation"
			}
		]
	},
	"17": {
		"key": 17,
		"geneLine": "skull-slime",
		"classCode": "B",
		"variant": 2,
		"phase": 2,
		"candidates": [
			{
				"to": 19,
				"weight": 70,
				"kind": "base"
			},
			{
				"to": 18,
				"weight": 30,
				"kind": "same_line_variant_mutation"
			}
		]
	},
	"18": {
		"key": 18,
		"geneLine": "skull-slime",
		"classCode": "C",
		"variant": 1,
		"phase": 3,
		"candidates": [
			{
				"to": 20,
				"weight": 70,
				"kind": "base"
			},
			{
				"to": 21,
				"weight": 30,
				"kind": "same_line_variant_mutation"
			}
		]
	},
	"19": {
		"key": 19,
		"geneLine": "skull-slime",
		"classCode": "C",
		"variant": 2,
		"phase": 3,
		"candidates": [
			{
				"to": 21,
				"weight": 60,
				"kind": "base"
			},
			{
				"to": 20,
				"weight": 40,
				"kind": "same_line_variant_mutation"
			}
		]
	},
	"20": {
		"key": 20,
		"geneLine": "skull-slime",
		"classCode": "D",
		"variant": 1,
		"phase": 4,
		"candidates": []
	},
	"21": {
		"key": 21,
		"geneLine": "skull-slime",
		"classCode": "D",
		"variant": 2,
		"phase": 4,
		"candidates": []
	},
	"22": {
		"key": 22,
		"geneLine": "soil-slime",
		"classCode": "A",
		"variant": 1,
		"phase": 1,
		"candidates": [
			{
				"to": 24,
				"weight": 70,
				"kind": "base"
			},
			{
				"to": 25,
				"weight": 30,
				"kind": "same_line_variant_mutation"
			}
		]
	},
	"24": {
		"key": 24,
		"geneLine": "soil-slime",
		"classCode": "B",
		"variant": 1,
		"phase": 2,
		"candidates": [
			{
				"to": 26,
				"weight": 55,
				"kind": "base"
			},
			{
				"to": 27,
				"weight": 25,
				"kind": "same_line_variant_mutation"
			},
			{
				"to": 28,
				"weight": 20,
				"kind": "same_line_variant_mutation"
			}
		]
	},
	"25": {
		"key": 25,
		"geneLine": "soil-slime",
		"classCode": "B",
		"variant": 2,
		"phase": 2,
		"candidates": [
			{
				"to": 27,
				"weight": 55,
				"kind": "base"
			},
			{
				"to": 26,
				"weight": 25,
				"kind": "same_line_variant_mutation"
			},
			{
				"to": 28,
				"weight": 20,
				"kind": "same_line_variant_mutation"
			}
		]
	},
	"26": {
		"key": 26,
		"geneLine": "soil-slime",
		"classCode": "C",
		"variant": 1,
		"phase": 3,
		"candidates": [
			{
				"to": 29,
				"weight": 55,
				"kind": "base"
			},
			{
				"to": 30,
				"weight": 25,
				"kind": "same_line_variant_mutation"
			},
			{
				"to": 31,
				"weight": 20,
				"kind": "same_line_variant_mutation"
			}
		]
	},
	"27": {
		"key": 27,
		"geneLine": "soil-slime",
		"classCode": "C",
		"variant": 2,
		"phase": 3,
		"candidates": [
			{
				"to": 30,
				"weight": 55,
				"kind": "base"
			},
			{
				"to": 29,
				"weight": 25,
				"kind": "same_line_variant_mutation"
			},
			{
				"to": 31,
				"weight": 20,
				"kind": "same_line_variant_mutation"
			}
		]
	},
	"28": {
		"key": 28,
		"geneLine": "soil-slime",
		"classCode": "C",
		"variant": 3,
		"phase": 3,
		"candidates": [
			{
				"to": 31,
				"weight": 55,
				"kind": "base"
			},
			{
				"to": 29,
				"weight": 25,
				"kind": "same_line_variant_mutation"
			},
			{
				"to": 30,
				"weight": 20,
				"kind": "same_line_variant_mutation"
			}
		]
	},
	"29": {
		"key": 29,
		"geneLine": "soil-slime",
		"classCode": "D",
		"variant": 1,
		"phase": 4,
		"candidates": []
	},
	"30": {
		"key": 30,
		"geneLine": "soil-slime",
		"classCode": "D",
		"variant": 2,
		"phase": 4,
		"candidates": []
	},
	"31": {
		"key": 31,
		"geneLine": "soil-slime",
		"classCode": "D",
		"variant": 3,
		"phase": 4,
		"candidates": []
	}
} as const satisfies Record<string, GeneratedMonsterEvolutionSpec>;

