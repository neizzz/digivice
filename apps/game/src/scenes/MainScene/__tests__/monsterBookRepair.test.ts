import assert from "node:assert/strict";
import test from "node:test";
import type { Storage } from "@shared/storage";
import {
  createEmptyMonsterBookState,
  getMonsterBookRecords,
  normalizeMonsterBookStateWithMeta,
  recordMonsterBookReach,
} from "../monsterBook";
import { MONSTER_BOOK_STORAGE_KEY, loadMonsterBookState } from "../monsterBookStorage";
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

test("recordMonsterBookReach는 같은 species/object 재기록을 중복 append하지 않고 최신 1건으로 유지한다", () => {
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
  const world = {
    getInMemoryData: () => data,
    setData: async (_nextData: typeof data) => {},
  };

  recordMonsterBookReach({
    world,
    characterKey: CharacterKeyECS.GreenSlimeB1,
    source: "evolution",
    reachedAt: 1_000,
    objectId: 55,
  });
  recordMonsterBookReach({
    world,
    characterKey: CharacterKeyECS.GreenSlimeB1,
    source: "evolution",
    reachedAt: 1_500,
    objectId: 55,
  });

  const records = getMonsterBookRecords(
    data.world_metadata.app_state.monster_book,
    CharacterKeyECS.GreenSlimeB1,
  );

  assert.equal(records.length, 1);
  assert.equal(records[0].reached_at, 1_500);
});

test("loadMonsterBookState는 species 내부 중복을 수리하면 전용 storage에 write-back한다", async () => {
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
  assert.deepEqual(storage.data.get(MONSTER_BOOK_STORAGE_KEY), state);
});
