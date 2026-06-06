import assert from "node:assert/strict";
import test from "node:test";
import { addComponent, addEntity, createWorld } from "bitecs";
import * as PIXI from "pixi.js";
import { GAME_CONSTANTS } from "../config";
import { EVOLUTION_GAUGE_CONFIG } from "../evolutionConfig";
import {
  CharacterStatusComp,
  EggHatchComp,
  FreshnessComp,
  MutationRiskComp,
  ObjectComp,
} from "../raw-components";
import {
  CharacterKeyECS,
  CharacterState,
  Freshness,
  ObjectType,
} from "../types";
import { MainSceneWorld } from "../world";
import { createTestCharacter } from "../../../test-utils/mainSceneTestUtils";

function createMainSceneWorldForTest(): MainSceneWorld {
  const world = new MainSceneWorld({
    stage: new PIXI.Container(),
    positionBoundary: {
      x: 0,
      y: 0,
      width: 320,
      height: 320,
    },
  });

  createWorld(world, 100);

  return world;
}

function addStaleFood(world: MainSceneWorld): number {
  const eid = addEntity(world);

  addComponent(world, ObjectComp, eid);
  addComponent(world, FreshnessComp, eid);
  ObjectComp.type[eid] = ObjectType.FOOD;
  FreshnessComp.freshness[eid] = Freshness.STALE;

  return eid;
}

test("메인 캐릭터 스테미나 snapshot을 반환한다", () => {
  const world = createMainSceneWorldForTest();
  assert.equal(GAME_CONSTANTS.UNHAPPY_STAMINA_THRESHOLD, 3);

  createTestCharacter(
    world as unknown as Parameters<typeof createTestCharacter>[0],
    {
      state: CharacterState.IDLE,
      stamina: 7.25,
      x: 90,
      y: 120,
    },
  );

  assert.deepEqual(world.getMainCharacterStaminaSnapshot(), {
    stamina: 7.25,
    maxStamina: GAME_CONSTANTS.MAX_STAMINA,
    unhappyThreshold: 3,
    boostedThreshold: GAME_CONSTANTS.BOOSTED_STAMINA_THRESHOLD,
  });
});

test("메인 캐릭터가 없으면 스테미나 snapshot은 null이다", () => {
  const world = createMainSceneWorldForTest();

  assert.equal(world.getMainCharacterStaminaSnapshot(), null);
});

test("메인 캐릭터 info snapshot은 이름, 레벨, 게이지 정보를 반환한다", () => {
  const world = createMainSceneWorldForTest();
  const characterEid = createTestCharacter(
    world as unknown as Parameters<typeof createTestCharacter>[0],
    {
      characterKey: CharacterKeyECS.SkullSlimeC2,
      state: CharacterState.IDLE,
      stamina: 7.25,
      x: 90,
      y: 120,
    },
  );

  CharacterStatusComp.evolutionPhase[characterEid] = 3;
  CharacterStatusComp.evolutionGage[characterEid] = 42.5;
  (world as unknown as {
    _persistentData?: {
      world_metadata: {
        monster_name: string;
      };
    };
  })._persistentData = {
    world_metadata: {
      monster_name: "MonTTo",
    },
  };

  assert.deepEqual(world.getMainCharacterInfoSnapshot(), {
    monsterName: "MonTTo",
    isEgg: false,
    geneLine: "skull-slime",
    geneOutcomes: [
      {
        kind: "evolution",
        geneLine: "skull-slime",
        level: 4,
        probability: 0.99,
      },
      {
        kind: "mutation",
        geneLine: "green-slime",
        level: 3,
        probability: 0.01 * (4 / 7),
      },
      {
        kind: "mutation",
        geneLine: "soil-slime",
        level: 3,
        probability: 0.01 * (3 / 7),
      },
    ],
    eggHatchRemainingMs: null,
    evolutionPhase: 3,
    stamina: 7.25,
    maxStamina: GAME_CONSTANTS.MAX_STAMINA,
    unhappyThreshold: GAME_CONSTANTS.UNHAPPY_STAMINA_THRESHOLD,
    boostedThreshold: GAME_CONSTANTS.BOOSTED_STAMINA_THRESHOLD,
    evolutionGauge: 42.5,
    maxEvolutionGauge: EVOLUTION_GAUGE_CONFIG.maxGauge,
  });
});

test("알 상태 메인 캐릭터 info snapshot은 egg 상태를 그대로 반환한다", () => {
  const world = createMainSceneWorldForTest();
  const characterEid = createTestCharacter(
    world as unknown as Parameters<typeof createTestCharacter>[0],
    {
      state: CharacterState.EGG,
      stamina: 5,
      x: 64,
      y: 88,
    },
  );

  EggHatchComp.hatchTime[characterEid] = 22_000;
  EggHatchComp.hatchDurationMs[characterEid] = 12_000;
  CharacterStatusComp.evolutionPhase[characterEid] = 1;
  CharacterStatusComp.evolutionGage[characterEid] = 10;
  (world as unknown as {
    _persistentData?: {
      world_metadata: {
        monster_name: string;
      };
    };
  })._persistentData = {
    world_metadata: {
      monster_name: "Eggy",
    },
  };
  (world as unknown as { _simulationTime: number | null })._simulationTime = 15_000;

  assert.deepEqual(world.getMainCharacterInfoSnapshot(), {
    monsterName: "Eggy",
    isEgg: true,
    geneLine: null,
    geneOutcomes: [
      {
        kind: "hatch",
        geneLine: "green-slime",
        level: 1,
        probability: 0.65,
      },
      {
        kind: "hatch",
        geneLine: "soil-slime",
        level: 1,
        probability: 0.2,
      },
      {
        kind: "hatch",
        geneLine: "skull-slime",
        level: 1,
        probability: 0.15,
      },
    ],
    eggHatchRemainingMs: 7_000,
    evolutionPhase: 1,
    stamina: 5,
    maxStamina: GAME_CONSTANTS.MAX_STAMINA,
    unhappyThreshold: GAME_CONSTANTS.UNHAPPY_STAMINA_THRESHOLD,
    boostedThreshold: GAME_CONSTANTS.BOOSTED_STAMINA_THRESHOLD,
    evolutionGauge: 10,
    maxEvolutionGauge: EVOLUTION_GAUGE_CONFIG.maxGauge,
  });
});

test("알 상태 info snapshot은 주사 횟수와 상한 음식 수를 부화 gene 확률에 반영한다", () => {
  const world = createMainSceneWorldForTest();
  const characterEid = createTestCharacter(
    world as unknown as Parameters<typeof createTestCharacter>[0],
    {
      state: CharacterState.EGG,
      x: 64,
      y: 88,
    },
  );

  addStaleFood(world);
  addStaleFood(world);
  EggHatchComp.syringeCount[characterEid] = 3;

  assert.deepEqual(world.getMainCharacterInfoSnapshot()?.geneOutcomes, [
    {
      kind: "hatch",
      geneLine: "green-slime",
      level: 1,
      probability: 0.55,
    },
    {
      kind: "hatch",
      geneLine: "soil-slime",
      level: 1,
      probability: 0.24,
    },
    {
      kind: "hatch",
      geneLine: "skull-slime",
      level: 1,
      probability: 0.21,
    },
  ]);
});

test("알 상태 info snapshot은 이미 고정된 부화 결과를 100%로 표시한다", () => {
  const world = createMainSceneWorldForTest();
  const characterEid = createTestCharacter(
    world as unknown as Parameters<typeof createTestCharacter>[0],
    {
      state: CharacterState.EGG,
      x: 64,
      y: 88,
    },
  );

  EggHatchComp.pendingCharacterKey[characterEid] = CharacterKeyECS.SoilSlimeA1;

  assert.deepEqual(world.getMainCharacterInfoSnapshot()?.geneOutcomes, [
    {
      kind: "hatch",
      geneLine: "green-slime",
      level: 1,
      probability: 0,
    },
    {
      kind: "hatch",
      geneLine: "soil-slime",
      level: 1,
      probability: 1,
    },
    {
      kind: "hatch",
      geneLine: "skull-slime",
      level: 1,
      probability: 0,
    },
  ]);
});

test("비알 상태 info snapshot은 현재 gene 다음 레벨과 mutation row를 반환한다", () => {
  const world = createMainSceneWorldForTest();
  const characterEid = createTestCharacter(
    world as unknown as Parameters<typeof createTestCharacter>[0],
    {
      characterKey: CharacterKeyECS.GreenSlimeA1,
      state: CharacterState.IDLE,
      x: 90,
      y: 120,
    },
  );

  MutationRiskComp.unnecessaryInjectionStacks[characterEid] = 2;
  MutationRiskComp.dirtyExposureStacks[characterEid] = 1;

  assert.deepEqual(world.getMainCharacterInfoSnapshot()?.geneOutcomes, [
    {
      kind: "evolution",
      geneLine: "green-slime",
      level: 2,
      probability: 0.9750000000000001,
    },
    {
      kind: "mutation",
      geneLine: "soil-slime",
      level: 1,
      probability: 0.0125,
    },
    {
      kind: "mutation",
      geneLine: "skull-slime",
      level: 1,
      probability: 0.0125,
    },
  ]);
});

test("최종 단계 캐릭터 info snapshot은 gene 확률 목록을 빈 배열로 반환한다", () => {
  const world = createMainSceneWorldForTest();

  createTestCharacter(
    world as unknown as Parameters<typeof createTestCharacter>[0],
    {
      characterKey: CharacterKeyECS.GreenSlimeD1,
      state: CharacterState.IDLE,
      x: 90,
      y: 120,
    },
  );

  assert.deepEqual(world.getMainCharacterInfoSnapshot()?.geneOutcomes, []);
});
