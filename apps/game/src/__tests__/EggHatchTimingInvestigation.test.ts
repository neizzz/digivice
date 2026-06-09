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
          characterStatus?: {
            statuses?: number[];
          };
          render?: {
            textureKey?: number;
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
  CharacterKeyECS,
  CharacterState,
  CharacterStatus,
  TextureKey,
} from "../scenes/MainScene/types";
import {
  withMockedDateNow,
  withMockedRandom,
} from "../test-utils/mainSceneTestUtils";

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

function buildStoredCharacterWorldData(params: {
  state: CharacterState;
  statuses: number[];
}): StoredWorldData {
  return {
    world_metadata: {
      name: "MainScene",
      monster_name: "DebugCharacter",
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
            state: params.state,
          },
          characterStatus: {
            characterKey: 1,
            stamina: 5,
            evolutionGage: 0,
            evolutionPhase: 1,
            statuses: params.statuses,
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
          eggHatch: {},
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

function getSanitizedCharacterStatuses(
  result: SanitizeStoredWorldDataResult,
): number[] {
  assert.equal(result.action, "playable");
  assert.ok(result.sanitizedData);

  const statuses =
    result.sanitizedData.entities?.[0]?.components?.characterStatus?.statuses;
  assert.ok(statuses);
  return statuses;
}

function getSanitizedRenderTextureKey(
  result: SanitizeStoredWorldDataResult,
): number | undefined {
  assert.equal(result.action, "playable");
  assert.ok(result.sanitizedData);

  return result.sanitizedData.entities?.[0]?.components?.render?.textureKey;
}

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

test("sanitizeStoredWorldData는 sick state 저장본의 빈 status 슬롯에 sick을 보정한다", () => {
  const result = sanitizeStoredWorldData(
    buildStoredCharacterWorldData({
      state: CharacterState.SICK,
      statuses: [0, 0, 0, 0],
    }),
  );

  assert.deepEqual(getSanitizedCharacterStatuses(result), [
    CharacterStatus.SICK,
    0,
    0,
    0,
  ]);
});

test("sanitizeStoredWorldData는 status 슬롯이 꽉 차면 sick status를 덧붙이지 않는다", () => {
  const statuses = [
    CharacterStatus.URGENT,
    CharacterStatus.HAPPY,
    CharacterStatus.DISCOVER,
    CharacterStatus.URGENT,
  ];
  const result = sanitizeStoredWorldData(
    buildStoredCharacterWorldData({
      state: CharacterState.SICK,
      statuses,
    }),
  );

  assert.deepEqual(getSanitizedCharacterStatuses(result), statuses);
});

test("sanitizeStoredWorldData는 non-egg 캐릭터에 남은 egg static texture를 제거한다", () => {
  const result = sanitizeStoredWorldData(
    buildStoredCharacterWorldData({
      state: CharacterState.SICK,
      statuses: [0, 0, 0, 0],
    }),
  );

  assert.equal(getSanitizedRenderTextureKey(result), TextureKey.NULL);
});
