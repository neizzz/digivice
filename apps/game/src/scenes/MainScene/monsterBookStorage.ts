import type { Storage } from "@shared/storage";
import {
	createEmptyMonsterBookState,
	normalizeMonsterBookState,
	normalizeMonsterBookStateWithMeta,
	type MonsterBookState,
} from "./monsterBook";

export const MONSTER_BOOK_STORAGE_KEY = "MonsterBookData";

type MonsterBookStorageReadResult = {
	hasStoredState: boolean;
	state: MonsterBookState;
	didRepair: boolean;
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
		hasLegacyState: Object.prototype.hasOwnProperty.call(
			appState,
			"monster_book",
		),
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

	return normalizeMonsterBookState(
		value as MonsterBookState | null | undefined,
	);
}

export async function readMonsterBookState(
	storage: Pick<Storage, "getData"> & Partial<Pick<Storage, "setData">>,
): Promise<MonsterBookStorageReadResult> {
	const rawState = await storage.getData(MONSTER_BOOK_STORAGE_KEY);
	const hasStoredState = rawState !== null && typeof rawState !== "undefined";
	const normalizedResult = normalizeMonsterBookStateWithMeta(
		rawState as MonsterBookState | null | undefined,
	);

	if (hasStoredState && normalizedResult.didRepair) {
		console.warn(
			"[MonsterBookStorage] Repaired MonsterBookData in memory; JS storage writes are disabled because Flutter lifecycle owns this key.",
			{
				key: MONSTER_BOOK_STORAGE_KEY,
				monsterBookWriteOwner: "flutter_lifecycle",
			},
		);
	}

	return {
		hasStoredState,
		state: normalizedResult.state,
		didRepair: normalizedResult.didRepair,
	};
}

export async function loadMonsterBookState(
	storage: Pick<Storage, "getData"> & Partial<Pick<Storage, "setData">>,
): Promise<MonsterBookState> {
	const { state } = await readMonsterBookState(storage);
	return state;
}

export async function saveMonsterBookState(
	_storage: Pick<Storage, "setData">,
	state: MonsterBookState | null | undefined,
): Promise<MonsterBookState> {
	const normalizedState = normalizeMonsterBookState(state);
	console.warn(
		"[MonsterBookStorage] Ignored JS MonsterBookData write; Flutter lifecycle owns this key.",
		{
			key: MONSTER_BOOK_STORAGE_KEY,
			monsterBookWriteOwner: "flutter_lifecycle",
		},
	);
	return normalizedState;
}

export async function removeMonsterBookState(
	_storage: Pick<Storage, "removeData">,
): Promise<void> {
	console.warn(
		"[MonsterBookStorage] Ignored JS MonsterBookData remove; Flutter lifecycle owns this key.",
		{
			key: MONSTER_BOOK_STORAGE_KEY,
			monsterBookWriteOwner: "flutter_lifecycle",
		},
	);
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
			didRepair: false,
			didMigrate: false,
		};
	}

	return {
		hasStoredState: false,
		state: legacyMonsterBookState,
		didRepair: false,
		didMigrate: false,
	};
}
