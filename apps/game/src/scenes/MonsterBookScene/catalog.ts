import {
  type EvolutionRarity,
  MONSTER_CHARACTER_KEYS,
  MONSTER_EVOLUTION_CATALOG,
  type MonsterCharacterKey,
  type MonsterClassCode,
  type MonsterGeneLine,
  getEvolutionRarity,
} from "../MainScene/evolutionConfig";
import {
  type MonsterBookState,
  hasReachedMonster,
} from "../MainScene/monsterBook";

export type MonsterBookVisibleDetails = {
  displayName: string;
  code: string;
  classCode: MonsterClassCode;
  geneLine: MonsterGeneLine;
  phase: number;
  variant: number;
  reachProbabilityText: string;
};

export type MonsterBookCardInfo = {
  characterKey: MonsterCharacterKey;
  isReached: boolean;
  rarity: EvolutionRarity;
  reachProbability: number;
  details: MonsterBookVisibleDetails | null;
};

export type MonsterBookGlobalPage = {
  globalPageIndex: number;
  totalGlobalPages: number;
  classCode: MonsterClassCode;
  classPageIndex: number;
  classPageCount: number;
  entries: MonsterCharacterKey[];
};

const MONSTER_BOOK_LEVEL_BY_CLASS_CODE: Record<MonsterClassCode, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
};

export function getMonsterBookEntriesForClass(
  classCode: MonsterClassCode,
): MonsterCharacterKey[] {
  return MONSTER_CHARACTER_KEYS.filter(
    (characterKey) =>
      MONSTER_EVOLUTION_CATALOG[characterKey].classCode === classCode,
  ).sort((left, right) => {
    const leftRarity = getEvolutionRarity(left)?.rarity ?? 5;
    const rightRarity = getEvolutionRarity(right)?.rarity ?? 5;

    if (leftRarity !== rightRarity) {
      return leftRarity - rightRarity;
    }

    return MONSTER_EVOLUTION_CATALOG[left].code.localeCompare(
      MONSTER_EVOLUTION_CATALOG[right].code,
    );
  });
}

export function getMonsterBookGlobalPages(params: {
  classOrder: readonly MonsterClassCode[];
  cardsPerPage: number;
}): MonsterBookGlobalPage[] {
  const { classOrder, cardsPerPage } = params;

  const pagesWithoutGlobalMetadata = classOrder.flatMap((classCode) => {
    const entries = getMonsterBookEntriesForClass(classCode);
    const classPageCount = Math.max(1, Math.ceil(entries.length / cardsPerPage));

    return Array.from({ length: classPageCount }, (_, classPageIndex) => ({
      classCode,
      classPageIndex,
      classPageCount,
      entries: entries.slice(
        classPageIndex * cardsPerPage,
        (classPageIndex + 1) * cardsPerPage,
      ),
    }));
  });

  return pagesWithoutGlobalMetadata.map((page, globalPageIndex) => ({
    ...page,
    globalPageIndex,
    totalGlobalPages: pagesWithoutGlobalMetadata.length,
  }));
}

export function normalizeMonsterBookPageIndex(params: {
  pageIndex: number;
  totalPages: number;
}): number {
  const { pageIndex, totalPages } = params;

  if (totalPages <= 0) {
    return 0;
  }

  return Math.min(Math.max(pageIndex, 0), totalPages - 1);
}

export function getMonsterBookPageIndexByDelta(params: {
  pageIndex: number;
  delta: number;
  totalPages: number;
}): number {
  const { delta, totalPages } = params;

  if (totalPages <= 0) {
    return 0;
  }

  const pageIndex = normalizeMonsterBookPageIndex(params);

  return ((pageIndex + delta) % totalPages + totalPages) % totalPages;
}

export function getMonsterBookFirstPageIndexForClass(params: {
  classOrder: readonly MonsterClassCode[];
  cardsPerPage: number;
  classCode: MonsterClassCode;
}): number {
  const pages = getMonsterBookGlobalPages(params);
  const pageIndex = pages.findIndex(
    (page) => page.classCode === params.classCode,
  );

  return pageIndex >= 0 ? pageIndex : 0;
}

export function formatMonsterBookClassLabel(
  classCode: MonsterClassCode,
): string {
  return `Lv. ${MONSTER_BOOK_LEVEL_BY_CLASS_CODE[classCode]}`;
}

export function createMonsterBookCardInfo(params: {
  characterKey: MonsterCharacterKey;
  monsterBookState: MonsterBookState;
}): MonsterBookCardInfo {
  const { characterKey, monsterBookState } = params;
  const spec = MONSTER_EVOLUTION_CATALOG[characterKey];
  const rarityEntry = getEvolutionRarity(characterKey);
  const isReached = hasReachedMonster(monsterBookState, characterKey);
  const rarity = rarityEntry?.rarity ?? 5;
  const reachProbability = rarityEntry?.reachProbability ?? 0;

  return {
    characterKey,
    isReached,
    rarity,
    reachProbability,
    details: isReached
      ? {
          displayName: spec.displayName,
          code: spec.code,
          classCode: spec.classCode,
          geneLine: spec.geneLine,
          phase: spec.phase,
          variant: spec.variant,
          reachProbabilityText: formatReachProbability(reachProbability),
        }
      : null,
  };
}

export function formatReachProbability(reachProbability: number): string {
  const percent = reachProbability * 100;

  if (percent >= 10) {
    return `${trimTrailingZero(percent.toFixed(1))}%`;
  }

  return `${trimTrailingZero(percent.toFixed(2))}%`;
}

function trimTrailingZero(value: string): string {
  return value.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}
