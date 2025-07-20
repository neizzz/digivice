// 캐릭터 상태 아이콘 렌더링 시스템
import { defineQuery, exitQuery } from "bitecs";
import {
  PositionComp,
  CharacterStatusComp,
  StatusIconRenderComp,
  ObjectComp,
} from "../raw-components";
import * as PIXI from "pixi.js";
import { MainSceneWorld } from "../world";
import { CharacterStatus, ObjectType, TextureKey } from "../types";

// 상태 아이콘 매핑
const STATUS_TO_TEXTURE_KEY: Record<CharacterStatus, TextureKey> = {
  [CharacterStatus.SICK]: TextureKey.SICK,
  [CharacterStatus.HAPPY]: TextureKey.HAPPY,
  [CharacterStatus.UNHAPPY]: TextureKey.UNHAPPY,
  [CharacterStatus.URGENT]: TextureKey.URGENT,
};

// 엔티티별 스프라이트 스토어
const entityStatusSprites: Map<number, PIXI.Sprite[]> = new Map();

function getTextureFromKey(textureKey: number): PIXI.Texture | undefined {
  const textureMap: Record<
    number,
    { spritesheetAlias?: string; textureName: string }
  > = {
    [TextureKey.SICK]: { spritesheetAlias: "common16x16", textureName: "sick" },
    [TextureKey.HAPPY]: {
      spritesheetAlias: "common16x16",
      textureName: "happy",
    },
    [TextureKey.UNHAPPY]: {
      spritesheetAlias: "common16x16",
      textureName: "unhappy",
    },
    [TextureKey.URGENT]: {
      spritesheetAlias: "common16x16",
      textureName: "urgent",
    },
  };

  const textureInfo = textureMap[textureKey];
  if (!textureInfo) {
    console.warn(
      `[StatusIconRenderSystem] Texture key ${textureKey} not found`
    );
    return undefined;
  }

  try {
    const spritesheet = PIXI.Assets.get<PIXI.Spritesheet>(
      textureInfo.spritesheetAlias!
    );
    if (!spritesheet) {
      console.warn(
        `[StatusIconRenderSystem] Spritesheet not found: ${textureInfo.spritesheetAlias}`
      );
      return PIXI.Texture.WHITE;
    }

    const texture = spritesheet.textures[textureInfo.textureName];
    if (!texture) {
      console.warn(
        `[StatusIconRenderSystem] Texture not found: ${textureInfo.textureName}`
      );
      return PIXI.Texture.WHITE;
    }

    return texture;
  } catch (error) {
    console.error(
      `[StatusIconRenderSystem] Error getting texture for key ${textureKey}:`,
      error
    );
    return PIXI.Texture.WHITE;
  }
}

function createStatusIconSprite(textureKey: TextureKey): PIXI.Sprite {
  const texture = getTextureFromKey(textureKey);
  const sprite = new PIXI.Sprite(texture || PIXI.Texture.WHITE);
  sprite.anchor.set(0.5);
  sprite.scale.set(1.8); // 16x16을 28.8x28.8로 확대
  return sprite;
}

function clearEntitySprites(eid: number): void {
  const sprites = entityStatusSprites.get(eid);
  if (sprites) {
    sprites.forEach((sprite) => sprite.removeFromParent());
    entityStatusSprites.delete(eid);
  }
}

const statusIconQuery = defineQuery([
  PositionComp,
  CharacterStatusComp,
  StatusIconRenderComp,
]);

const statusIconExitQuery = exitQuery(statusIconQuery);

export function statusIconRenderSystem(params: {
  world: MainSceneWorld;
  delta: number;
}): typeof params {
  const { world } = params;

  // 제거된 엔티티 처리
  const exitEntities = statusIconExitQuery(world);
  for (let i = 0; i < exitEntities.length; i++) {
    const eid = exitEntities[i];
    clearEntitySprites(eid);
    StatusIconRenderComp.visibleCount[eid] = 0;
  }

  const entities = statusIconQuery(world);

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    // 캐릭터만 처리
    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
      continue;
    }

    const position = {
      x: PositionComp.x[eid],
      y: PositionComp.y[eid],
    };

    // 현재 상태들 가져오기
    const currentStatuses: CharacterStatus[] = [];
    for (let j = 0; j < 4; j++) {
      const status = CharacterStatusComp.statuses[eid][j];
      if (status !== ECS_NULL_VALUE) {
        currentStatuses.push(status);
      }
    }

    // 기존 스프라이트들 가져오기 또는 초기화
    let sprites = entityStatusSprites.get(eid);
    if (!sprites) {
      sprites = [];
      entityStatusSprites.set(eid, sprites);
    }

    // 필요 없는 스프라이트 제거
    if (sprites.length > currentStatuses.length) {
      for (let j = currentStatuses.length; j < sprites.length; j++) {
        sprites[j].removeFromParent();
      }
      sprites.splice(currentStatuses.length);
    }

    // 필요한 스프라이트 생성/업데이트
    for (let j = 0; j < currentStatuses.length; j++) {
      const status = currentStatuses[j];
      const textureKey = STATUS_TO_TEXTURE_KEY[status];

      if (!textureKey) {
        console.warn(`[StatusIconRenderSystem] Unknown status: ${status}`);
        continue;
      }

      const expectedTexture = getTextureFromKey(textureKey);

      // 기존 스프라이트가 있고 올바른 텍스처인지 확인
      if (sprites[j] && sprites[j].texture === expectedTexture) {
        // 기존 스프라이트 재사용, 위치만 업데이트
      } else {
        // 기존 스프라이트 제거 (있다면)
        if (sprites[j]) {
          sprites[j].removeFromParent();
        }

        // 새 스프라이트 생성
        sprites[j] = createStatusIconSprite(textureKey);
        world.stage.addChild(sprites[j]);
      }

      // 위치 설정
      const iconSize = 28.8; // 1.8 * 16
      const spacing = 4;
      const totalWidth =
        currentStatuses.length * iconSize +
        (currentStatuses.length - 1) * spacing;
      const startX =
        position.x - totalWidth / 2 + j * (iconSize + spacing) + iconSize / 2;

      sprites[j].x = startX;
      sprites[j].y = position.y - 50;
    }

    StatusIconRenderComp.visibleCount[eid] = currentStatuses.length;
  }

  return params;
}
