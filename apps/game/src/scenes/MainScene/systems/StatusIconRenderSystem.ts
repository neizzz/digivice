// 캐릭터 상태 아이콘 렌더링 시스템
import { defineQuery, exitQuery } from "bitecs";
import {
  PositionComp,
  CharacterStatusComp,
  StatusIconRenderComp,
  ObjectComp,
  RenderComp,
  TemporaryStatusComp,
} from "../raw-components";
import * as PIXI from "pixi.js";
import { MainSceneWorld } from "../world";
import {
  CharacterState,
  CharacterStatus,
  ObjectType,
  TextureKey,
} from "../types";
import { getCharacterWorldBounds } from "./CharacterDisplayBounds";

const STATUS_ICON_SCALE = 1.625;
const STATUS_ICON_BASE_SIZE = 16;
const STATUS_ICON_SIZE = STATUS_ICON_BASE_SIZE * STATUS_ICON_SCALE;
const STATUS_ICON_Z_INDEX_OFFSET = 1.5;
const STATUS_ICON_HORIZONTAL_SPACING = 1;
const STATUS_ICON_CONTAINER_LEFT_OFFSET = 6;

function getRenderedCharacterAttributes(eid: number): {
  renderedX: number;
  renderedY: number;
  effectiveZIndex: number;
} {
  const renderedX = Math.round(PositionComp.x[eid]);
  const renderedY = Math.round(PositionComp.y[eid]);
  const configuredZIndex = RenderComp.zIndex[eid];
  const effectiveZIndex =
    configuredZIndex === ECS_NULL_VALUE ? renderedY : configuredZIndex;

  return {
    renderedX,
    renderedY,
    effectiveZIndex,
  };
}

function getRenderedCharacterWorldBounds(eid: number): {
  leftX: number;
  rightX: number;
  topY: number;
  bottomY: number;
  width: number;
  height: number;
} {
  const bounds = getCharacterWorldBounds(eid);
  const offsetX = Math.round(PositionComp.x[eid]) - PositionComp.x[eid];
  const offsetY = Math.round(PositionComp.y[eid]) - PositionComp.y[eid];

  return {
    leftX: bounds.leftX + offsetX,
    rightX: bounds.rightX + offsetX,
    topY: bounds.topY + offsetY,
    bottomY: bounds.bottomY + offsetY,
    width: bounds.width,
    height: bounds.height,
  };
}

// 일시적인 상태들 (3초 후 자동 제거)
const TEMPORARY_STATUSES = [CharacterStatus.HAPPY, CharacterStatus.DISCOVER];
const TEMPORARY_STATUS_DURATION = 3000;
const SLEEP_ICON_TEXTURE_NAME = "sleeping";

// 상태 아이콘 매핑
const STATUS_TO_TEXTURE_NAME: Partial<Record<CharacterStatus, string>> = {
  [CharacterStatus.SICK]: "sick",
  [CharacterStatus.HAPPY]: "happy",
  [CharacterStatus.DISCOVER]: "discover",
};

// 엔티티별 스프라이트 스토어
const entityStatusSprites: Map<number, PIXI.Sprite[]> = new Map();
const entityTemporarySprites: Map<number, PIXI.Sprite> = new Map(); // 일시적 상태/수면 아이콘용 별도 스프라이트

function getCommon16x16Texture(textureName: string): PIXI.Texture | undefined {
  try {
    const spritesheet = PIXI.Assets.get<PIXI.Spritesheet>("common16x16");
    if (!spritesheet) {
      console.warn(
        "[StatusIconRenderSystem] Spritesheet not found: common16x16",
      );
      return PIXI.Texture.WHITE;
    }

    const texture = spritesheet.textures[textureName];
    if (!texture) {
      console.warn(
        `[StatusIconRenderSystem] Texture not found: ${textureName}`,
      );
      return PIXI.Texture.WHITE;
    }

    return texture;
  } catch (error) {
    console.error(
      `[StatusIconRenderSystem] Error getting texture ${textureName}:`,
      error,
    );
    return PIXI.Texture.WHITE;
  }
}

function createStatusIconSprite(textureName: string): PIXI.Sprite {
  const texture = getCommon16x16Texture(textureName);
  const sprite = new PIXI.Sprite(texture || PIXI.Texture.WHITE);
  sprite.anchor.set(0.5);
  sprite.scale.set(STATUS_ICON_SCALE); // 16x16을 25.92x25.92로 확대
  sprite.roundPixels = true;
  return sprite;
}

function getStatusIconListWidth(iconCount: number): number {
  return (
    iconCount * STATUS_ICON_SIZE +
    Math.max(0, iconCount - 1) * STATUS_ICON_HORIZONTAL_SPACING
  );
}

function clampNumber(value: number, min: number, max: number): number {
  if (min > max) {
    return (min + max) / 2;
  }

  return Math.max(min, Math.min(max, value));
}

function getStatusIconScreenBounds(world: MainSceneWorld): {
  leftX: number;
  rightX: number;
  topY: number;
  bottomY: number;
} {
  const boundary = world.characterPositionBoundary ?? world.positionBoundary;

  return {
    leftX: boundary.x,
    rightX: boundary.x + boundary.width,
    topY: boundary.y,
    bottomY: boundary.y + boundary.height,
  };
}

function getClampedStatusIconListCenter(params: {
  world: MainSceneWorld;
  preferredCenterX: number;
  preferredCenterY: number;
  iconCount: number;
}): {
  centerX: number;
  centerY: number;
} {
  const { world, preferredCenterX, preferredCenterY, iconCount } = params;
  const bounds = getStatusIconScreenBounds(world);
  const halfListWidth = getStatusIconListWidth(iconCount) / 2;
  const halfIconHeight = STATUS_ICON_SIZE / 2;

  return {
    centerX: clampNumber(
      preferredCenterX,
      bounds.leftX + halfListWidth,
      bounds.rightX - halfListWidth,
    ),
    centerY: clampNumber(
      preferredCenterY,
      bounds.topY + halfIconHeight,
      bounds.bottomY - halfIconHeight,
    ),
  };
}

function getUnifiedStatusIconStartX(
  listCenterX: number,
  iconCount: number,
): number {
  const totalWidth = getStatusIconListWidth(iconCount);
  return listCenterX - totalWidth / 2 + STATUS_ICON_SIZE / 2;
}

function getStatusIconListCenterAtCharacterTopRight(params: {
  world: MainSceneWorld;
  eid: number;
  iconCount: number;
}): {
  centerX: number;
  centerY: number;
} {
  const { world, eid, iconCount } = params;
  const bounds = getRenderedCharacterWorldBounds(eid);

  return getClampedStatusIconListCenter({
    world,
    preferredCenterX: bounds.rightX - STATUS_ICON_CONTAINER_LEFT_OFFSET,
    preferredCenterY: bounds.topY,
    iconCount,
  });
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

export function cleanupStatusIconRenderStateForTests(): void {
  entityStatusSprites.forEach((sprites) => {
    sprites.forEach((sprite) => sprite.removeFromParent());
  });
  entityTemporarySprites.forEach((sprite) => {
    sprite.removeFromParent();
  });
  entityStatusSprites.clear();
  entityTemporarySprites.clear();
}

// 일시적 상태 관리 함수들
export function startTemporaryStatus(
  eid: number,
  status: CharacterStatus,
): void {
  if (!TEMPORARY_STATUSES.includes(status)) return;
  if (ObjectComp.state[eid] === CharacterState.SLEEPING) return;

  const currentTime = Date.now();

  // 이미 같은 상태가 활성화되어 있는지 확인
  if (TemporaryStatusComp.statusType[eid] === status) {
    const elapsedTime = currentTime - TemporaryStatusComp.startTime[eid];
    if (elapsedTime < TEMPORARY_STATUS_DURATION) {
      return; // 이미 활성화된 상태면 무시
    }
  }

  TemporaryStatusComp.statusType[eid] = status;
  TemporaryStatusComp.startTime[eid] = currentTime;
}

// 참고: updateTemporaryStatuses()와 removeStatusFromEntity()는
// CharacterStatusSystem으로 이동되었습니다.
// 이 시스템은 순수하게 렌더링만 담당합니다.

function organizeStatuses(statuses: CharacterStatus[]): {
  persistent: CharacterStatus[];
  latestTemporary: CharacterStatus | null;
} {
  const persistent: CharacterStatus[] = [];
  let latestTemporary: CharacterStatus | null = null;

  for (const status of statuses) {
    if (TEMPORARY_STATUSES.includes(status)) {
      latestTemporary = status; // 가장 마지막(최신) 일시적 상태만 저장
    } else if (status !== CharacterStatus.URGENT) {
      persistent.push(status);
    } else {
      continue;
    }
  }

  return { persistent, latestTemporary };
}

function getOverlayIconTextureName(
  world: MainSceneWorld,
  eid: number,
  latestTemporary: CharacterStatus | null,
): string | null {
  if (ObjectComp.state[eid] === CharacterState.SLEEPING) {
    return world.isSleepDebugEffectEnabled() ? SLEEP_ICON_TEXTURE_NAME : null;
  }

  if (!latestTemporary) {
    return null;
  }

  return STATUS_TO_TEXTURE_NAME[latestTemporary] ?? null;
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
    StatusIconRenderComp.visibleCount[eid] = 0;
  }

  const entities = statusIconQuery(world);

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    // 캐릭터만 처리
    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
      continue;
    }

    // 죽은 캐릭터(무덤)는 상태 아이콘을 표시하지 않음
    if (RenderComp.textureKey[eid] === TextureKey.TOMB) {
      // 기존 스프라이트들 제거
      clearEntitySprites(eid);
      StatusIconRenderComp.visibleCount[eid] = 0;
      continue;
    }

    // 참고: 일시적 상태 만료는 CharacterStatusSystem에서 처리됨

    const { effectiveZIndex } = getRenderedCharacterAttributes(eid);
    const iconZIndex = effectiveZIndex + STATUS_ICON_Z_INDEX_OFFSET;

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
    const overlayTextureName = getOverlayIconTextureName(
      world,
      eid,
      latestTemporary,
    );
    const iconCount = persistent.length + (overlayTextureName ? 1 : 0);
    const { centerX: iconListCenterX, centerY: iconCenterY } =
      getStatusIconListCenterAtCharacterTopRight({
        world,
        eid,
        iconCount,
      });
    const iconStartX = getUnifiedStatusIconStartX(
      iconListCenterX,
      iconCount,
    );

    // 지속적 상태 아이콘들 처리 (캐릭터 우측 상단 기준 가로 배열)
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
      const textureName = STATUS_TO_TEXTURE_NAME[status];

      if (!textureName) {
        console.warn(`[StatusIconRenderSystem] Unknown status: ${status}`);
        continue;
      }

      const expectedTexture = getCommon16x16Texture(textureName);

      // 기존 스프라이트가 있고 올바른 텍스처인지 확인
      if (sprites[j] && sprites[j].texture === expectedTexture) {
        // 기존 스프라이트 재사용, 위치만 업데이트
      } else {
        // 기존 스프라이트 제거 (있다면)
        if (sprites[j]) {
          sprites[j].removeFromParent();
        }

        // 새 스프라이트 생성
        sprites[j] = createStatusIconSprite(textureName);
        world.stage.addChild(sprites[j]);
      }

      // 지속적 상태 아이콘 위치 설정 (왼쪽부터 순서대로 배치)
      sprites[j].x =
        iconStartX +
        j * (STATUS_ICON_SIZE + STATUS_ICON_HORIZONTAL_SPACING);
      sprites[j].y = iconCenterY;
      sprites[j].zIndex = iconZIndex;
    }

    // 일시적 상태/수면 아이콘 처리 (상태 아이콘 라인에 통합)
    const currentTempSprite = entityTemporarySprites.get(eid);

    if (overlayTextureName) {
      const expectedTexture = getCommon16x16Texture(overlayTextureName);

      // 기존 스프라이트가 있고 올바른 텍스처인지 확인
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

        // 새 스프라이트 생성
        const newTempSprite = createStatusIconSprite(overlayTextureName);
        entityTemporarySprites.set(eid, newTempSprite);
        world.stage.addChild(newTempSprite);
      }

      // 오버레이 아이콘 위치 설정 (persistent 다음 순서)
      const tempSprite = entityTemporarySprites.get(eid)!;
      tempSprite.x =
        iconStartX +
        persistent.length * (STATUS_ICON_SIZE + STATUS_ICON_HORIZONTAL_SPACING);
      tempSprite.y = iconCenterY;
      tempSprite.zIndex = iconZIndex;
    } else {
      // 표시할 오버레이가 없으면 기존 스프라이트 제거
      if (currentTempSprite) {
        currentTempSprite.removeFromParent();
        entityTemporarySprites.delete(eid);
      }
    }

    StatusIconRenderComp.visibleCount[eid] =
      persistent.length + (overlayTextureName ? 1 : 0);
  }

  return params;
}
