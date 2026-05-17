import assert from "node:assert/strict";
import test from "node:test";
import { CharacterClass } from "../../../types/Character";
import {
  applyEvolutionOverrideConfig,
  canEvolveFromConfig,
  DEV_EVOLUTION_GAUGE_CONFIG,
  EVOLUTION_GAUGE_GAIN_MULTIPLIER,
  MONSTER_CHARACTER_KEYS,
  MONSTER_EVOLUTION_RARITIES,
  PRODUCTION_EVOLUTION_GAUGE_CONFIG,
  getEvolutionSpec,
  getEvolutionRarity,
  getMaxEvolutionRarityForClass,
  getMinEvolutionRarityForClass,
  getProductionEvolutionTargetDurationMsForEntity,
  resolveEvolutionTarget,
  validateEvolutionWeights,
  type MonsterClassCode,
  type MonsterEvolutionCode,
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

test("Skull Slime C2 override는 D2와 D1 진화 weight를 50/50으로 적용한다", () => {
  const skullSlimeC2Spec = getEvolutionSpec(CharacterKeyECS.SkullSlimeC2);

  assert.ok(skullSlimeC2Spec);
  assert.deepEqual(
    skullSlimeC2Spec.evolutionCandidates.map((candidate) => {
      const targetSpec = getEvolutionSpec(candidate.to);
      assert.ok(targetSpec);

      return {
        toCode: targetSpec.code,
        weight: candidate.weight,
      };
    }),
    [
      { toCode: "skull-slime_D2", weight: 50 },
      { toCode: "skull-slime_D1", weight: 50 },
    ],
  );
  assert.equal(
    resolveEvolutionTarget(CharacterKeyECS.SkullSlimeC2, 0.49),
    CharacterKeyECS.SkullSlimeD2,
  );
  assert.equal(
    resolveEvolutionTarget(CharacterKeyECS.SkullSlimeC2, 0.5),
    CharacterKeyECS.SkullSlimeD1,
  );
});

test("진화 rarity JSON은 같은 클래스 내 도달 확률 순위 기반 class별 등급을 가진다", () => {
  const expectedRarities: Record<
    MonsterEvolutionCode,
    { reachProbability: number; rarity: 1 | 2 | 3 | 4 | 5 }
  > = {
    "green-slime_A1": { reachProbability: 0.65, rarity: 1 },
    "soil-slime_A1": { reachProbability: 0.2, rarity: 2 },
    "skull-slime_A1": { reachProbability: 0.15, rarity: 2 },
    "green-slime_B1": { reachProbability: 0.325, rarity: 1 },
    "green-slime_B2": { reachProbability: 0.1625, rarity: 2 },
    "green-slime_B3": { reachProbability: 0.1625, rarity: 2 },
    "soil-slime_B1": { reachProbability: 0.14, rarity: 2 },
    "skull-slime_B1": { reachProbability: 0.105, rarity: 3 },
    "soil-slime_B2": { reachProbability: 0.06, rarity: 3 },
    "skull-slime_B2": { reachProbability: 0.045, rarity: 3 },
    "green-slime_C1": { reachProbability: 0.21125, rarity: 2 },
    "green-slime_C2": { reachProbability: 0.17875, rarity: 2 },
    "green-slime_C3": { reachProbability: 0.1625, rarity: 2 },
    "green-slime_C4": { reachProbability: 0.0975, rarity: 3 },
    "skull-slime_C1": { reachProbability: 0.087, rarity: 3 },
    "soil-slime_C1": { reachProbability: 0.085, rarity: 4 },
    "soil-slime_C2": { reachProbability: 0.065, rarity: 4 },
    "skull-slime_C2": { reachProbability: 0.063, rarity: 4 },
    "soil-slime_C3": { reachProbability: 0.05, rarity: 4 },
    "green-slime_D1": { reachProbability: 0.1941875, rarity: 2 },
    "green-slime_D2": { reachProbability: 0.1763125, rarity: 2 },
    "green-slime_D3": { reachProbability: 0.157625, rarity: 2 },
    "green-slime_D4": { reachProbability: 0.121875, rarity: 3 },
    "skull-slime_D1": { reachProbability: 0.0924, rarity: 3 },
    "soil-slime_D1": { reachProbability: 0.07125, rarity: 4 },
    "soil-slime_D2": { reachProbability: 0.06625, rarity: 4 },
    "soil-slime_D3": { reachProbability: 0.0625, rarity: 4 },
    "skull-slime_D2": { reachProbability: 0.0576, rarity: 5 },
  };
  const catalogCodes = MONSTER_CHARACTER_KEYS.map((characterKey) => {
    const spec = getEvolutionSpec(characterKey);
    assert.ok(spec);
    return spec.code;
  }).sort();

  assert.deepEqual(Object.keys(MONSTER_EVOLUTION_RARITIES).sort(), catalogCodes);

  for (const [code, expectedRarity] of Object.entries(expectedRarities)) {
    const characterKey = MONSTER_CHARACTER_KEYS.find(
      (candidateKey) => getEvolutionSpec(candidateKey)?.code === code,
    );

    assert.notEqual(characterKey, undefined, `missing character key for ${code}`);
    assert.deepEqual(
      MONSTER_EVOLUTION_RARITIES[code as MonsterEvolutionCode],
      expectedRarity,
    );
    assert.deepEqual(getEvolutionRarity(characterKey), expectedRarity);
  }

  const maxRarityByClass: Record<MonsterClassCode, 1 | 2 | 3 | 4 | 5> = {
    A: 2,
    B: 3,
    C: 4,
    D: 5,
  };
  const minRarityByClass: Record<MonsterClassCode, 1 | 2 | 3 | 4 | 5> = {
    A: 1,
    B: 1,
    C: 2,
    D: 2,
  };

  for (const characterKey of MONSTER_CHARACTER_KEYS) {
    const spec = getEvolutionSpec(characterKey);
    assert.ok(spec);

    const rarity = getEvolutionRarity(characterKey);
    assert.ok(rarity);
    assert.equal(
      getMaxEvolutionRarityForClass(spec.classCode),
      maxRarityByClass[spec.classCode],
    );
    assert.equal(
      getMinEvolutionRarityForClass(spec.classCode),
      minRarityByClass[spec.classCode],
    );
    assert.ok(
      rarity.rarity >= minRarityByClass[spec.classCode],
      `${spec.code} rarity should be within Class ${spec.classCode} min`,
    );
    assert.ok(
      rarity.rarity <= maxRarityByClass[spec.classCode],
      `${spec.code} rarity should be within Class ${spec.classCode} max`,
    );
  }

  assert.equal(getEvolutionRarity(CharacterKeyECS.NULL), null);

  const classDEntries = Object.entries(MONSTER_EVOLUTION_RARITIES)
    .map(([code, rarity]) => {
      const characterKey = MONSTER_CHARACTER_KEYS.find(
        (candidateKey) => getEvolutionSpec(candidateKey)?.code === code,
      );
      assert.notEqual(
        characterKey,
        undefined,
        `missing character key for ${code}`,
      );
      const spec = getEvolutionSpec(characterKey);
      assert.ok(spec);

      return { code, classCode: spec.classCode, rarity };
    })
    .filter((entry) => entry.classCode === "D");
  const rarestClassDEntries = classDEntries.filter(
    (entry) => entry.rarity.rarity === getMaxEvolutionRarityForClass("D"),
  );

  assert.deepEqual(
    rarestClassDEntries.map((entry) => entry.code),
    ["skull-slime_D2"],
  );
  assert.deepEqual(
    [...classDEntries].sort(
      (left, right) =>
        left.rarity.reachProbability - right.rarity.reachProbability,
    )[0],
    {
      code: "skull-slime_D2",
      classCode: "D",
      rarity: { reachProbability: 0.0576, rarity: 5 },
    },
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
