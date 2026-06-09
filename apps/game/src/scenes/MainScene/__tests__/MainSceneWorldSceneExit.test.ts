import assert from "node:assert/strict";
import test from "node:test";
import { StorageManager } from "../../../managers/StorageManager";
import { MONSTER_BOOK_STORAGE_KEY } from "../monsterBookStorage";
import { MainSceneWorld, WORLD_DATA_STORAGE_KEY } from "../world";

test("MainSceneWorld.onSceneExit는 저장 실패가 있어도 cleanup을 계속 진행한다", async () => {
	const callCounts = {
		cleanupVisibilityChangeHandler: 0,
		clearMainSceneAdTimers: 0,
		stopRecoveryVibration: 0,
	};

	const fakeWorld: {
		_isPersistenceDisabled: boolean;
		_saveCurrentState: () => Promise<void>;
		_cleanupVisibilityChangeHandler: () => void;
		_clearMainSceneAdTimers: () => void;
		_stage: null;
		_pendingRecoveryCureEids: Set<number>;
		stopRecoveryVibration: () => void;
		_isPaused: boolean;
	} = {
		_isPersistenceDisabled: false,
		_saveCurrentState: async () => {
			throw new Error("simulated storage timeout");
		},
		_cleanupVisibilityChangeHandler: () => {
			callCounts.cleanupVisibilityChangeHandler += 1;
		},
		_clearMainSceneAdTimers: () => {
			callCounts.clearMainSceneAdTimers += 1;
		},
		_stage: null,
		_pendingRecoveryCureEids: new Set([1, 2]),
		stopRecoveryVibration: () => {
			callCounts.stopRecoveryVibration += 1;
		},
		_isPaused: false,
	};

	await MainSceneWorld.prototype.onSceneExit.call(
		fakeWorld as unknown as MainSceneWorld,
	);

	assert.equal(callCounts.cleanupVisibilityChangeHandler, 1);
	assert.equal(callCounts.clearMainSceneAdTimers, 1);
	assert.equal(callCounts.stopRecoveryVibration, 1);
	assert.equal(fakeWorld._pendingRecoveryCureEids.size, 0);
	assert.equal(fakeWorld._isPaused, true);
});

test("MainSceneWorld.setData는 FlappyBird active 동안 persistence를 defer하고 reenter 시 1회 flush한다", async () => {
	const originalSetData = StorageManager.setData.bind(StorageManager);
	const writes: Array<{ key: string; data: unknown }> = [];

	(
		StorageManager as {
			setData: typeof StorageManager.setData;
		}
	).setData = async (_key, data) => {
		writes.push({ key: _key, data });
	};

	try {
		const world = {
			_persistentData: undefined,
			_isPersistenceDisabled: false,
			_shouldDeferPersistence: () => true,
			_hasDeferredPersistence: false,
			_pendingStorageWrite: Promise.resolve(),
			_enqueueStorageWrite: MainSceneWorld.prototype["_enqueueStorageWrite"],
			_createStoragePersistableData:
				MainSceneWorld.prototype["_createStoragePersistableData"],
			setData: MainSceneWorld.prototype.setData,
			_flushDeferredPersistenceIfNeeded:
				MainSceneWorld.prototype["_flushDeferredPersistenceIfNeeded"],
		} as unknown as MainSceneWorld & {
			_persistentData: unknown;
			_isPersistenceDisabled: boolean;
			_shouldDeferPersistence: () => boolean;
			_hasDeferredPersistence: boolean;
			_pendingStorageWrite: Promise<void>;
			_enqueueStorageWrite: (work: () => Promise<void>) => Promise<void>;
			_createStoragePersistableData: (data: unknown) => unknown;
			_flushDeferredPersistenceIfNeeded: () => Promise<void>;
		};

		const data = {
			world_metadata: {
				monster_name: "Test",
				last_ecs_saved: Date.now(),
				app_state: {
					last_active_time: Date.now(),
					is_first_load: false,
					use_local_time: true,
					monster_book: {
						reached: {},
					},
				},
			},
			entities: [],
		};

		await MainSceneWorld.prototype.setData.call(world, data as never);

		assert.equal(writes.length, 0);
		assert.equal(world._hasDeferredPersistence, true);

		world._shouldDeferPersistence = () => false;
		await world._flushDeferredPersistenceIfNeeded();

		assert.equal(writes.length, 1);
		assert.equal(world._hasDeferredPersistence, false);
		assert.equal(writes[0]?.key, "MainSceneWorldData");
		assert.equal(
			(
				writes[0]?.data as {
					world_metadata?: {
						app_state?: { monster_book?: unknown };
					};
				}
			).world_metadata?.app_state?.monster_book,
			undefined,
		);
	} finally {
		(
			StorageManager as {
				setData: typeof StorageManager.setData;
			}
		).setData = originalSetData;
	}
});

test("MainSceneWorld.clearData는 reset 시 world 저장만 지우고 Monster Book 저장은 유지한다", async () => {
	const originalRemoveData = StorageManager.removeData.bind(StorageManager);
	const storage = new Map<string, unknown>([
		[
			WORLD_DATA_STORAGE_KEY,
			{ world_metadata: { monster_name: "Before Reset" } },
		],
		[
			MONSTER_BOOK_STORAGE_KEY,
			{ reached: { someMonster: [{ name: "몽이" }] } },
		],
	]);
	const removedKeys: string[] = [];

	(
		StorageManager as {
			removeData: typeof StorageManager.removeData;
		}
	).removeData = async (key) => {
		removedKeys.push(key);
		storage.delete(key);
	};

	try {
		const world = {
			_persistentData: {
				world_metadata: {
					monster_name: "Before Reset",
				},
				entities: [],
			},
			_pendingStorageWrite: Promise.resolve(),
			_enqueueStorageWrite: MainSceneWorld.prototype["_enqueueStorageWrite"],
			clearData: MainSceneWorld.prototype.clearData,
		} as unknown as MainSceneWorld & {
			_persistentData: unknown;
			_pendingStorageWrite: Promise<void>;
			_enqueueStorageWrite: (work: () => Promise<void>) => Promise<void>;
		};

		await MainSceneWorld.prototype.clearData.call(world);

		assert.deepEqual(removedKeys, [WORLD_DATA_STORAGE_KEY]);
		assert.equal(storage.has(WORLD_DATA_STORAGE_KEY), false);
		assert.equal(storage.has(MONSTER_BOOK_STORAGE_KEY), true);
		assert.equal(world._persistentData, undefined);
	} finally {
		(
			StorageManager as {
				removeData: typeof StorageManager.removeData;
			}
		).removeData = originalRemoveData;
	}
});
