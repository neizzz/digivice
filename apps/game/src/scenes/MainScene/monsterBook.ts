import type { MainSceneWorldData, SavedEntity } from "./world";
import { type CharacterKeyECS, CharacterState, ObjectType } from "./types";
import {
  MONSTER_CHARACTER_KEYS,
  type MonsterCharacterKey,
  isMonsterCharacterKey,
} from "./evolutionConfig";

export type MonsterBookReachSource = "hatch" | "evolution" | "backfill";

export type MonsterBookReachRecord = {
  name: string;
  reached_at: number;
  object_id: number;
  source: MonsterBookReachSource;
};

export type MonsterBookState = {
  reached: Partial<Record<MonsterCharacterKey, MonsterBookReachRecord[]>>;
};

export type MonsterBookRecordableWorld = {
  getInMemoryData: () => MainSceneWorldData;
  setData: (data: MainSceneWorldData) => Promise<void>;
};

export const MONSTER_BOOK_MAX_RECORDS_PER_CHARACTER = 50;

export function createEmptyMonsterBookState(): MonsterBookState {
  return {
    reached: {},
  };
}

export function normalizeMonsterBookState(
  state: MonsterBookState | null | undefined,
): MonsterBookState {
  const normalized = createEmptyMonsterBookState();
  const rawReached = state?.reached;

  if (!rawReached || typeof rawReached !== "object") {
    return normalized;
  }

  for (const characterKey of MONSTER_CHARACTER_KEYS) {
    const records = rawReached[characterKey];
    if (!Array.isArray(records)) {
      continue;
    }

    normalized.reached[characterKey] = records
      .filter(isValidReachRecord)
      .sort((a, b) => b.reached_at - a.reached_at)
      .slice(0, MONSTER_BOOK_MAX_RECORDS_PER_CHARACTER);
  }

  return normalized;
}

export function hasReachedMonster(
  state: MonsterBookState | null | undefined,
  characterKey: CharacterKeyECS | number,
): characterKey is MonsterCharacterKey {
  if (!isMonsterCharacterKey(characterKey)) {
    return false;
  }

  const normalized = normalizeMonsterBookState(state);
  return (normalized.reached[characterKey]?.length ?? 0) > 0;
}

export function getMonsterBookRecords(
  state: MonsterBookState | null | undefined,
  characterKey: CharacterKeyECS | number,
): MonsterBookReachRecord[] {
  if (!isMonsterCharacterKey(characterKey)) {
    return [];
  }

  return normalizeMonsterBookState(state).reached[characterKey] ?? [];
}

export function ensureMonsterBookState(
  data: MainSceneWorldData,
): MonsterBookState {
  if (!data.world_metadata.app_state) {
    data.world_metadata.app_state = {
      last_active_time: Date.now(),
      is_first_load: false,
      use_local_time: true,
    };
  }

  const appState = data.world_metadata.app_state;
  appState.monster_book = normalizeMonsterBookState(appState.monster_book);
  return appState.monster_book;
}

export function recordMonsterBookReach(params: {
  world: Partial<MonsterBookRecordableWorld>;
  characterKey: CharacterKeyECS | number;
  source: MonsterBookReachSource;
  reachedAt: number;
  objectId?: number;
  name?: string | null;
}): boolean {
  const { world, characterKey, source, reachedAt } = params;
  if (!isMonsterCharacterKey(characterKey)) {
    return false;
  }

  if (
    typeof world.getInMemoryData !== "function" ||
    typeof world.setData !== "function"
  ) {
    return false;
  }

  const data = world.getInMemoryData();
  if (!data) {
    return false;
  }

  const monsterName =
    params.name?.trim() || data.world_metadata.monster_name?.trim();
  if (!monsterName) {
    return false;
  }

  const record: MonsterBookReachRecord = {
    name: monsterName,
    reached_at: Number.isFinite(reachedAt) ? reachedAt : Date.now(),
    object_id: normalizeObjectId(params.objectId),
    source,
  };
  const monsterBook = ensureMonsterBookState(data);
  const records = monsterBook.reached[characterKey] ?? [];
  monsterBook.reached[characterKey] = [record, ...records]
    .filter(isValidReachRecord)
    .sort((a, b) => b.reached_at - a.reached_at)
    .slice(0, MONSTER_BOOK_MAX_RECORDS_PER_CHARACTER);

  void world.setData(data);
  return true;
}

export type CurrentMonsterBookCandidate = {
  characterKey: MonsterCharacterKey;
  objectId: number;
};

export type MonsterBookCurrentBackfillResult = {
  state: MonsterBookState;
  didBackfill: boolean;
};

export function getSavedCurrentMonsterBookCandidates(
  data: MainSceneWorldData,
): CurrentMonsterBookCandidate[] {
  const currentMonstersByKey = new Map<
    MonsterCharacterKey,
    CurrentMonsterBookCandidate
  >();

  for (const entity of data.entities ?? []) {
    const characterKey = getSavedMonsterCharacterKey(entity);
    if (characterKey === null || !isMonsterCharacterKey(characterKey)) {
      continue;
    }

    if (!currentMonstersByKey.has(characterKey)) {
      currentMonstersByKey.set(characterKey, {
        characterKey,
        objectId: normalizeObjectId(entity.components.object?.id),
      });
    }
  }

  return [...currentMonstersByKey.values()];
}

export function backfillCurrentMonsterIfHidden(
  data: MainSceneWorldData,
  currentMonsters: Iterable<CurrentMonsterBookCandidate>,
  reachedAt: number,
): MonsterBookCurrentBackfillResult {
  const monsterBook = ensureMonsterBookState(data);
  const monsterName = data.world_metadata.monster_name?.trim();
  if (!monsterName) {
    return { state: monsterBook, didBackfill: false };
  }

  const normalizedReachedAt = Number.isFinite(reachedAt)
    ? reachedAt
    : Date.now();
  let didBackfill = false;

  for (const currentMonster of currentMonsters) {
    const { characterKey } = currentMonster;
    if (!isMonsterCharacterKey(characterKey)) {
      continue;
    }

    if ((monsterBook.reached[characterKey]?.length ?? 0) > 0) {
      continue;
    }

    monsterBook.reached[characterKey] = [
      {
        name: monsterName,
        reached_at: normalizedReachedAt,
        object_id: normalizeObjectId(currentMonster.objectId),
        source: "backfill",
      },
    ];
    didBackfill = true;
  }

  return { state: monsterBook, didBackfill };
}

function getSavedMonsterCharacterKey(
  entity: SavedEntity,
): CharacterKeyECS | number | null {
  const object = entity.components.object;
  const characterStatus = entity.components.characterStatus;

  if (
    object?.type !== ObjectType.CHARACTER ||
    object.state === CharacterState.EGG ||
    object.state === CharacterState.DEAD ||
    !characterStatus
  ) {
    return null;
  }

  return characterStatus.characterKey;
}

function isValidReachRecord(record: unknown): record is MonsterBookReachRecord {
  if (!record || typeof record !== "object") {
    return false;
  }

  const candidate = record as Partial<MonsterBookReachRecord>;
  return (
    typeof candidate.name === "string" &&
    candidate.name.trim().length > 0 &&
    typeof candidate.reached_at === "number" &&
    Number.isFinite(candidate.reached_at)
  );
}

function normalizeObjectId(objectId: unknown): number {
  return typeof objectId === "number" && Number.isFinite(objectId)
    ? objectId
    : 0;
}
