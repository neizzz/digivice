import assert from "node:assert/strict";
import test from "node:test";
const { sanitizeStoredWorldData } = require("../../../client/src/utils/sanitizeStoredWorldData.ts") as {
  sanitizeStoredWorldData: (savedData: unknown) => {
    action: string;
    sanitizedData: {
      entities?: Array<{
        components?: {
          eggHatch?: {
            hatchTime?: number;
            hatchDurationMs?: number;
          };
        };
      }>;
    } | null;
  };
};

type StoredWorldData = {
  world_metadata?: {
    name?: string;
    monster_name?: string;
    last_ecs_saved?: number;
    version?: string;
    app_state?: {
      last_active_time?: number;
      is_first_load?: boolean;
      use_local_time?: boolean;
    };
  };
  entities?: Array<{
    components?: {
      object?: {
        id?: number;
        type?: number;
        state?: number;
      };
      characterStatus?: {
        characterKey?: number;
        stamina?: number;
        evolutionGage?: number;
        evolutionPhase?: number;
        statuses?: number[];
      };
      position?: {
        x?: number;
        y?: number;
      };
      angle?: {
        value?: number;
      };
      speed?: {
        value?: number;
      };
      render?: {
        storeIndex?: number;
        textureKey?: number;
        scale?: number;
        zIndex?: number;
      };
      eggHatch?: {
        hatchTime?: number;
        hatchDurationMs?: number;
        pendingCharacterKey?: number;
      };
    };
  }>;
};

type SanitizeStoredWorldDataResult = ReturnType<typeof sanitizeStoredWorldData>;
import {
  createEggHatchSchedule,
  GAME_CONSTANTS,
} from "../scenes/MainScene/config";
import { EggHatchComp } from "../scenes/MainScene/raw-components";
import { CharacterKeyECS, CharacterState } from "../scenes/MainScene/types";
import {
  createTestCharacter,
  createTestWorld,
  withMockedDateNow,
  withMockedRandom,
} from "../test-utils/mainSceneTestUtils";

const TEN_MINUTES_MS = 10 * 60 * 1_000;

function buildStoredEggWorldData(eggHatch: {
  hatchTime?: number;
  hatchDurationMs?: number;
  pendingCharacterKey?: number;
}): StoredWorldData {
  return {
    world_metadata: {
      name: "MainScene",
      monster_name: "DebugEgg",
      last_ecs_saved: 1,
      version: "1.0.0",
      app_state: {
        last_active_time: 1,
        is_first_load: false,
        use_local_time: true,
      },
    },
    entities: [
      {
        components: {
          object: {
            id: 1001,
            type: 1,
            state: 0,
          },
          characterStatus: {
            characterKey: 1,
            stamina: 5,
            evolutionGage: 0,
            evolutionPhase: 1,
            statuses: [],
          },
          position: {
            x: 0,
            y: 0,
          },
          angle: {
            value: 0,
          },
          speed: {
            value: 0,
          },
          render: {
            storeIndex: 0,
            textureKey: 500,
            scale: 3,
            zIndex: 0,
          },
          eggHatch,
        },
      },
    ],
  };
}

function getSanitizedEggHatch(
  result: SanitizeStoredWorldDataResult,
): NonNullable<
  NonNullable<StoredWorldData["entities"]>[number]["components"]
>["eggHatch"] {
  assert.equal(result.action, "playable");
  assert.ok(result.sanitizedData);

  const eggHatch = result.sanitizedData.entities?.[0]?.components?.eggHatch;
  assert.ok(eggHatch);
  return eggHatch;
}

test("DEV 신규 egg 생성 경로는 4~6초 hatch schedule만 만든다", () => {
  assert.equal(GAME_CONSTANTS.EGG_HATCH_MIN_TIME, 4_000);
  assert.equal(GAME_CONSTANTS.EGG_HATCH_MODE_TIME, 5_000);
  assert.equal(GAME_CONSTANTS.EGG_HATCH_MAX_TIME, 6_000);

  const now = 100_000;
  assert.deepEqual(createEggHatchSchedule(now, 0), {
    hatchTime: now + 4_000,
    hatchDurationMs: 4_000,
  });
  assert.deepEqual(createEggHatchSchedule(now, 0.5), {
    hatchTime: now + 5_000,
    hatchDurationMs: 5_000,
  });
  assert.deepEqual(createEggHatchSchedule(now, 1), {
    hatchTime: now + 6_000,
    hatchDurationMs: 6_000,
  });

  const world = createTestWorld({ now });
  const eid = withMockedDateNow(now, () =>
    withMockedRandom(0.5, () =>
      createTestCharacter(world, {
        state: CharacterState.EGG,
      }),
    ),
  );

  assert.equal(EggHatchComp.hatchDurationMs[eid], 5_000);
  assert.equal(EggHatchComp.hatchTime[eid], now + 5_000);
});

test("DEV 신규 egg 생성은 Date.now 대신 world currentTime 기준으로 hatchTime을 만든다", () => {
  const worldNow = 100_000;
  const wallNow = worldNow + 120 * 60 * 60 * 1000;
  const world = createTestWorld({ now: worldNow });
  const eid = withMockedDateNow(wallNow, () =>
    withMockedRandom(0.5, () =>
      createTestCharacter(world, {
        state: CharacterState.EGG,
      }),
    ),
  );

  assert.equal(EggHatchComp.hatchDurationMs[eid], 5_000);
  assert.equal(EggHatchComp.hatchTime[eid], worldNow + 5_000);
});

test("sanitizeStoredWorldData는 DEV에서 complete 10분 egg hatch를 4~6초 새 스케줄로 재정규화한다", () => {
  const now = 2_000_000;

  const result = withMockedDateNow(now, () =>
    withMockedRandom(0.5, () =>
      sanitizeStoredWorldData(
        buildStoredEggWorldData({
          hatchTime: now + TEN_MINUTES_MS,
          hatchDurationMs: TEN_MINUTES_MS,
        }),
      ),
    ),
  );

  const eggHatch = getSanitizedEggHatch(result);
  assert.equal(eggHatch?.hatchTime, now + 5_000);
  assert.equal(eggHatch?.hatchDurationMs, 5_000);
});

test("sanitizeStoredWorldData는 DEV에서 hatchTime only 10분 egg hatch를 4~6초 새 스케줄로 재정규화한다", () => {
  const now = 3_000_000;

  const result = withMockedDateNow(now, () =>
    withMockedRandom(0.5, () =>
      sanitizeStoredWorldData(
        buildStoredEggWorldData({
          hatchTime: now + TEN_MINUTES_MS,
        }),
      ),
    ),
  );

  const eggHatch = getSanitizedEggHatch(result);
  assert.equal(eggHatch?.hatchTime, now + 5_000);
  assert.equal(eggHatch?.hatchDurationMs, 5_000);
});

test("sanitizeStoredWorldData는 DEV에서 hatchDuration only 10분 egg hatch를 4~6초 새 스케줄로 재정규화한다", () => {
  const now = 4_000_000;

  const result = withMockedDateNow(now, () =>
    withMockedRandom(0.5, () =>
      sanitizeStoredWorldData(
        buildStoredEggWorldData({
          hatchDurationMs: TEN_MINUTES_MS,
        }),
      ),
    ),
  );

  const eggHatch = getSanitizedEggHatch(result);
  assert.equal(eggHatch?.hatchTime, now + 5_000);
  assert.equal(eggHatch?.hatchDurationMs, 5_000);
});

test("sanitizeStoredWorldData는 DEV에서 egg hatch 정보가 비면 4~6초 새 스케줄을 만든다", () => {
  const now = 5_000_000;

  const result = withMockedDateNow(now, () =>
    withMockedRandom(0.5, () =>
      sanitizeStoredWorldData(buildStoredEggWorldData({})),
    ),
  );

  const eggHatch = getSanitizedEggHatch(result);
  assert.equal(eggHatch?.hatchTime, now + 5_000);
  assert.equal(eggHatch?.hatchDurationMs, 5_000);
});

test("sanitizeStoredWorldData는 duration보다 큰 future remaining을 현재 저장 정리 시간 기준으로 보정한다", () => {
  const now = 5_500_000;

  const result = withMockedDateNow(now, () =>
    sanitizeStoredWorldData(
      buildStoredEggWorldData({
        hatchTime: now + 120 * 60 * 60 * 1000,
        hatchDurationMs: 5_000,
      }),
    ),
  );

  const eggHatch = getSanitizedEggHatch(result);
  assert.equal(eggHatch?.hatchTime, now + 5_000);
  assert.equal(eggHatch?.hatchDurationMs, 5_000);
});

test("sanitizeStoredWorldData는 egg pendingCharacterKey를 보존한다", () => {
  const now = 6_000_000;

  const result = withMockedDateNow(now, () =>
    withMockedRandom(0.5, () =>
      sanitizeStoredWorldData(
        buildStoredEggWorldData({
          hatchTime: now + 5_000,
          hatchDurationMs: 5_000,
          pendingCharacterKey: CharacterKeyECS.SoilSlimeA1,
        }),
      ),
    ),
  );

  const eggHatch = getSanitizedEggHatch(result);
  assert.equal(
    eggHatch?.pendingCharacterKey,
    CharacterKeyECS.SoilSlimeA1,
  );
});
