import assert from "node:assert/strict";
import test from "node:test";
import { CharacterClass } from "../../../types/Character";
import {
	DEV_EVOLUTION_GAUGE_CONFIG,
	GAME_CONSTANTS,
	HATCH_GENE_CONFIG,
	PRODUCTION_EVOLUTION_GAUGE_CONFIG,
} from "../generated/worldDataConstants.generated";

test("generated world-data constants expose Dart canonical gameplay values", () => {
	assert.equal(GAME_CONSTANTS.EGG_HATCH_MIN_TIME, 5 * 60 * 1000);
	assert.equal(GAME_CONSTANTS.EGG_HATCH_MODE_TIME, 5 * 60 * 1000);
	assert.equal(GAME_CONSTANTS.EGG_HATCH_MAX_TIME, 5 * 60 * 1000);
	assert.equal(GAME_CONSTANTS.MAX_STAMINA, 10);
	assert.equal(GAME_CONSTANTS.UNHAPPY_STAMINA_THRESHOLD, 3);
	assert.equal(GAME_CONSTANTS.BOOSTED_STAMINA_THRESHOLD, 7);
	assert.equal(GAME_CONSTANTS.BASE_DISEASE_RATE, 0.0001862601875783909);
	assert.equal(HATCH_GENE_CONFIG.baseGreenPercent, 65);
	assert.equal(HATCH_GENE_CONFIG.baseSoilPercent, 20);
	assert.equal(HATCH_GENE_CONFIG.baseSkullPercent, 15);
	assert.equal(HATCH_GENE_CONFIG.bonusPerCountPercent, 2);
	assert.equal(
		PRODUCTION_EVOLUTION_GAUGE_CONFIG.targetDurationByClassMs[CharacterClass.A],
		10 * 60 * 1000,
	);
	assert.equal(
		PRODUCTION_EVOLUTION_GAUGE_CONFIG.gaugeGainByClass[CharacterClass.A],
		(100 * 10 * 1000) / (10 * 60 * 1000),
	);
	assert.deepEqual(
		DEV_EVOLUTION_GAUGE_CONFIG.gaugeGainByClass,
		PRODUCTION_EVOLUTION_GAUGE_CONFIG.gaugeGainByClass,
	);
});
