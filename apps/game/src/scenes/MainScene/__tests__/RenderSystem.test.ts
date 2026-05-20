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
    RenderComp.storeIndex[foodEid] = foodEid;
    RenderComp.textureKey[foodEid] = TextureKey.FOOD1;
    RenderComp.scale[foodEid] = 1.4;
    RenderComp.zIndex[foodEid] = 0;
    FoodMaskComp.progress[foodEid] = 0;
    FoodMaskComp.isInitialized[foodEid] = 0;
    FoodMaskComp.maskStoreIndex[foodEid] = 0;

    const foodSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
    foodSprite.anchor.set(0.5);
    foodSprite.width = 44.8;
    foodSprite.height = 44.8;
    world.stage.addChild(foodSprite);
    getSpriteStore().set(foodEid, foodSprite);

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
    assert.match(
      initializationLogs[0][0] as string,
      /size=\d+(\.\d+)?x\d+(\.\d+)?/,
    );
    assert.match(initializationLogs[0][0] as string, /worldTime=123456/);
    assert.ok(calls.every((args) => args.length === 1));
  }));
