import assert from "node:assert/strict";
import test from "node:test";
import { createWorld } from "bitecs";
import * as PIXI from "pixi.js";
import { CharacterStatusComp, EggHatchComp, ObjectComp } from "../raw-components";
import { CharacterKeyECS, CharacterState } from "../types";
import {
  MainSceneWorld,
  type MainSceneWorldData,
} from "../world";
import { createTestCharacter } from "../../../test-utils/mainSceneTestUtils";
import { TrustedClock } from "../../../utils/TrustedClock";

function createTrustedClock(now: number): TrustedClock {
  const anchor = {
    trustedUtcMs: now,
    osUptimeMs: now + 10_000,
    source: "ntp" as const,
    uncertaintyMs: 10,
    capturedWallMs: now,
  };

  const trustedClock = new TrustedClock(anchor);
  trustedClock.now = () => now;
  trustedClock.captureAnchor = () => ({ ...anchor });
  trustedClock.refresh = async () => ({ ...anchor });
  trustedClock.elapsedSince = () => ({
      elapsedMs: 0,
      trusted: true,
      reason: "uptime_delta",
      currentSnapshot: { ...anchor },
    });

  return trustedClock;
}

function createMainSceneWorldForTest(now: number): MainSceneWorld {
  const world = new MainSceneWorld({
    stage: new PIXI.Container(),
    positionBoundary: {
      x: 0,
      y: 0,
      width: 320,
      height: 320,
    },
    trustedClock: createTrustedClock(now),
  });

  createWorld(world, 100);
  return world;
}

test("buildWorldDataSyncPayload는 저장본 대신 현재 ECS egg 상태를 export한다", () => {
  const now = 9_000;
  const world = createMainSceneWorldForTest(now);
  const characterEid = createTestCharacter(
    world as unknown as Parameters<typeof createTestCharacter>[0],
    {
      state: CharacterState.EGG,
      stamina: 7,
      x: 120,
      y: 140,
    },
  );

  EggHatchComp.hatchTime[characterEid] = 12_345;
  EggHatchComp.hatchDurationMs[characterEid] = 2_222;
  EggHatchComp.syringeCount[characterEid] = 4;
  EggHatchComp.pendingCharacterKey[characterEid] = CharacterKeyECS.SoilSlimeA1;

  const persistedData: MainSceneWorldData = {
    world_metadata: {
      name: "MainScene",
      monster_name: "Test",
      last_ecs_saved: 1_000,
      version: "1.0.0",
      app_state: {
        last_active_time: 800,
        last_active_time_anchor: {
          trustedUtcMs: 800,
          osUptimeMs: 8_800,
          source: "ntp",
          uncertaintyMs: 10,
          capturedWallMs: 800,
        },
        is_first_load: false,
        use_local_time: true,
      },
    },
    entities: [
      {
        components: {
          object: {
            id: 999,
            type: ObjectComp.type[characterEid],
            state: CharacterState.IDLE,
          },
          characterStatus: {
            characterKey: CharacterStatusComp.characterKey[characterEid],
            stamina: 1,
            evolutionGage: 0,
            evolutionPhase: 1,
            statuses: [],
          },
          eggHatch: {
            hatchTime: 4_000,
            hatchDurationMs: 1_000,
            isReadyToHatch: false,
            syringeCount: 0,
            pendingCharacterKey: CharacterKeyECS.GreenSlimeA1,
          },
          render: {
            storeIndex: 0,
            textureKey: 0,
            scale: 3,
            zIndex: 0,
          },
        },
      },
    ],
  };

  (
    world as unknown as {
      _persistentData: MainSceneWorldData;
    }
  )._persistentData = persistedData;

  const snapshot = world.buildWorldDataSyncPayload();

  assert.ok(snapshot);
  assert.notEqual(snapshot, persistedData);
  assert.equal(snapshot.world_metadata.last_ecs_saved, now);
  assert.equal(snapshot.world_metadata.app_state?.last_active_time, now);
  assert.equal(
    snapshot.world_metadata.app_state?.last_active_time_anchor?.trustedUtcMs,
    now,
  );
  assert.equal(snapshot.entities.length, 1);
  assert.equal(snapshot.entities[0]?.components.object?.id, ObjectComp.id[characterEid]);
  assert.equal(
    snapshot.entities[0]?.components.object?.state,
    CharacterState.EGG,
  );
  assert.equal(
    snapshot.entities[0]?.components.characterStatus?.stamina,
    CharacterStatusComp.stamina[characterEid],
  );
  assert.equal(
    snapshot.entities[0]?.components.eggHatch?.hatchTime,
    EggHatchComp.hatchTime[characterEid],
  );
  assert.equal(
    snapshot.entities[0]?.components.eggHatch?.hatchDurationMs,
    EggHatchComp.hatchDurationMs[characterEid],
  );
  assert.equal(
    snapshot.entities[0]?.components.eggHatch?.syringeCount,
    EggHatchComp.syringeCount[characterEid],
  );
  assert.equal(
    snapshot.entities[0]?.components.eggHatch?.pendingCharacterKey,
    EggHatchComp.pendingCharacterKey[characterEid],
  );

  assert.equal(persistedData.world_metadata.last_ecs_saved, 1_000);
  assert.equal(
    persistedData.world_metadata.app_state?.last_active_time,
    800,
  );
  assert.equal(persistedData.entities[0]?.components.object?.state, CharacterState.IDLE);
});

test("buildWorldDataSyncPayload는 stale clock으로 저장 timestamp를 되돌리지 않는다", () => {
  const staleNow = 4_000;
  const nativeSavedAt = 60 * 60 * 1000;
  const world = createMainSceneWorldForTest(staleNow);
  createTestCharacter(
    world as unknown as Parameters<typeof createTestCharacter>[0],
    {
      state: CharacterState.IDLE,
    },
  );

  (
    world as unknown as {
      _persistentData: MainSceneWorldData;
    }
  )._persistentData = {
    world_metadata: {
      name: "MainScene",
      monster_name: "Test",
      last_ecs_saved: nativeSavedAt,
      version: "1.0.0",
      app_state: {
        last_active_time: nativeSavedAt,
        is_first_load: false,
        use_local_time: true,
      },
    },
    entities: [],
  };

  const snapshot = world.buildWorldDataSyncPayload();

  assert.ok(snapshot);
  assert.equal(snapshot.world_metadata.last_ecs_saved, nativeSavedAt);
  assert.equal(
    snapshot.world_metadata.app_state?.last_active_time,
    nativeSavedAt,
  );
  assert.equal(
    snapshot.world_metadata.app_state?.last_active_time_anchor?.trustedUtcMs,
    staleNow,
  );
});

test("buildWorldDataSyncPayload는 persistence write를 발생시키지 않는다", () => {
  const now = 4_000;
  const world = createMainSceneWorldForTest(now);
  const worldInternals = world as unknown as {
    _persistentData: MainSceneWorldData;
    _enqueueStorageWrite: (...args: unknown[]) => Promise<void>;
    setData: (...args: unknown[]) => Promise<void>;
  };
  createTestCharacter(
    world as unknown as Parameters<typeof createTestCharacter>[0],
    {
      state: CharacterState.EGG,
    },
  );

  worldInternals._persistentData = {
    world_metadata: {
      name: "MainScene",
      monster_name: "Test",
      last_ecs_saved: 1_000,
      version: "1.0.0",
      app_state: {
        last_active_time: 1_000,
        is_first_load: false,
        use_local_time: true,
      },
    },
    entities: [],
  };

  let enqueueCalled = 0;
  let setDataCalled = 0;
  worldInternals._enqueueStorageWrite = async () => {
    enqueueCalled += 1;
  };
  worldInternals.setData = async () => {
    setDataCalled += 1;
  };

  const snapshot = world.buildWorldDataSyncPayload();

  assert.ok(snapshot);
  assert.equal(enqueueCalled, 0);
  assert.equal(setDataCalled, 0);
});
