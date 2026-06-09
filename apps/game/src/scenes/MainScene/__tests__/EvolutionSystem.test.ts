import assert from "node:assert/strict";
import test from "node:test";
import * as PIXI from "pixi.js";
import { CharacterStatusComp, ObjectComp } from "../raw-components";
import {
	createEmptyMonsterBookState,
	getMonsterBookRecords,
} from "../monsterBook";
import { evolveCharacter } from "../systems/EvolutionSystem";
import { CharacterKeyECS } from "../types";
import {
	createTestCharacter,
	createTestWorld,
	withMockedDateNow,
	withMockedRandom,
} from "../../../test-utils/mainSceneTestUtils";

type Deferred<T> = {
	promise: Promise<T>;
	resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});

	return { promise, resolve };
}

async function flushAsyncWork(): Promise<void> {
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));
}

function createEvolutionTestContext(now = 50_000) {
	const world = createTestWorld({ now }) as ReturnType<
		typeof createTestWorld
	> & {
		getInMemoryData: () => any;
		setData: (data: any) => Promise<void>;
	};
	const data = {
		world_metadata: {
			name: "MainScene",
			monster_name: "몽이",
			last_ecs_saved: now,
			version: "1.0.0",
			app_state: {
				last_active_time: now,
				is_first_load: false,
				use_local_time: true,
				monster_book: createEmptyMonsterBookState(),
			},
		},
		entities: [],
	};
	const savedSnapshots: unknown[] = [];

	world.getInMemoryData = () => data;
	world.setData = async (nextData) => {
		savedSnapshots.push(nextData);
	};

	return { world, data, savedSnapshots };
}

function mockPendingSpritesheetLoad() {
	const deferred = createDeferred<PIXI.Spritesheet>();
	const dummySpritesheet = Object.create(
		PIXI.Spritesheet.prototype,
	) as PIXI.Spritesheet;
	Object.assign(dummySpritesheet, {
		animations: {},
		textures: {},
		textureSource: {
			scaleMode: "nearest",
		},
	});

	const cache = new Map<string, unknown>();
	const originalGet = PIXI.Assets.get.bind(PIXI.Assets);
	const originalLoad = PIXI.Assets.load.bind(PIXI.Assets);
	const originalAdd = PIXI.Assets.add.bind(PIXI.Assets);

	(PIXI.Assets as typeof PIXI.Assets & { get: typeof PIXI.Assets.get }).get = ((
		key: string,
	) => {
		if (cache.has(key)) {
			return cache.get(key);
		}

		return originalGet(key);
	}) as typeof PIXI.Assets.get;

	(PIXI.Assets as typeof PIXI.Assets & { add: typeof PIXI.Assets.add }).add = ((
		_options: unknown,
	) => {}) as typeof PIXI.Assets.add;

	(PIXI.Assets as typeof PIXI.Assets & { load: typeof PIXI.Assets.load }).load =
		((key: string) =>
			deferred.promise.then((spritesheet) => {
				cache.set(key, spritesheet);
				return spritesheet;
			})) as typeof PIXI.Assets.load;

	return {
		deferred,
		dummySpritesheet,
		restore: () => {
			(
				PIXI.Assets as typeof PIXI.Assets & { get: typeof PIXI.Assets.get }
			).get = originalGet;
			(
				PIXI.Assets as typeof PIXI.Assets & { load: typeof PIXI.Assets.load }
			).load = originalLoad;
			(
				PIXI.Assets as typeof PIXI.Assets & { add: typeof PIXI.Assets.add }
			).add = originalAdd;
		},
	};
}

test("pending 중복 진화 요청은 MonsterBookData를 JS에서 기록하지 않는다", async () => {
	const { world, data, savedSnapshots } = createEvolutionTestContext();
	const eid = withMockedDateNow(50_000, () =>
		createTestCharacter(world, {
			characterKey: CharacterKeyECS.GreenSlimeA1,
			x: 100,
			y: 100,
		}),
	);
	const { deferred, dummySpritesheet, restore } = mockPendingSpritesheetLoad();

	try {
		withMockedRandom(0, () => {
			evolveCharacter(world as any, eid);
			evolveCharacter(world as any, eid);
		});

		deferred.resolve(dummySpritesheet);
		await flushAsyncWork();

		const totalReachRecords = Object.values(
			data.world_metadata.app_state.monster_book.reached,
		).reduce((count, records) => count + (records?.length ?? 0), 0);

		assert.equal(totalReachRecords, 0);
		assert.equal(savedSnapshots.length, 0);
		assert.notEqual(
			CharacterStatusComp.characterKey[eid],
			CharacterKeyECS.GreenSlimeA1,
		);
	} finally {
		restore();
	}
});

test("pending 진화 완료 전에 캐릭터가 바뀌면 stale completion을 버린다", async () => {
	const { world, data, savedSnapshots } = createEvolutionTestContext(60_000);
	const eid = withMockedDateNow(60_000, () =>
		createTestCharacter(world, {
			characterKey: CharacterKeyECS.GreenSlimeA1,
			x: 120,
			y: 120,
		}),
	);
	const { deferred, dummySpritesheet, restore } = mockPendingSpritesheetLoad();

	try {
		withMockedRandom(0, () => {
			evolveCharacter(world as any, eid);
		});

		CharacterStatusComp.characterKey[eid] = CharacterKeyECS.GreenSlimeB1;
		CharacterStatusComp.evolutionPhase[eid] = 2;

		deferred.resolve(dummySpritesheet);
		await flushAsyncWork();

		const records = getMonsterBookRecords(
			data.world_metadata.app_state.monster_book,
			CharacterKeyECS.GreenSlimeB1,
		);

		assert.equal(savedSnapshots.length, 0);
		assert.equal(records.length, 0);
		assert.equal(
			CharacterStatusComp.characterKey[eid],
			CharacterKeyECS.GreenSlimeB1,
		);
		assert.equal(ObjectComp.id[eid] > 0, true);
	} finally {
		restore();
	}
});
