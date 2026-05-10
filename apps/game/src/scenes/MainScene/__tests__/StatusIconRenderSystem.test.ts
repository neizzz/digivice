import assert from "node:assert/strict";
import test from "node:test";
import { createWorld } from "bitecs";
import * as PIXI from "pixi.js";
import { CharacterStatusComp, PositionComp } from "../raw-components";
import {
  cleanupStatusIconRenderStateForTests,
  statusIconRenderSystem,
} from "../systems/StatusIconRenderSystem";
import { CharacterState, CharacterStatus } from "../types";
import { MainSceneWorld } from "../world";
import { createTestCharacter } from "../../../test-utils/mainSceneTestUtils";

const POSITION_BOUNDARY_TOP = 20;
const POSITION_BOUNDARY_WIDTH = 320;
const CENTERED_SINGLE_ICON_X = 80;
const CENTERED_SINGLE_ICON_X_WALKING = 81;
const RIGHT_EDGE_SINGLE_ICON_X = 310;
const CENTERED_DOUBLE_ICON_LEFT_X = 67;
const CENTERED_DOUBLE_ICON_RIGHT_X = 94;
const CLAMPED_STATUS_ICON_CENTER_Y = 14;
const STATUS_ICON_CENTER_Y_ABOVE_BAR = 67;
const STATUS_ICON_CENTER_Y_ABOVE_BAR_WALKING = 67.6;

function assertApproximatelyEqual(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 0.0001);
}

function createMainSceneWorldForTest(): MainSceneWorld {
  const world = new MainSceneWorld({
    stage: new PIXI.Container(),
    positionBoundary: {
      x: 0,
      y: POSITION_BOUNDARY_TOP,
      width: POSITION_BOUNDARY_WIDTH,
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
      sleeping: PIXI.Texture.WHITE,
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

function getStatusIconSprites(world: MainSceneWorld): PIXI.Sprite[] {
  return world.stage.children.map((child) => {
    assert.ok(child instanceof PIXI.Sprite);
    return child;
  });
}

test("상단 근처의 지속 상태 아이콘은 게이지 영역보다 0px 아래까지만 올라가도록 clamp된다", () => {
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
    assertApproximatelyEqual(sprite.x, CENTERED_SINGLE_ICON_X);
    assertApproximatelyEqual(sprite.y, CLAMPED_STATUS_ICON_CENTER_Y);
  });
});

test("urgent 상태는 더 이상 상태 아이콘으로 렌더링되지 않는다", () => {
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

    CharacterStatusComp.statuses[eid][0] = CharacterStatus.URGENT;

    statusIconRenderSystem({
      world,
      delta: 16,
    });

    assert.equal(world.stage.children.length, 0);
  });
});

test("상단 근처의 emotion 아이콘은 status icon 라인에 통합된 상태로 clamp된다", () => {
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
    assertApproximatelyEqual(sprite.x, CENTERED_SINGLE_ICON_X);
    assertApproximatelyEqual(sprite.y, CLAMPED_STATUS_ICON_CENTER_Y);
  });
});

test("우측 가장자리 근처의 일시 상태 아이콘은 우측 clamp 없이 게이지바 시작 지점부터 배치된다", () => {
  withMockedStatusIconSprites(() => {
    const world = createMainSceneWorldForTest();
    const eid = createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.IDLE,
        x: 310,
        y: 120,
      },
    );

    CharacterStatusComp.statuses[eid][0] = CharacterStatus.HAPPY;

    statusIconRenderSystem({
      world,
      delta: 16,
    });

    const sprite = getOnlyStatusIconSprite(world);
    assertApproximatelyEqual(sprite.x, RIGHT_EDGE_SINGLE_ICON_X);
    assertApproximatelyEqual(sprite.y, STATUS_ICON_CENTER_Y_ABOVE_BAR);
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

    assertApproximatelyEqual(sprite.y, STATUS_ICON_CENTER_Y_ABOVE_BAR);
  });
});

test("persistent status와 emotion이 함께 있으면 status icon이 왼쪽부터 먼저 배치된다", () => {
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
    CharacterStatusComp.statuses[eid][1] = CharacterStatus.HAPPY;

    statusIconRenderSystem({
      world,
      delta: 16,
    });

    const sprites = getStatusIconSprites(world).sort((a, b) => a.x - b.x);

    assert.equal(sprites.length, 2);
    assertApproximatelyEqual(sprites[0].x, CENTERED_DOUBLE_ICON_LEFT_X);
    assertApproximatelyEqual(sprites[1].x, CENTERED_DOUBLE_ICON_RIGHT_X);
    assertApproximatelyEqual(sprites[0].y, STATUS_ICON_CENTER_Y_ABOVE_BAR);
    assertApproximatelyEqual(sprites[1].y, STATUS_ICON_CENTER_Y_ABOVE_BAR);
  });
});

test("지속 상태 아이콘은 캐릭터보다 앞 zIndex를 사용하고 캐릭터 렌더 좌표를 따라간다", () => {
  withMockedStatusIconSprites(() => {
    const world = createMainSceneWorldForTest();
    const eid = createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.WALKING,
        x: 80.6,
        y: 120.6,
      },
    );

    CharacterStatusComp.statuses[eid][0] = CharacterStatus.SICK;

    statusIconRenderSystem({
      world,
      delta: 16,
    });

    const sprite = getOnlyStatusIconSprite(world);
    const characterZIndex = Math.round(PositionComp.y[eid]);

    assertApproximatelyEqual(sprite.x, CENTERED_SINGLE_ICON_X_WALKING);
    assertApproximatelyEqual(sprite.y, STATUS_ICON_CENTER_Y_ABOVE_BAR_WALKING);
    assert.equal(sprite.zIndex, characterZIndex + 1.5);
    assert.equal(sprite.roundPixels, true);
  });
});

test("emotion 아이콘도 캐릭터보다 앞 zIndex를 사용하고 walking 중 좌표 반올림 기준을 따른다", () => {
  withMockedStatusIconSprites(() => {
    const world = createMainSceneWorldForTest();
    const eid = createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.WALKING,
        x: 80.6,
        y: 120.6,
      },
    );

    CharacterStatusComp.statuses[eid][0] = CharacterStatus.HAPPY;

    statusIconRenderSystem({
      world,
      delta: 16,
    });

    const sprite = getOnlyStatusIconSprite(world);
    const characterZIndex = Math.round(PositionComp.y[eid]);

    assertApproximatelyEqual(sprite.x, CENTERED_SINGLE_ICON_X_WALKING);
    assertApproximatelyEqual(sprite.y, STATUS_ICON_CENTER_Y_ABOVE_BAR_WALKING);
    assert.equal(sprite.zIndex, characterZIndex + 1.5);
    assert.equal(sprite.roundPixels, true);
  });
});

test("수면 중에는 임시 상태 슬롯에 sleeping 아이콘이 렌더링된다", () => {
  withMockedStatusIconSprites(() => {
    const world = createMainSceneWorldForTest();
    const eid = createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.SLEEPING,
        x: 80.6,
        y: 120.6,
      },
    );

    statusIconRenderSystem({
      world,
      delta: 16,
    });

    const sprite = getOnlyStatusIconSprite(world);
    const characterZIndex = Math.round(PositionComp.y[eid]);

    assertApproximatelyEqual(sprite.x, CENTERED_SINGLE_ICON_X_WALKING);
    assertApproximatelyEqual(sprite.y, STATUS_ICON_CENTER_Y_ABOVE_BAR_WALKING);
    assert.equal(sprite.zIndex, characterZIndex + 1.5);
    assert.equal(sprite.roundPixels, true);
  });
});

test("SleepFX 토글이 꺼져 있으면 sleeping 아이콘을 렌더링하지 않는다", () => {
  withMockedStatusIconSprites(() => {
    const world = createMainSceneWorldForTest();
    createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.SLEEPING,
        x: 80,
        y: 120,
      },
    );

    world.toggleSleepDebugEffect();
    statusIconRenderSystem({
      world,
      delta: 16,
    });

    assert.equal(world.stage.children.length, 0);
  });
});
