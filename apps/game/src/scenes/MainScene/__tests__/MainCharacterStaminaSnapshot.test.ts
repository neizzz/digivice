import assert from "node:assert/strict";
import test from "node:test";
import { createWorld } from "bitecs";
import * as PIXI from "pixi.js";
import { GAME_CONSTANTS } from "../config";
import { EVOLUTION_GAUGE_CONFIG } from "../evolutionConfig";
import { CharacterStatusComp, EggHatchComp } from "../raw-components";
import { CharacterState } from "../types";
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
