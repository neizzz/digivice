import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import test from "node:test";
import {
  MONSTER_CHARACTER_KEYS,
  MONSTER_EVOLUTION_CATALOG,
  type MonsterClassCode,
  getEvolutionRarity,
} from "../../MainScene/evolutionConfig";
import { createEmptyMonsterBookState } from "../../MainScene/monsterBook";
import { CharacterKeyECS } from "../../MainScene/types";
import {
  createMonsterBookCardInfo,
  getMonsterBookEntriesForClass,
  getMonsterBookFirstPageIndexForClass,
  getMonsterBookGlobalPages,
  getMonsterBookPageIndexByDelta,
} from "../catalog";

const CLASS_ORDER: MonsterClassCode[] = ["A", "B", "C", "D"];

test("몬스터북 catalog는 monster asset json 전체를 포함한다", () => {
  const catalogCodes = Object.values(MONSTER_EVOLUTION_CATALOG)
    .map((spec) => spec.code)
    .sort();
  const assetCodes = readdirSync("assets/sprites/monsters")
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => fileName.replace(/\.json$/, ""))
    .sort();

  assert.deepEqual(catalogCodes, assetCodes);
});

test("몬스터북 class 목록은 모든 몬스터를 누락/중복 없이 포함한다", () => {
  const entries = CLASS_ORDER.flatMap((classCode) =>
    getMonsterBookEntriesForClass(classCode),
  );

  assert.equal(new Set(entries).size, entries.length);
  assert.deepEqual(
    [...entries].sort((left, right) => left - right),
    [...MONSTER_CHARACTER_KEYS].sort((left, right) => left - right),
  );
});

test("몬스터북 class 목록은 각 class 내부에서 rarity와 code 순서로 정렬된다", () => {
  for (const classCode of CLASS_ORDER) {
    const entries = getMonsterBookEntriesForClass(classCode);

    assert.ok(entries.length > 0, `Class ${classCode} should not be empty`);
    assert.ok(
      entries.every(
        (characterKey) =>
          MONSTER_EVOLUTION_CATALOG[characterKey].classCode === classCode,
      ),
      `Class ${classCode} should only include matching monsters`,
    );

    const sorted = [...entries].sort((left, right) => {
      const leftRarity = getEvolutionRarity(left)?.rarity ?? 5;
      const rightRarity = getEvolutionRarity(right)?.rarity ?? 5;

      if (leftRarity !== rightRarity) {
        return leftRarity - rightRarity;
      }

      return MONSTER_EVOLUTION_CATALOG[left].code.localeCompare(
        MONSTER_EVOLUTION_CATALOG[right].code,
      );
    });

    assert.deepEqual(entries, sorted, `Class ${classCode} order`);
  }
});

test("몬스터북 pagination은 모든 class 페이지를 순서대로 포함한다", () => {
  const cardsPerPage = 6;
  const pages = getMonsterBookGlobalPages({
    classOrder: CLASS_ORDER,
    cardsPerPage,
  });

  assert.deepEqual(
    [...new Set(pages.map((page) => page.classCode))],
    CLASS_ORDER,
  );

  for (const classCode of CLASS_ORDER) {
    const entries = getMonsterBookEntriesForClass(classCode);
    const classPages = pages.filter((page) => page.classCode === classCode);
    const totalPages = Math.max(1, Math.ceil(entries.length / cardsPerPage));

    assert.equal(classPages.length, totalPages);
    assert.deepEqual(
      classPages.flatMap((page) => page.entries),
      entries,
      `Class ${classCode} pages should cover every entry`,
    );
    assert.ok(
      classPages.every(
        (page) =>
          page.classPageCount === totalPages &&
          page.entries.length > 0 &&
          page.entries.length <= cardsPerPage,
      ),
      `Class ${classCode} page metadata`,
    );
  }
});

test("몬스터북 global pagination은 모든 몬스터를 누락/중복 없이 포함한다", () => {
  const pages = getMonsterBookGlobalPages({
    classOrder: CLASS_ORDER,
    cardsPerPage: 6,
  });
  const pagedEntries = pages.flatMap((page) => page.entries);

  assert.equal(new Set(pagedEntries).size, pagedEntries.length);
  assert.deepEqual(
    [...pagedEntries].sort((left, right) => left - right),
    [...MONSTER_CHARACTER_KEYS].sort((left, right) => left - right),
  );
});

test("몬스터북 global pagination은 현재 catalog 기준 7페이지를 만든다", () => {
  const pages = getMonsterBookGlobalPages({
    classOrder: CLASS_ORDER,
    cardsPerPage: 6,
  });

  assert.equal(pages.length, 7);
  assert.ok(
    pages.every(
      (page, index) =>
        page.globalPageIndex === index && page.totalGlobalPages === 7,
    ),
  );
});

test("몬스터북 global pagination은 A(1) → B(2) → C(2) → D(2) 순서다", () => {
  const pages = getMonsterBookGlobalPages({
    classOrder: CLASS_ORDER,
    cardsPerPage: 6,
  });

  assert.deepEqual(
    pages.map((page) => page.classCode),
    ["A", "B", "B", "C", "C", "D", "D"],
  );

  const classRuns = pages.reduce<MonsterClassCode[]>((runs, page) => {
    if (runs[runs.length - 1] !== page.classCode) {
      runs.push(page.classCode);
    }

    return runs;
  }, []);

  assert.deepEqual(classRuns, CLASS_ORDER);
});

test("몬스터북 class 선택은 해당 class의 첫 global page index로 이동한다", () => {
  const cardsPerPage = 6;
  const pages = getMonsterBookGlobalPages({
    classOrder: CLASS_ORDER,
    cardsPerPage,
  });
  const firstPageIndices = Object.fromEntries(
    CLASS_ORDER.map((classCode) => [
      classCode,
      getMonsterBookFirstPageIndexForClass({
        classOrder: CLASS_ORDER,
        cardsPerPage,
        classCode,
      }),
    ]),
  );

  assert.deepEqual(firstPageIndices, { A: 0, B: 1, C: 3, D: 5 });

  for (const classCode of CLASS_ORDER) {
    const firstPageIndex = firstPageIndices[classCode];

    assert.equal(pages[firstPageIndex]?.classCode, classCode);
    assert.equal(pages[firstPageIndex]?.classPageIndex, 0);
  }
});

test("몬스터북 next/previous는 global page index 기준으로 순환 이동한다", () => {
  const pages = getMonsterBookGlobalPages({
    classOrder: CLASS_ORDER,
    cardsPerPage: 6,
  });

  const nextFromFirst = getMonsterBookPageIndexByDelta({
    pageIndex: 0,
    delta: 1,
    totalPages: pages.length,
  });
  const previousFromFirst = getMonsterBookPageIndexByDelta({
    pageIndex: 0,
    delta: -1,
    totalPages: pages.length,
  });

  assert.equal(nextFromFirst, 1);
  assert.equal(pages[nextFromFirst]?.classCode, "B");
  assert.equal(pages[nextFromFirst]?.classPageIndex, 0);
  assert.equal(previousFromFirst, pages.length - 1);
  assert.equal(pages[previousFromFirst]?.classCode, "D");
  assert.equal(
    getMonsterBookPageIndexByDelta({
      pageIndex: pages.length - 1,
      delta: 1,
      totalPages: pages.length,
    }),
    0,
  );
});

test("몬스터북 미도달 카드는 희귀도만 공개한다", () => {
  const cardInfo = createMonsterBookCardInfo({
    characterKey: CharacterKeyECS.SkullSlimeA1,
    monsterBookState: createEmptyMonsterBookState(),
  });

  assert.equal(cardInfo.isReached, false);
  assert.equal(cardInfo.rarity, 2);
  assert.equal(cardInfo.reachProbability, 0.15);
  assert.equal(cardInfo.details, null);
});

test("몬스터북 미도달 몬스터는 모두 상세 정보를 숨긴다", () => {
  const monsterBookState = createEmptyMonsterBookState();

  for (const characterKey of MONSTER_CHARACTER_KEYS) {
    const cardInfo = createMonsterBookCardInfo({
      characterKey,
      monsterBookState,
    });

    assert.equal(cardInfo.isReached, false);
    assert.equal(cardInfo.details, null);
  }
});

test("몬스터북 도달 몬스터는 모두 상세 정보를 공개한다", () => {
  const monsterBookState = createEmptyMonsterBookState();

  for (const characterKey of MONSTER_CHARACTER_KEYS) {
    monsterBookState.reached[characterKey] = [
      {
        name: "몽이",
        reached_at: 1_000,
        object_id: 1,
        source: "hatch",
      },
    ];
  }

  for (const characterKey of MONSTER_CHARACTER_KEYS) {
    const cardInfo = createMonsterBookCardInfo({
      characterKey,
      monsterBookState,
    });

    assert.equal(cardInfo.isReached, true);
    assert.notEqual(cardInfo.details, null);
  }
});

test("몬스터북 도달 카드는 catalog 기반 상세 정보를 공개한다", () => {
  const monsterBookState = createEmptyMonsterBookState();
  monsterBookState.reached[CharacterKeyECS.GreenSlimeA1] = [
    {
      name: "몽이",
      reached_at: 1_000,
      object_id: 1,
      source: "hatch",
    },
  ];

  const cardInfo = createMonsterBookCardInfo({
    characterKey: CharacterKeyECS.GreenSlimeA1,
    monsterBookState,
  });

  assert.equal(cardInfo.isReached, true);
  assert.equal(cardInfo.rarity, 1);
  assert.equal(cardInfo.reachProbability, 0.65);
  assert.deepEqual(cardInfo.details, {
    displayName: "Green Slime A1",
    code: "green-slime_A1",
    classCode: "A",
    geneLine: "green-slime",
    phase: 1,
    variant: 1,
    reachProbabilityText: "65%",
  });
});
