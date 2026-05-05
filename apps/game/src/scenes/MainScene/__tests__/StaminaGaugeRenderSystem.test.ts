import assert from "node:assert/strict";
import test from "node:test";
import { createWorld } from "bitecs";
import * as PIXI from "pixi.js";
import { MainSceneWorld } from "../world";
import {
  cleanupStaminaGaugeRenderState,
  getStaminaGaugeFillRowSpanForTests,
  getStaminaGaugeFillColorForTests,
  getStaminaGaugeRoundedRowSpanForTests,
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

test("상단 스태미나 게이지 색상은 3과 7 경계에 맞춰 바뀐다", () => {
  assert.equal(getStaminaGaugeFillColorForTests(2.99), 0xe2554b);
  assert.equal(getStaminaGaugeFillColorForTests(3), 0xf2a33a);
  assert.equal(getStaminaGaugeFillColorForTests(6.99), 0xf2a33a);
  assert.equal(getStaminaGaugeFillColorForTests(7), 0x58b86b);
});

test("상단 스태미나 게이지 bevel row span은 상하 대칭이다", () => {
  const topEdge = getStaminaGaugeRoundedRowSpanForTests(40, 8, 2, 2, 0);
  const upperMiddle = getStaminaGaugeRoundedRowSpanForTests(40, 8, 2, 2, 1);
  const lowerMiddle = getStaminaGaugeRoundedRowSpanForTests(40, 8, 2, 2, 6);
  const bottomEdge = getStaminaGaugeRoundedRowSpanForTests(40, 8, 2, 2, 7);

  assert.deepEqual(topEdge, { startX: 2, endX: 38 });
  assert.deepEqual(upperMiddle, { startX: 1, endX: 39 });
  assert.deepEqual(lowerMiddle, upperMiddle);
  assert.deepEqual(bottomEdge, topEdge);
});

test("상단 스태미나 게이지 fill은 부분 채움일 때 오른쪽 bevel 없이 유지된다", () => {
  const partialTopEdge = getStaminaGaugeFillRowSpanForTests(10, 20, 8, 0);
  const partialBottomEdge = getStaminaGaugeFillRowSpanForTests(10, 20, 8, 7);
  const fullTopEdge = getStaminaGaugeFillRowSpanForTests(20, 20, 8, 0);
  const fullBottomEdge = getStaminaGaugeFillRowSpanForTests(20, 20, 8, 7);

  assert.deepEqual(partialTopEdge, { startX: 2, endX: 10 });
  assert.deepEqual(partialBottomEdge, partialTopEdge);
  assert.deepEqual(fullTopEdge, { startX: 2, endX: 18 });
  assert.deepEqual(fullBottomEdge, fullTopEdge);
});
