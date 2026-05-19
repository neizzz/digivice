import assert from "node:assert/strict";
import test from "node:test";
import type { Storage } from "@shared/storage";
import { CharacterKeyECS } from "../types";
import {
  MONSTER_BOOK_STORAGE_KEY,
  loadMonsterBookState,
  migrateLegacyMonsterBookIfNeeded,
  saveMonsterBookState,
} from "../monsterBookStorage";

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

test("migrateLegacyMonsterBookIfNeeded는 legacy world data를 전용 storage key로 1회 이관한다", async () => {
  const storage = createMemoryStorage();
  const legacyWorldData = {
    world_metadata: {
      app_state: {
        monster_book: {
          reached: {
            [CharacterKeyECS.GreenSlimeA1]: [
              {
                name: "몽이",
                reached_at: 1234,
                object_id: 99,
                source: "hatch",
              },
            ],
          },
        },
      },
    },
  };

  const result = await migrateLegacyMonsterBookIfNeeded(storage, legacyWorldData);

  assert.equal(result.didMigrate, true);
  assert.equal(result.hasStoredState, true);
  assert.deepEqual(storage.data.get(MONSTER_BOOK_STORAGE_KEY), result.state);
});

test("migrateLegacyMonsterBookIfNeeded는 전용 storage key가 이미 있으면 legacy data로 덮어쓰지 않는다", async () => {
  const storage = createMemoryStorage();
  await saveMonsterBookState(storage, {
    reached: {
      [CharacterKeyECS.GreenSlimeB1]: [
        {
          name: "현재 도감",
          reached_at: 5678,
          object_id: 12,
          source: "evolution",
        },
      ],
    },
  });

  const result = await migrateLegacyMonsterBookIfNeeded(storage, {
    world_metadata: {
      app_state: {
        monster_book: {
          reached: {
            [CharacterKeyECS.GreenSlimeA1]: [
              {
                name: "예전 도감",
                reached_at: 1234,
                object_id: 10,
                source: "hatch",
              },
            ],
          },
        },
      },
    },
  });

  const reloaded = await loadMonsterBookState(storage);
  assert.equal(result.didMigrate, false);
  assert.deepEqual(result.state, reloaded);
  assert.equal(
    reloaded.reached[CharacterKeyECS.GreenSlimeB1]?.[0]?.name,
    "현재 도감",
  );
});
