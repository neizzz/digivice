import assert from "node:assert/strict";
import test from "node:test";
import { StorageManager } from "../../../managers/StorageManager";
import { MainSceneWorld } from "../world";

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
  const writes: unknown[] = [];

  (StorageManager as {
    setData: typeof StorageManager.setData;
  }).setData = async (_key, data) => {
    writes.push(data);
  };

  try {
    const world = {
      _persistentData: undefined,
      _isPersistenceDisabled: false,
      _shouldDeferPersistence: () => true,
      _hasDeferredPersistence: false,
      _pendingStorageWrite: Promise.resolve(),
      _enqueueStorageWrite: MainSceneWorld.prototype["_enqueueStorageWrite"],
      setData: MainSceneWorld.prototype.setData,
      _flushDeferredPersistenceIfNeeded:
        MainSceneWorld.prototype["_flushDeferredPersistenceIfNeeded"],
    } as unknown as MainSceneWorld & {
      _persistentData: unknown;
      _isPersistenceDisabled: boolean;
      _shouldDeferPersistence: () => boolean;
      _hasDeferredPersistence: boolean;
      _pendingStorageWrite: Promise<void>;
      _enqueueStorageWrite: (
        work: () => Promise<void>,
      ) => Promise<void>;
      _flushDeferredPersistenceIfNeeded: () => Promise<void>;
    };

    const data = {
      world_metadata: {
        monster_name: "Test",
        last_ecs_saved: Date.now(),
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
  } finally {
    (StorageManager as {
      setData: typeof StorageManager.setData;
    }).setData = originalSetData;
  }
});
