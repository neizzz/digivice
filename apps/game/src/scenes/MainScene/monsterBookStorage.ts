import type { Storage } from "@shared/storage";
import {
  createEmptyMonsterBookState,
  normalizeMonsterBookState,
  type MonsterBookState,
} from "./monsterBook";

export const MONSTER_BOOK_STORAGE_KEY = "MonsterBookData";

type MonsterBookStorageReadResult = {
  hasStoredState: boolean;
  state: MonsterBookState;
};

function getLegacyMonsterBookRaw(savedWorldData: unknown): {
  hasLegacyState: boolean;
  value: unknown;
} {
  if (!savedWorldData || typeof savedWorldData !== "object") {
    return {
      hasLegacyState: false,
      value: undefined,
    };
  }

  const worldMetadata = (savedWorldData as { world_metadata?: unknown })
    .world_metadata;
  if (!worldMetadata || typeof worldMetadata !== "object") {
    return {
      hasLegacyState: false,
      value: undefined,
    };
  }

  const appState = (worldMetadata as { app_state?: unknown }).app_state;
  if (!appState || typeof appState !== "object") {
    return {
      hasLegacyState: false,
      value: undefined,
    };
  }

  return {
    hasLegacyState: Object.prototype.hasOwnProperty.call(appState, "monster_book"),
    value: (appState as { monster_book?: unknown }).monster_book,
  };
}

export function hasLegacyMonsterBookState(savedWorldData: unknown): boolean {
  return getLegacyMonsterBookRaw(savedWorldData).hasLegacyState;
}

export function getLegacyMonsterBookState(
  savedWorldData: unknown,
): MonsterBookState | null {
  const { hasLegacyState, value } = getLegacyMonsterBookRaw(savedWorldData);
  if (!hasLegacyState) {
    return null;
  }

  return normalizeMonsterBookState(value as MonsterBookState | null | undefined);
}

export async function readMonsterBookState(
  storage: Pick<Storage, "getData">,
): Promise<MonsterBookStorageReadResult> {
  const rawState = await storage.getData(MONSTER_BOOK_STORAGE_KEY);

  return {
    hasStoredState: rawState !== null && typeof rawState !== "undefined",
    state: normalizeMonsterBookState(
      rawState as MonsterBookState | null | undefined,
    ),
  };
}

export async function loadMonsterBookState(
  storage: Pick<Storage, "getData">,
): Promise<MonsterBookState> {
  const { state } = await readMonsterBookState(storage);
  return state;
}

export async function saveMonsterBookState(
  storage: Pick<Storage, "setData">,
  state: MonsterBookState | null | undefined,
): Promise<MonsterBookState> {
  const normalizedState = normalizeMonsterBookState(state);
  await storage.setData(MONSTER_BOOK_STORAGE_KEY, normalizedState);
  return normalizedState;
}

export async function removeMonsterBookState(
  storage: Pick<Storage, "removeData">,
): Promise<void> {
  await storage.removeData(MONSTER_BOOK_STORAGE_KEY);
}

export async function migrateLegacyMonsterBookIfNeeded(
  storage: Pick<Storage, "getData" | "setData">,
  savedWorldData: unknown,
): Promise<MonsterBookStorageReadResult & { didMigrate: boolean }> {
  const persistedState = await readMonsterBookState(storage);
  if (persistedState.hasStoredState) {
    return {
      ...persistedState,
      didMigrate: false,
    };
  }

  const legacyMonsterBookState = getLegacyMonsterBookState(savedWorldData);
  if (legacyMonsterBookState === null) {
    return {
      hasStoredState: false,
      state: createEmptyMonsterBookState(),
      didMigrate: false,
    };
  }

  const normalizedState = await saveMonsterBookState(storage, legacyMonsterBookState);
  return {
    hasStoredState: true,
    state: normalizedState,
    didMigrate: true,
  };
}
