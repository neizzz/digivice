import assert from "node:assert/strict";
import test from "node:test";
import { createWorld } from "bitecs";
import * as PIXI from "pixi.js";
import { MainSceneWorld } from "../world";
import {
  cleanupStaminaGaugeRenderState,
  staminaGaugeRenderSystem,
} from "../systems/StaminaGaugeRenderSystem";
import { CharacterState } from "../types";
import { createTestCharacter } from "../../../test-utils/mainSceneTestUtils";

function createMainSceneWorldForTest(): MainSceneWorld {
  const world = new MainSceneWorld({
    stage: new PIXI.Container(),
    positionBoundary: {
      x: 14,
      y: 20,
      width: 292,
      height: 286,
    },
  });

  createWorld(world, 100);
  world.stage.sortableChildren = true;

  return world;
}

function withCleanedGaugeState<T>(fn: () => T): T {
  try {
    return fn();
  } finally {
    cleanupStaminaGaugeRenderState();
  }
}

test("상단 스태미나 게이지는 배경보다 앞이고 캐릭터/상태 아이콘보다 뒤에 렌더링된다", () => {
  withCleanedGaugeState(() => {
    const world = createMainSceneWorldForTest();

    createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.IDLE,
        stamina: 6.5,
        x: 90,
        y: 120,
      },
    );

    const background = new PIXI.Sprite(PIXI.Texture.WHITE);
    background.zIndex = 0;
    world.stage.addChild(background);

    const characterSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
    characterSprite.zIndex = world.positionBoundary.y;
    world.stage.addChild(characterSprite);

    const statusIconSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
    statusIconSprite.zIndex = world.positionBoundary.y;
    world.stage.addChild(statusIconSprite);

    staminaGaugeRenderSystem({
      world,
      delta: 16,
    });

    const gauge = world.stage.children[world.stage.children.length - 1];

    assert.ok(gauge instanceof PIXI.Container);
    assert.equal(gauge.x, 0);
    assert.equal(gauge.y, 0);
    assert.equal(gauge.children.length, 2);
    assert.ok(gauge.children.every((child) => child instanceof PIXI.Graphics));

    world.stage.sortChildren();

    const backgroundIndex = world.stage.getChildIndex(background);
    const gaugeIndex = world.stage.getChildIndex(gauge);
    const characterIndex = world.stage.getChildIndex(characterSprite);
    const statusIconIndex = world.stage.getChildIndex(statusIconSprite);

    assert.ok(backgroundIndex < gaugeIndex);
    assert.ok(gaugeIndex < characterIndex);
    assert.ok(gaugeIndex < statusIconIndex);
  });
});