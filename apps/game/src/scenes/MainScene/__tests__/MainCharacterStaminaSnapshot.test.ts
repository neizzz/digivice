import assert from "node:assert/strict";
import test from "node:test";
import { createWorld } from "bitecs";
import * as PIXI from "pixi.js";
import { GAME_CONSTANTS } from "../config";
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
    unhappyThreshold: GAME_CONSTANTS.UNHAPPY_STAMINA_THRESHOLD,
    boostedThreshold: GAME_CONSTANTS.BOOSTED_STAMINA_THRESHOLD,
  });
});

test("메인 캐릭터가 없으면 스테미나 snapshot은 null이다", () => {
  const world = createMainSceneWorldForTest();

  assert.equal(world.getMainCharacterStaminaSnapshot(), null);
});
