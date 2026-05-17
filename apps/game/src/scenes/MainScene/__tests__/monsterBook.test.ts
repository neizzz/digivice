import assert from "node:assert/strict";
import test from "node:test";
import { CharacterKeyECS, CharacterState, ObjectType } from "../types";
import {
  MONSTER_BOOK_MAX_RECORDS_PER_CHARACTER,
  createEmptyMonsterBookState,
  ensureMonsterBookBackfillFromSavedData,
  getMonsterBookRecords,
  hasReachedMonster,
  recordMonsterBookReach,
} from "../monsterBook";
import type { MainSceneWorldData } from "../world";

function createWorldData(): MainSceneWorldData {
  return {
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
}

test("recordMonsterBookReach는 species별 도달 이름을 최신순 최대 50개로 저장한다", () => {
  const data = createWorldData();
  const savedSnapshots: MainSceneWorldData[] = [];
  const world = {
    getInMemoryData: () => data,
    setData: async (nextData: MainSceneWorldData) => {
      savedSnapshots.push(nextData);
    },
  };

  for (let i = 0; i < MONSTER_BOOK_MAX_RECORDS_PER_CHARACTER + 5; i++) {
    data.world_metadata.monster_name = `몽이-${i}`;
    recordMonsterBookReach({
      world,
      characterKey: CharacterKeyECS.GreenSlimeB1,
      source: "evolution",
      reachedAt: 1_000 + i,
      objectId: 10 + i,
    });
  }

  const records = getMonsterBookRecords(
    data.world_metadata.app_state?.monster_book,
    CharacterKeyECS.GreenSlimeB1,
  );
  assert.equal(records.length, MONSTER_BOOK_MAX_RECORDS_PER_CHARACTER);
  assert.equal(records[0].name, "몽이-54");
  assert.equal(records.at(-1)?.name, "몽이-5");
  assert.equal(savedSnapshots.length, MONSTER_BOOK_MAX_RECORDS_PER_CHARACTER + 5);
});

test("ensureMonsterBookBackfillFromSavedData는 현재 부화된 캐릭터만 1회 보정한다", () => {
  const data = createWorldData();
  data.entities = [
    {
      components: {
        object: {
          id: 11,
          type: ObjectType.CHARACTER,
          state: CharacterState.IDLE,
        },
        characterStatus: {
          characterKey: CharacterKeyECS.GreenSlimeA1,
          stamina: 5,
          evolutionGage: 0,
          evolutionPhase: 1,
          statuses: [],
        },
      },
    },
    {
      components: {
        object: {
          id: 12,
          type: ObjectType.CHARACTER,
          state: CharacterState.EGG,
        },
        characterStatus: {
          characterKey: CharacterKeyECS.GreenSlimeB1,
          stamina: 5,
          evolutionGage: 0,
          evolutionPhase: 2,
          statuses: [],
        },
      },
    },
  ];

  const state = ensureMonsterBookBackfillFromSavedData(data, 2_000);
  assert.equal(hasReachedMonster(state, CharacterKeyECS.GreenSlimeA1), true);
  assert.equal(hasReachedMonster(state, CharacterKeyECS.GreenSlimeB1), false);

  ensureMonsterBookBackfillFromSavedData(data, 3_000);
  const records = getMonsterBookRecords(state, CharacterKeyECS.GreenSlimeA1);
  assert.equal(records.length, 1);
  assert.equal(records[0].source, "backfill");
  assert.equal(records[0].reached_at, 2_000);
});
