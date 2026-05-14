import { defineQuery, exitQuery } from "bitecs";
import * as PIXI from "pixi.js";
import { GAME_CONSTANTS, getEggHatchProgress } from "../config";
import {
  CharacterStatusComp,
  EggHatchComp,
  ObjectComp,
  PositionComp,
  RenderComp,
} from "../raw-components";
import { CharacterState, CharacterStatus, ObjectType } from "../types";
import { MainSceneWorld } from "../world";
import {
  NAME_LABEL_FILL_COLOR,
  NAME_LABEL_FONT_FAMILIES,
  NAME_LABEL_FONT_SIZE,
  NAME_LABEL_FONT_WEIGHT,
  NAME_LABEL_STROKE_COLOR,
  NAME_LABEL_STROKE_WIDTH,
  truncateNameLabelToWidth,
} from "../../../utils/nameLabel";
import {
  getCharacterDisplayObject,
  getCharacterVerticalBounds,
} from "./CharacterDisplayBounds";

const characterQuery = defineQuery([
  ObjectComp,
  PositionComp,
  RenderComp,
  CharacterStatusComp,
]);
const characterExitQuery = exitQuery(characterQuery);

export type CharacterNameLabelRenderState = {
  label: PIXI.Text;
  barTrack: PIXI.Graphics;
  barFill: PIXI.Graphics;
  urgentOverlay: PIXI.Graphics;
  barFrame: PIXI.Graphics;
  lastFillColor: number;
  lastFillWidth: number;
  lastUrgentOverlayAlpha: number;
  lastUrgentOverlayVisible: boolean;
};

const labelStore = new Map<number, CharacterNameLabelRenderState>();

const NAME_LABEL_STYLE = new PIXI.TextStyle({
  fontFamily: [...NAME_LABEL_FONT_FAMILIES],
  fontSize: NAME_LABEL_FONT_SIZE,
  fontWeight: NAME_LABEL_FONT_WEIGHT,
  fill: NAME_LABEL_FILL_COLOR,
  align: "center",
  stroke: { color: NAME_LABEL_STROKE_COLOR, width: NAME_LABEL_STROKE_WIDTH },
});

const LABEL_Z_INDEX_OFFSET = 1000;
const STAMINA_BAR_Z_INDEX_OFFSET = 1;
const NAME_LABEL_TEXT_WIDTH = 80;
const STAMINA_BAR_WIDTH = 56;
const STAMINA_BAR_HEIGHT = 10;
const STAMINA_BAR_BORDER_THICKNESS = 3;
const STAMINA_BAR_TRACK_WIDTH = STAMINA_BAR_WIDTH;
const STAMINA_BAR_TRACK_HEIGHT = STAMINA_BAR_HEIGHT;
const CHARACTER_STAMINA_BAR_TOP_GAP = 2;
const STAMINA_BAR_LABEL_GAP = 2;
const MINI_STAMINA_BAR_TRACK_COLOR = 0x6f6f6f;
const MINI_STAMINA_BAR_TRACK_ALPHA = 0.34;
const MINI_STAMINA_BAR_TRACK_DOT_COLOR = 0x000000;
const MINI_STAMINA_BAR_TRACK_DOT_ALPHA = 0.45;
const MINI_STAMINA_BAR_TRACK_DOT_SIZE = 2;
const MINI_STAMINA_BAR_TRACK_DOT_STRIDE =
  MINI_STAMINA_BAR_TRACK_DOT_SIZE * 2;
const MINI_STAMINA_BAR_TRACK_DOT_X_OFFSET = -1;
const MINI_STAMINA_BAR_TRACK_DOT_Y_OFFSET = -1;
const MINI_STAMINA_BAR_BORDER_COLOR = 0x000000;
const MINI_STAMINA_BAR_BORDER_ALPHA = 1;
const MINI_STAMINA_BAR_LOW_COLOR = 0xe2554b;
const MINI_STAMINA_BAR_MID_COLOR = 0xf2a33a;
const MINI_STAMINA_BAR_HIGH_COLOR = 0x49a95d;
const MINI_STAMINA_BAR_EGG_FILL_COLOR = 0x59b8ff;
const MINI_STAMINA_BAR_URGENT_OVERLAY_COLOR = 0xe2554b;
const MINI_STAMINA_BAR_URGENT_OVERLAY_MIN_ALPHA = 0.18;
const MINI_STAMINA_BAR_URGENT_OVERLAY_MAX_ALPHA = 0.75;
const MINI_STAMINA_BAR_URGENT_OVERLAY_CYCLE_MS = 1200;

export function characterNameLabelSystem(params: {
  world: MainSceneWorld;
  delta: number;
}): typeof params {
  const { world } = params;
  const exitedEntities = characterExitQuery(world);

  for (let i = 0; i < exitedEntities.length; i++) {
    removeCharacterNameLabel(exitedEntities[i]);
  }

  const rawName = world.getInMemoryData().world_metadata.monster_name?.trim();
  const displayName = rawName ? truncateDisplayName(rawName) : "";
  const entities = characterQuery(world);

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
      removeCharacterNameLabel(eid);
      continue;
    }

    if (!displayName) {
      removeCharacterNameLabel(eid);
      continue;
    }

    const displayObject = getCharacterDisplayObject(eid);
    if (!displayObject) {
      removeCharacterNameLabel(eid);
      continue;
    }

    const renderState = getOrCreateCharacterNameLabel(eid, world.stage);
    if (renderState.label.text !== displayName) {
      renderState.label.text = displayName;
    }

    updateCharacterNameLabel(renderState, world, eid, world.currentTime);
  }

  return params;
}

export function cleanupCharacterNameLabels(): void {
  labelStore.forEach((renderState) => {
    renderState.label.removeFromParent();
    renderState.label.destroy();
    renderState.barTrack.removeFromParent();
    renderState.barTrack.destroy();
    renderState.barFill.removeFromParent();
    renderState.barFill.destroy();
    renderState.urgentOverlay.removeFromParent();
    renderState.urgentOverlay.destroy();
    renderState.barFrame.removeFromParent();
    renderState.barFrame.destroy();
  });
  labelStore.clear();
}

function getOrCreateCharacterNameLabel(
  eid: number,
  stage: PIXI.Container,
): CharacterNameLabelRenderState {
  const existingRenderState = labelStore.get(eid);
  if (existingRenderState) {
    return existingRenderState;
  }

  const label = new PIXI.Text({
    text: "",
    style: NAME_LABEL_STYLE,
    anchor: { x: 0.5, y: 0.5 },
  });
  const barTrack = new PIXI.Graphics();
  const barFill = new PIXI.Graphics();
  const urgentOverlay = new PIXI.Graphics();
  const barFrame = new PIXI.Graphics();
  label.position.set(0, NAME_LABEL_FONT_SIZE / 2);
  label.eventMode = "none";
  label.roundPixels = true;
  barTrack.roundPixels = true;
  barFill.roundPixels = true;
  urgentOverlay.roundPixels = true;
  barFrame.roundPixels = true;
  label.zIndex = LABEL_Z_INDEX_OFFSET;
  barTrack.eventMode = "none";
  barFill.eventMode = "none";
  urgentOverlay.eventMode = "none";
  barFrame.eventMode = "none";

  stage.addChild(label);
  stage.addChild(barTrack);
  stage.addChild(barFill);
  stage.addChild(urgentOverlay);
  stage.addChild(barFrame);

  const renderState: CharacterNameLabelRenderState = {
    label,
    barTrack,
    barFill,
    urgentOverlay,
    barFrame,
    lastFillColor: MINI_STAMINA_BAR_HIGH_COLOR,
    lastFillWidth: 0,
    lastUrgentOverlayAlpha: 0,
    lastUrgentOverlayVisible: false,
  };

  labelStore.set(eid, renderState);
  return renderState;
}

function removeCharacterNameLabel(eid: number): void {
  const renderState = labelStore.get(eid);
  if (!renderState) {
    return;
  }

  renderState.label.removeFromParent();
  renderState.label.destroy();
  renderState.barTrack.removeFromParent();
  renderState.barTrack.destroy();
  renderState.barFill.removeFromParent();
  renderState.barFill.destroy();
  renderState.urgentOverlay.removeFromParent();
  renderState.urgentOverlay.destroy();
  renderState.barFrame.removeFromParent();
  renderState.barFrame.destroy();
  labelStore.delete(eid);
}

function updateCharacterNameLabel(
  renderState: CharacterNameLabelRenderState,
  world: MainSceneWorld,
  eid: number,
  currentTime: number,
): void {
  const x = PositionComp.x[eid];
  const y = PositionComp.y[eid];
  const configuredZIndex = RenderComp.zIndex[eid];
  const effectiveZIndex =
    configuredZIndex === ECS_NULL_VALUE ? y : configuredZIndex;
  const { bottomY } = getCharacterVerticalBounds(eid);
  const barTopY = Math.round(getCharacterStaminaBarTopY(eid, bottomY));
  const labelCenterY = Math.round(
    barTopY +
      STAMINA_BAR_HEIGHT +
      STAMINA_BAR_LABEL_GAP +
      NAME_LABEL_FONT_SIZE / 2,
  );

  renderState.label.position.set(Math.round(x), labelCenterY);
  renderState.label.zIndex = effectiveZIndex + LABEL_Z_INDEX_OFFSET;
  renderState.label.visible = true;

  if (ObjectComp.state[eid] === CharacterState.DEAD) {
    setMiniStaminaBarVisible(renderState, false);
    renderState.lastUrgentOverlayAlpha = 0;
    renderState.lastUrgentOverlayVisible = false;
    return;
  }

  const barVisual = getCharacterBarVisual(world, eid, currentTime);
  const barLeftX = getCharacterStaminaBarLeftX(eid, x);

  renderState.barTrack.position.set(barLeftX, barTopY);
  renderState.barFill.position.set(barLeftX, barTopY);
  renderState.urgentOverlay.position.set(barLeftX, barTopY);
  renderState.barFrame.position.set(barLeftX, barTopY);
  renderState.barTrack.zIndex = effectiveZIndex + STAMINA_BAR_Z_INDEX_OFFSET;
  renderState.barFill.zIndex = effectiveZIndex + STAMINA_BAR_Z_INDEX_OFFSET;
  renderState.urgentOverlay.zIndex =
    effectiveZIndex + STAMINA_BAR_Z_INDEX_OFFSET;
  renderState.barFrame.zIndex = effectiveZIndex + STAMINA_BAR_Z_INDEX_OFFSET;
  setMiniStaminaBarVisible(renderState, true);

  drawMiniStaminaBar(renderState, barVisual, currentTime);
}

function truncateDisplayName(name: string): string {
  return truncateNameLabelToWidth(name, NAME_LABEL_TEXT_WIDTH);
}

function setMiniStaminaBarVisible(
  renderState: CharacterNameLabelRenderState,
  visible: boolean,
): void {
  renderState.barTrack.visible = visible;
  renderState.barFill.visible = visible;
  renderState.urgentOverlay.visible = visible;
  renderState.barFrame.visible = visible;
}

function drawMiniStaminaBar(
  renderState: CharacterNameLabelRenderState,
  barVisual: {
    fillWidth: number;
    fillColor: number;
    isUrgent: boolean;
  },
  currentTime: number,
): void {
  renderState.barTrack.clear();
  drawCutCornerRect(
    renderState.barTrack,
    0,
    0,
    STAMINA_BAR_TRACK_WIDTH,
    STAMINA_BAR_TRACK_HEIGHT,
    {
      color: MINI_STAMINA_BAR_TRACK_COLOR,
      alpha: MINI_STAMINA_BAR_TRACK_ALPHA,
    },
  );
  drawCutCornerDotGrid(
    renderState.barTrack,
    STAMINA_BAR_TRACK_WIDTH,
    STAMINA_BAR_TRACK_HEIGHT,
    {
      color: MINI_STAMINA_BAR_TRACK_DOT_COLOR,
      alpha: MINI_STAMINA_BAR_TRACK_DOT_ALPHA,
    },
  );

  renderState.barFill.clear();

  const { fillWidth, fillColor, isUrgent } = barVisual;
  if (fillWidth > 0) {
    drawLeftCutRect(
      renderState.barFill,
      0,
      0,
      fillWidth,
      STAMINA_BAR_TRACK_HEIGHT,
      fillColor,
    );
  }

  renderState.urgentOverlay.clear();

  if (isUrgent) {
    const alpha = getMiniStaminaBarUrgentOverlayAlpha(currentTime);

    drawCutCornerRect(
      renderState.urgentOverlay,
      0,
      0,
      STAMINA_BAR_TRACK_WIDTH,
      STAMINA_BAR_TRACK_HEIGHT,
      {
        color: MINI_STAMINA_BAR_URGENT_OVERLAY_COLOR,
        alpha,
      },
    );

    renderState.lastUrgentOverlayAlpha = alpha;
    renderState.lastUrgentOverlayVisible = true;
  } else {
    renderState.lastUrgentOverlayAlpha = 0;
    renderState.lastUrgentOverlayVisible = false;
  }

  renderState.barFrame.clear();
  drawCutCornerFrame(
    renderState.barFrame,
    0,
    0,
    STAMINA_BAR_WIDTH,
    STAMINA_BAR_HEIGHT,
    {
      color: MINI_STAMINA_BAR_BORDER_COLOR,
      alpha: MINI_STAMINA_BAR_BORDER_ALPHA,
    },
  );

  if (isUrgent) {
    drawCutCornerFrame(
      renderState.barFrame,
      0,
      0,
      STAMINA_BAR_WIDTH,
      STAMINA_BAR_HEIGHT,
      {
        color: MINI_STAMINA_BAR_URGENT_OVERLAY_COLOR,
        alpha: renderState.lastUrgentOverlayAlpha,
      },
    );
  }

  renderState.lastFillColor = fillColor;
  renderState.lastFillWidth = fillWidth;
}

function getCharacterBarVisual(
  world: MainSceneWorld,
  eid: number,
  currentTime: number,
): {
  fillWidth: number;
  fillColor: number;
  isUrgent: boolean;
} {
  if (ObjectComp.state[eid] === CharacterState.EGG) {
    return {
      fillWidth: getEggTimerBarFillWidth(eid, currentTime),
      fillColor: MINI_STAMINA_BAR_EGG_FILL_COLOR,
      isUrgent: false,
    };
  }

  const stamina = CharacterStatusComp.stamina[eid];

  return {
    fillWidth: getMiniStaminaBarFillWidth(stamina),
    fillColor: getMiniStaminaBarFillColor(stamina),
    isUrgent: hasUrgentStatus(eid),
  };
}

function hasUrgentStatus(eid: number): boolean {
  return Array.from(CharacterStatusComp.statuses[eid]).includes(
    CharacterStatus.URGENT,
  );
}

function clampUnitInterval(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getMiniStaminaBarFillColor(stamina: number): number {
  if (stamina < GAME_CONSTANTS.UNHAPPY_STAMINA_THRESHOLD) {
    return MINI_STAMINA_BAR_LOW_COLOR;
  }

  if (stamina < GAME_CONSTANTS.BOOSTED_STAMINA_THRESHOLD) {
    return MINI_STAMINA_BAR_MID_COLOR;
  }

  return MINI_STAMINA_BAR_HIGH_COLOR;
}

function getMiniStaminaBarFillWidth(stamina: number): number {
  return Math.max(
    0,
    Math.round(
      clampUnitInterval(stamina / GAME_CONSTANTS.MAX_STAMINA) *
        STAMINA_BAR_TRACK_WIDTH,
    ),
  );
}

function getEggTimerBarFillWidth(eid: number, currentTime: number): number {
  const progress = getEggHatchProgress({
    currentTime,
    hatchTime: EggHatchComp.hatchTime[eid],
    hatchDurationMs: EggHatchComp.hatchDurationMs[eid],
  });

  return Math.max(0, Math.round((1 - progress) * STAMINA_BAR_TRACK_WIDTH));
}

export function getCharacterStaminaBarTopY(
  eid: number,
  resolvedBottomY?: number,
): number {
  const { bottomY } =
    resolvedBottomY === undefined
      ? getCharacterVerticalBounds(eid)
      : { bottomY: resolvedBottomY };
  return bottomY + CHARACTER_STAMINA_BAR_TOP_GAP;
}

export function getCharacterStaminaBarLeftX(
  eid: number,
  resolvedX?: number,
): number {
  const x = resolvedX ?? PositionComp.x[eid];
  return Math.round(x - STAMINA_BAR_WIDTH / 2);
}

export function getCharacterStaminaBarBounds(
  eid: number,
  resolvedX?: number,
): {
  leftX: number;
  rightX: number;
  width: number;
  height: number;
  centerX: number;
} {
  const leftX = getCharacterStaminaBarLeftX(eid, resolvedX);

  return {
    leftX,
    rightX: leftX + STAMINA_BAR_WIDTH,
    width: STAMINA_BAR_WIDTH,
    height: STAMINA_BAR_HEIGHT,
    centerX: leftX + STAMINA_BAR_WIDTH / 2,
  };
}

function drawCutCornerRect(
  graphics: PIXI.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: number | { color: number; alpha?: number },
): void {
  if (width <= 0 || height <= 0) {
    return;
  }

  for (let row = 0; row < height; row += 1) {
    const { startX, rowWidth } = getCutCornerRowBounds(width, height, row);

    if (rowWidth <= 0) {
      continue;
    }

    graphics.rect(x + startX, y + row, rowWidth, 1).fill(fill);
  }
}

function drawLeftCutRect(
  graphics: PIXI.Graphics,
  x: number,
  y: number,
  fillWidth: number,
  height: number,
  fill: number | { color: number; alpha?: number },
): void {
  if (fillWidth <= 0 || height <= 0) {
    return;
  }

  for (let row = 0; row < height; row += 1) {
    const { startX, maxXExclusive } = getCutCornerRowBounds(
      STAMINA_BAR_TRACK_WIDTH,
      height,
      row,
    );
    const clippedEndX = Math.min(fillWidth, maxXExclusive);
    const rowWidth = clippedEndX - startX;

    if (rowWidth <= 0) {
      continue;
    }

    graphics.rect(x + startX, y + row, rowWidth, 1).fill(fill);
  }
}

function drawCutCornerFrame(
  graphics: PIXI.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  stroke: { color: number; alpha?: number },
): void {
  if (width <= 0 || height <= 0) {
    return;
  }

  for (let row = 0; row < height; row += 1) {
    const isTopBand = row < STAMINA_BAR_BORDER_THICKNESS;
    const isBottomBand = row >= height - STAMINA_BAR_BORDER_THICKNESS;

    if (isTopBand || isBottomBand) {
      const cornerInset = Math.min(
        STAMINA_BAR_BORDER_THICKNESS,
        Math.floor(width / 2),
      );
      const startX = width > cornerInset * 2 ? cornerInset : 0;
      const rowWidth = width > cornerInset * 2 ? width - cornerInset * 2 : width;

      if (rowWidth > 0) {
        graphics.rect(x + startX, y + row, rowWidth, 1).fill(stroke);
      }
      continue;
    }

    const sideWidth = Math.min(STAMINA_BAR_BORDER_THICKNESS, width);
    if (sideWidth > 0) {
      graphics.rect(x, y + row, sideWidth, 1).fill(stroke);
      graphics.rect(x + width - sideWidth, y + row, sideWidth, 1).fill(stroke);
    }
  }
}

function drawCutCornerDotGrid(
  graphics: PIXI.Graphics,
  width: number,
  height: number,
  fill: number | { color: number; alpha?: number },
): void {
  if (width <= 0 || height <= 0) {
    return;
  }

  for (let row = 0; row < height; row += MINI_STAMINA_BAR_TRACK_DOT_SIZE) {
    const { startX, maxXExclusive } = getCutCornerRowBounds(width, height, row);
    const rowBandIndex = Math.floor(row / MINI_STAMINA_BAR_TRACK_DOT_SIZE);
    const parityOffset =
      (((rowBandIndex % 2) * MINI_STAMINA_BAR_TRACK_DOT_SIZE) +
        MINI_STAMINA_BAR_TRACK_DOT_STRIDE) %
      MINI_STAMINA_BAR_TRACK_DOT_STRIDE;
    const firstDotX =
      startX + ((parityOffset - (startX % MINI_STAMINA_BAR_TRACK_DOT_STRIDE) + MINI_STAMINA_BAR_TRACK_DOT_STRIDE) %
        MINI_STAMINA_BAR_TRACK_DOT_STRIDE);

    for (
      let x = firstDotX;
      x < maxXExclusive;
      x += MINI_STAMINA_BAR_TRACK_DOT_STRIDE
    ) {
      const dotX = x + MINI_STAMINA_BAR_TRACK_DOT_X_OFFSET;
      const dotY = row + MINI_STAMINA_BAR_TRACK_DOT_Y_OFFSET;
      const clippedX = Math.max(0, dotX);
      const clippedY = Math.max(0, dotY);
      const clippedWidth = Math.min(
        MINI_STAMINA_BAR_TRACK_DOT_SIZE - (clippedX - dotX),
        maxXExclusive - clippedX,
      );
      const clippedHeight = Math.min(
        MINI_STAMINA_BAR_TRACK_DOT_SIZE - (clippedY - dotY),
        height - clippedY,
      );

      if (clippedWidth <= 0 || clippedHeight <= 0) {
        continue;
      }

      graphics
        .rect(
          clippedX,
          clippedY,
          clippedWidth,
          clippedHeight,
        )
        .fill(fill);
    }
  }
}

function getCutCornerRowBounds(
  width: number,
  height: number,
  row: number,
): {
  startX: number;
  rowWidth: number;
  maxXExclusive: number;
} {
  const inCornerBand =
    row < STAMINA_BAR_BORDER_THICKNESS ||
    row >= height - STAMINA_BAR_BORDER_THICKNESS;
  const cornerInset = inCornerBand
    ? Math.min(STAMINA_BAR_BORDER_THICKNESS, Math.floor(width / 2))
    : 0;
  const startX = cornerInset;
  const maxXExclusive = width - cornerInset;
  const rowWidth = maxXExclusive - startX;

  return {
    startX,
    rowWidth,
    maxXExclusive,
  };
}

function getMiniStaminaBarUrgentOverlayAlpha(currentTime: number): number {
  const normalizedTime =
    ((currentTime % MINI_STAMINA_BAR_URGENT_OVERLAY_CYCLE_MS) +
      MINI_STAMINA_BAR_URGENT_OVERLAY_CYCLE_MS) %
    MINI_STAMINA_BAR_URGENT_OVERLAY_CYCLE_MS;
  const phase = normalizedTime / MINI_STAMINA_BAR_URGENT_OVERLAY_CYCLE_MS;
  const triangleWave = phase < 0.5 ? phase * 2 : (1 - phase) * 2;

  return (
    MINI_STAMINA_BAR_URGENT_OVERLAY_MIN_ALPHA +
    (MINI_STAMINA_BAR_URGENT_OVERLAY_MAX_ALPHA -
      MINI_STAMINA_BAR_URGENT_OVERLAY_MIN_ALPHA) *
      triangleWave
  );
}

export function getCharacterNameLabelRenderStateForTests(
  eid: number,
): CharacterNameLabelRenderState | undefined {
  return labelStore.get(eid);
}

export function getMiniStaminaBarFillColorForTests(stamina: number): number {
  return getMiniStaminaBarFillColor(stamina);
}

export function getMiniStaminaBarFillWidthForTests(stamina: number): number {
  return getMiniStaminaBarFillWidth(stamina);
}

export function getEggTimerBarFillWidthForTests(
  progress: number,
): number {
  return Math.max(
    0,
    Math.round((1 - clampUnitInterval(progress)) * STAMINA_BAR_TRACK_WIDTH),
  );
}

export function getEggTimerBarFillColorForTests(): number {
  return MINI_STAMINA_BAR_EGG_FILL_COLOR;
}

export function getMiniStaminaBarUrgentOverlayAlphaForTests(
  currentTime: number,
): number {
  return getMiniStaminaBarUrgentOverlayAlpha(currentTime);
}

export function getCharacterNameLabelLayoutForTests(): {
  textWidth: number;
  barWidth: number;
  barHeight: number;
  barBorderThickness: number;
  barTrackWidth: number;
  barTrackHeight: number;
  characterBarTopGap: number;
  barLabelGap: number;
} {
  return {
    textWidth: NAME_LABEL_TEXT_WIDTH,
    barWidth: STAMINA_BAR_WIDTH,
    barHeight: STAMINA_BAR_HEIGHT,
    barBorderThickness: STAMINA_BAR_BORDER_THICKNESS,
    barTrackWidth: STAMINA_BAR_TRACK_WIDTH,
    barTrackHeight: STAMINA_BAR_TRACK_HEIGHT,
    characterBarTopGap: CHARACTER_STAMINA_BAR_TOP_GAP,
    barLabelGap: STAMINA_BAR_LABEL_GAP,
  };
}
