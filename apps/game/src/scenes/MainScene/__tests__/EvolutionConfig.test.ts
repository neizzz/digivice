import assert from "node:assert/strict";
import test from "node:test";
import { CharacterClass } from "../../../types/Character";
import {
  canEvolveFromConfig,
  DEV_EVOLUTION_GAUGE_CONFIG,
  MONSTER_CHARACTER_KEYS,
  MONSTER_EVOLUTION_RARITIES,
  PRODUCTION_EVOLUTION_GAUGE_CONFIG,
  PRODUCTION_EVOLUTION_TARGET_DURATION_BY_CLASS_MS,
  PRODUCTION_EVOLUTION_TARGET_DURATION_VARIANCE_BY_CLASS_MS,
  getEvolutionSpec,
  getEvolutionPhaseDurationEstimate,
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
      characterClass: CharacterClass.A,
    },
    {
      characterKey: CharacterKeyECS.GreenSlimeB1,
      characterClass: CharacterClass.B,
    },
    {
      characterKey: CharacterKeyECS.GreenSlimeC1,
      characterClass: CharacterClass.C,
    },
  ];

  for (const testCase of cases) {
    const targetDurationMs = getProductionEvolutionTargetDurationMsForEntity({
      characterKey: testCase.characterKey,
      objectId: 123456,
    });

    assert.ok(
      targetDurationMs >=
        PRODUCTION_EVOLUTION_TARGET_DURATION_BY_CLASS_MS[testCase.characterClass] -
          PRODUCTION_EVOLUTION_TARGET_DURATION_VARIANCE_BY_CLASS_MS[
            testCase.characterClass
          ],
      `duration below range for ${testCase.characterKey}: ${targetDurationMs}`,
    );
    assert.ok(
      targetDurationMs <=
        PRODUCTION_EVOLUTION_TARGET_DURATION_BY_CLASS_MS[testCase.characterClass] +
          PRODUCTION_EVOLUTION_TARGET_DURATION_VARIANCE_BY_CLASS_MS[
            testCase.characterClass
          ],
      `duration above range for ${testCase.characterKey}: ${targetDurationMs}`,
    );
  }
});

test("레벨별 예상 진화 시간 표시는 production 기준 시간/분산을 그대로 사용한다", () => {
  assert.deepEqual(getEvolutionPhaseDurationEstimate(1), {
    phase: 1,
    classCode: "A",
    expectedDurationMs:
      PRODUCTION_EVOLUTION_TARGET_DURATION_BY_CLASS_MS[CharacterClass.A],
    varianceMs:
      PRODUCTION_EVOLUTION_TARGET_DURATION_VARIANCE_BY_CLASS_MS[CharacterClass.A],
    minDurationMs:
      PRODUCTION_EVOLUTION_TARGET_DURATION_BY_CLASS_MS[CharacterClass.A] -
      PRODUCTION_EVOLUTION_TARGET_DURATION_VARIANCE_BY_CLASS_MS[CharacterClass.A],
    maxDurationMs:
      PRODUCTION_EVOLUTION_TARGET_DURATION_BY_CLASS_MS[CharacterClass.A] +
      PRODUCTION_EVOLUTION_TARGET_DURATION_VARIANCE_BY_CLASS_MS[CharacterClass.A],
    canEvolve: true,
  });
  assert.deepEqual(getEvolutionPhaseDurationEstimate(2), {
    phase: 2,
    classCode: "B",
    expectedDurationMs:
      PRODUCTION_EVOLUTION_TARGET_DURATION_BY_CLASS_MS[CharacterClass.B],
    varianceMs:
      PRODUCTION_EVOLUTION_TARGET_DURATION_VARIANCE_BY_CLASS_MS[CharacterClass.B],
    minDurationMs:
      PRODUCTION_EVOLUTION_TARGET_DURATION_BY_CLASS_MS[CharacterClass.B] -
      PRODUCTION_EVOLUTION_TARGET_DURATION_VARIANCE_BY_CLASS_MS[CharacterClass.B],
    maxDurationMs:
      PRODUCTION_EVOLUTION_TARGET_DURATION_BY_CLASS_MS[CharacterClass.B] +
      PRODUCTION_EVOLUTION_TARGET_DURATION_VARIANCE_BY_CLASS_MS[CharacterClass.B],
    canEvolve: true,
  });
  assert.deepEqual(getEvolutionPhaseDurationEstimate(3), {
    phase: 3,
    classCode: "C",
    expectedDurationMs:
      PRODUCTION_EVOLUTION_TARGET_DURATION_BY_CLASS_MS[CharacterClass.C],
    varianceMs:
      PRODUCTION_EVOLUTION_TARGET_DURATION_VARIANCE_BY_CLASS_MS[CharacterClass.C],
    minDurationMs:
      PRODUCTION_EVOLUTION_TARGET_DURATION_BY_CLASS_MS[CharacterClass.C] -
      PRODUCTION_EVOLUTION_TARGET_DURATION_VARIANCE_BY_CLASS_MS[CharacterClass.C],
    maxDurationMs:
      PRODUCTION_EVOLUTION_TARGET_DURATION_BY_CLASS_MS[CharacterClass.C] +
      PRODUCTION_EVOLUTION_TARGET_DURATION_VARIANCE_BY_CLASS_MS[CharacterClass.C],
    canEvolve: true,
  });
  assert.deepEqual(getEvolutionPhaseDurationEstimate(4), {
    phase: 4,
    classCode: "D",
    expectedDurationMs: null,
    varianceMs: null,
    minDurationMs: null,
    maxDurationMs: null,
    canEvolve: false,
  });
  assert.equal(getEvolutionPhaseDurationEstimate(0), null);
  assert.equal(getEvolutionPhaseDurationEstimate(99), null);
});

test("production/dev 기본 진화게이지 gain은 target duration 기준으로 계산한다", () => {
  const productionExpectedClassAGain =
    (100 * 10_000) /
    PRODUCTION_EVOLUTION_TARGET_DURATION_BY_CLASS_MS[CharacterClass.A];

  assert.ok(
    Math.abs(
      PRODUCTION_EVOLUTION_GAUGE_CONFIG.gaugeGainByClass[CharacterClass.A] -
        productionExpectedClassAGain,
    ) < 0.000001,
  );
  assert.equal(
    DEV_EVOLUTION_GAUGE_CONFIG.gaugeGainByClass[CharacterClass.A],
    productionExpectedClassAGain,
  );
});

test("production 수면 중 진화 속도 배율은 1/3이다", () => {
  assert.equal(
    PRODUCTION_EVOLUTION_GAUGE_CONFIG.sleepingGaugeTimeProgressMultiplier,
    1 / 3,
  );
});
