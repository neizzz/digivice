import assert from "node:assert/strict";
import test from "node:test";
import { addComponent, addEntity } from "bitecs";
import * as PIXI from "pixi.js";
import { CleanableComp, PositionComp, RenderComp } from "../raw-components";
import {
  cleanupCleanableRenderSystem,
  cleanableRenderSystem,
  getBroomStore,
  getCleaningDimOverlay,
  getDashedBorderStore,
} from "../systems/CleanableRenderSystem";
import { getSpriteStore } from "../systems/RenderSystem";
import type { MainSceneWorld } from "../world";
import {
  createTestWorld,
  type TestWorld,
} from "../../../test-utils/mainSceneTestUtils";

type CleanableRenderTestWorld = TestWorld & {
  stage: PIXI.Container;
  _isCleaningMode: boolean;
  _focusedTargetEid: number;
  _sliderValue: number;
  isCleaningMode: boolean;
  focusedTargetEid: number;
  sliderValue: number;
};

type CapturedStrokeStyle = {
  width: number;
  color: number;
};

type GraphicsCallCounts = {
  clear: number;
  drawRect: number;
};

type CapturedGraphicsBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function createCleanableRenderWorld(): CleanableRenderTestWorld {
  const world = createTestWorld() as CleanableRenderTestWorld;

  world.stage = new PIXI.Container();
  world.stage.sortableChildren = true;
  world._isCleaningMode = false;
  world._focusedTargetEid = -1;
  world._sliderValue = 0.5;

  Object.defineProperty(world, "isCleaningMode", {
    configurable: true,
    enumerable: true,
    get() {
      return world._isCleaningMode;
    },
  });

  Object.defineProperty(world, "focusedTargetEid", {
    configurable: true,
    enumerable: true,
    get() {
      return world._focusedTargetEid;
    },
  });

  Object.defineProperty(world, "sliderValue", {
    configurable: true,
    enumerable: true,
    get() {
      return world._sliderValue;
    },
  });

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

function withMockedBroomTexture<T>(fn: () => T): T {
  const originalGet = PIXI.Assets.get.bind(PIXI.Assets);
  const dummySpritesheet = {
    textures: {
      broom: PIXI.Texture.WHITE,
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
  }
}

function withCapturedStrokeStyles<T>(
  fn: (styles: WeakMap<PIXI.Graphics, CapturedStrokeStyle>) => T,
): T {
  const styles = new WeakMap<PIXI.Graphics, CapturedStrokeStyle>();
  const originalSetStrokeStyle = PIXI.Graphics.prototype.setStrokeStyle;

  PIXI.Graphics.prototype.setStrokeStyle = function patchedSetStrokeStyle(
    this: PIXI.Graphics,
    style: Parameters<typeof originalSetStrokeStyle>[0],
  ) {
    if (style && typeof style === "object") {
      const strokeStyle = style as {
        width?: number;
        color?: number;
      };

      styles.set(this, {
        width: strokeStyle.width ?? 0,
        color: strokeStyle.color ?? 0,
      });
    }

    return originalSetStrokeStyle.call(this, style);
  };

  try {
    return fn(styles);
  } finally {
    PIXI.Graphics.prototype.setStrokeStyle = originalSetStrokeStyle;
  }
}

function withGraphicsCallCounts<T>(
  fn: (counts: GraphicsCallCounts) => T,
): T {
  const counts: GraphicsCallCounts = {
    clear: 0,
    drawRect: 0,
  };
  const originalClear = PIXI.Graphics.prototype.clear;
  const originalDrawRect = PIXI.Graphics.prototype.drawRect;

  PIXI.Graphics.prototype.clear = function patchedClear(this: PIXI.Graphics) {
    counts.clear += 1;
    return originalClear.call(this);
  };
  PIXI.Graphics.prototype.drawRect = function patchedDrawRect(
    this: PIXI.Graphics,
    ...args: Parameters<typeof originalDrawRect>
  ) {
    counts.drawRect += 1;
    return originalDrawRect.apply(this, args);
  };

  try {
    return fn(counts);
  } finally {
    PIXI.Graphics.prototype.clear = originalClear;
    PIXI.Graphics.prototype.drawRect = originalDrawRect;
  }
}

function withCapturedGraphicsBounds<T>(
  fn: (boundsByGraphics: WeakMap<PIXI.Graphics, CapturedGraphicsBounds>) => T,
): T {
  const boundsByGraphics = new WeakMap<PIXI.Graphics, CapturedGraphicsBounds>();
  const originalMoveTo = PIXI.Graphics.prototype.moveTo;
  const originalLineTo = PIXI.Graphics.prototype.lineTo;
  const originalClear = PIXI.Graphics.prototype.clear;

  const capturePoint = (graphics: PIXI.Graphics, x: number, y: number) => {
    const previous = boundsByGraphics.get(graphics);
    boundsByGraphics.set(graphics, {
      minX: previous ? Math.min(previous.minX, x) : x,
      minY: previous ? Math.min(previous.minY, y) : y,
      maxX: previous ? Math.max(previous.maxX, x) : x,
      maxY: previous ? Math.max(previous.maxY, y) : y,
    });
  };

  PIXI.Graphics.prototype.moveTo = function patchedMoveTo(
    this: PIXI.Graphics,
    x: number,
    y: number,
  ) {
    capturePoint(this, x, y);
    return originalMoveTo.call(this, x, y);
  };
  PIXI.Graphics.prototype.lineTo = function patchedLineTo(
    this: PIXI.Graphics,
    x: number,
    y: number,
  ) {
    capturePoint(this, x, y);
    return originalLineTo.call(this, x, y);
  };
  PIXI.Graphics.prototype.clear = function patchedClear(this: PIXI.Graphics) {
    boundsByGraphics.delete(this);
    return originalClear.call(this);
  };

  try {
    return fn(boundsByGraphics);
  } finally {
    PIXI.Graphics.prototype.moveTo = originalMoveTo;
    PIXI.Graphics.prototype.lineTo = originalLineTo;
    PIXI.Graphics.prototype.clear = originalClear;
  }
}

function withCleanableRenderHarness<T>(
  fn: (context: {
    world: CleanableRenderTestWorld;
    strokeStyles: WeakMap<PIXI.Graphics, CapturedStrokeStyle>;
  }) => T,
): T {
  return withMockedBroomTexture(() =>
    withCapturedStrokeStyles((strokeStyles) => {
      const world = createCleanableRenderWorld();

      try {
        return fn({ world, strokeStyles });
      } finally {
        cleanupCleanableRenderSystem(world.stage);
        cleanupSpriteStore();
      }
    }),
  );
}

function createCleanableEntity(
  world: CleanableRenderTestWorld,
  options: {
    x: number;
    y: number;
    zIndex?: number;
    texture?: PIXI.Texture;
    scale?: number;
    renderedWidth?: number;
    renderedHeight?: number;
  },
): {
  eid: number;
  sprite: PIXI.Sprite;
} {
  const eid = addEntity(world);
  addComponent(world, PositionComp, eid);
  addComponent(world, RenderComp, eid);
  addComponent(world, CleanableComp, eid);

  PositionComp.x[eid] = options.x;
  PositionComp.y[eid] = options.y;
  RenderComp.storeIndex[eid] = eid;
  RenderComp.textureKey[eid] = 0;
  RenderComp.scale[eid] = 1;
  RenderComp.zIndex[eid] = options.zIndex ?? ECS_NULL_VALUE;
  CleanableComp.isHighlighted[eid] = 1;
  CleanableComp.cleaningProgress[eid] = 0;
  CleanableComp.isBeingCleaned[eid] = 0;

  const sprite = new PIXI.Sprite(options.texture ?? PIXI.Texture.WHITE);
  const bounds = new PIXI.Rectangle(options.x - 18, options.y - 18, 36, 36);

  sprite.anchor.set(0.5);
  sprite.position.set(options.x, options.y);
  sprite.scale.set(options.scale ?? 1);
  if (options.renderedWidth !== undefined) {
    sprite.width = options.renderedWidth;
  }
  if (options.renderedHeight !== undefined) {
    sprite.height = options.renderedHeight;
  }
  sprite.zIndex = options.zIndex ?? options.y;
  sprite.getBounds = (() =>
    bounds as unknown as PIXI.Bounds) as typeof sprite.getBounds;

  world.stage.addChild(sprite);
  getSpriteStore().set(eid, sprite);

  return { eid, sprite };
}

function createTextureWithMetadata(width: number, height: number): PIXI.Texture {
  return new PIXI.Texture({
    source: PIXI.Texture.WHITE.source,
    frame: new PIXI.Rectangle(0, 0, width, height),
    orig: new PIXI.Rectangle(0, 0, width, height),
  });
}

function getCapturedBorderSize(
  boundsByGraphics: WeakMap<PIXI.Graphics, CapturedGraphicsBounds>,
  border: PIXI.Graphics | undefined,
): {
  width: number;
  height: number;
} {
  assert.ok(border);

  const bounds = boundsByGraphics.get(border);
  assert.ok(bounds);

  return {
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  };
}

function runCleanableRenderSystem(world: CleanableRenderTestWorld): void {
  cleanableRenderSystem({
    world: world as unknown as MainSceneWorld,
    delta: 16,
    stage: world.stage,
  });
}

test("포커스된 청소 타겟은 비포커스 테두리보다 앞에 오고 자신의 테두리/빗자루는 더 위에 남는다", () => {
  withCleanableRenderHarness(({ world, strokeStyles }) => {
    const focused = createCleanableEntity(world, { x: 80, y: 120 });
    const other = createCleanableEntity(world, { x: 160, y: 180 });

    world._isCleaningMode = true;
    world._focusedTargetEid = focused.eid;
    world._sliderValue = 0.25;

    runCleanableRenderSystem(world);

    const focusedBorder = getDashedBorderStore().get(focused.eid);
    const otherBorder = getDashedBorderStore().get(other.eid);
    const broom = getBroomStore().get(focused.eid);

    assert.ok(focusedBorder);
    assert.ok(otherBorder);
    assert.ok(broom);
    assert.ok(getCleaningDimOverlay());

    assert.equal(focused.sprite.zIndex, 1000103);
    assert.equal(other.sprite.zIndex, 1000101);
    assert.equal(otherBorder.zIndex, 1000102);
    assert.equal(focusedBorder.zIndex, 1000104);
    assert.equal(broom.zIndex, 1000105);
    assert.ok(focused.sprite.zIndex > otherBorder.zIndex);
    assert.ok(focusedBorder.zIndex > focused.sprite.zIndex);
    assert.ok(broom.zIndex > focusedBorder.zIndex);

    assert.deepEqual(strokeStyles.get(focusedBorder), {
      width: 4,
      color: 0xff7dc2,
    });
    assert.deepEqual(strokeStyles.get(otherBorder), {
      width: 3,
      color: 0xffffff,
    });
  });
});

test("같은 텍스처와 scale의 cleanable은 같은 점선 테두리 크기를 사용한다", () => {
  withCapturedGraphicsBounds((boundsByGraphics) => {
    withCleanableRenderHarness(({ world }) => {
      const texture = createTextureWithMetadata(24, 18);
      const first = createCleanableEntity(world, {
        x: 80,
        y: 120,
        texture,
        scale: 2,
      });
      const second = createCleanableEntity(world, {
        x: 160,
        y: 180,
        texture,
        scale: 2,
      });

      world._isCleaningMode = true;
      runCleanableRenderSystem(world);

      const firstSize = getCapturedBorderSize(
        boundsByGraphics,
        getDashedBorderStore().get(first.eid),
      );
      const secondSize = getCapturedBorderSize(
        boundsByGraphics,
        getDashedBorderStore().get(second.eid),
      );

      assert.deepEqual(firstSize, { width: 48, height: 36 });
      assert.deepEqual(secondSize, firstSize);
    });
  });
});

test("texture metadata가 달라도 렌더된 sprite 크기가 같으면 같은 점선 테두리 크기를 사용한다", () => {
  withCapturedGraphicsBounds((boundsByGraphics) => {
    withCleanableRenderHarness(({ world }) => {
      const first = createCleanableEntity(world, {
        x: 80,
        y: 120,
        texture: createTextureWithMetadata(80, 24),
        renderedWidth: 40,
        renderedHeight: 40,
      });
      const second = createCleanableEntity(world, {
        x: 160,
        y: 180,
        texture: createTextureWithMetadata(16, 96),
        renderedWidth: 40,
        renderedHeight: 40,
      });

      world._isCleaningMode = true;
      runCleanableRenderSystem(world);

      const firstSize = getCapturedBorderSize(
        boundsByGraphics,
        getDashedBorderStore().get(first.eid),
      );
      const secondSize = getCapturedBorderSize(
        boundsByGraphics,
        getDashedBorderStore().get(second.eid),
      );

      assert.deepEqual(firstSize, { width: 40, height: 40 });
      assert.deepEqual(secondSize, firstSize);
    });
  });
});

test("cleanable sprite scale이 바뀌면 점선 테두리를 새 렌더 크기로 다시 그린다", () => {
  withCapturedGraphicsBounds((boundsByGraphics) => {
    withCleanableRenderHarness(({ world }) => {
      const target = createCleanableEntity(world, {
        x: 80,
        y: 120,
        texture: createTextureWithMetadata(20, 10),
        scale: 1,
      });

      world._isCleaningMode = true;
      runCleanableRenderSystem(world);

      const border = getDashedBorderStore().get(target.eid);
      assert.deepEqual(getCapturedBorderSize(boundsByGraphics, border), {
        width: 20,
        height: 10,
      });

      target.sprite.scale.set(3, 2);
      runCleanableRenderSystem(world);

      assert.equal(getDashedBorderStore().get(target.eid), border);
      assert.deepEqual(getCapturedBorderSize(boundsByGraphics, border), {
        width: 60,
        height: 20,
      });
    });
  });
});

test("포커스가 바뀌면 이전 타겟은 기본 zIndex로 돌아가고 새 타겟만 최전면으로 올라온다", () => {
  withCleanableRenderHarness(({ world, strokeStyles }) => {
    const first = createCleanableEntity(world, { x: 80, y: 120 });
    const second = createCleanableEntity(world, { x: 160, y: 180 });

    world._isCleaningMode = true;
    world._focusedTargetEid = first.eid;
    runCleanableRenderSystem(world);

    assert.equal(first.sprite.zIndex, 1000103);
    assert.equal(second.sprite.zIndex, 1000101);

    world._focusedTargetEid = second.eid;
    runCleanableRenderSystem(world);

    assert.equal(first.sprite.zIndex, 1000101);
    assert.equal(second.sprite.zIndex, 1000103);
    assert.equal(getDashedBorderStore().get(first.eid)?.zIndex, 1000102);
    assert.equal(getDashedBorderStore().get(second.eid)?.zIndex, 1000104);
    assert.equal(getBroomStore().get(first.eid), undefined);
    assert.ok(getBroomStore().get(second.eid));

    const firstBorder = getDashedBorderStore().get(first.eid);
    const secondBorder = getDashedBorderStore().get(second.eid);

    assert.ok(firstBorder);
    assert.ok(secondBorder);
    assert.deepEqual(strokeStyles.get(firstBorder), {
      width: 3,
      color: 0xffffff,
    });
    assert.deepEqual(strokeStyles.get(secondBorder), {
      width: 4,
      color: 0xff7dc2,
    });
  });
});

test("청소 모드가 끝나면 타겟 스프라이트는 기본 zIndex로 복귀하고 빗자루는 제거된다", () => {
  withCleanableRenderHarness(({ world }) => {
    const target = createCleanableEntity(world, { x: 80, y: 120, zIndex: 321 });
    const other = createCleanableEntity(world, { x: 160, y: 180 });

    world._isCleaningMode = true;
    world._focusedTargetEid = target.eid;
    runCleanableRenderSystem(world);

    assert.equal(target.sprite.zIndex, 1000103);
    assert.ok(getBroomStore().get(target.eid));

    world._isCleaningMode = false;
    runCleanableRenderSystem(world);

    assert.equal(target.sprite.zIndex, 321);
    assert.equal(other.sprite.zIndex, 180);
    assert.equal(getBroomStore().get(target.eid), undefined);
    assert.equal(getDashedBorderStore().get(target.eid)?.zIndex, 1000102);
    assert.equal(getCleaningDimOverlay(), null);
  });
});

test("청소 모드에서는 dim overlay가 생성되고 청소 가능 오브젝트보다 뒤에 배치된다", () => {
  withCleanableRenderHarness(({ world }) => {
    const first = createCleanableEntity(world, { x: 80, y: 120 });
    const second = createCleanableEntity(world, { x: 160, y: 180 });

    world._isCleaningMode = true;
    world._focusedTargetEid = first.eid;
    runCleanableRenderSystem(world);

    const overlay = getCleaningDimOverlay();

    assert.ok(overlay);
    assert.equal(overlay.zIndex, 1000100);
    assert.ok(first.sprite.zIndex > overlay.zIndex);
    assert.ok(second.sprite.zIndex > overlay.zIndex);

    world._isCleaningMode = false;
    runCleanableRenderSystem(world);

    assert.equal(getCleaningDimOverlay(), null);
  });
});

test("청소 모드에서는 cleanable 타겟이 없어도 dim overlay가 생성된다", () => {
  withCleanableRenderHarness(({ world }) => {
    world._isCleaningMode = true;

    runCleanableRenderSystem(world);

    const overlay = getCleaningDimOverlay();

    assert.ok(overlay);
    assert.equal(overlay.zIndex, 1000100);

    world._isCleaningMode = false;
    runCleanableRenderSystem(world);

    assert.equal(getCleaningDimOverlay(), null);
  });
});

test("청소 모드에서는 cleanable 오브젝트와 테두리가 밤 오버레이보다 위에 배치되어 밝게 유지된다", () => {
  withCleanableRenderHarness(({ world }) => {
    const focused = createCleanableEntity(world, { x: 80, y: 120 });
    const other = createCleanableEntity(world, { x: 160, y: 180 });

    world._isCleaningMode = true;
    world._focusedTargetEid = focused.eid;
    runCleanableRenderSystem(world);

    const focusedBorder = getDashedBorderStore().get(focused.eid);
    const otherBorder = getDashedBorderStore().get(other.eid);

    assert.ok(focusedBorder);
    assert.ok(otherBorder);
    assert.ok(focused.sprite.zIndex > 1_000_000);
    assert.ok(other.sprite.zIndex > 1_000_000);
    assert.ok(focusedBorder.zIndex > 1_000_000);
    assert.ok(otherBorder.zIndex > 1_000_000);
  });
});

test("청소 렌더 상태가 바뀌지 않으면 dim overlay와 점선 테두리를 다시 그리지 않는다", () => {
  withGraphicsCallCounts((counts) => {
    withCleanableRenderHarness(({ world }) => {
      const focused = createCleanableEntity(world, { x: 80, y: 120 });
      createCleanableEntity(world, { x: 160, y: 180 });

      world._isCleaningMode = true;
      world._focusedTargetEid = focused.eid;

      runCleanableRenderSystem(world);

      const countsAfterFirstRender = { ...counts };

      runCleanableRenderSystem(world);

      assert.deepEqual(counts, countsAfterFirstRender);
    });
  });
});
