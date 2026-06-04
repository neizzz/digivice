import assert from "node:assert/strict";
import test from "node:test";
const {
  selectHomeWidgetSyncWorldData,
} = require("../../../client/src/utils/selectHomeWidgetSyncWorldData.ts") as {
  selectHomeWidgetSyncWorldData: (params: {
    storedWorldData: HomeWidgetSyncWorldDataLike | null;
    inMemoryWorldData: HomeWidgetSyncWorldDataLike | null;
  }) => {
    source: "stored" | "in_memory" | null;
    selectedWorldData: HomeWidgetSyncWorldDataLike | null;
  };
};
import { CharacterState } from "../scenes/MainScene/types";

type HomeWidgetSyncWorldDataLike = {
  world_metadata?: {
    last_ecs_saved?: number;
  };
  entities?: Array<{
    components?: {
      object?: {
        type?: number;
        state?: number;
      };
    };
  }>;
};

function worldData(
  lastEcsSaved: number,
  state: CharacterState,
): HomeWidgetSyncWorldDataLike {
  return {
    world_metadata: {
      last_ecs_saved: lastEcsSaved,
    },
    entities: [
      {
        components: {
          object: {
            type: 1,
            state,
          },
        },
      },
    ],
  };
}

test("stored complete hatch는 더 최신처럼 보이는 stale in-memory egg보다 우선한다", () => {
  const stored = worldData(400, CharacterState.IDLE);
  const inMemory = worldData(450, CharacterState.EGG);

  const selection = selectHomeWidgetSyncWorldData({
    storedWorldData: stored,
    inMemoryWorldData: inMemory,
  });

  assert.equal(selection.source, "stored");
  assert.deepEqual(selection.selectedWorldData, stored);
});

test("둘 다 hatch 완료 상태면 더 최신 in-memory를 유지한다", () => {
  const stored = worldData(400, CharacterState.IDLE);
  const inMemory = worldData(450, CharacterState.SLEEPING);

  const selection = selectHomeWidgetSyncWorldData({
    storedWorldData: stored,
    inMemoryWorldData: inMemory,
  });

  assert.equal(selection.source, "in_memory");
  assert.deepEqual(selection.selectedWorldData, inMemory);
});
