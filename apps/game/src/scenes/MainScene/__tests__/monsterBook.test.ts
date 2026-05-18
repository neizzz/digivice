import assert from "node:assert/strict";
import test from "node:test";
import {
  MONSTER_BOOK_MAX_RECORDS_PER_CHARACTER,
  backfillCurrentMonsterIfHidden,
  createEmptyMonsterBookState,
  getMonsterBookRecords,
  getSavedCurrentMonsterBookCandidates,
  hasReachedMonster,
  recordMonsterBookReach,
} from "../monsterBook";
import { CharacterKeyECS, CharacterState, ObjectType } from "../types";
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

test("backfillCurrentMonsterIfHidden는 현재 몬스터가 미도달이면 도달 기록을 보정한다", () => {
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
  ];

  const result = backfillCurrentMonsterIfHidden(
    data,
    getSavedCurrentMonsterBookCandidates(data),
    2_000,
  );

  assert.equal(result.didBackfill, true);
  assert.equal(
    hasReachedMonster(result.state, CharacterKeyECS.GreenSlimeA1),
    true,
  );
  assert.equal(
    hasReachedMonster(result.state, CharacterKeyECS.GreenSlimeB1),
    false,
  );

  const records = getMonsterBookRecords(
    result.state,
    CharacterKeyECS.GreenSlimeA1,
  );
  assert.equal(records.length, 1);
  assert.deepEqual(records[0], {
    name: "몽이",
    reached_at: 2_000,
    object_id: 11,
    source: "backfill",
  });
});

test("backfillCurrentMonsterIfHidden는 기존 도달 기록이 있으면 중복 보정하지 않는다", () => {
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
  ];
  const monsterBook = data.world_metadata.app_state?.monster_book;
  assert.ok(monsterBook);
  monsterBook.reached[CharacterKeyECS.GreenSlimeA1] = [
    {
      name: "몽이",
      reached_at: 1_000,
      object_id: 10,
      source: "hatch",
    },
  ];

  const result = backfillCurrentMonsterIfHidden(
    data,
    getSavedCurrentMonsterBookCandidates(data),
    2_000,
  );

  const records = getMonsterBookRecords(
    result.state,
    CharacterKeyECS.GreenSlimeA1,
  );
  assert.equal(result.didBackfill, false);
  assert.equal(records.length, 1);
  assert.equal(records[0].source, "hatch");
  assert.equal(records[0].reached_at, 1_000);
  assert.equal(records[0].object_id, 10);
});

test("backfillCurrentMonsterIfHidden는 egg/dead 상태를 현재 몬스터로 보정하지 않는다", () => {
  const data = createWorldData();
  data.entities = [
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
    {
      components: {
        object: {
          id: 13,
          type: ObjectType.CHARACTER,
          state: CharacterState.DEAD,
        },
        characterStatus: {
          characterKey: CharacterKeyECS.SkullSlimeA1,
          stamina: 0,
          evolutionGage: 0,
          evolutionPhase: 1,
          statuses: [],
        },
      },
    },
  ];

  const currentMonsters = getSavedCurrentMonsterBookCandidates(data);
  const result = backfillCurrentMonsterIfHidden(data, currentMonsters, 2_000);

  assert.deepEqual(currentMonsters, []);
  assert.equal(result.didBackfill, false);
  assert.equal(
    hasReachedMonster(result.state, CharacterKeyECS.GreenSlimeB1),
    false,
  );
  assert.equal(
    hasReachedMonster(result.state, CharacterKeyECS.SkullSlimeA1),
    false,
  );
});
