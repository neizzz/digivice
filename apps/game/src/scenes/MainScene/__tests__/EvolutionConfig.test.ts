import assert from "node:assert/strict";
import test from "node:test";
import {
  canEvolveFromConfig,
  MONSTER_CHARACTER_KEYS,
  PRODUCTION_EVOLUTION_GAUGE_CONFIG,
  getProductionEvolutionTargetDurationMsForEntity,
  resolveEvolutionTarget,
  validateEvolutionWeights,
} from "../evolutionConfig";
import { CharacterKeyECS } from "../types";

const HOUR_MS = 60 * 60 * 1000;

test("모든 몬스터 진화 후보 weight 합은 100 또는 0이어야 한다", () => {
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
    resolveEvolutionTarget(CharacterKeyECS.TestGreenSlimeA1, 0.01),
    CharacterKeyECS.TestGreenSlimeB1,
  );
  assert.equal(
    resolveEvolutionTarget(CharacterKeyECS.TestGreenSlimeA1, 0.65),
    CharacterKeyECS.TestGreenSlimeB2,
  );
  assert.equal(
    resolveEvolutionTarget(CharacterKeyECS.TestGreenSlimeA1, 0.9),
    CharacterKeyECS.TestGreenSlimeB3,
  );

  assert.equal(
    resolveEvolutionTarget(CharacterKeyECS.TestGreenSlimeC4, 0.05),
    CharacterKeyECS.TestGreenSlimeD4,
  );
  assert.equal(
    resolveEvolutionTarget(CharacterKeyECS.TestGreenSlimeC4, 0.55),
    CharacterKeyECS.TestGreenSlimeD1,
  );
});

test("최종 단계 몬스터는 더 이상 진화 후보가 없다", () => {
  assert.equal(canEvolveFromConfig(CharacterKeyECS.TestGreenSlimeD1), false);
  assert.equal(
    resolveEvolutionTarget(CharacterKeyECS.TestGreenSlimeD1, 0.5),
    null,
  );
});

test("production 진화 목표 시간은 클래스별 기대 범위 안에서 결정된다", () => {
  const cases = [
    {
      characterKey: CharacterKeyECS.TestGreenSlimeA1,
      expectedDurationMs: 20 * HOUR_MS,
      varianceMs: 2 * HOUR_MS,
    },
    {
      characterKey: CharacterKeyECS.TestGreenSlimeB1,
      expectedDurationMs: 40 * HOUR_MS,
      varianceMs: 4 * HOUR_MS,
    },
    {
      characterKey: CharacterKeyECS.TestGreenSlimeC1,
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

test("production 수면 중 진화 속도 배율은 1/3이다", () => {
  assert.equal(
    PRODUCTION_EVOLUTION_GAUGE_CONFIG.sleepingGaugeTimeProgressMultiplier,
    1 / 3,
  );
});
