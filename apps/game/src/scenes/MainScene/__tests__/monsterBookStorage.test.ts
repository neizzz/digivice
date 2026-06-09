import assert from "node:assert/strict";
import test from "node:test";
import type { Storage } from "@shared/storage";
import { CharacterKeyECS } from "../types";
import {
	MONSTER_BOOK_STORAGE_KEY,
	loadMonsterBookState,
	migrateLegacyMonsterBookIfNeeded,
} from "../monsterBookStorage";

function createMemoryStorage(seed: Record<string, unknown> = {}): Storage & {
	data: Map<string, unknown>;
} {
	const data = new Map(Object.entries(seed));

	return {
		data,
		async getData(key) {
			return data.has(key) ? data.get(key)! : null;
		},
		async setData(key, value) {
			data.set(key, value);
		},
		async removeData(key) {
			data.delete(key);
		},
	};
}

test("migrateLegacyMonsterBookIfNeeded는 legacy world data를 읽기만 하고 JS storage에는 쓰지 않는다", async () => {
	const storage = createMemoryStorage();
	const legacyWorldData = {
		world_metadata: {
			app_state: {
				monster_book: {
					reached: {
						[CharacterKeyECS.GreenSlimeA1]: [
							{
								name: "몽이",
								reached_at: 1234,
								object_id: 99,
								source: "hatch",
							},
						],
					},
				},
			},
		},
	};

	const result = await migrateLegacyMonsterBookIfNeeded(
		storage,
		legacyWorldData,
	);

	assert.equal(result.didMigrate, false);
	assert.equal(result.hasStoredState, false);
	assert.equal(storage.data.has(MONSTER_BOOK_STORAGE_KEY), false);
	assert.equal(
		result.state.reached[CharacterKeyECS.GreenSlimeA1]?.[0]?.name,
		"몽이",
	);
});

test("migrateLegacyMonsterBookIfNeeded는 전용 storage key가 이미 있으면 legacy data로 덮어쓰지 않는다", async () => {
	const storage = createMemoryStorage({
		[MONSTER_BOOK_STORAGE_KEY]: {
			reached: {
				[CharacterKeyECS.GreenSlimeB1]: [
					{
						name: "현재 도감",
						reached_at: 5678,
						object_id: 12,
						source: "evolution",
					},
				],
			},
		},
	});

	const result = await migrateLegacyMonsterBookIfNeeded(storage, {
		world_metadata: {
			app_state: {
				monster_book: {
					reached: {
						[CharacterKeyECS.GreenSlimeA1]: [
							{
								name: "예전 도감",
								reached_at: 1234,
								object_id: 10,
								source: "hatch",
							},
						],
					},
				},
			},
		},
	});

	const reloaded = await loadMonsterBookState(storage);
	assert.equal(result.didMigrate, false);
	assert.deepEqual(result.state, reloaded);
	assert.equal(
		reloaded.reached[CharacterKeyECS.GreenSlimeB1]?.[0]?.name,
		"현재 도감",
	);
});

test("loadMonsterBookState는 world save가 없어도 전용 storage key의 reached state를 그대로 복원한다", async () => {
	const storage = createMemoryStorage({
		[MONSTER_BOOK_STORAGE_KEY]: {
			reached: {
				[CharacterKeyECS.GreenSlimeA1]: [
					{
						name: "초기 슬라임",
						reached_at: 1111,
						object_id: 1,
						source: "hatch",
					},
				],
				[CharacterKeyECS.GreenSlimeB1]: [
					{
						name: "진화 슬라임",
						reached_at: 2222,
						object_id: 2,
						source: "evolution",
					},
				],
			},
		},
	});

	const reloaded = await loadMonsterBookState(storage);

	assert.equal(
		reloaded.reached[CharacterKeyECS.GreenSlimeA1]?.[0]?.name,
		"초기 슬라임",
	);
	assert.equal(
		reloaded.reached[CharacterKeyECS.GreenSlimeB1]?.[0]?.name,
		"진화 슬라임",
	);
});
