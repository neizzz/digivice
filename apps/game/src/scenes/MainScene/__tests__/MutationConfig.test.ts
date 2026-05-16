import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateMutationRate,
  getSameClassCrossGeneMutationTargets,
  resolveMutationEvolutionCandidate,
  resolveSameClassCrossGeneMutationTarget,
} from "../mutationConfig";
import { CharacterKeyECS } from "../types";

function assertNearlyEqual(actual: number, expected: number): void {
  assert.ok(
    Math.abs(actual - expected) < 0.000001,
    `expected ${actual} to be close to ${expected}`,
  );
}

test("돌연변이 확률은 gene별 보정률과 주사/오염 스택 cap을 적용한다", () => {
  assertNearlyEqual(
    calculateMutationRate({
      characterKey: CharacterKeyECS.GreenSlimeA1,
      unnecessaryInjectionStacks: 1,
      dirtyExposureStacks: 2,
    }),
    0.025,
  );
  assertNearlyEqual(
    calculateMutationRate({
      characterKey: CharacterKeyECS.SoilSlimeA1,
      unnecessaryInjectionStacks: 99,
      dirtyExposureStacks: 99,
    }),
    0.21,
  );
  assertNearlyEqual(
    calculateMutationRate({
      characterKey: CharacterKeyECS.SkullSlimeA1,
      unnecessaryInjectionStacks: 10,
      dirtyExposureStacks: 10,
    }),
    0.31,
  );
});

test("돌연변이 후보는 같은 클래스의 다른 gene 몬스터만 포함한다", () => {
  assert.deepEqual(
    getSameClassCrossGeneMutationTargets(CharacterKeyECS.GreenSlimeB1),
    [
      CharacterKeyECS.SkullSlimeB1,
      CharacterKeyECS.SkullSlimeB2,
      CharacterKeyECS.SoilSlimeB1,
      CharacterKeyECS.SoilSlimeB2,
    ],
  );

  assert.equal(
    resolveSameClassCrossGeneMutationTarget(CharacterKeyECS.GreenSlimeB1, 0),
    CharacterKeyECS.SkullSlimeB1,
  );
  assert.equal(
    resolveSameClassCrossGeneMutationTarget(
      CharacterKeyECS.GreenSlimeB1,
      0.999,
    ),
    CharacterKeyECS.SoilSlimeB2,
  );
});

test("돌연변이 roll이 확률 안에 들어올 때 진화 후보를 반환한다", () => {
  assert.deepEqual(
    resolveMutationEvolutionCandidate({
      characterKey: CharacterKeyECS.GreenSlimeA1,
      unnecessaryInjectionStacks: 0,
      dirtyExposureStacks: 0,
      mutationRoll: 0.009,
      targetRoll: 0,
    }),
    {
      to: CharacterKeyECS.SkullSlimeA1,
      weight: 1,
      kind: "same_class_cross_line_mutation",
    },
  );

  assert.equal(
    resolveMutationEvolutionCandidate({
      characterKey: CharacterKeyECS.GreenSlimeA1,
      unnecessaryInjectionStacks: 0,
      dirtyExposureStacks: 0,
      mutationRoll: 0.01,
      targetRoll: 0,
    }),
    null,
  );
});
