// PIXI 렌더링 시스템
import { defineQuery, exitQuery } from "bitecs";
import { PositionComp, AngleComp, RenderComp } from "../raw-components";
import * as PIXI from "pixi.js";
import { ECS_NULL_VALUE } from "@/utils/ecs";
import { MainSceneWorld } from "../world";
import { AssetLoader } from "@/utils/AssetLoader";

/** NOTE: types.ts에 {@link TextureKey}과 싱크가 맞아야 함. */
const TEXTURE_MAP: Record<number, string> = {
  1: "test-green-slime_A1",
  2: "test-green-slime_B1",
  3: "test-green-slime_C1",
  4: "test-green-slime_D1",
  5: "green-slime",
  6: "mushroom2",
  100: "bird",
  101: "poob",
  102: "broom",
  103: "basket",
  104: "tombstone",
  110: "food-1",
  111: "food-2",
  112: "food-3",
  150: "egg-0",
  151: "egg-1",
} as const;

// const TEXTURES_MAP_SIZE = Object.keys(TEXTURES_MAP).length;

const spriteStore: PIXI.Sprite[] = [];
export function setSpriteStore(store: PIXI.Sprite[]) {
  spriteStore.length = 0;
  for (const s of store) spriteStore.push(s);
}

function getSprite(idx: number): PIXI.Sprite | undefined {
  return spriteStore[idx] || undefined;
}

function getTextureFromKey(textureKey: number): PIXI.Texture | null {
  const textureName = TEXTURE_MAP[textureKey];

  if (!textureName || textureKey === 0) {
    return null;
  }

  const texture = AssetLoader.getTextureByName(textureName);

  if (!texture) {
    console.warn(`[RenderSystem] Texture not found: ${textureName}`);
  }

  return texture;
}

function createSpriteForEntity(eid: number): PIXI.Sprite | undefined {
  const textureKey = RenderComp.textureKey[eid];
  const texture = getTextureFromKey(textureKey);

  if (!texture) {
    return undefined;
  }

  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(0.5);
  return sprite;
}

const renderableQuery = defineQuery([PositionComp, AngleComp, RenderComp]);
const exitedRenderableQuery = exitQuery(renderableQuery);

/**
 * 디버깅을 위해 모든 사용 가능한 텍스처 이름을 콘솔에 출력합니다
 */
export function logAvailableTextures(): void {
  const textureNames = AssetLoader.getAvailableTextureNames();
  console.log(
    `[RenderSystem] Available textures (${textureNames.length}):`,
    textureNames
  );
}

export function renderSystem(world: MainSceneWorld): MainSceneWorld {
  const entities = renderableQuery(world);
  const exitedEntities = exitedRenderableQuery(world);
  const stage = world.getStage();

  // 제거된 엔티티들의 스프라이트를 stage에서 제거
  for (let i = 0; i < exitedEntities.length; i++) {
    const eid = exitedEntities[i];
    const spriteRefIndex = RenderComp.spriteRefIndex[eid];
    const sprite = getSprite(spriteRefIndex);

    if (sprite && sprite.parent) {
      stage.removeChild(sprite);
      console.log(`[RenderSystem] Removed sprite from stage for entity ${eid}`);

      // 스프라이트를 destroy하여 메모리 해제
      sprite.destroy();

      // spriteStore에서도 제거 (인덱스를 null로 설정)
      if (spriteRefIndex < spriteStore.length) {
        spriteStore[spriteRefIndex] = null as any;
      }
    }
  }

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    const spriteRefIndex = RenderComp.spriteRefIndex[eid];

    let sprite = getSprite(spriteRefIndex);

    // 스프라이트가 없으면 생성
    if (!sprite) {
      sprite = createSpriteForEntity(eid);
      if (!sprite) continue;

      // 스프라이트 스토어에 추가
      spriteStore.push(sprite);
      RenderComp.spriteRefIndex[eid] = spriteStore.length - 1;

      // Stage에 스프라이트 추가
      stage.addChild(sprite);
      console.log(`[RenderSystem] Added sprite to stage for entity ${eid}`);
    }

    const x = PositionComp.x[eid];
    const y = PositionComp.y[eid];
    sprite.position.set(x, y);

    const angle = AngleComp.value[eid];
    sprite.rotation = angle;

    sprite.zIndex = RenderComp.zIndex[eid];
    sprite.scale.set(RenderComp.scale[eid]);

    const textureKey = RenderComp.textureKey[eid];
    const newTexture = getTextureFromKey(textureKey);
    if (newTexture && sprite.texture !== newTexture) {
      sprite.texture = newTexture;
    }
  }

  return world;
}
