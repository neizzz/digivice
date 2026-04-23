import assert from "node:assert/strict";
import test from "node:test";
import {
  canEvolveFromConfig,
  MONSTER_CHARACTER_KEYS,
  resolveEvolutionTarget,
  validateEvolutionWeights,
} from "../evolutionConfig";
import { CharacterKeyECS } from "../types";

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
    resolveEvolutionTarget(CharacterKeyECS.TestGreenSlimeA1, 0.85),
    CharacterKeyECS.TestGreenSlimeB2,
  );
  assert.equal(
    resolveEvolutionTarget(CharacterKeyECS.TestGreenSlimeA1, 0.95),
    CharacterKeyECS.TestGreenSlimeB3,
  );

  assert.equal(
    resolveEvolutionTarget(CharacterKeyECS.TestGreenSlimeC4, 0.05),
    CharacterKeyECS.TestGreenSlimeD4,
  );
  assert.equal(
    resolveEvolutionTarget(CharacterKeyECS.TestGreenSlimeC4, 0.75),
    CharacterKeyECS.TestGreenSlimeD1,
  );
});

test("최종 단계 몬스터는 더 이상 진화 후보가 없다", () => {
  assert.equal(canEvolveFromConfig(CharacterKeyECS.TestGreenSlimeD1), false);
  assert.equal(resolveEvolutionTarget(CharacterKeyECS.TestGreenSlimeD1, 0.5), null);
});
