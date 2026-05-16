import assert from "node:assert/strict";
import test from "node:test";
import { CharacterClass } from "../../../types/Character";
import {
  applyEvolutionOverrideConfig,
  canEvolveFromConfig,
  DEV_EVOLUTION_GAUGE_CONFIG,
  EVOLUTION_GAUGE_GAIN_MULTIPLIER,
  MONSTER_CHARACTER_KEYS,
  PRODUCTION_EVOLUTION_GAUGE_CONFIG,
  getEvolutionSpec,
  getProductionEvolutionTargetDurationMsForEntity,
  resolveEvolutionTarget,
  validateEvolutionWeights,
} from "../evolutionConfig";
import { CharacterKeyECS } from "../types";

const HOUR_MS = 60 * 60 * 1000;

test("모든 몬스터 진화 후보 weight는 유효한 정수 범위여야 한다", () => {
  for (const characterKey of MONSTER_CHARACTER_KEYS) {
    assert.equal(
      validateEvolutionWeights(characterKey),
      true,
      `invalid weight sum for ${characterKey}`,
    );
  }
});

test("같은 라인 같은 종류의 다음 클래스가 가장 높은 확률로 우선 선택된다", () => {
  assert.equal(
    resolveEvolutionTarget(CharacterKeyECS.GreenSlimeA1, 0.01),
    CharacterKeyECS.GreenSlimeB1,
  );
  assert.equal(
    resolveEvolutionTarget(CharacterKeyECS.GreenSlimeA1, 0.65),
    CharacterKeyECS.GreenSlimeB2,
  );
  assert.equal(
    resolveEvolutionTarget(CharacterKeyECS.GreenSlimeA1, 0.9),
    CharacterKeyECS.GreenSlimeB3,
  );

  assert.equal(
    resolveEvolutionTarget(CharacterKeyECS.GreenSlimeC4, 0.05),
    CharacterKeyECS.GreenSlimeD4,
  );
  assert.equal(
    resolveEvolutionTarget(CharacterKeyECS.GreenSlimeC4, 0.55),
    CharacterKeyECS.GreenSlimeD1,
  );
});

test("진화 override JSON schema는 런타임 진화 catalog에 적용된다", () => {
  const baseCatalog = Object.fromEntries(
    MONSTER_CHARACTER_KEYS.map((characterKey) => {
      const spec = getEvolutionSpec(characterKey);
      assert.ok(spec);
      return [characterKey, spec];
    }),
  ) as Parameters<typeof applyEvolutionOverrideConfig>[0];

  const overriddenCatalog = applyEvolutionOverrideConfig(baseCatalog, {
    schemaVersion: 1,
    overrides: {
      "green-slime_A1": {
        evolutionCandidates: [
          {
            toCode: "green-slime_B1",
            weight: 40,
            kind: "base",
          },
          {
            toCode: "green-slime_B2",
            weight: 30,
            kind: "same_line_variant_mutation",
          },
          {
            toCode: "green-slime_B3",
            weight: 30,
            kind: "same_line_variant_mutation",
          },
        ],
      },
    },
  });

  assert.deepEqual(
    overriddenCatalog[CharacterKeyECS.GreenSlimeA1].evolutionCandidates.map(
      (candidate) => candidate.weight,
    ),
    [40, 30, 30],
  );
  assert.deepEqual(
    baseCatalog[CharacterKeyECS.GreenSlimeA1].evolutionCandidates.map(
      (candidate) => candidate.weight,
    ),
    [50, 25, 25],
  );
});

test("최종 단계 몬스터는 더 이상 진화 후보가 없다", () => {
  assert.equal(canEvolveFromConfig(CharacterKeyECS.GreenSlimeD1), false);
  assert.equal(
    resolveEvolutionTarget(CharacterKeyECS.GreenSlimeD1, 0.5),
    null,
  );
});

test("production/dev 진화게이지 시작 경계는 3이다", () => {
  assert.equal(PRODUCTION_EVOLUTION_GAUGE_CONFIG.staminaThreshold, 3);
  assert.equal(DEV_EVOLUTION_GAUGE_CONFIG.staminaThreshold, 3);
});

test("production 진화 목표 시간은 클래스별 기대 범위 안에서 결정된다", () => {
  const cases = [
    {
      characterKey: CharacterKeyECS.GreenSlimeA1,
      expectedDurationMs: 20 * HOUR_MS,
      varianceMs: 2 * HOUR_MS,
    },
    {
      characterKey: CharacterKeyECS.GreenSlimeB1,
      expectedDurationMs: 40 * HOUR_MS,
      varianceMs: 4 * HOUR_MS,
    },
    {
      characterKey: CharacterKeyECS.GreenSlimeC1,
      expectedDurationMs: 80 * HOUR_MS,
      varianceMs: 8 * HOUR_MS,
    },
  ];

  for (const testCase of cases) {
    const targetDurationMs = getProductionEvolutionTargetDurationMsForEntity({
      characterKey: testCase.characterKey,
      objectId: 123456,
    });

    assert.ok(
      targetDurationMs >= testCase.expectedDurationMs - testCase.varianceMs,
      `duration below range for ${testCase.characterKey}: ${targetDurationMs}`,
    );
    assert.ok(
      targetDurationMs <= testCase.expectedDurationMs + testCase.varianceMs,
      `duration above range for ${testCase.characterKey}: ${targetDurationMs}`,
    );
  }
});

test("production/dev 기본 진화게이지 gain은 기존 대비 10% 증가한다", () => {
  const productionExpectedClassAGain =
    ((100 * 10_000) / (20 * HOUR_MS)) * EVOLUTION_GAUGE_GAIN_MULTIPLIER;

  assert.ok(
    Math.abs(
      PRODUCTION_EVOLUTION_GAUGE_CONFIG.gaugeGainByClass[CharacterClass.A] -
        productionExpectedClassAGain,
    ) < 0.000001,
  );
  assert.equal(
    DEV_EVOLUTION_GAUGE_CONFIG.gaugeGainByClass[CharacterClass.A],
    EVOLUTION_GAUGE_GAIN_MULTIPLIER,
  );
});

test("production 수면 중 진화 속도 배율은 1/3이다", () => {
  assert.equal(
    PRODUCTION_EVOLUTION_GAUGE_CONFIG.sleepingGaugeTimeProgressMultiplier,
    1 / 3,
  );
});
