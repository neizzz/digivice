import * as PIXI from "pixi.js";
import { CharacterKeyECS } from "../types";
import {
  getCharacterSpritesheetOptions,
  isSpritesheetLoaded,
} from "../../../utils/asset";
import { getTextureInfo, isTextureKeyLoaded } from "./RenderSystem";

export type CharacterOpaqueBounds = {
  sourceKey: string;
  alias: string;
  frameName: string;
  sourceWidth: number;
  sourceHeight: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

const OPAQUE_BOUNDS_PADDING_PX = 2;
const characterOpaqueBoundsCache = new Map<number, CharacterOpaqueBounds>();
const textureOpaqueBoundsCache = new Map<number, CharacterOpaqueBounds>();
const inFlightOpaqueBounds = new Map<string, Promise<CharacterOpaqueBounds | null>>();

let measurementCanvas: HTMLCanvasElement | null | undefined;
let measurementContext: CanvasRenderingContext2D | null | undefined;

export function getCachedCharacterOpaqueBounds(
  characterKey: number,
): CharacterOpaqueBounds | null {
  return characterOpaqueBoundsCache.get(characterKey) ?? null;
}

export function getCachedTextureOpaqueBounds(
  textureKey: number,
): CharacterOpaqueBounds | null {
  return textureOpaqueBoundsCache.get(textureKey) ?? null;
}

export async function ensureCharacterOpaqueBoundsComputed(
  characterKey: number,
): Promise<CharacterOpaqueBounds | null> {
  if (characterKey === CharacterKeyECS.NULL) {
    return null;
  }

  const cached = characterOpaqueBoundsCache.get(characterKey);
  if (cached) {
    return cached;
  }

  const spritesheetOptions = getCharacterSpritesheetOptions(
    characterKey as CharacterKeyECS,
  );
  if (!spritesheetOptions) {
    return null;
  }

  const alias = spritesheetOptions.alias ?? spritesheetOptions.jsonPath;
  if (!isSpritesheetLoaded(alias)) {
    return null;
  }

  const spritesheet = PIXI.Assets.get<PIXI.Spritesheet>(alias);
  if (!(spritesheet instanceof PIXI.Spritesheet)) {
    return null;
  }

  const idleTextureEntry = resolveIdleTextureEntry(spritesheet);
  if (!idleTextureEntry) {
    return null;
  }

  return ensureOpaqueBoundsComputed({
    cacheKey: `character:${characterKey}`,
    getCached: () => characterOpaqueBoundsCache.get(characterKey) ?? null,
    setCached: (bounds) => {
      characterOpaqueBoundsCache.set(characterKey, bounds);
    },
    texture: idleTextureEntry.texture,
    alias,
    frameName: idleTextureEntry.frameName,
  });
}

export async function ensureTextureOpaqueBoundsComputed(
  textureKey: number,
): Promise<CharacterOpaqueBounds | null> {
  if (textureKey <= 0) {
    return null;
  }

  const cached = textureOpaqueBoundsCache.get(textureKey);
  if (cached) {
    return cached;
  }

  if (!isTextureKeyLoaded(textureKey)) {
    return null;
  }

  const textureInfo = getTextureInfo(textureKey);
  if (!textureInfo?.spritesheetAlias) {
    return null;
  }

  const spritesheet = PIXI.Assets.get<PIXI.Spritesheet>(
    textureInfo.spritesheetAlias,
  );
  if (!(spritesheet instanceof PIXI.Spritesheet)) {
    return null;
  }

  const texture = spritesheet.textures?.[textureInfo.textureName];
  if (!texture) {
    return null;
  }

  return ensureOpaqueBoundsComputed({
    cacheKey: `texture:${textureKey}`,
    getCached: () => textureOpaqueBoundsCache.get(textureKey) ?? null,
    setCached: (bounds) => {
      textureOpaqueBoundsCache.set(textureKey, bounds);
    },
    texture,
    alias: textureInfo.spritesheetAlias,
    frameName: textureInfo.textureName,
  });
}

export async function precomputeLoadedCharacterOpaqueBounds(): Promise<void> {
  const characterKeys = Object.values(CharacterKeyECS).filter(
    (value): value is CharacterKeyECS =>
      typeof value === "number" && value !== CharacterKeyECS.NULL,
  );

  await Promise.all(
    characterKeys.map(async (characterKey) => {
      const spritesheetOptions = getCharacterSpritesheetOptions(characterKey);
      if (!spritesheetOptions) {
        return;
      }

      const alias = spritesheetOptions.alias ?? spritesheetOptions.jsonPath;
      if (!isSpritesheetLoaded(alias)) {
        return;
      }

      await ensureCharacterOpaqueBoundsComputed(characterKey);
    }),
  );
}

export async function precomputeLoadedTextureOpaqueBounds(
  textureKeys: number[],
): Promise<void> {
  await Promise.all(
    textureKeys.map(async (textureKey) => {
      if (!isTextureKeyLoaded(textureKey)) {
        return;
      }

      await ensureTextureOpaqueBoundsComputed(textureKey);
    }),
  );
}

function resolveIdleTextureEntry(
  spritesheet: PIXI.Spritesheet,
): { texture: PIXI.Texture; frameName: string } | null {
  const idleAnimation = spritesheet.animations?.idle;
  if (idleAnimation && idleAnimation.length > 0) {
    const texture = idleAnimation[0];
    const frameName =
      findTextureNameByReference(spritesheet, texture) ?? "idle:first";
    return { texture, frameName };
  }

  const idleTexture = spritesheet.textures?.idle_0;
  if (idleTexture) {
    return { texture: idleTexture, frameName: "idle_0" };
  }

  const textureEntries = Object.entries(spritesheet.textures ?? {});
  if (textureEntries.length === 0) {
    return null;
  }

  const [frameName, texture] = textureEntries[0];
  return { texture, frameName };
}

function findTextureNameByReference(
  spritesheet: PIXI.Spritesheet,
  targetTexture: PIXI.Texture,
): string | null {
  const textureEntries = Object.entries(spritesheet.textures ?? {});

  for (let i = 0; i < textureEntries.length; i++) {
    const [frameName, texture] = textureEntries[i];
    if (texture === targetTexture) {
      return frameName;
    }
  }

  return null;
}

function computeOpaqueBoundsFromTexture(
  texture: PIXI.Texture,
  sourceKey: string,
  alias: string,
  frameName: string,
): CharacterOpaqueBounds | null {
  const context = getMeasurementContext();
  if (!context) {
    return null;
  }

  const sourceResource = getTextureCanvasSource(texture);
  if (!sourceResource) {
    return null;
  }

  const resolution =
    (texture.source as typeof texture.source & {
      resolution?: number;
      _resolution?: number;
    }).resolution ??
    (texture.source as typeof texture.source & { _resolution?: number })
      ._resolution ??
    1;
  const frame = texture.frame;
  const frameWidth = Math.max(1, Math.round(frame.width));
  const frameHeight = Math.max(1, Math.round(frame.height));
  const sourceWidth = Math.max(1, Math.round(texture.orig.width || frame.width));
  const sourceHeight = Math.max(
    1,
    Math.round(texture.orig.height || frame.height),
  );
  const trimX = Math.round(texture.trim?.x ?? 0);
  const trimY = Math.round(texture.trim?.y ?? 0);

  measurementCanvas!.width = frameWidth;
  measurementCanvas!.height = frameHeight;
  context.clearRect(0, 0, frameWidth, frameHeight);
  context.drawImage(
    sourceResource,
    Math.round(frame.x * resolution),
    Math.round(frame.y * resolution),
    Math.max(1, Math.round(frame.width * resolution)),
    Math.max(1, Math.round(frame.height * resolution)),
    0,
    0,
    frameWidth,
    frameHeight,
  );

  const imageData = context.getImageData(0, 0, frameWidth, frameHeight);
  const scanResult = scanOpaquePixels(imageData.data, frameWidth, frameHeight);

  if (!scanResult) {
    return createFullFrameBounds({
      sourceKey,
      alias,
      frameName,
      sourceWidth,
      sourceHeight,
      trimX,
      trimY,
      frameWidth,
      frameHeight,
    });
  }

  const minXInSource = trimX + scanResult.minX;
  const maxXExclusiveInSource = trimX + scanResult.maxX + 1;
  const minYInSource = trimY + scanResult.minY;
  const maxYExclusiveInSource = trimY + scanResult.maxY + 1;

  const paddedMinXInSource = Math.max(
    0,
    minXInSource - OPAQUE_BOUNDS_PADDING_PX,
  );
  const paddedMaxXExclusiveInSource = Math.min(
    sourceWidth,
    maxXExclusiveInSource + OPAQUE_BOUNDS_PADDING_PX,
  );
  const paddedMinYInSource = Math.max(
    0,
    minYInSource - OPAQUE_BOUNDS_PADDING_PX,
  );
  const paddedMaxYExclusiveInSource = Math.min(
    sourceHeight,
    maxYExclusiveInSource + OPAQUE_BOUNDS_PADDING_PX,
  );

  const left = paddedMinXInSource - sourceWidth / 2;
  const right = paddedMaxXExclusiveInSource - sourceWidth / 2;
  const top = paddedMinYInSource - sourceHeight / 2;
  const bottom = paddedMaxYExclusiveInSource - sourceHeight / 2;

  return {
    sourceKey,
    alias,
    frameName,
    sourceWidth,
    sourceHeight,
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function createFullFrameBounds(params: {
  sourceKey: string;
  alias: string;
  frameName: string;
  sourceWidth: number;
  sourceHeight: number;
  trimX: number;
  trimY: number;
  frameWidth: number;
  frameHeight: number;
}): CharacterOpaqueBounds {
  const {
    sourceKey,
    alias,
    frameName,
    sourceWidth,
    sourceHeight,
    trimX,
    trimY,
    frameWidth,
    frameHeight,
  } = params;

  const left = trimX - sourceWidth / 2;
  const right = trimX + frameWidth - sourceWidth / 2;
  const top = trimY - sourceHeight / 2;
  const bottom = trimY + frameHeight - sourceHeight / 2;

  return {
    sourceKey,
    alias,
    frameName,
    sourceWidth,
    sourceHeight,
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

async function ensureOpaqueBoundsComputed(params: {
  cacheKey: string;
  getCached: () => CharacterOpaqueBounds | null;
  setCached: (bounds: CharacterOpaqueBounds) => void;
  texture: PIXI.Texture;
  alias: string;
  frameName: string;
}): Promise<CharacterOpaqueBounds | null> {
  const cached = params.getCached();
  if (cached) {
    return cached;
  }

  const existingPromise = inFlightOpaqueBounds.get(params.cacheKey);
  if (existingPromise) {
    return existingPromise;
  }

  const computePromise = (async (): Promise<CharacterOpaqueBounds | null> => {
    try {
      const bounds = computeOpaqueBoundsFromTexture(
        params.texture,
        params.cacheKey,
        params.alias,
        params.frameName,
      );

      if (bounds) {
        params.setCached(bounds);
      }

      return bounds;
    } finally {
      inFlightOpaqueBounds.delete(params.cacheKey);
    }
  })();

  inFlightOpaqueBounds.set(params.cacheKey, computePromise);
  return computePromise;
}

function scanOpaquePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alphaIndex = (y * width + x) * 4 + 3;
      if (data[alphaIndex] <= 0) {
        continue;
      }

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

function getMeasurementContext(): CanvasRenderingContext2D | null {
  if (measurementContext !== undefined) {
    return measurementContext;
  }

  if (typeof document === "undefined") {
    measurementCanvas = null;
    measurementContext = null;
    return measurementContext;
  }

  measurementCanvas = document.createElement("canvas");
  measurementContext = measurementCanvas.getContext("2d", {
    willReadFrequently: true,
  });

  return measurementContext;
}

function getTextureCanvasSource(texture: PIXI.Texture): CanvasImageSource | null {
  const resource = texture.source.resource as unknown;

  if (
    resource instanceof HTMLImageElement ||
    resource instanceof HTMLCanvasElement ||
    resource instanceof HTMLVideoElement ||
    (typeof ImageBitmap !== "undefined" && resource instanceof ImageBitmap) ||
    (typeof OffscreenCanvas !== "undefined" &&
      resource instanceof OffscreenCanvas)
  ) {
    return resource;
  }

  return null;
}
