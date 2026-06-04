import assert from "node:assert/strict";
import test from "node:test";
import {
  selectHomeWidgetSyncWorldData,
  type HomeWidgetSyncWorldDataLike,
} from "./selectHomeWidgetSyncWorldData.ts";
import { CharacterState } from "@/scenes/MainScene/types";

function worldData(
  lastEcsSaved: number,
  state?: CharacterState,
): HomeWidgetSyncWorldDataLike {
  return {
    world_metadata: {
      last_ecs_saved: lastEcsSaved,
    },
    entities:
      state === undefined
        ? undefined
        : [
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

test("저장본만 있으면 저장본을 선택한다", () => {
  const selection = selectHomeWidgetSyncWorldData({
    storedWorldData: worldData(100),
    inMemoryWorldData: null,
  });

  assert.equal(selection.source, "stored");
  assert.deepEqual(selection.selectedWorldData, worldData(100));
});

test("in-memory만 있으면 in-memory를 선택한다", () => {
  const selection = selectHomeWidgetSyncWorldData({
    storedWorldData: null,
    inMemoryWorldData: worldData(200),
  });

  assert.equal(selection.source, "in_memory");
  assert.deepEqual(selection.selectedWorldData, worldData(200));
});

test("둘 다 있으면 기본적으로 저장본을 선택한다", () => {
  const selection = selectHomeWidgetSyncWorldData({
    storedWorldData: worldData(300),
    inMemoryWorldData: worldData(250),
  });

  assert.equal(selection.source, "stored");
  assert.deepEqual(selection.selectedWorldData, worldData(300));
});

test("in-memory가 더 최신이면 in-memory를 선택한다", () => {
  const selection = selectHomeWidgetSyncWorldData({
    storedWorldData: worldData(400),
    inMemoryWorldData: worldData(450),
  });

  assert.equal(selection.source, "in_memory");
  assert.equal(selection.storedLastEcsSaved, 400);
  assert.equal(selection.inMemoryLastEcsSaved, 450);
  assert.deepEqual(selection.selectedWorldData, worldData(450));
});

test("stored hatch 완료 상태는 더 최신처럼 보이는 stale in-memory egg보다 우선한다", () => {
  const selection = selectHomeWidgetSyncWorldData({
    storedWorldData: worldData(400, CharacterState.IDLE),
    inMemoryWorldData: worldData(450, CharacterState.EGG),
  });

  assert.equal(selection.source, "stored");
  assert.deepEqual(
    selection.selectedWorldData,
    worldData(400, CharacterState.IDLE),
  );
});

test("둘 다 없으면 null을 반환한다", () => {
  const selection = selectHomeWidgetSyncWorldData({
    storedWorldData: null,
    inMemoryWorldData: null,
  });

  assert.equal(selection.source, null);
  assert.equal(selection.selectedWorldData, null);
});
