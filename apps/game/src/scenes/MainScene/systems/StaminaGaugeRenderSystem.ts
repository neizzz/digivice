import { defineQuery } from "bitecs";
import * as PIXI from "pixi.js";
import { GAME_CONSTANTS } from "../config";
import { CharacterStatusComp, ObjectComp } from "../raw-components";
import { ObjectType } from "../types";
import type { MainSceneWorld } from "../world";

type StaminaGaugeRenderState = {
  container: PIXI.Container;
  background: PIXI.Graphics;
  fill: PIXI.Graphics;
};

const staminaGaugeQuery = defineQuery([ObjectComp, CharacterStatusComp]);

const GAUGE_HEIGHT = 16;
const GAUGE_BORDER_THICKNESS = 4;
const GAUGE_BORDER_BOTTOM_CORNER_RADIUS = 3;
const GAUGE_HIGHLIGHT_HEIGHT = 2;
const GAUGE_FILL_HIGHLIGHT_ALPHA = 0.18;
const GAUGE_TRACK_BASE_COLOR = 0x000000;
const GAUGE_TRACK_BASE_ALPHA = 0.34;
const GAUGE_Z_INDEX_OFFSET = 0.5;
const GAUGE_BORDER_COLOR = 0x565656;
const GAUGE_FILL_HIGHLIGHT_COLOR = 0xffffff;
const GAUGE_LOW_STAMINA_COLOR = 0xe2554b;
const GAUGE_MID_STAMINA_COLOR = 0xf2a33a;
const GAUGE_HIGH_STAMINA_COLOR = 0x58b86b;

let staminaGaugeRenderState: StaminaGaugeRenderState | null = null;

function clampUnitInterval(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getGaugeFillColor(stamina: number): number {
  if (stamina < GAME_CONSTANTS.UNHAPPY_STAMINA_THRESHOLD) {
    return GAUGE_LOW_STAMINA_COLOR;
  }

  if (stamina < GAME_CONSTANTS.BOOSTED_STAMINA_THRESHOLD) {
    return GAUGE_MID_STAMINA_COLOR;
  }

  return GAUGE_HIGH_STAMINA_COLOR;
}

function findMainCharacterEntity(world: MainSceneWorld): number {
  const entities = staminaGaugeQuery(world);

  for (let index = 0; index < entities.length; index += 1) {
    const eid = entities[index];

    if (ObjectComp.type[eid] === ObjectType.CHARACTER) {
      return eid;
    }
  }

  return -1;
}

function fillPixelCappedRect(
  graphics: PIXI.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  leftRadius: number,
  rightRadius: number,
  fill: number | { color: number; alpha?: number },
): void {
  if (width <= 0 || height <= 0) {
    return;
  }

  const maxVerticalRadius = Math.floor((height - 1) / 2);
  let effectiveLeftRadius = Math.max(
    0,
    Math.min(leftRadius, maxVerticalRadius),
  );
  let effectiveRightRadius = Math.max(
    0,
    Math.min(rightRadius, maxVerticalRadius),
  );
  const maxHorizontalInset = Math.max(0, width - 1);
  const totalRadius = effectiveLeftRadius + effectiveRightRadius;

  if (totalRadius > maxHorizontalInset && totalRadius > 0) {
    const scale = maxHorizontalInset / totalRadius;
    effectiveLeftRadius = Math.floor(effectiveLeftRadius * scale);
    effectiveRightRadius = Math.floor(effectiveRightRadius * scale);
  }

  if (effectiveLeftRadius === 0 && effectiveRightRadius === 0) {
    graphics.rect(x, y, width, height).fill(fill);
    return;
  }

  for (let row = 0; row < height; row += 1) {
    const { startX, endX } = getPixelCappedRowSpan(
      width,
      height,
      effectiveLeftRadius,
      effectiveRightRadius,
      row,
    );
    const rowWidth = endX - startX;

    if (rowWidth <= 0) {
      continue;
    }

    graphics.rect(x + startX, y + row, rowWidth, 1).fill(fill);
  }
}

function getPixelCappedRowSpan(
  width: number,
  height: number,
  leftRadius: number,
  rightRadius: number,
  row: number,
): {
  startX: number;
  endX: number;
} {
  const maxVerticalRadius = Math.floor((height - 1) / 2);
  let effectiveLeftRadius = Math.max(
    0,
    Math.min(leftRadius, maxVerticalRadius),
  );
  let effectiveRightRadius = Math.max(
    0,
    Math.min(rightRadius, maxVerticalRadius),
  );
  const maxHorizontalInset = Math.max(0, width - 1);
  const totalRadius = effectiveLeftRadius + effectiveRightRadius;

  if (totalRadius > maxHorizontalInset && totalRadius > 0) {
    const scale = maxHorizontalInset / totalRadius;
    effectiveLeftRadius = Math.floor(effectiveLeftRadius * scale);
    effectiveRightRadius = Math.floor(effectiveRightRadius * scale);
  }

  const distanceFromNearestEdge = Math.min(row, height - 1 - row);
  const startX = Math.max(0, effectiveLeftRadius - distanceFromNearestEdge);
  const endX = Math.max(
    startX,
    width - Math.max(0, effectiveRightRadius - distanceFromNearestEdge),
  );

  return {
    startX,
    endX,
  };
}

function fillPixelRoundedRect(
  graphics: PIXI.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: number | { color: number; alpha?: number },
): void {
  fillPixelCappedRect(graphics, x, y, width, height, radius, radius, fill);
}

function fillPixelBottomCappedRect(
  graphics: PIXI.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  bottomLeftRadius: number,
  bottomRightRadius: number,
  fill: number | { color: number; alpha?: number },
): void {
  if (width <= 0 || height <= 0) {
    return;
  }

  for (let row = 0; row < height; row += 1) {
    const { startX, endX } = getPixelBottomRoundedRowSpan(
      width,
      height,
      bottomLeftRadius,
      bottomRightRadius,
      row,
    );
    const rowWidth = endX - startX;

    if (rowWidth <= 0) {
      continue;
    }

    graphics.rect(x + startX, y + row, rowWidth, 1).fill(fill);
  }
}

function fillPixelBottomRoundedRect(
  graphics: PIXI.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: number | { color: number; alpha?: number },
): void {
  fillPixelBottomCappedRect(
    graphics,
    x,
    y,
    width,
    height,
    radius,
    radius,
    fill,
  );
}

function getPixelBottomRoundedRowSpan(
  width: number,
  height: number,
  bottomLeftRadius: number,
  bottomRightRadius: number,
  row: number,
): {
  startX: number;
  endX: number;
} {
  const distanceFromBottom = height - 1 - row;
  let leftInset = Math.max(0, bottomLeftRadius - distanceFromBottom);
  let rightInset = Math.max(0, bottomRightRadius - distanceFromBottom);
  const maxHorizontalInset = Math.max(0, width - 1);
  const totalInset = leftInset + rightInset;

  if (totalInset > maxHorizontalInset && totalInset > 0) {
    const scale = maxHorizontalInset / totalInset;
    leftInset = Math.floor(leftInset * scale);
    rightInset = Math.floor(rightInset * scale);
  }

  return {
    startX: leftInset,
    endX: Math.max(leftInset, width - rightInset),
  };
}

function drawPixelRoundedFrame(
  graphics: PIXI.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  thickness: number,
  bottomRadius: number,
  fill: number | { color: number; alpha?: number },
): void {
  if (width <= 0 || height <= 0 || thickness <= 0) {
    return;
  }

  const innerWidth = Math.max(0, width - thickness * 2);
  const innerHeight = Math.max(0, height - thickness * 2);
  const innerBottomRadius = Math.max(0, bottomRadius - 1);

  for (let row = 0; row < height; row += 1) {
    const outerSpan = getPixelBottomRoundedRowSpan(
      width,
      height,
      bottomRadius,
      bottomRadius,
      row,
    );
    const outerWidth = outerSpan.endX - outerSpan.startX;

    if (outerWidth <= 0) {
      continue;
    }

    if (
      row < thickness ||
      row >= height - thickness ||
      innerWidth <= 0 ||
      innerHeight <= 0
    ) {
      graphics.rect(x + outerSpan.startX, y + row, outerWidth, 1).fill(fill);
      continue;
    }

    const innerRow = row - thickness;
    const innerSpan = getPixelBottomRoundedRowSpan(
      innerWidth,
      innerHeight,
      innerBottomRadius,
      innerBottomRadius,
      innerRow,
    );
    const innerStartX = thickness + innerSpan.startX;
    const innerEndX = thickness + innerSpan.endX;
    const leftWidth = innerStartX - outerSpan.startX;
    const rightWidth = outerSpan.endX - innerEndX;

    if (leftWidth > 0) {
      graphics.rect(x + outerSpan.startX, y + row, leftWidth, 1).fill(fill);
    }

    if (rightWidth > 0) {
      graphics.rect(x + innerEndX, y + row, rightWidth, 1).fill(fill);
    }
  }
}

function getOrCreateRenderState(
  stage: PIXI.Container,
): StaminaGaugeRenderState {
  if (staminaGaugeRenderState) {
    return staminaGaugeRenderState;
  }

  const container = new PIXI.Container();
  const background = new PIXI.Graphics();
  const fill = new PIXI.Graphics();

  container.eventMode = "none";
  background.eventMode = "none";
  fill.eventMode = "none";
  background.roundPixels = true;
  fill.roundPixels = true;
  container.addChild(background);
  container.addChild(fill);

  stage.addChild(container);

  staminaGaugeRenderState = {
    container,
    background,
    fill,
  };

  return staminaGaugeRenderState;
}

function drawGaugeBackground(
  graphics: PIXI.Graphics,
  gaugeWidth: number,
  gaugeHeight: number,
): {
  trackX: number;
  trackY: number;
  trackWidth: number;
  trackHeight: number;
} {
  const trackInset = GAUGE_BORDER_THICKNESS;
  const trackX = trackInset;
  const trackY = trackInset;
  const trackWidth = Math.max(1, gaugeWidth - trackInset * 2);
  const trackHeight = Math.max(1, gaugeHeight - trackInset * 2);
  const trackBottomRadius = Math.max(0, GAUGE_BORDER_BOTTOM_CORNER_RADIUS - 1);

  graphics.clear();
  fillPixelBottomRoundedRect(
    graphics,
    trackX,
    trackY,
    trackWidth,
    trackHeight,
    trackBottomRadius,
    {
      color: GAUGE_TRACK_BASE_COLOR,
      alpha: GAUGE_TRACK_BASE_ALPHA,
    },
  );
  drawPixelRoundedFrame(
    graphics,
    0,
    0,
    gaugeWidth,
    gaugeHeight,
    GAUGE_BORDER_THICKNESS,
    GAUGE_BORDER_BOTTOM_CORNER_RADIUS,
    GAUGE_BORDER_COLOR,
  );

  return {
    trackX,
    trackY,
    trackWidth,
    trackHeight,
  };
}

function drawGaugeFill(
  graphics: PIXI.Graphics,
  stamina: number,
  maxStamina: number,
  trackX: number,
  trackY: number,
  trackWidth: number,
  trackHeight: number,
): void {
  const fillColor = getGaugeFillColor(stamina);
  const fillBottomRadius = Math.max(0, GAUGE_BORDER_BOTTOM_CORNER_RADIUS - 1);
  const fillWidth = Math.max(
    0,
    Math.round(clampUnitInterval(stamina / maxStamina) * trackWidth),
  );
  const fillRightBottomRadius = fillWidth >= trackWidth ? fillBottomRadius : 0;

  graphics.clear();

  if (fillWidth <= 0) {
    return;
  }

  fillPixelBottomCappedRect(
    graphics,
    trackX,
    trackY,
    fillWidth,
    trackHeight,
    fillBottomRadius,
    fillRightBottomRadius,
    fillColor,
  );

  if (trackHeight > 1) {
    fillPixelCappedRect(
      graphics,
      trackX,
      trackY,
      fillWidth,
      Math.min(GAUGE_HIGHLIGHT_HEIGHT, trackHeight),
      0,
      0,
      {
        color: GAUGE_FILL_HIGHLIGHT_COLOR,
        alpha: GAUGE_FILL_HIGHLIGHT_ALPHA,
      },
    );
  }
}

export function cleanupStaminaGaugeRenderState(): void {
  if (!staminaGaugeRenderState) {
    return;
  }

  staminaGaugeRenderState.container.removeFromParent();
  staminaGaugeRenderState.container.destroy({ children: true });
  staminaGaugeRenderState = null;
}

export function staminaGaugeRenderSystem(params: {
  world: MainSceneWorld;
  delta: number;
}): typeof params {
  const { world } = params;
  const characterEid = findMainCharacterEntity(world);

  if (characterEid === -1) {
    if (staminaGaugeRenderState) {
      staminaGaugeRenderState.container.visible = false;
    }

    return params;
  }

  const gaugeWidth = Math.max(
    48,
    Math.round(world.positionBoundary.width + world.positionBoundary.x * 2),
  );
  const gaugeHeight = GAUGE_HEIGHT;
  const gaugeState = getOrCreateRenderState(world.stage);

  gaugeState.container.visible = true;
  gaugeState.container.position.set(0, 0);
  gaugeState.container.zIndex = world.positionBoundary.y - GAUGE_Z_INDEX_OFFSET;

  const { trackX, trackY, trackWidth, trackHeight } = drawGaugeBackground(
    gaugeState.background,
    gaugeWidth,
    gaugeHeight,
  );

  drawGaugeFill(
    gaugeState.fill,
    CharacterStatusComp.stamina[characterEid],
    GAME_CONSTANTS.MAX_STAMINA,
    trackX,
    trackY,
    trackWidth,
    trackHeight,
  );

  return params;
}
