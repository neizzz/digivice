import assert from "node:assert/strict";
import test from "node:test";
import { createWorld } from "bitecs";
import * as PIXI from "pixi.js";
import { StorageManager } from "../../../managers/StorageManager";
import {
  createTestCharacter,
  withMockedDateNow,
} from "../../../test-utils/mainSceneTestUtils";
import { MutationRiskComp, ObjectComp } from "../raw-components";
import {
  CharacterKeyECS,
  CharacterState,
} from "../types";
import {
  MainSceneWorld,
  type MainSceneWorldData,
  WORLD_DATA_STORAGE_KEY,
} from "../world";

type TestableHospitalWorld = MainSceneWorld & {
  _handleHospitalSelection: () => boolean;
  _pendingStorageWrite: Promise<void>;
  _persistentData?: unknown;
};

function createHospitalWorld(now: number): TestableHospitalWorld {
  return new MainSceneWorld({
    stage: new PIXI.Container(),
    positionBoundary: {
      x: 0,
      y: 0,
      width: 320,
      height: 320,
    },
    trustedClock: {
      now: () => now,
      captureAnchor: () => ({
        trustedUtcMs: now,
        osUptimeMs: now,
        source: "web_fallback",
        uncertaintyMs: 0,
        capturedWallMs: now,
      }),
    } as never,
  }) as TestableHospitalWorld;
}

test("성체에게 불필요한 병원 주사를 놓으면 주사 stack을 즉시 저장한다", async () => {
  const originalSetData = StorageManager.setData.bind(StorageManager);
  const now = 123_000;
  const world = createHospitalWorld(now);
  const writes: Array<{ key: string; data: unknown }> = [];

  createWorld(world as any, 128);
  const characterEid = withMockedDateNow(now, () =>
    createTestCharacter(world as any, {
      state: CharacterState.IDLE,
      characterKey: CharacterKeyECS.GreenSlimeA1,
    }),
  );
  world._persistentData = {
    world_metadata: {
      name: "MainScene",
      monster_name: "Test",
      last_ecs_saved: now,
      version: "1.0.0",
      app_state: {
        last_active_time: now,
        is_first_load: false,
        use_local_time: true,
      },
    },
    entities: [],
  };

  (
    StorageManager as {
      setData: typeof StorageManager.setData;
    }
  ).setData = async (key, data) => {
    writes.push({ key, data });
  };

  try {
    assert.equal(world._handleHospitalSelection(), true);
    await world._pendingStorageWrite;
  } finally {
    (
      StorageManager as {
        setData: typeof StorageManager.setData;
      }
    ).setData = originalSetData;
  }

  const worldWrite = writes
    .filter((write) => write.key === WORLD_DATA_STORAGE_KEY)
    .at(-1)?.data as MainSceneWorldData | undefined;
  const mutationRisk = worldWrite?.entities.find(
    (entity) => entity.components.object?.id === ObjectComp.id[characterEid],
  )?.components.mutationRisk;

  assert.equal(MutationRiskComp.unnecessaryInjectionStacks[characterEid], 1);
  assert.equal(mutationRisk?.unnecessaryInjectionStacks, 1);
  assert.equal(mutationRisk?.lastInjectionDetoxTime, now);
});
