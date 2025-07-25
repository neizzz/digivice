// PIXI v8 렌더링 시스템
import { defineQuery, exitQuery } from "bitecs";
import { PositionComp, AngleComp, RenderComp } from "../raw-components";
import * as PIXI from "pixi.js";
import { MainSceneWorld } from "../world";
import { TextureKey } from "../types";
import { getTextureFromSpritesheet } from "../../../utils/asset";

/** NOTE: types.ts에 {@link TextureKey}과 싱크가 맞아야 함. */
const TEXTURE_MAP: Record<
  number,
  { spritesheetAlias?: string; textureName: string }
> = {
  // TODO: animation으로 취급
  // Character sprites (monsters) (1-99)
  // 1: { spritesheetAlias: "test-green-slime_A1", textureName: "idle-1" }, // CharacterKey.TestGreenSlimeA1
  // 2: { spritesheetAlias: "test-green-slime_B1", textureName: "idle-1" }, // CharacterKey.TestGreenSlimeB1
  // 3: { spritesheetAlias: "test-green-slime_C1", textureName: "idle-1" }, // CharacterKey.TestGreenSlimeC1
  // 4: { spritesheetAlias: "test-green-slime_D1", textureName: "idle-1" }, // CharacterKey.TestGreenSlimeD1

  // Bird sprites (100-199)
  // 100: { spritesheetAlias: "bird", textureName: "bird" },

  // Common 16x16 sprites (200-299)
  200: { spritesheetAlias: "common16x16", textureName: "poob" }, // TextureKey.POOB
  201: { spritesheetAlias: "common16x16", textureName: "broom" }, // TextureKey.BROOM
  202: { spritesheetAlias: "common16x16", textureName: "sick" }, // TextureKey.SICK
  203: { spritesheetAlias: "common16x16", textureName: "happy" }, // TextureKey.HAPPY
  204: { spritesheetAlias: "common16x16", textureName: "unhappy" }, // TextureKey.UNHAPPY
  205: { spritesheetAlias: "common16x16", textureName: "urgent" }, // TextureKey.URGENT
  206: { spritesheetAlias: "common16x16", textureName: "discover" }, // TextureKey.DISCOVER

  // Common 32x32 sprites (300-399)
  300: { spritesheetAlias: "common32x32", textureName: "basket" }, // TextureKey.BASKET
  301: { spritesheetAlias: "common32x32", textureName: "tomb" }, // TextureKey.TOMB

  // Food sprites (400-499)
  400: { spritesheetAlias: "foods", textureName: "food-1" }, // TextureKey.FOOD1
  401: { spritesheetAlias: "foods", textureName: "food-2" }, // TextureKey.FOOD2
  402: { spritesheetAlias: "foods", textureName: "food-3" }, // TextureKey.FOOD3

  // Egg sprites (500-599)
  500: { spritesheetAlias: "eggs", textureName: "egg-0" }, // TextureKey.EGG0
  501: { spritesheetAlias: "eggs", textureName: "egg-1" }, // TextureKey.EGG1

  // Pill sprites (600-699)
  600: { spritesheetAlias: "common16x16", textureName: "pill-1" }, // TextureKey.PILL1
  601: { spritesheetAlias: "common16x16", textureName: "pill-2" }, // TextureKey.PILL2
} as const;

// 스프라이트 스토어
const spriteStore: (PIXI.Sprite | PIXI.AnimatedSprite | null)[] = [];

// function setSpriteStore(store: PIXI.Sprite[]) {
//   spriteStore.length = 0;
//   for (const s of store) spriteStore.push(s);
// }

function getSprite(
  idx: number
): (PIXI.Sprite | PIXI.AnimatedSprite) | undefined {
  return spriteStore[idx] || undefined;
}

function getTextureFromKey(textureKey: number): PIXI.Texture | undefined {
  const textureInfo = TEXTURE_MAP[textureKey];
  if (!textureInfo) {
    if (import.meta.env.DEV) {
      throw new Error(
        `[RenderSystem] Texture key ${textureKey} not found in TEXTURE_MAP`
      );
    }
    console.warn(
      `[RenderSystem] Texture key ${textureKey} not found in TEXTURE_MAP`
    );
    return undefined;
  }

  try {
    if (!textureInfo.spritesheetAlias) {
      return PIXI.Assets.get<PIXI.Texture>(textureInfo.textureName);
    }

    // 스프라이트시트에서 텍스처 가져오기
    const spritesheet = PIXI.Assets.get<PIXI.Spritesheet>(
      textureInfo.spritesheetAlias
    );

    if (!spritesheet) {
      console.warn(
        `[RenderSystem] Spritesheet not found: ${textureInfo.spritesheetAlias} for texture key ${textureKey}`
      );
      return PIXI.Texture.WHITE;
    }

    const texture = getTextureFromSpritesheet(
      spritesheet,
      textureInfo.textureName
    );

    if (!texture) {
      console.warn(
        `[RenderSystem] Texture not found: ${textureInfo.textureName} in spritesheet ${textureInfo.spritesheetAlias} (key: ${textureKey})`
      );
      return PIXI.Texture.WHITE;
    }

    return texture;
  } catch (error) {
    console.error(
      `[RenderSystem] Error getting texture for key ${textureKey}:`,
      error
    );
    return PIXI.Texture.WHITE;
  }
}

function createSpriteForEntity(eid: number): PIXI.Sprite | undefined {
  const textureKey = RenderComp.textureKey[eid];
  const texture = getTextureFromKey(textureKey);
  if (!texture) {
    console.warn(
      `[RenderSystem] Texture not found for entity ${eid} with key ${textureKey}`
    );
    return new PIXI.Sprite(PIXI.Texture.WHITE);
  }
  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(0.5);
  return sprite;
}

const renderableQuery = defineQuery([PositionComp, AngleComp, RenderComp]);
const exitedRenderableQuery = exitQuery(renderableQuery);

// 개발 환경에서 텍스처 검증을 한 번만 수행하기 위한 플래그
let hasValidatedTextures = false;

export function renderSystem(params: {
  world: MainSceneWorld;
  delta: number;
}): typeof params {
  const { world } = params;
  // 첫 번째 실행 시 텍스처 맵 검증 (개발 환경에서만)
  if (process.env.NODE_ENV === "development" && !hasValidatedTextures) {
    validateTextureMap();
    hasValidatedTextures = true;
  }

  const entities = renderableQuery(world);
  const exitedEntities = exitedRenderableQuery(world);
  const stage = world.stage;

  // 제거된 엔티티들의 스프라이트를 stage에서 제거
  for (let i = 0; i < exitedEntities.length; i++) {
    const eid = exitedEntities[i];
    const storeIndex = RenderComp.storeIndex[eid];
    const sprite = getSprite(storeIndex);

    if (sprite && sprite.parent) {
      stage.removeChild(sprite);
      sprite.destroy();
      // if (storeIndex < spriteStore.length) {
      spriteStore[storeIndex] = null;
      // }
      console.log(`[RenderSystem] Removed sprite from stage for entity ${eid}`);
    }
  }

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    const textureKey = RenderComp.textureKey[eid];
    const storeIndex = RenderComp.storeIndex[eid];
    let sprite = getSprite(storeIndex);

    if (textureKey === TextureKey.NULL) {
      if (sprite) {
        stage.removeChild(sprite); // NULL 텍스처는 Stage에서 제거
        sprite.destroy();
        spriteStore[storeIndex] = null;

        console.log(
          `[RenderSystem] Removed sprite from stage for entity ${eid} (NULL texture)`
        );
      }
      continue;
    }

    // 스프라이트가 없으면 생성
    if (!sprite) {
      sprite = createSpriteForEntity(eid);
      if (!sprite) {
        console.warn(
          `[RenderSystem] Failed to create sprite for entity ${eid}`
        );
        continue;
      }

      stage.addChild(sprite);
      spriteStore.push(sprite);
      RenderComp.storeIndex[eid] = spriteStore.length - 1;
      console.log(`[RenderSystem] Added sprite to stage for entity ${eid}`);
    }

    renderCommonAttribute(eid, sprite);

    const newTexture = getTextureFromKey(textureKey);
    if (newTexture && sprite.texture !== newTexture) {
      sprite.texture = newTexture;
      console.log(
        `[RenderSystem] Updated texture for entity ${eid} to key ${textureKey}`
      );
    }
  }

  return params;
}

export function renderCommonAttribute(
  eid: number,
  sprite: PIXI.Sprite | PIXI.AnimatedSprite
): void {
  const x = PositionComp.x[eid];
  const y = PositionComp.y[eid];
  sprite.position.set(x, y);

  const angle = AngleComp.value[eid];
  sprite.zIndex = RenderComp.zIndex[eid] || y; // NOTE: zIndex가 없으면 y 좌표로 설정
  // angle이 왼쪽(PI 또는 -PI 부근)을 향하면 x scale에 -1을 곱하기
  const baseScale = RenderComp.scale[eid];
  const isLeft = Math.abs(angle) > Math.PI / 2;
  sprite.scale.set(isLeft ? -baseScale : baseScale, baseScale);
}

/**
 * 특정 텍스처가 로딩되었는지 확인
 */
export function isTextureLoaded(
  spritesheetAlias: string,
  textureName: string
): boolean {
  const cache = PIXI.Assets.cache;
  const spritesheet = cache.get(spritesheetAlias);

  if (spritesheet instanceof PIXI.Spritesheet && spritesheet.textures) {
    return !!spritesheet.textures[textureName];
  }

  return false;
}

/**
 * TextureKey로 텍스처가 로딩되었는지 확인
 */
export function isTextureKeyLoaded(textureKey: number): boolean {
  const textureInfo = TEXTURE_MAP[textureKey];
  if (!textureInfo) {
    return false;
  }

  return isTextureLoaded(
    // FIXME: undefined 핸들
    textureInfo.spritesheetAlias ?? "",
    textureInfo.textureName
  );
}

/**
 * 사용 가능한 TextureKey들을 반환합니다
 */
function getAvailableTextureKeys(): number[] {
  return Object.keys(TEXTURE_MAP)
    .map(Number)
    .sort((a, b) => a - b);
}

/**
 * TextureKey에 대응하는 스프라이트시트와 텍스처 정보를 반환합니다
 */
function getTextureInfo(
  textureKey: number
): { spritesheetAlias?: string; textureName: string } | null {
  return TEXTURE_MAP[textureKey] || null;
}

/**
 * 모든 텍스처의 로딩 상태를 확인하고 로그를 출력합니다
 */
function validateTextureMap(): void {
  console.group("[RenderSystem] Texture Map Validation:");

  const availableKeys = getAvailableTextureKeys();
  let validCount = 0;
  let invalidCount = 0;

  for (const textureKey of availableKeys) {
    const isLoaded = isTextureKeyLoaded(textureKey);
    const textureInfo = getTextureInfo(textureKey);

    if (isLoaded) {
      validCount++;
      console.log(
        `✓ Key ${textureKey}: ${textureInfo?.spritesheetAlias}/${textureInfo?.textureName}`
      );
    } else {
      invalidCount++;
      console.warn(
        `✗ Key ${textureKey}: ${textureInfo?.spritesheetAlias}/${textureInfo?.textureName} - NOT LOADED`
      );
    }
  }

  console.log(`Summary: ${validCount} valid, ${invalidCount} invalid textures`);
  console.groupEnd();
}
