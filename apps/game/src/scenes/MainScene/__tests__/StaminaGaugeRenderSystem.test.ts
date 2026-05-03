import assert from "node:assert/strict";
import test from "node:test";
import { createWorld } from "bitecs";
import * as PIXI from "pixi.js";
import { GAME_CONSTANTS } from "../config";
import { PositionComp } from "../raw-components";
import { CharacterState } from "../types";
import { MainSceneWorld } from "../world";
import {
  clampStaminaGaugeY,
  cleanupStaminaGaugeRenderState,
  getStaminaGaugeFillColor,
  staminaGaugeRenderSystem,
} from "../systems/StaminaGaugeRenderSystem";
import { getCharacterWorldBounds } from "../systems/CharacterDisplayBounds";
import { createTestCharacter } from "../../../test-utils/mainSceneTestUtils";

const POSITION_BOUNDARY_TOP = 20;
const STAMINA_GAUGE_Y_OFFSET = 10;

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

function withCleanedStaminaGaugeState<T>(fn: () => T): T {
  try {
    return fn();
  } finally {
    cleanupStaminaGaugeRenderState();
  }
}

function getOnlyStaminaGauge(world: MainSceneWorld): PIXI.Graphics {
  assert.equal(world.stage.children.length, 1);

  const gauge = world.stage.children[0];

  assert.ok(gauge instanceof PIXI.Graphics);
  return gauge;
}

test("스테미나 게이지 색상은 4와 7 경계값을 기준으로 바뀐다", () => {
  const lowColor = getStaminaGaugeFillColor(
    GAME_CONSTANTS.UNHAPPY_STAMINA_THRESHOLD - 0.01,
  );
  const midColor = getStaminaGaugeFillColor(
    GAME_CONSTANTS.UNHAPPY_STAMINA_THRESHOLD,
  );
  const highColor = getStaminaGaugeFillColor(
    GAME_CONSTANTS.BOOSTED_STAMINA_THRESHOLD,
  );

  assert.equal(getStaminaGaugeFillColor(0), lowColor);
  assert.equal(
    getStaminaGaugeFillColor(GAME_CONSTANTS.BOOSTED_STAMINA_THRESHOLD - 0.01),
    midColor,
  );
  assert.equal(getStaminaGaugeFillColor(GAME_CONSTANTS.MAX_STAMINA), highColor);
  assert.notEqual(lowColor, midColor);
  assert.notEqual(midColor, highColor);
});

test("상단 근처의 스테미나 게이지는 상단 경계 아래로 clamp된다", () => {
  withCleanedStaminaGaugeState(() => {
    const world = createMainSceneWorldForTest();
    const eid = createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.IDLE,
        stamina: 6,
        x: 80,
        y: 30,
      },
    );

    const bounds = getCharacterWorldBounds(eid);

    staminaGaugeRenderSystem({
      world,
      delta: 16,
    });

    const gauge = getOnlyStaminaGauge(world);
    const expectedY = clampStaminaGaugeY(
      world,
      bounds.topY - STAMINA_GAUGE_Y_OFFSET,
    );

    assert.equal(gauge.x, 80);
    assert.ok(Math.abs(gauge.y - expectedY) < 0.000001);
  });
});

test("스테미나 게이지는 캐릭터보다 한 단계 뒤 zIndex에 렌더링된다", () => {
  withCleanedStaminaGaugeState(() => {
    const world = createMainSceneWorldForTest();
    const eid = createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.IDLE,
        stamina: 8,
        x: 96,
        y: 120,
      },
    );

    staminaGaugeRenderSystem({
      world,
      delta: 16,
    });

    const gauge = getOnlyStaminaGauge(world);

    assert.equal(gauge.zIndex, PositionComp.y[eid] - 1);
  });
});