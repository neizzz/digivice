import assert from "node:assert/strict";
import test from "node:test";
import { createWorld } from "bitecs";
import * as PIXI from "pixi.js";
import { CharacterStatusComp } from "../raw-components";
import {
  cleanupStatusIconRenderStateForTests,
  statusIconRenderSystem,
} from "../systems/StatusIconRenderSystem";
import { CharacterState, CharacterStatus } from "../types";
import { MainSceneWorld } from "../world";
import { createTestCharacter } from "../../../test-utils/mainSceneTestUtils";

const STATUS_ICON_SIZE = 16 * 1.8;
const POSITION_BOUNDARY_TOP = 20;

function createMainSceneWorldForTest(): MainSceneWorld {
  const world = new MainSceneWorld({
    stage: new PIXI.Container(),
    positionBoundary: {
      x: 0,
      y: POSITION_BOUNDARY_TOP,
      width: 320,
      height: 320,
    },
  });

  createWorld(world, 100);

  return world;
}

function withMockedStatusIconSprites<T>(fn: () => T): T {
  const originalGet = PIXI.Assets.get.bind(PIXI.Assets);
  const dummySpritesheet = {
    textures: {
      sick: PIXI.Texture.WHITE,
      urgent: PIXI.Texture.WHITE,
      happy: PIXI.Texture.WHITE,
      discover: PIXI.Texture.WHITE,
    },
  } as unknown as PIXI.Spritesheet;

  (PIXI.Assets as typeof PIXI.Assets & { get: typeof PIXI.Assets.get }).get = ((
    key: string,
  ) => {
    if (key === "common16x16") {
      return dummySpritesheet;
    }

    return originalGet(key);
  }) as typeof PIXI.Assets.get;

  try {
    return fn();
  } finally {
    (PIXI.Assets as typeof PIXI.Assets & { get: typeof PIXI.Assets.get }).get =
      originalGet;
    cleanupStatusIconRenderStateForTests();
  }
}

function getOnlyStatusIconSprite(world: MainSceneWorld): PIXI.Sprite {
  assert.equal(world.stage.children.length, 1);

  const sprite = world.stage.children[0];

  assert.ok(sprite instanceof PIXI.Sprite);
  return sprite;
}

test("상단 근처의 지속 상태 아이콘은 게이지 영역까지 올라갈 수 있도록 0 기준으로 clamp된다", () => {
  withMockedStatusIconSprites(() => {
    const world = createMainSceneWorldForTest();
    const eid = createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.IDLE,
        x: 80,
        y: 30,
      },
    );

    CharacterStatusComp.statuses[eid][0] = CharacterStatus.SICK;

    statusIconRenderSystem({
      world,
      delta: 16,
    });

    const sprite = getOnlyStatusIconSprite(world);
    assert.equal(sprite.x, 80);
    assert.equal(sprite.y, 0);
  });
});

test("상단 근처의 일시 상태 아이콘은 게이지 영역까지 올라갈 수 있도록 0 기준으로 clamp된다", () => {
  withMockedStatusIconSprites(() => {
    const world = createMainSceneWorldForTest();
    const eid = createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.IDLE,
        x: 80,
        y: 30,
      },
    );

    CharacterStatusComp.statuses[eid][0] = CharacterStatus.HAPPY;

    statusIconRenderSystem({
      world,
      delta: 16,
    });

    const sprite = getOnlyStatusIconSprite(world);
    assert.equal(sprite.x, 105);
    assert.equal(sprite.y, 0);
  });
});

test("상단 여유가 충분하면 상태 아이콘은 기존 위치를 유지한다", () => {
  withMockedStatusIconSprites(() => {
    const world = createMainSceneWorldForTest();
    const eid = createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.IDLE,
        x: 80,
        y: 120,
      },
    );

    CharacterStatusComp.statuses[eid][0] = CharacterStatus.SICK;

    statusIconRenderSystem({
      world,
      delta: 16,
    });

    const sprite = getOnlyStatusIconSprite(world);

    assert.equal(sprite.y, 70);
  });
});
