import { defineQuery, exitQuery } from "bitecs";
import * as PIXI from "pixi.js";
import { getEggCrackStage, getEggHatchProgress } from "../config";
import { EggHatchComp, ObjectComp, RenderComp } from "../raw-components";
import { CharacterState, isEggTextureKey } from "../types";
import type { MainSceneWorld } from "../world";
import { getSpriteStore } from "./RenderSystem";

type EggCrackOverlay = {
  container: PIXI.Container;
  crack: PIXI.Graphics;
  mask: PIXI.Sprite;
};

const EGG_CRACK_COLOR = 0x000000;
const EGG_CRACK_BASE_ALPHA = 1;
const EGG_CRACK_STAGE_ALPHA_STEP = 0.12;
const EGG_CRACK_PIXEL_SIZE = 1;
const overlayStore = new Map<number, EggCrackOverlay>();

const eggCrackQuery = defineQuery([ObjectComp, RenderComp, EggHatchComp]);
const eggCrackExitQuery = exitQuery(eggCrackQuery);

function getOrCreateOverlay(
  eid: number,
  stage: PIXI.Container,
): EggCrackOverlay {
  const existing = overlayStore.get(eid);
  if (existing) {
    return existing;
  }

  const container = new PIXI.Container();
  const crack = new PIXI.Graphics();
  const mask = new PIXI.Sprite();

  container.eventMode = "none";
  crack.eventMode = "none";
  mask.eventMode = "none";
  mask.anchor.set(0.5);
  container.addChild(crack);
  container.addChild(mask);
  container.mask = mask;

  if (!stage.sortableChildren) {
    stage.sortableChildren = true;
  }

  stage.addChild(container);

  const overlay = { container, crack, mask };
  overlayStore.set(eid, overlay);
  return overlay;
}

function removeOverlay(eid: number): void {
  const overlay = overlayStore.get(eid);
  if (!overlay) {
    return;
  }

  overlay.container.removeFromParent();
  overlay.container.destroy({ children: true });
  overlayStore.delete(eid);
}

function drawCrackPath(
  graphics: PIXI.Graphics,
  points: Array<[number, number]>,
  alpha: number,
): void {
  if (points.length < 2) {
    return;
  }

  for (let i = 1; i < points.length; i++) {
    const [startX, startY] = points[i - 1];
    const [endX, endY] = points[i];
    drawPixelSegment(graphics, startX, startY, endX, endY, alpha);
  }
}

function drawPixelSegment(
  graphics: PIXI.Graphics,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  alpha: number,
): void {
  let x0 = Math.round(startX);
  let y0 = Math.round(startY);
  const x1 = Math.round(endX);
  const y1 = Math.round(endY);
  const deltaX = Math.abs(x1 - x0);
  const deltaY = Math.abs(y1 - y0);
  const stepX = x0 < x1 ? 1 : -1;
  const stepY = y0 < y1 ? 1 : -1;
  let error = deltaX - deltaY;

  while (true) {
    graphics
      .rect(x0, y0, EGG_CRACK_PIXEL_SIZE, EGG_CRACK_PIXEL_SIZE)
      .fill({ color: EGG_CRACK_COLOR, alpha });

    if (x0 === x1 && y0 === y1) {
      break;
    }

    const doubledError = error * 2;

    if (doubledError > -deltaY) {
      error -= deltaY;
      x0 += stepX;
    }

    if (doubledError < deltaX) {
      error += deltaX;
      y0 += stepY;
    }
  }
}

function drawEggCracks(
  graphics: PIXI.Graphics,
  bounds: PIXI.Bounds,
  stage: 1 | 2 | 3,
): void {
  const inset = Math.max(6, Math.min(bounds.width, bounds.height) * 0.2);
  const left = bounds.x + inset;
  const right = bounds.x + bounds.width - inset;
  const top = bounds.y + inset + 1;
  const bottom = bounds.y + bounds.height - inset - 1;
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const innerWidth = right - left;
  const innerHeight = bottom - top;
  const shortX = innerWidth * 0.07;
  const shortY = innerHeight * 0.1;
  const mediumX = innerWidth * 0.16;
  const mediumY = innerHeight * 0.2;
  const longX = innerWidth * 0.25;
  const longY = innerHeight * 0.32;
  const alpha = Math.min(
    1,
    EGG_CRACK_BASE_ALPHA + stage * EGG_CRACK_STAGE_ALPHA_STEP,
  );
  const rootTop: [number, number] = [
    centerX - shortX * 0.55,
    centerY - shortY * 1.05,
  ];
  const rootUpper: [number, number] = [
    centerX + shortX * 0.18,
    centerY - shortY * 0.28,
  ];
  const rootMiddle: [number, number] = [
    centerX - shortX * 0.46,
    centerY + shortY * 0.28,
  ];
  const rootLower: [number, number] = [
    centerX + shortX * 0.08,
    centerY + shortY * 1.02,
  ];
  const upperRightStem: [number, number] = [
    centerX + shortX * 0.96,
    centerY - shortY * 1.08,
  ];
  const upperRightTip: [number, number] = [
    centerX + longX * 0.94,
    centerY - mediumY * 1.08,
  ];
  const lowerLeftStem: [number, number] = [
    centerX - shortX * 1.18,
    centerY + shortY * 1.02,
  ];
  const lowerLeftTip: [number, number] = [
    centerX - longX * 0.92,
    centerY + mediumY * 0.98,
  ];
  const upperLeftStem: [number, number] = [
    centerX - shortX * 1.16,
    centerY - shortY * 1.66,
  ];
  const upperLeftTip: [number, number] = [
    centerX - longX * 0.86,
    centerY - longY * 0.94,
  ];
  const lowerRightStem: [number, number] = [
    centerX + shortX * 1.02,
    centerY + shortY * 1.1,
  ];
  const lowerRightTip: [number, number] = [
    centerX + longX * 0.84,
    centerY + longY * 0.84,
  ];
  const upperRightSplit: [number, number] = [
    centerX + mediumX * 0.78,
    centerY - shortY * 0.44,
  ];
  const upperRightSplitTip: [number, number] = [
    centerX + longX * 0.8,
    centerY + shortY * 0.08,
  ];
  const lowerLeftSplit: [number, number] = [
    centerX - mediumX * 0.74,
    centerY + shortY * 0.32,
  ];
  const lowerLeftSplitTip: [number, number] = [
    centerX - longX * 0.74,
    centerY - shortY * 0.14,
  ];
  const topStem: [number, number] = [
    centerX - shortX * 0.04,
    centerY - mediumY * 0.96,
  ];
  const topTip: [number, number] = [
    centerX + shortX * 0.1,
    top + innerHeight * 0.08,
  ];
  const lowerLeftDownStem: [number, number] = [
    centerX - mediumX * 0.58,
    centerY + mediumY * 0.96,
  ];
  const lowerLeftDownTip: [number, number] = [
    left + innerWidth * 0.18,
    bottom - innerHeight * 0.06,
  ];

  graphics.clear();

  drawCrackPath(graphics, [rootTop, rootUpper, rootMiddle, rootLower], alpha);

  if (stage >= 2) {
    drawCrackPath(graphics, [rootUpper, upperRightStem, upperRightTip], alpha);
    drawCrackPath(graphics, [rootMiddle, lowerLeftStem, lowerLeftTip], alpha);
  }

  if (stage >= 3) {
    drawCrackPath(graphics, [rootTop, upperLeftStem, upperLeftTip], alpha);
    drawCrackPath(graphics, [rootLower, lowerRightStem, lowerRightTip], alpha);
    drawCrackPath(
      graphics,
      [upperRightStem, upperRightSplit, upperRightSplitTip],
      alpha,
    );
    drawCrackPath(
      graphics,
      [lowerLeftStem, lowerLeftSplit, lowerLeftSplitTip],
      alpha,
    );
    drawCrackPath(graphics, [rootUpper, topStem, topTip], alpha);
    drawCrackPath(
      graphics,
      [lowerLeftStem, lowerLeftDownStem, lowerLeftDownTip],
      alpha,
    );
  }
}

function syncOverlayMask(mask: PIXI.Sprite, sprite: PIXI.Sprite): void {
  mask.texture = sprite.texture;
  mask.anchor.copyFrom(sprite.anchor);
  mask.position.set(0, 0);
  mask.scale.set(1, 1);
  mask.rotation = 0;
}

function syncOverlayTransform(
  overlay: EggCrackOverlay,
  sprite: PIXI.Sprite,
): void {
  overlay.container.position.copyFrom(sprite.position);
  overlay.container.scale.copyFrom(sprite.scale);
  overlay.container.rotation = sprite.rotation;
  overlay.container.zIndex = sprite.zIndex + 0.5;
  overlay.container.visible = sprite.visible;
  overlay.container.alpha = sprite.alpha;
}

export function cleanupEggCrackRenderState(): void {
  overlayStore.forEach((_overlay, eid) => {
    removeOverlay(eid);
  });
}

export function eggCrackRenderSystem(params: {
  world: MainSceneWorld;
  delta: number;
  currentTime: number;
}): typeof params {
  const { world, currentTime } = params;
  const exitedEntities = eggCrackExitQuery(world);

  for (let i = 0; i < exitedEntities.length; i++) {
    removeOverlay(exitedEntities[i]);
  }

  const entities = eggCrackQuery(world);
  const activeEntities = new Set<number>();
  const spriteStore = getSpriteStore();

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    const textureKey = RenderComp.textureKey[eid];

    if (
      ObjectComp.state[eid] !== CharacterState.EGG ||
      !isEggTextureKey(textureKey)
    ) {
      removeOverlay(eid);
      continue;
    }

    const progress = getEggHatchProgress({
      currentTime,
      hatchTime: EggHatchComp.hatchTime[eid],
      hatchDurationMs: EggHatchComp.hatchDurationMs[eid],
    });
    const crackStage = getEggCrackStage(progress);

    if (crackStage === 0) {
      removeOverlay(eid);
      continue;
    }

    const baseSprite = spriteStore.get(eid);
    if (!baseSprite) {
      removeOverlay(eid);
      continue;
    }

    const bounds = baseSprite.getLocalBounds();
    if (bounds.width <= 0 || bounds.height <= 0) {
      removeOverlay(eid);
      continue;
    }

    const overlay = getOrCreateOverlay(eid, world.stage);
    syncOverlayTransform(overlay, baseSprite);
    syncOverlayMask(overlay.mask, baseSprite);
    drawEggCracks(overlay.crack, bounds, crackStage);
    activeEntities.add(eid);
  }

  const trackedEids = Array.from(overlayStore.keys());
  for (let i = 0; i < trackedEids.length; i++) {
    const eid = trackedEids[i];
    if (!activeEntities.has(eid)) {
      removeOverlay(eid);
    }
  }

  return params;
}
