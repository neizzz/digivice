import assert from "node:assert/strict";
import test from "node:test";
import { createWorld } from "bitecs";
import * as PIXI from "pixi.js";
import { MainSceneWorld } from "../world";
import {
  characterNameLabelSystem,
  getEggTimerBarFillColorForTests,
  getEggTimerBarFillWidthForTests,
  cleanupCharacterNameLabels,
  getCharacterStaminaBarTopY,
  getCharacterNameLabelLayoutForTests,
  getCharacterNameLabelRenderStateForTests,
  getMiniStaminaBarFillColorForTests,
  getMiniStaminaBarFillWidthForTests,
  getMiniStaminaBarUrgentOverlayAlphaForTests,
} from "../systems/CharacterNameLabelSystem";
import {
  CharacterStatusComp,
  EggHatchComp,
  StatusIconRenderComp,
} from "../raw-components";
import { CharacterState, CharacterStatus } from "../types";
import { createTestCharacter } from "../../../test-utils/mainSceneTestUtils";
import { getSpriteStore } from "../systems/RenderSystem";
import {
  NAME_LABEL_FONT_SIZE,
  truncateNameLabelToWidth,
} from "../../../utils/nameLabel";
import {
  cleanupStatusIconRenderStateForTests,
  statusIconRenderSystem,
} from "../systems/StatusIconRenderSystem";

function createMainSceneWorldForTest(monsterName: string): MainSceneWorld {
  const world = new MainSceneWorld({
    stage: new PIXI.Container(),
    positionBoundary: {
      x: 0,
      y: 20,
      width: 320,
      height: 320,
    },
  });

  createWorld(world, 100);
  world.stage.sortableChildren = true;
  (world as MainSceneWorld & { _persistentData: unknown })._persistentData = {
    world_metadata: {
      monster_name: monsterName,
    },
  };

  return world;
}

function attachTestDisplayObject(world: MainSceneWorld, eid: number): PIXI.Sprite {
  const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
  sprite.scale.set(48);
  world.stage.addChild(sprite);
  getSpriteStore().set(eid, sprite);
  return sprite;
}

function withCleanedNameLabelState<T>(fn: () => T): T {
  try {
    return fn();
  } finally {
    cleanupCharacterNameLabels();
    cleanupStatusIconRenderStateForTests();
  }
}

test("이름표는 80px 슬롯 기준으로 truncate되고 이름은 중앙 정렬된다", () => {
  withCleanedNameLabelState(() => {
    const world = createMainSceneWorldForTest("가나다라마바사아자차카타파하");
    const eid = createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.IDLE,
        stamina: 5,
        x: 80,
        y: 120,
      },
    );
    const displayObject = attachTestDisplayObject(world, eid);
    const layout = getCharacterNameLabelLayoutForTests();

    characterNameLabelSystem({
      world,
      delta: 16,
    });

    const renderState = getCharacterNameLabelRenderStateForTests(eid);
    assert.ok(renderState);
    assert.equal(
      renderState.label.text,
      truncateNameLabelToWidth("가나다라마바사아자차카타파하", layout.textWidth),
    );
    assert.equal(renderState.label.x, 80);
    assert.equal(
      renderState.label.y,
      Math.round(120 + displayObject.height / 2 + NAME_LABEL_FONT_SIZE / 2),
    );
    assert.equal(renderState.label.anchor.x, 0.5);
    assert.equal(renderState.barTrack.x, 80 - layout.barWidth / 2);
    assert.equal(
      renderState.barTrack.y,
      Math.round(getCharacterStaminaBarTopY(eid, 120 - displayObject.height / 2)),
    );
    assert.equal(renderState.barFrame.x, renderState.barTrack.x);
    assert.equal(renderState.barFrame.y, renderState.barTrack.y);
    assert.equal(layout.barWidth, 56);
    assert.equal(layout.barHeight, 10);
    assert.equal(layout.barBorderThickness, 3);
    assert.equal(renderState.label.zIndex, 120 + 1000);
    assert.equal(renderState.barTrack.zIndex, 121);

    displayObject.removeFromParent();
    getSpriteStore().remove(eid);
  });
});

test("미니 스테미나 바 색상과 fill 길이는 기존 threshold 규칙을 유지한다", () => {
  const layout = getCharacterNameLabelLayoutForTests();

  assert.equal(getMiniStaminaBarFillColorForTests(2.99), 0xe2554b);
  assert.equal(getMiniStaminaBarFillColorForTests(3), 0xf2a33a);
  assert.equal(getMiniStaminaBarFillColorForTests(6.99), 0xf2a33a);
  assert.equal(getMiniStaminaBarFillColorForTests(7), 0x49a95d);

  assert.equal(getMiniStaminaBarFillWidthForTests(0), 0);
  assert.equal(getMiniStaminaBarFillWidthForTests(5), 28);
  assert.equal(getMiniStaminaBarFillWidthForTests(10), layout.barTrackWidth);
});

test("egg 상태에서는 스테미나 대신 부화 타이머 진행도로 파란 계열 fill을 렌더링한다", () => {
  withCleanedNameLabelState(() => {
    const world = createMainSceneWorldForTest("Egg");
    Object.defineProperty(world, "currentTime", {
      configurable: true,
      get: () => 500,
    });

    const eid = createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.EGG,
        stamina: 5,
        x: 100,
        y: 100,
      },
    );
    const displayObject = attachTestDisplayObject(world, eid);
    EggHatchComp.hatchTime[eid] = 1_000;
    EggHatchComp.hatchDurationMs[eid] = 1_000;

    characterNameLabelSystem({
      world,
      delta: 16,
    });

    const renderState = getCharacterNameLabelRenderStateForTests(eid);
    assert.ok(renderState);
    assert.equal(
      renderState.lastFillWidth,
      getEggTimerBarFillWidthForTests(0.5),
    );
    assert.equal(
      renderState.lastFillColor,
      getEggTimerBarFillColorForTests(),
    );
    assert.equal(renderState.lastUrgentOverlayVisible, false);

    displayObject.removeFromParent();
    getSpriteStore().remove(eid);
  });
});

test("urgent 상태에서는 미니 스테미나 바 내부 전체 영역이 red fade in-out overlay로 표시된다", () => {
  withCleanedNameLabelState(() => {
    const world = createMainSceneWorldForTest("Test");
    Object.defineProperty(world, "currentTime", {
      configurable: true,
      get: () => 450,
    });

    const eid = createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.IDLE,
        stamina: 0,
        x: 100,
        y: 100,
      },
    );
    const displayObject = attachTestDisplayObject(world, eid);
    CharacterStatusComp.statuses[eid][0] = CharacterStatus.URGENT;

    characterNameLabelSystem({
      world,
      delta: 16,
    });

    const renderState = getCharacterNameLabelRenderStateForTests(eid);
    assert.ok(renderState);
    assert.equal(renderState.lastFillWidth, 0);
    assert.equal(renderState.lastUrgentOverlayVisible, true);
    assert.equal(
      renderState.lastUrgentOverlayAlpha,
      getMiniStaminaBarUrgentOverlayAlphaForTests(450),
    );

    displayObject.removeFromParent();
    getSpriteStore().remove(eid);
  });
});

test("상태 아이콘이 없으면 상단 근처에서도 스테미나 바가 아이콘 공간을 남기지 않고 clamp된다", () => {
  withCleanedNameLabelState(() => {
    const world = createMainSceneWorldForTest("Test");
    const eid = createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.IDLE,
        stamina: 5,
        x: 80,
        y: 30,
      },
    );
    const displayObject = attachTestDisplayObject(world, eid);

    characterNameLabelSystem({
      world,
      delta: 16,
    });

    const renderState = getCharacterNameLabelRenderStateForTests(eid);
    assert.ok(renderState);
    assert.equal(renderState.barTrack.y, 0);
    assert.equal(renderState.barFrame.y, 0);
    displayObject.removeFromParent();
    getSpriteStore().remove(eid);
  });
});

test("상태 아이콘이 있으면 상단 근처에서 스테미나 바가 아이콘 아래 위치를 유지하도록 clamp된다", () => {
  withCleanedNameLabelState(() => {
    const world = createMainSceneWorldForTest("Test");
    const eid = createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.IDLE,
        stamina: 5,
        x: 80,
        y: 30,
      },
    );
    const displayObject = attachTestDisplayObject(world, eid);
    CharacterStatusComp.statuses[eid][0] = CharacterStatus.SICK;

    characterNameLabelSystem({
      world,
      delta: 16,
    });

    const renderState = getCharacterNameLabelRenderStateForTests(eid);
    assert.ok(renderState);
    assert.equal(renderState.barTrack.y, 29);
    assert.equal(renderState.barFrame.y, 29);

    displayObject.removeFromParent();
    getSpriteStore().remove(eid);
  });
});

test("상단 clamp 상태에서 아이콘이 새로 생기면 다음 프레임에 스테미나 바도 아이콘 아래로 내려간다", () => {
  withCleanedNameLabelState(() => {
    const world = createMainSceneWorldForTest("Test");
    const eid = createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.IDLE,
        stamina: 5,
        x: 80,
        y: 30,
      },
    );
    const displayObject = attachTestDisplayObject(world, eid);

    statusIconRenderSystem({
      world,
      delta: 16,
    });
    characterNameLabelSystem({
      world,
      delta: 16,
    });

    let renderState = getCharacterNameLabelRenderStateForTests(eid);
    assert.ok(renderState);
    assert.equal(renderState.barTrack.y, 0);

    CharacterStatusComp.statuses[eid][0] = CharacterStatus.SICK;

    statusIconRenderSystem({
      world,
      delta: 16,
    });
    characterNameLabelSystem({
      world,
      delta: 16,
    });

    renderState = getCharacterNameLabelRenderStateForTests(eid);
    assert.ok(renderState);
    assert.equal(renderState.barTrack.y, 29);

    displayObject.removeFromParent();
    getSpriteStore().remove(eid);
  });
});

test("수면 상태에서는 status icon 렌더 후 이름표 시스템도 sleeping icon 공간을 반영해 clamp한다", () => {
  withCleanedNameLabelState(() => {
    const world = createMainSceneWorldForTest("Test");
    const eid = createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.SLEEPING,
        stamina: 5,
        x: 80,
        y: 30,
      },
    );
    const displayObject = attachTestDisplayObject(world, eid);

    statusIconRenderSystem({
      world,
      delta: 16,
    });
    characterNameLabelSystem({
      world,
      delta: 16,
    });

    const renderState = getCharacterNameLabelRenderStateForTests(eid);
    assert.ok(renderState);
    assert.equal(StatusIconRenderComp.visibleCount[eid], 1);
    assert.equal(renderState.barTrack.y, 29);

    displayObject.removeFromParent();
    getSpriteStore().remove(eid);
  });
});
