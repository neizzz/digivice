import assert from "node:assert/strict";
import test from "node:test";
import type { Storage } from "@shared/storage";
import {
	createEmptyMonsterBookState,
	getMonsterBookRecords,
	normalizeMonsterBookStateWithMeta,
	recordMonsterBookReach,
} from "../monsterBook";
import {
	MONSTER_BOOK_STORAGE_KEY,
	loadMonsterBookState,
} from "../monsterBookStorage";
import { CharacterKeyECS } from "../types";

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

test("normalizeMonsterBookStateWithMeta는 같은 species의 동일 object 중복을 최신 1건으로 정리한다", () => {
	const result = normalizeMonsterBookStateWithMeta({
		reached: {
			[CharacterKeyECS.GreenSlimeB1]: [
				{
					name: "몽이",
					reached_at: 1_000,
					object_id: 77,
					source: "evolution",
				},
				{
					name: "몽이",
					reached_at: 1_100,
					object_id: 77,
					source: "evolution",
				},
			],
			[CharacterKeyECS.GreenSlimeB2]: [
				{
					name: "몽이",
					reached_at: 1_050,
					object_id: 77,
					source: "evolution",
				},
			],
		},
	});

	assert.equal(result.didRepair, true);
	assert.deepEqual(result.state.reached[CharacterKeyECS.GreenSlimeB1], [
		{
			name: "몽이",
			reached_at: 1_100,
			object_id: 77,
			source: "evolution",
		},
	]);
	assert.equal(result.state.reached[CharacterKeyECS.GreenSlimeB2]?.length, 1);
});

test("recordMonsterBookReach는 JS에서 MonsterBookData를 수정하지 않는다", () => {
	const data = {
		world_metadata: {
			name: "MainScene",
			monster_name: "몽이",
			last_ecs_saved: 1_000,
			version: "1.0.0",
			app_state: {
				last_active_time: 1_000,
				is_first_load: false,
				use_local_time: true,
				monster_book: createEmptyMonsterBookState(),
			},
		},
		entities: [],
	};
	let writeCount = 0;
	const world = {
		getInMemoryData: () => data,
		setData: async (_nextData: typeof data) => {
			writeCount += 1;
		},
	};

	recordMonsterBookReach({
		world,
		characterKey: CharacterKeyECS.GreenSlimeB1,
		source: "evolution",
		reachedAt: 1_000,
		objectId: 55,
	});

	const records = getMonsterBookRecords(
		data.world_metadata.app_state.monster_book,
		CharacterKeyECS.GreenSlimeB1,
	);

	assert.equal(records.length, 0);
	assert.equal(writeCount, 0);
});

test("loadMonsterBookState는 species 내부 중복을 수리해 반환하지만 JS storage에는 write-back하지 않는다", async () => {
	const storage = createMemoryStorage({
		[MONSTER_BOOK_STORAGE_KEY]: {
			reached: {
				[CharacterKeyECS.GreenSlimeB1]: [
					{
						name: "몽이",
						reached_at: 1_000,
						object_id: 88,
						source: "evolution",
					},
					{
						name: "몽이",
						reached_at: 1_200,
						object_id: 88,
						source: "evolution",
					},
				],
			},
		},
	});

	const state = await loadMonsterBookState(storage);

	assert.deepEqual(state.reached[CharacterKeyECS.GreenSlimeB1], [
		{
			name: "몽이",
			reached_at: 1_200,
			object_id: 88,
			source: "evolution",
		},
	]);
	assert.notDeepEqual(storage.data.get(MONSTER_BOOK_STORAGE_KEY), state);
});
