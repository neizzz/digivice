import assert from "node:assert/strict";
import test from "node:test";
import * as PIXI from "pixi.js";
import { CharacterState } from "../../MainScene/types";
import { PlayerManager } from "../gameLogic";
import { CharacterKey } from "../../../types/Character";
import { AssetLoader, type GameAssets } from "../../../utils/AssetLoader";

function createTexture(): PIXI.Texture {
  return new PIXI.Texture(PIXI.Texture.WHITE.source);
}

function createGameAssets(): {
  assets: GameAssets;
  inBasketTexture: PIXI.Texture;
  tombInBasketTexture: PIXI.Texture;
} {
  const inBasketTexture = createTexture();
  const tombInBasketTexture = createTexture();

  return {
    assets: {
      birdSprites: {
        animations: {
          fly: [createTexture()],
        },
      } as unknown as PIXI.Spritesheet,
      common32x32Sprites: {
        textures: {
          "tomb-in-basket": tombInBasketTexture,
        },
      } as unknown as PIXI.Spritesheet,
      characterSprites: {
        [CharacterKey.TestGreenSlimeA1]: {
          textures: {
            "in-basket": inBasketTexture,
          },
        } as unknown as PIXI.Spritesheet,
      },
    },
    inBasketTexture,
    tombInBasketTexture,
  };
}

function withMockedAssets<T>(
  assets: GameAssets,
  fn: () => T,
): T {
  const originalGetAssets = AssetLoader.getAssets;
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

  AssetLoader.getAssets = () => assets;
  globalThis.requestAnimationFrame = (() => 1) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = (() => undefined) as typeof cancelAnimationFrame;

  try {
    return fn();
  } finally {
    AssetLoader.getAssets = originalGetAssets;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  }
}

function createMockPhysicsManager() {
  return {
    createCircleBody: (x: number, y: number, radius: number, options: object) =>
      ({
        position: { x, y },
        radius,
        ...options,
      }) as never,
    addToEngine: () => undefined,
  };
}

test("dead 상태로 FlappyBird에 진입하면 tomb-in-basket 텍스처를 사용한다", () => {
  const { assets, tombInBasketTexture } = createGameAssets();

  withMockedAssets(assets, () => {
    const playerManager = new PlayerManager(
      {
        screen: {
          width: 320,
          height: 480,
        },
      } as PIXI.Application,
      createMockPhysicsManager() as never,
      CharacterKey.TestGreenSlimeA1,
      CharacterState.DEAD,
    );

    assert.equal(playerManager.getBasket().texture, tombInBasketTexture);
  });
});

test("dead가 아닌 상태로 FlappyBird에 진입하면 기존 in-basket 텍스처를 유지한다", () => {
  const { assets, inBasketTexture } = createGameAssets();

  withMockedAssets(assets, () => {
    const playerManager = new PlayerManager(
      {
        screen: {
          width: 320,
          height: 480,
        },
      } as PIXI.Application,
      createMockPhysicsManager() as never,
      CharacterKey.TestGreenSlimeA1,
      CharacterState.IDLE,
    );

    assert.equal(playerManager.getBasket().texture, inBasketTexture);
  });
});
