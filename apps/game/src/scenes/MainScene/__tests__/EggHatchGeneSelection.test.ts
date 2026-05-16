import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateEggHatchGeneProbabilities,
  selectEggHatchStartingGene,
} from "../eggHatchGeneSelection";
import { CharacterKeyECS } from "../types";

test("egg hatch gene 기본 확률은 green 65 / soil 20 / skull 15이다", () => {
  assert.deepEqual(
    calculateEggHatchGeneProbabilities({
      staleFoodCountAtHatch: 0,
      syringeCount: 0,
    }),
    {
      green: 65,
      soil: 20,
      skull: 15,
    },
  );

  assert.equal(
    selectEggHatchStartingGene({
      staleFoodCountAtHatch: 0,
      syringeCount: 0,
      random: 0.649,
    }),
    CharacterKeyECS.GreenSlimeA1,
  );
  assert.equal(
    selectEggHatchStartingGene({
      staleFoodCountAtHatch: 0,
      syringeCount: 0,
      random: 0.65,
    }),
    CharacterKeyECS.SoilSlimeA1,
  );
  assert.equal(
    selectEggHatchStartingGene({
      staleFoodCountAtHatch: 0,
      syringeCount: 0,
      random: 0.85,
    }),
    CharacterKeyECS.SkullSlimeA1,
  );
});

test("egg hatch gene는 stale food 10개에서 soil +20%, green -20%를 적용한다", () => {
  assert.deepEqual(
    calculateEggHatchGeneProbabilities({
      staleFoodCountAtHatch: 10,
      syringeCount: 0,
    }),
    {
      green: 45,
      soil: 40,
      skull: 15,
    },
  );
});

test("egg hatch gene는 syringe 10회에서 skull +20%, green -20%를 적용한다", () => {
  assert.deepEqual(
    calculateEggHatchGeneProbabilities({
      staleFoodCountAtHatch: 0,
      syringeCount: 10,
    }),
    {
      green: 45,
      soil: 20,
      skull: 35,
    },
  );
});

test("egg hatch gene는 stale food와 syringe를 각각 10까지 cap 한다", () => {
  assert.deepEqual(
    calculateEggHatchGeneProbabilities({
      staleFoodCountAtHatch: 999,
      syringeCount: 999,
    }),
    {
      green: 25,
      soil: 40,
      skull: 35,
    },
  );
});
