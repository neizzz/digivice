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
        circleRadius: radius,
        ...options,
      }) as never,
    addToEngine: () => undefined,
    setPosition: (body: { position: { x: number; y: number } }, position: { x: number; y: number }) => {
      body.position = { ...position };
    },
    setVelocity: (body: { velocity?: { x: number; y: number } }, velocity: { x: number; y: number }) => {
      body.velocity = { ...velocity };
    },
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

test("ground 충돌 보정은 basket이 ground top 아래로 내려간 경우에만 다시 올린다", () => {
  const { assets } = createGameAssets();

  withMockedAssets(assets, () => {
    const physicsManager = createMockPhysicsManager();
    const playerManager = new PlayerManager(
      {
        screen: {
          width: 320,
          height: 480,
        },
      } as PIXI.Application,
      physicsManager as never,
      CharacterKey.TestGreenSlimeA1,
      CharacterState.IDLE,
    );

    const basketBody = playerManager.getBasketBody() as {
      position: { x: number; y: number };
      velocity?: { x: number; y: number };
      circleRadius: number;
    };
    basketBody.position.y = 470;

    playerManager.clampBasketBottomTo(464);

    assert.equal(basketBody.position.y, 442);
    assert.deepEqual(basketBody.velocity, { x: 0, y: 0 });

    basketBody.position.y = 430;
    playerManager.clampBasketBottomTo(464);
    assert.equal(basketBody.position.y, 430);
  });
});

test("last stable bird position snapshot은 update 시점의 bird 표시 좌표를 유지한다", () => {
  const { assets } = createGameAssets();

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

    playerManager.getBasket().position.set(120, 200);
    playerManager.update();

    const snapshot = playerManager.getLastStableBirdPositionSnapshot();

    assert.deepEqual(snapshot, {
      x: 124.4,
      y: 160.4,
    });
  });
});
