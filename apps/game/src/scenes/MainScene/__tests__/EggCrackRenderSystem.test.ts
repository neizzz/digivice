import assert from "node:assert/strict";
import test from "node:test";
import { addEntity, createWorld } from "bitecs";
import * as PIXI from "pixi.js";
import {
  getDefaultEggHatchDurationMs,
  getEggCrackStage,
  getEggHatchProgress,
} from "../config";
import {
  applySavedEntityToECS,
  convertECSEntityToSavedEntity,
} from "../entityDataHelpers";
import { EggHatchComp, ObjectComp } from "../raw-components";
import {
  cleanupEggCrackRenderState,
  eggCrackRenderSystem,
} from "../systems/EggCrackRenderSystem";
import { getSpriteStore } from "../systems/RenderSystem";
import { CharacterState } from "../types";
import { MainSceneWorld } from "../world";
import {
  createTestCharacter,
  createTestWorld,
  withMockedDateNow,
} from "../../../test-utils/mainSceneTestUtils";

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

function cleanupSpriteStore(): void {
  const spriteStore = getSpriteStore();
  spriteStore.forEach((sprite) => {
    sprite.removeFromParent();
    sprite.destroy();
  });
  spriteStore.clear();
}

function withCleanedEggCrackState<T>(fn: () => T): T {
  try {
    return fn();
  } finally {
    cleanupEggCrackRenderState();
    cleanupSpriteStore();
  }
}

function attachEggSprite(
  world: MainSceneWorld,
  eid: number,
  options?: {
    x?: number;
    y?: number;
    zIndex?: number;
  },
): PIXI.Sprite {
  const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
  const localBounds = new PIXI.Rectangle(-16, -16, 32, 32);

  sprite.anchor.set(0.5);
  sprite.position.set(options?.x ?? 80, options?.y ?? 120);
  sprite.scale.set(3);
  sprite.zIndex = options?.zIndex ?? 120;
  sprite.getLocalBounds = (() =>
    localBounds as unknown as PIXI.Bounds) as typeof sprite.getLocalBounds;

  world.stage.addChild(sprite);
  getSpriteStore().set(eid, sprite);
  return sprite;
}

function getEggCrackOverlay(
  world: MainSceneWorld,
  baseSprite: PIXI.Sprite,
): PIXI.Container {
  const overlay = world.stage.children.find((child) => child !== baseSprite);

  assert.ok(overlay instanceof PIXI.Container);
  return overlay;
}

test("egg hatch progress와 crack stage는 임계값에 맞춰 clamp된다", () => {
  assert.equal(
    getEggHatchProgress({
      currentTime: -100,
      hatchTime: 1_000,
      hatchDurationMs: 1_000,
    }),
    0,
  );
  assert.equal(
    getEggHatchProgress({
      currentTime: 1_500,
      hatchTime: 1_000,
      hatchDurationMs: 1_000,
    }),
    1,
  );
  assert.equal(getEggCrackStage(0.59), 0);
  assert.equal(getEggCrackStage(0.6), 1);
  assert.equal(getEggCrackStage(0.8), 2);
  assert.equal(getEggCrackStage(0.92), 3);
  assert.equal(
    getEggHatchProgress({
      currentTime: 500,
      hatchTime: 1_000,
      hatchDurationMs: 1_000,
    }),
    0.5,
  );
});

test("egg crack overlay는 진행도에 따라 생성되고 egg 위 zIndex로 렌더링된다", () => {
  withCleanedEggCrackState(() => {
    const world = createMainSceneWorldForTest();
    const eid = createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.EGG,
        x: 80,
        y: 120,
      },
    );
    const baseSprite = attachEggSprite(world, eid, {
      x: 80,
      y: 120,
      zIndex: 120,
    });

    EggHatchComp.hatchTime[eid] = 1_000;
    EggHatchComp.hatchDurationMs[eid] = 1_000;

    eggCrackRenderSystem({
      world,
      delta: 16,
      currentTime: 850,
    });

    assert.equal(world.stage.children.length, 2);

    const overlay = getEggCrackOverlay(world, baseSprite);
    const mask = overlay.children[1];
    const crack = overlay.children[0];

    assert.equal(overlay.x, 80);
    assert.equal(overlay.y, 120);
    assert.equal(overlay.zIndex, 120.5);
    assert.ok(overlay.mask);
    assert.ok(mask instanceof PIXI.Sprite);
    assert.ok(crack instanceof PIXI.Graphics);
  });
});

test("egg crack overlay는 frame bounds 안에 머물고 stage 0 또는 non-egg에서 제거된다", () => {
  withCleanedEggCrackState(() => {
    const world = createMainSceneWorldForTest();
    const eid = createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.EGG,
      },
    );
    const baseSprite = attachEggSprite(world, eid);

    EggHatchComp.hatchTime[eid] = 1_000;
    EggHatchComp.hatchDurationMs[eid] = 1_000;

    eggCrackRenderSystem({
      world,
      delta: 16,
      currentTime: 950,
    });

    const overlay = getEggCrackOverlay(world, baseSprite);
    const crack = overlay.children[0] as PIXI.Graphics;
    const mask = overlay.children[1] as PIXI.Sprite;
    const crackBounds = crack.getLocalBounds();
    const eggBounds = baseSprite.getLocalBounds();

    assert.ok(mask instanceof PIXI.Sprite);
    assert.ok(crackBounds.x >= eggBounds.x);
    assert.ok(crackBounds.y >= eggBounds.y);
    assert.ok(
      crackBounds.x + crackBounds.width <= eggBounds.x + eggBounds.width,
    );
    assert.ok(
      crackBounds.y + crackBounds.height <= eggBounds.y + eggBounds.height,
    );

    eggCrackRenderSystem({
      world,
      delta: 16,
      currentTime: 100,
    });

    assert.equal(world.stage.children.length, 1);

    ObjectComp.state[eid] = CharacterState.IDLE;
    eggCrackRenderSystem({
      world,
      delta: 16,
      currentTime: 950,
    });

    assert.equal(world.stage.children.length, 1);
  });
});

test("egg hatch duration은 저장과 복원 시 round-trip된다", () => {
  const world = createTestWorld({ now: 0 });
  const eid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.EGG,
    }),
  );

  EggHatchComp.hatchTime[eid] = 4_000;
  EggHatchComp.hatchDurationMs[eid] = 1_234;

  const saved = convertECSEntityToSavedEntity(world, eid);
  assert.equal(saved.components.eggHatch?.hatchDurationMs, 1_234);

  const restoredWorld = createTestWorld({ now: 0 });
  const restoredEid = addEntity(restoredWorld);
  applySavedEntityToECS(restoredWorld, restoredEid, saved);

  assert.equal(EggHatchComp.hatchTime[restoredEid], 4_000);
  assert.equal(EggHatchComp.hatchDurationMs[restoredEid], 1_234);
});

test("legacy egg save에 hatchDurationMs가 없어도 기본 duration으로 복원된다", () => {
  const world = createTestWorld({ now: 0 });
  const eid = addEntity(world);

  applySavedEntityToECS(world, eid, {
    components: {
      object: {
        id: 100,
        type: 1,
        state: CharacterState.EGG,
      },
      eggHatch: {
        hatchTime: 5_000,
        isReadyToHatch: false,
      },
    },
  });

  assert.equal(EggHatchComp.hatchTime[eid], 5_000);
  assert.equal(
    EggHatchComp.hatchDurationMs[eid],
    getDefaultEggHatchDurationMs(),
  );
});
