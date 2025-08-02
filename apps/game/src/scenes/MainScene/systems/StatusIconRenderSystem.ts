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

// 일시적인 상태들 (3초 후 자동 제거)
const TEMPORARY_STATUSES = [
  CharacterStatus.UNHAPPY,
  CharacterStatus.HAPPY,
  CharacterStatus.DISCOVER,
];
const TEMPORARY_STATUS_DURATION = 3000; // 3초

// 엔티티별 일시적 상태 타이머
const temporaryStatusTimers: Map<
  number,
  Map<CharacterStatus, number>
> = new Map();

// 상태 아이콘 매핑
const STATUS_TO_TEXTURE_KEY: Record<CharacterStatus, TextureKey> = {
  [CharacterStatus.SICK]: TextureKey.SICK,
  [CharacterStatus.HAPPY]: TextureKey.HAPPY,
  [CharacterStatus.UNHAPPY]: TextureKey.UNHAPPY,
  [CharacterStatus.URGENT]: TextureKey.URGENT,
  [CharacterStatus.DISCOVER]: TextureKey.DISCOVER,
};

// 엔티티별 스프라이트 스토어
const entityStatusSprites: Map<number, PIXI.Sprite[]> = new Map();
const entityTemporarySprites: Map<number, PIXI.Sprite> = new Map(); // 일시적 상태용 별도 스프라이트

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
    [TextureKey.DISCOVER]: {
      spritesheetAlias: "common16x16",
      textureName: "discover",
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
  // 지속적 상태 스프라이트 제거
  const sprites = entityStatusSprites.get(eid);
  if (sprites) {
    sprites.forEach((sprite) => sprite.removeFromParent());
    entityStatusSprites.delete(eid);
  }

  // 일시적 상태 스프라이트 제거
  const tempSprite = entityTemporarySprites.get(eid);
  if (tempSprite) {
    tempSprite.removeFromParent();
    entityTemporarySprites.delete(eid);
  }
}

// 일시적 상태 관리 함수들
export function startTemporaryStatus(
  eid: number,
  status: CharacterStatus
): void {
  if (!TEMPORARY_STATUSES.includes(status)) return;

  if (!temporaryStatusTimers.has(eid)) {
    temporaryStatusTimers.set(eid, new Map());
  }

  const entityTimers = temporaryStatusTimers.get(eid)!;
  entityTimers.set(status, Date.now() + TEMPORARY_STATUS_DURATION);
}

function updateTemporaryStatuses(eid: number, _delta: number): void {
  const entityTimers = temporaryStatusTimers.get(eid);
  if (!entityTimers) return;

  const now = Date.now();
  const expiredStatuses: CharacterStatus[] = [];

  for (const [status, expireTime] of entityTimers.entries()) {
    if (now >= expireTime) {
      expiredStatuses.push(status);
    }
  }

  // 만료된 일시적 상태들 제거
  for (const status of expiredStatuses) {
    entityTimers.delete(status);
    removeStatusFromEntity(eid, status);
  }

  if (entityTimers.size === 0) {
    temporaryStatusTimers.delete(eid);
  }
}

function removeStatusFromEntity(
  eid: number,
  statusToRemove: CharacterStatus
): void {
  const currentStatuses = CharacterStatusComp.statuses[eid];
  let removed = false;

  // CharacterStatusComp에서 상태 제거
  for (let i = 0; i < currentStatuses.length; i++) {
    if (currentStatuses[i] === statusToRemove) {
      currentStatuses[i] = ECS_NULL_VALUE;
      removed = true;
      break;
    }
  }

  if (removed) {
    console.log(
      `[StatusIconRenderSystem] Removed temporary status ${statusToRemove} from entity ${eid}`
    );

    // StatusIconRenderComp 동기화는 CharacterManageSystem에서 처리됨
    // 여기서는 상태만 제거하고 다음 프레임에 CharacterManageSystem이 동기화함
  }
}

function organizeStatuses(statuses: CharacterStatus[]): {
  persistent: CharacterStatus[];
  latestTemporary: CharacterStatus | null;
} {
  const persistent: CharacterStatus[] = [];
  let latestTemporary: CharacterStatus | null = null;

  for (const status of statuses) {
    if (TEMPORARY_STATUSES.includes(status)) {
      latestTemporary = status; // 가장 마지막(최신) 일시적 상태만 저장
    } else {
      persistent.push(status);
    }
  }

  return { persistent, latestTemporary };
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
  const { world, delta } = params;

  // 제거된 엔티티 처리
  const exitEntities = statusIconExitQuery(world);
  for (let i = 0; i < exitEntities.length; i++) {
    const eid = exitEntities[i];
    clearEntitySprites(eid);
    temporaryStatusTimers.delete(eid);
    StatusIconRenderComp.visibleCount[eid] = 0;
  }

  const entities = statusIconQuery(world);

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    // 캐릭터만 처리
    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
      continue;
    }

    // 일시적 상태 업데이트 (만료된 상태 제거)
    updateTemporaryStatuses(eid, delta);

    const position = {
      x: PositionComp.x[eid],
      y: PositionComp.y[eid],
    };

    // 현재 상태들 가져오기
    const allStatuses: CharacterStatus[] = [];
    for (let j = 0; j < 4; j++) {
      const status = CharacterStatusComp.statuses[eid][j];
      if (status !== ECS_NULL_VALUE) {
        allStatuses.push(status);
      }
    }

    // 상태를 지속적 상태와 일시적 상태로 분리
    const { persistent, latestTemporary } = organizeStatuses(allStatuses);

    // 지속적 상태 아이콘들 처리 (캐릭터 위쪽에 가로 배열)
    let sprites = entityStatusSprites.get(eid);
    if (!sprites) {
      sprites = [];
      entityStatusSprites.set(eid, sprites);
    }

    // 필요 없는 지속적 상태 스프라이트 제거
    if (sprites.length > persistent.length) {
      for (let j = persistent.length; j < sprites.length; j++) {
        sprites[j].removeFromParent();
      }
      sprites.splice(persistent.length);
    }

    // 지속적 상태 스프라이트 생성/업데이트
    for (let j = 0; j < persistent.length; j++) {
      const status = persistent[j];
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

      // 지속적 상태 아이콘 위치 설정 (캐릭터 위쪽에 가로 배열)
      const iconSize = 28.8; // 1.8 * 16
      const spacing = 4;
      const totalWidth =
        persistent.length * iconSize + (persistent.length - 1) * spacing;
      const startX =
        position.x - totalWidth / 2 + j * (iconSize + spacing) + iconSize / 2;

      sprites[j].x = startX;
      sprites[j].y = position.y - 50;
    }

    // 일시적 상태 아이콘 처리 (캐릭터 우측상단에 1개만)
    const currentTempSprite = entityTemporarySprites.get(eid);

    if (latestTemporary) {
      const textureKey = STATUS_TO_TEXTURE_KEY[latestTemporary];

      if (textureKey) {
        const expectedTexture = getTextureFromKey(textureKey);

        // 기존 일시적 스프라이트가 있고 올바른 텍스처인지 확인
        if (
          currentTempSprite &&
          currentTempSprite.texture === expectedTexture
        ) {
          // 기존 스프라이트 재사용, 위치만 업데이트
        } else {
          // 기존 스프라이트 제거 (있다면)
          if (currentTempSprite) {
            currentTempSprite.removeFromParent();
          }

          // 새 일시적 스프라이트 생성
          const newTempSprite = createStatusIconSprite(textureKey);
          entityTemporarySprites.set(eid, newTempSprite);
          world.stage.addChild(newTempSprite);
        }

        // 일시적 상태 아이콘 위치 설정 (캐릭터 우측상단)
        const tempSprite = entityTemporarySprites.get(eid)!;
        tempSprite.x = position.x + 20; // 캐릭터 우측
        tempSprite.y = position.y - 40; // 캐릭터 상단
      }
    } else {
      // 일시적 상태가 없으면 기존 일시적 스프라이트 제거
      if (currentTempSprite) {
        currentTempSprite.removeFromParent();
        entityTemporarySprites.delete(eid);
      }
    }

    StatusIconRenderComp.visibleCount[eid] =
      persistent.length + (latestTemporary ? 1 : 0);
  }

  return params;
}
