import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import test from "node:test";
import {
  applyEvolutionAdminExport,
  buildEvolutionAdminExport,
  getEvolutionAdminCatalog,
  validateEvolutionAdminExport,
} from "../evolutionAdmin";

test("진화 어드민 catalog snapshot은 현재 전체 진화 spec를 펼쳐서 반환한다", () => {
  const catalog = getEvolutionAdminCatalog();

  assert.equal(catalog.length, 28);
  assert.equal(catalog[0]?.code, "green-slime_A1");
  assert.equal(catalog[catalog.length - 1]?.code, "soil-slime_D3");
  assert.equal(catalog.filter((entry) => entry.candidates.length > 0).length, 19);
  assert.equal(
    catalog.find((entry) => entry.code === "green-slime_C1")?.candidates.length,
    4,
  );
  assert.equal(
    catalog.find((entry) => entry.code === "green-slime_D1")?.candidates.length,
    0,
  );
});

test("진화 어드민 catalog는 monster asset json 전체를 포함한다", () => {
  const catalogCodes = getEvolutionAdminCatalog()
    .map((entry) => entry.code)
    .sort();
  const assetCodes = readdirSync("assets/sprites/monsters")
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => fileName.replace(/\.json$/, ""))
    .sort();

  assert.deepEqual(catalogCodes, assetCodes);
});

test("진화 어드민 export는 baseline과 달라진 source만 포함한다", () => {
  const baseline = getEvolutionAdminCatalog();
  const current = getEvolutionAdminCatalog();
  const targetEntry = current.find((entry) => entry.code === "green-slime_A1");

  assert.ok(targetEntry);
  targetEntry.candidates[0]!.weight = 40;
  targetEntry.candidates[1]!.weight = 30;
  targetEntry.candidates[2]!.weight = 30;

  const exportData = buildEvolutionAdminExport({
    baseCatalog: baseline,
    currentCatalog: current,
  });

  assert.deepEqual(Object.keys(exportData.overrides), ["green-slime_A1"]);
  assert.deepEqual(exportData.overrides["green-slime_A1"]?.evolutionCandidates, [
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
  ]);
});

test("진화 어드민 import 검증은 합계가 100이 아니어도 target을 baseline 순서로 정규화한다", () => {
  const validation = validateEvolutionAdminExport({
    schemaVersion: 1,
    overrides: {
      "green-slime_A1": {
        evolutionCandidates: [
          {
            toCode: "green-slime_B3",
            weight: 25,
            kind: "same_line_variant_mutation",
          },
          {
            toCode: "green-slime_B1",
            weight: 50,
            kind: "base",
          },
          {
            toCode: "green-slime_B2",
            weight: 10,
            kind: "same_line_variant_mutation",
          },
        ],
      },
    },
  });

  assert.equal(validation.ok, true);

  if (!validation.ok) {
    return;
  }

  assert.deepEqual(validation.data.overrides["green-slime_A1"]?.evolutionCandidates, [
    {
      toCode: "green-slime_B1",
      weight: 50,
      kind: "base",
    },
    {
      toCode: "green-slime_B2",
      weight: 10,
      kind: "same_line_variant_mutation",
    },
    {
      toCode: "green-slime_B3",
      weight: 25,
      kind: "same_line_variant_mutation",
    },
  ]);

  const mergedCatalog = applyEvolutionAdminExport({
    exportData: validation.data,
  });

  assert.deepEqual(
    mergedCatalog.find((entry) => entry.code === "green-slime_A1")?.candidates.map(
      (candidate) => candidate.weight,
    ),
    [50, 10, 25],
  );
});

test("진화 어드민 import 검증은 잘못된 override를 거부한다", () => {
  const validation = validateEvolutionAdminExport({
    schemaVersion: 1,
    overrides: {
      "green-slime_A1": {
        evolutionCandidates: [
          {
            toCode: "green-slime_B1",
            weight: 60,
            kind: "base",
          },
          {
            toCode: "green-slime_B1",
            weight: 30,
            kind: "base",
          },
        ],
      },
      "green-slime_D1": {
        evolutionCandidates: [],
      },
    },
  });

  assert.equal(validation.ok, false);

  if (validation.ok) {
    return;
  }

  assert.ok(
    validation.errors.some((error) =>
      error.includes("Duplicate target code for green-slime_A1"),
    ),
  );
  assert.ok(
    validation.errors.some((error) =>
      error.includes("Terminal stage cannot be overridden: green-slime_D1"),
    ),
  );
});

test("진화 어드민 import 검증은 최종 단계 몬스터 rarity를 허용한다", () => {
  const validation = validateEvolutionAdminExport({
    schemaVersion: 1,
    overrides: {},
    rarities: {
      "green-slime_D1": {
        reachProbability: 0.1941875,
        rarity: 2,
      },
    },
  });

  assert.equal(validation.ok, true);

  if (!validation.ok) {
    return;
  }

  assert.deepEqual(validation.data.rarities, {
    "green-slime_D1": {
      reachProbability: 0.1941875,
      rarity: 2,
    },
  });
});

test("진화 어드민 import 검증은 class별 rarity 범위를 적용한다", () => {
  const validation = validateEvolutionAdminExport({
    schemaVersion: 1,
    overrides: {},
    rarities: {
      "green-slime_C1": {
        reachProbability: 0.21125,
        rarity: 1,
      },
    },
  });

  assert.equal(validation.ok, false);

  if (validation.ok) {
    return;
  }

  assert.ok(
    validation.errors.some((error) =>
      error.includes("Class C supports 2-4"),
    ),
  );
});
