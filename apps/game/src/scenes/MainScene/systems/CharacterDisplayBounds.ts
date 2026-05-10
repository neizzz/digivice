import * as PIXI from "pixi.js";
import {
  AnimationRenderComp,
  CharacterStatusComp,
  PositionComp,
  RenderComp,
} from "../raw-components";
import type { Boundary } from "../types";
import { getAnimatedSpriteStore } from "./AnimationRenderSystem";
import { getSpriteStore } from "./RenderSystem";
import {
  ensureCharacterOpaqueBoundsComputed,
  ensureTextureOpaqueBoundsComputed,
  getCachedCharacterOpaqueBounds,
  getCachedTextureOpaqueBounds,
} from "./CharacterOpaqueBounds";

const FALLBACK_CHARACTER_HEIGHT = 48;
const FALLBACK_CHARACTER_WIDTH = 48;
export const CHARACTER_SCREEN_EDGE_OVERFLOW_PX = 10;
export const CHARACTER_SCREEN_TOP_EDGE_OVERFLOW_PX = 14;

export function getCharacterDisplayObject(
  eid: number,
): PIXI.Sprite | PIXI.AnimatedSprite | undefined {
  return getSpriteStore().get(eid) ?? getAnimatedSpriteStore().get(eid);
}

export function getCharacterDisplayHeight(eid: number): number {
  return getCharacterWorldBounds(eid).height;
}

export function getCharacterVerticalBounds(eid: number): {
  topY: number;
  bottomY: number;
  height: number;
} {
  const bounds = getCharacterWorldBounds(eid);

  return {
    topY: bounds.topY,
    bottomY: bounds.bottomY,
    height: bounds.height,
  };
}

export function getCharacterWorldBounds(eid: number): {
  leftX: number;
  rightX: number;
  topY: number;
  bottomY: number;
  width: number;
  height: number;
} {
  const centerX = PositionComp.x[eid];
  const centerY = PositionComp.y[eid];
  const relativeBounds = getCharacterRelativeBounds(eid);

  return {
    leftX: centerX + relativeBounds.left,
    rightX: centerX + relativeBounds.right,
    topY: centerY + relativeBounds.top,
    bottomY: centerY + relativeBounds.bottom,
    width: relativeBounds.width,
    height: relativeBounds.height,
  };
}

export function getCharacterCenterBoundary(
  eid: number,
  boundary: Boundary,
  overflowPx: number = CHARACTER_SCREEN_EDGE_OVERFLOW_PX,
  topOverflowPx: number = CHARACTER_SCREEN_TOP_EDGE_OVERFLOW_PX,
): Boundary {
  const relativeBounds = getCharacterRelativeBounds(eid);
  const xRange = createClampedAxisRange(
    boundary.x - overflowPx - relativeBounds.left,
    boundary.x + boundary.width + overflowPx - relativeBounds.right,
  );
  const yRange = createClampedAxisRange(
    boundary.y - topOverflowPx - relativeBounds.top,
    boundary.y + boundary.height + overflowPx - relativeBounds.bottom,
  );

  return {
    x: xRange.min,
    y: yRange.min,
    width: xRange.max - xRange.min,
    height: yRange.max - yRange.min,
  };
}

function getCharacterRelativeBounds(eid: number): {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
} {
  const displayObject = getCharacterDisplayObject(eid);
  const opaqueBounds = getCharacterOpaqueBoundsForEntity(eid);

  if (opaqueBounds) {
    const scaleX = getCharacterScaleX(displayObject, eid);
    const scaleY = getCharacterScaleY(displayObject, eid);
    const left = opaqueBounds.left * scaleX;
    const right = opaqueBounds.right * scaleX;
    const top = opaqueBounds.top * scaleY;
    const bottom = opaqueBounds.bottom * scaleY;

    return {
      left,
      right,
      top,
      bottom,
      width: right - left,
      height: bottom - top,
    };
  }

  const width = getFallbackDisplayDimension(
    displayObject,
    "width",
    eid,
    FALLBACK_CHARACTER_WIDTH,
  );
  const height = getFallbackDisplayDimension(
    displayObject,
    "height",
    eid,
    FALLBACK_CHARACTER_HEIGHT,
  );
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  return {
    left: -halfWidth,
    right: halfWidth,
    top: -halfHeight,
    bottom: halfHeight,
    width,
    height,
  };
}

function getCharacterOpaqueBoundsForEntity(eid: number) {
  const sprite = getSpriteStore().get(eid);
  if (sprite) {
    const textureKey = RenderComp.textureKey[eid];

    if (!textureKey || textureKey === ECS_NULL_VALUE) {
      return null;
    }

    const cachedBounds = getCachedTextureOpaqueBounds(textureKey);
    if (cachedBounds) {
      return cachedBounds;
    }

    void ensureTextureOpaqueBoundsComputed(textureKey);
    return null;
  }

  const animatedSprite = getAnimatedSpriteStore().get(eid);

  if (animatedSprite) {
    const characterKey =
      AnimationRenderComp.spritesheetKey[eid] ||
      CharacterStatusComp.characterKey[eid];

    if (!characterKey || characterKey === ECS_NULL_VALUE) {
      return null;
    }

    const cachedBounds = getCachedCharacterOpaqueBounds(characterKey);
    if (cachedBounds) {
      return cachedBounds;
    }

    void ensureCharacterOpaqueBoundsComputed(characterKey);
    return null;
  }
  return null;
}

function getCharacterScaleX(
  displayObject: PIXI.Container | undefined,
  eid: number,
): number {
  const displayScaleX =
    displayObject && Number.isFinite(displayObject.scale.x)
      ? Math.abs(displayObject.scale.x)
      : NaN;

  if (Number.isFinite(displayScaleX) && displayScaleX > 0) {
    return displayScaleX;
  }

  return getFallbackScale(eid);
}

function getCharacterScaleY(
  displayObject: PIXI.Container | undefined,
  eid: number,
): number {
  const displayScaleY =
    displayObject && Number.isFinite(displayObject.scale.y)
      ? Math.abs(displayObject.scale.y)
      : NaN;

  if (Number.isFinite(displayScaleY) && displayScaleY > 0) {
    return displayScaleY;
  }

  return getFallbackScale(eid);
}

function getFallbackDisplayDimension(
  displayObject: PIXI.Container | undefined,
  axis: "width" | "height",
  eid: number,
  fallbackDimension: number,
): number {
  const dimension =
    displayObject && Number.isFinite(displayObject[axis])
      ? Number(displayObject[axis])
      : NaN;

  if (Number.isFinite(dimension) && dimension > 0) {
    return dimension;
  }

  const scale = getFallbackScale(eid);
  return scale > 0 ? scale * 16 : fallbackDimension;
}

function getFallbackScale(eid: number): number {
  const scale = RenderComp.scale[eid];
  return scale > 0 ? scale : 1;
}

function createClampedAxisRange(min: number, max: number): {
  min: number;
  max: number;
} {
  if (min <= max) {
    return { min, max };
  }

  const center = (min + max) / 2;
  return { min: center, max: center };
}
