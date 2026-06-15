import assert from "node:assert/strict";
import test from "node:test";
import { addComponent, addEntity } from "bitecs";
import * as PIXI from "pixi.js";
import {
  FoodMaskComp,
  ObjectComp,
  PositionComp,
  RenderComp,
} from "../raw-components";
import {
  cleanupRenderSystemState,
  getSpriteStore,
  renderSystem,
} from "../systems/RenderSystem";
import { FoodState, ObjectType, TextureKey } from "../types";
import { createTestWorld } from "../../../test-utils/mainSceneTestUtils";

function withCleanedRenderSystemState<T>(fn: () => T): T {
  try {
    return fn();
  } finally {
    cleanupRenderSystemState();
  }
}

function createTexture(width: number, height: number): PIXI.Texture {
  return new PIXI.Texture({
    source: new PIXI.TextureSource({ width, height }),
  });
}

test("food mask 초기화 로그는 거대 PIXI 객체 대신 1줄 요약만 남긴다", () =>
  withCleanedRenderSystemState(() => {
    const world = createTestWorld({ now: 123_456 }) as ReturnType<
      typeof createTestWorld
    > & {
      stage: PIXI.Container;
      consumePendingFirstSpriteTimingLog: () => null;
    };
    world.stage = new PIXI.Container();
    world.consumePendingFirstSpriteTimingLog = () => null;

    const staleStoreEid = addEntity(world);
    const foodEid = addEntity(world);
    addComponent(world, ObjectComp, foodEid);
    addComponent(world, PositionComp, foodEid);
    addComponent(world, RenderComp, foodEid);
    addComponent(world, FoodMaskComp, foodEid);

    ObjectComp.id[foodEid] = 10_000 + foodEid;
    ObjectComp.type[foodEid] = ObjectType.FOOD;
    ObjectComp.state[foodEid] = FoodState.BEING_INTAKEN;
    PositionComp.x[foodEid] = 120;
    PositionComp.y[foodEid] = 180;
    RenderComp.storeIndex[foodEid] = staleStoreEid;
    RenderComp.textureKey[foodEid] = TextureKey.FOOD1;
    RenderComp.scale[foodEid] = 1.4;
    RenderComp.zIndex[foodEid] = 0;
    FoodMaskComp.progress[foodEid] = 0;
    FoodMaskComp.isInitialized[foodEid] = 0;
    FoodMaskComp.maskStoreIndex[foodEid] = 0;

    const foodTexture = createTexture(32, 32);
    const foodSprite = new PIXI.Sprite(foodTexture);
    foodSprite.anchor.set(0.5);
    foodSprite.scale.set(1.4);
    world.stage.addChild(foodSprite);
    getSpriteStore().set(foodEid, foodSprite);
    const staleSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
    staleSprite.width = 8;
    staleSprite.height = 8;
    getSpriteStore().set(staleStoreEid, staleSprite);

    const fakeMaskTextures = Object.fromEntries(
      ["vite-mask_0", "vite-mask_1", "vite-mask_2", "vite-mask_3", "vite-mask_4"].map(
        (name) => [name, PIXI.Texture.WHITE],
      ),
    );
    const originalAssetsGet = PIXI.Assets.get;
    PIXI.Assets.get = ((key: string) => {
      if (key === "vite-food-mask") {
        return {
          textures: fakeMaskTextures,
        } as unknown as PIXI.Spritesheet;
      }
      if (key === "foods") {
        return {
          textures: {
            food_apple: foodTexture,
          },
        } as unknown as PIXI.Spritesheet;
      }
      return originalAssetsGet.call(PIXI.Assets, key);
    }) as typeof PIXI.Assets.get;

    const originalConsoleLog = console.log;
    const calls: unknown[][] = [];
    console.log = (...args: unknown[]) => {
      calls.push(args);
    };

    try {
      renderSystem({
        world: world as any,
        delta: 16,
      });
    } finally {
      console.log = originalConsoleLog;
      PIXI.Assets.get = originalAssetsGet;
    }

    const initializationLogs = calls.filter(
      (args) =>
        typeof args[0] === "string" &&
        args[0].includes("[RenderSystem] Initialized food mask for entity"),
    );

    assert.equal(initializationLogs.length, 1);
    assert.match(initializationLogs[0][0] as string, /progress=0\.00/);
    assert.match(initializationLogs[0][0] as string, /size=44\.8x44\.8/);
    assert.match(initializationLogs[0][0] as string, /worldTime=123456/);
    assert.ok(calls.every((args) => args.length === 1));

    const maskSprite = foodSprite.mask as PIXI.Sprite | null;
    assert.ok(maskSprite instanceof PIXI.Sprite);
    assert.equal(maskSprite.width, foodSprite.width);
    assert.equal(maskSprite.height, foodSprite.height);
  }));

test("food mask는 texture 업데이트 뒤에도 실제 food sprite 크기로 다시 동기화된다", () =>
  withCleanedRenderSystemState(() => {
    const world = createTestWorld({ now: 123_456 }) as ReturnType<
      typeof createTestWorld
    > & {
      stage: PIXI.Container;
      consumePendingFirstSpriteTimingLog: () => null;
    };
    world.stage = new PIXI.Container();
    world.consumePendingFirstSpriteTimingLog = () => null;

    const foodEid = addEntity(world);
    addComponent(world, ObjectComp, foodEid);
    addComponent(world, PositionComp, foodEid);
    addComponent(world, RenderComp, foodEid);
    addComponent(world, FoodMaskComp, foodEid);

    ObjectComp.id[foodEid] = 20_000 + foodEid;
    ObjectComp.type[foodEid] = ObjectType.FOOD;
    ObjectComp.state[foodEid] = FoodState.BEING_INTAKEN;
    PositionComp.x[foodEid] = 120;
    PositionComp.y[foodEid] = 180;
    RenderComp.storeIndex[foodEid] = ECS_NULL_VALUE;
    RenderComp.textureKey[foodEid] = TextureKey.FOOD1;
    RenderComp.scale[foodEid] = 1.4;
    RenderComp.zIndex[foodEid] = 0;
    FoodMaskComp.progress[foodEid] = 0;
    FoodMaskComp.isInitialized[foodEid] = 0;
    FoodMaskComp.maskStoreIndex[foodEid] = ECS_NULL_VALUE;

    const foodTexture = createTexture(32, 32);
    const maskFrameTextures = {
      "vite-mask_0": createTexture(1, 1),
      "vite-mask_1": createTexture(1, 1),
      "vite-mask_2": createTexture(1, 1),
      "vite-mask_3": createTexture(1, 1),
      "vite-mask_4": createTexture(16, 16),
    };
    const originalAssetsGet = PIXI.Assets.get;
    PIXI.Assets.get = ((key: string) => {
      if (key === "vite-food-mask") {
        return {
          textures: maskFrameTextures,
        } as unknown as PIXI.Spritesheet;
      }
      if (key === "foods") {
        return {
          textures: {
            food_apple: foodTexture,
          },
        } as unknown as PIXI.Spritesheet;
      }
      return originalAssetsGet.call(PIXI.Assets, key);
    }) as typeof PIXI.Assets.get;

    const originalConsoleLog = console.log;
    console.log = () => {};

    try {
      renderSystem({
        world: world as any,
        delta: 16,
      });

      const foodSprite = getSpriteStore().get(foodEid);
      assert.ok(foodSprite);
      const maskSprite = foodSprite.mask as PIXI.Sprite | null;
      assert.ok(maskSprite instanceof PIXI.Sprite);
      assert.equal(maskSprite.width, foodSprite.width);
      assert.equal(maskSprite.height, foodSprite.height);

      RenderComp.scale[foodEid] = 2;
      FoodMaskComp.progress[foodEid] = 0.9;

      renderSystem({
        world: world as any,
        delta: 16,
      });

      assert.equal(foodSprite.width, 64);
      assert.equal(foodSprite.height, 64);
      assert.equal(maskSprite.width, 64);
      assert.equal(maskSprite.height, 64);
    } finally {
      console.log = originalConsoleLog;
      PIXI.Assets.get = originalAssetsGet;
    }
  }));
