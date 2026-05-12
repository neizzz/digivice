import { defineQuery, hasComponent, exitQuery } from "bitecs";
import * as PIXI from "pixi.js";
import {
  CleanableComp,
  ObjectComp,
  PositionComp,
  RenderComp,
} from "../raw-components";
import { ObjectStore } from "../utils/ObjectStore";
import { getSpriteStore } from "./RenderSystem";
import type { MainSceneWorld } from "../world";
import { ObjectType } from "../types";
import {
  BROOM_Z_INDEX,
  CLEANING_DIM_OVERLAY_Z_INDEX,
  FOCUSED_BORDER_Z_INDEX,
  getCleaningTargetZIndex,
  NON_FOCUSED_BORDER_Z_INDEX,
} from "./cleaningRenderLayers";

// 청소 대상 엔티티 쿼리 - CleanableComp만 필수로 요구
const cleanableQuery = defineQuery([CleanableComp]);

// 렌더링되는 청소 대상 엔티티 쿼리 (점선 테두리용)
const cleanableRenderQuery = defineQuery([CleanableComp, RenderComp]);

// 제거된 청소 대상 엔티티 쿼리
const exitCleanableQuery = exitQuery(cleanableQuery);

/**
 * 점선 테두리를 위한 그래픽스 저장소
 */
const dashedBorderStore = new ObjectStore<PIXI.Graphics>("DashedBorderStore");

/**
 * 빗자루를 위한 스프라이트 저장소
 */
const broomStore = new ObjectStore<PIXI.Sprite>("BroomStore");
const BROOM_RENDER_SCALE = 3.0;
const BROOM_HORIZONTAL_OVERSHOOT_PX = 10;
const BROOM_VERTICAL_OFFSET_PX = 10;
const CLEANING_DIM_OVERLAY_PADDING_PX = 512;
const CLEANING_DIM_OVERLAY_ALPHA = 0.45;
const FOCUSED_CLEANABLE_BORDER_COLOR = 0xff7dc2;
const NON_FOCUSED_CLEANABLE_BORDER_COLOR = 0xffffff;

let cleaningDimOverlay: PIXI.Graphics | null = null;

type CleaningDimOverlayRenderState = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DashedBorderRenderState = {
  x: number;
  y: number;
  width: number;
  height: number;
  isFocused: boolean;
};

type RenderSizeState = {
  width: number;
  height: number;
  textureId: number | string | null;
  scaleX: number;
  scaleY: number;
};

let cleaningDimOverlayRenderState: CleaningDimOverlayRenderState | null = null;
const dashedBorderRenderStateByEid = new Map<number, DashedBorderRenderState>();
const renderSizeStateByEid = new Map<number, RenderSizeState>();

/**
 * 청소 대상 렌더링 시스템 파라미터
 */
interface CleanableRenderSystemParams {
  world: MainSceneWorld;
  delta: number;
  stage: PIXI.Container;
}

/**
 * 청소 대상 렌더링 시스템 - 점선 테두리 표시 및 투명도 처리
 */
export function cleanableRenderSystem(params: CleanableRenderSystemParams): {
  world: MainSceneWorld;
  delta: number;
} {
  const { world, delta, stage } = params;

  const cleanableEntities = cleanableQuery(world);
  const cleanableRenderEntities = cleanableRenderQuery(world);

  updateCleaningDimOverlay(stage, world);

  // 제거된 청소 대상 엔티티의 그래픽스 정리
  const exitedCleanableEntities = exitCleanableQuery(world);
  for (let i = 0; i < exitedCleanableEntities.length; i++) {
    const eid = exitedCleanableEntities[i];
    removeDashedBorder(eid, stage);
    removeBroom(eid, stage);
  }

  // 모든 청소 대상 엔티티 처리
  for (let i = 0; i < cleanableEntities.length; i++) {
    const eid = cleanableEntities[i];

    // PositionComp가 있는지 확인
    const hasPosition = hasComponent(world, PositionComp, eid);
    const isFocused = world.isCleaningMode && world.focusedTargetEid === eid;
    const isHighlighted = CleanableComp.isHighlighted[eid];

    // 위치 정보가 있는 엔티티만 테두리 처리
    if (hasPosition) {
      // 포커스된 대상만 렌더 레이어를 프레임 단위로 최전면으로 올린다
      updateEntitySpriteZIndex(eid, isFocused, world);

      // 하이라이트 상태에 따른 점선 테두리 처리
      if (isHighlighted) {
        createOrUpdateDashedBorder(eid, stage, world);
      } else {
        removeDashedBorder(eid, stage);
      }

      // 포커스 상태에 따른 특별한 효과 (선택사항)
    } else {
      console.warn(
        `[CleanableRenderSystem] Entity ${eid} has CleanableComp but no PositionComp`,
      );
    }
  }

  // 렌더링되는 엔티티들의 투명도 처리
  for (let i = 0; i < cleanableRenderEntities.length; i++) {
    const eid = cleanableRenderEntities[i];
    updateCleaningOpacity(eid, world, stage);
  }

  return { world, delta };
}

/**
 * 엔티티 스프라이트의 zIndex 업데이트 (포커스된 대상을 앞으로)
 */
function updateEntitySpriteZIndex(
  eid: number,
  isFocused: boolean,
  world: MainSceneWorld,
) {
  if (!hasComponent(world, RenderComp, eid)) {
    return;
  }

  const spriteStore = getSpriteStore();
  const sprite = spriteStore.get(RenderComp.storeIndex[eid]);

  if (!sprite || sprite.destroyed) {
    return;
  }

  const shouldLiftAboveDimOverlay =
    world.isCleaningMode && CleanableComp.isHighlighted[eid] === 1;

  const nextZIndex = shouldLiftAboveDimOverlay
    ? getCleaningTargetZIndex(isFocused)
    : getBaselineSpriteZIndex(eid, world);

  if (sprite.zIndex !== nextZIndex) {
    sprite.zIndex = nextZIndex;
  }
}

function getBaselineSpriteZIndex(eid: number, world: MainSceneWorld): number {
  const configuredZIndex = RenderComp.zIndex[eid];

  if (configuredZIndex !== ECS_NULL_VALUE) {
    return configuredZIndex;
  }

  const y = PositionComp.y[eid];
  const shouldSnapCharacterToPixelGrid =
    hasComponent(world, ObjectComp, eid) &&
    ObjectComp.type[eid] === ObjectType.CHARACTER;

  return shouldSnapCharacterToPixelGrid ? Math.round(y) : y;
}

function getObjectRenderSize(
  eid: number,
  world: MainSceneWorld,
): {
  width: number;
  height: number;
} {
  if (!hasComponent(world, RenderComp, eid)) {
    return { width: 32, height: 32 };
  }

  const storeIndex = RenderComp.storeIndex[eid];
  const spriteStore = getSpriteStore();
  const sprite = spriteStore.get(storeIndex);

  if (!sprite) {
    return { width: 32, height: 32 };
  }

  const texture = sprite.texture as PIXI.Texture & {
    uid?: number;
    label?: string;
    source?: { uid?: number };
  };
  const textureId = texture.uid ?? texture.source?.uid ?? texture.label ?? null;
  const scaleX = Math.abs(sprite.scale.x);
  const scaleY = Math.abs(sprite.scale.y);
  const cached = renderSizeStateByEid.get(eid);

  if (
    cached &&
    cached.textureId === textureId &&
    cached.scaleX === scaleX &&
    cached.scaleY === scaleY
  ) {
    return {
      width: cached.width,
      height: cached.height,
    };
  }

  const textureFrame = texture.orig ?? texture.frame;
  let width = Math.abs((textureFrame?.width ?? texture.width ?? 32) * scaleX);
  let height = Math.abs((textureFrame?.height ?? texture.height ?? 32) * scaleY);

  if (width <= 0 || height <= 0) {
    const bounds = sprite.getBounds();
    width = bounds.width || 32;
    height = bounds.height || 32;
  }

  renderSizeStateByEid.set(eid, {
    width,
    height,
    textureId,
    scaleX,
    scaleY,
  });

  return { width, height };
}

function isSameDashedBorderRenderState(
  previous: DashedBorderRenderState | undefined,
  next: DashedBorderRenderState,
): boolean {
  return (
    !!previous &&
    previous.x === next.x &&
    previous.y === next.y &&
    previous.width === next.width &&
    previous.height === next.height &&
    previous.isFocused === next.isFocused
  );
}

/**
 * 점선 테두리 생성 또는 업데이트
 */
function createOrUpdateDashedBorder(
  eid: number,
  stage: PIXI.Container,
  world: MainSceneWorld,
) {
  // PositionComp가 있는지 확인
  if (!hasComponent(world, PositionComp, eid)) {
    console.warn(
      `[CleanableRenderSystem] Entity ${eid} has no PositionComp for border rendering`,
    );
    return;
  }

  const x = PositionComp.x[eid];
  const y = PositionComp.y[eid];

  // 포커스된 대상인지 확인
  const isFocused = world.isCleaningMode && world.focusedTargetEid === eid;

  const { width: objectWidth, height: objectHeight } = getObjectRenderSize(
    eid,
    world,
  );

  let graphics = dashedBorderStore.get(eid);
  const nextRenderState = {
    x,
    y,
    width: objectWidth,
    height: objectHeight,
    isFocused,
  };

  if (!graphics) {
    graphics = new PIXI.Graphics();
    graphics.zIndex = NON_FOCUSED_BORDER_Z_INDEX;
    graphics.visible = true;
    stage.addChild(graphics);
    dashedBorderStore.set(eid, graphics);

    // stage의 sortableChildren이 활성화되어 있는지 확인
    if (!stage.sortableChildren) {
      stage.sortableChildren = true;
    }
  } else {
    const previousRenderState = dashedBorderRenderStateByEid.get(eid);
    graphics.zIndex = isFocused
      ? FOCUSED_BORDER_Z_INDEX
      : NON_FOCUSED_BORDER_Z_INDEX;
    graphics.visible = true;

    if (isSameDashedBorderRenderState(previousRenderState, nextRenderState)) {
      if (isFocused) {
        createOrUpdateBroom(eid, stage, world, x, y, objectWidth);
      } else {
        removeBroom(eid, stage);
      }
      return;
    }

    graphics.clear();
    graphics.visible = true;
  }

  // 테두리 색상 결정 (포커스된 대상은 밝은 핑크, 일반은 밝은 회색)
  const borderColor = isFocused
    ? FOCUSED_CLEANABLE_BORDER_COLOR
    : NON_FOCUSED_CLEANABLE_BORDER_COLOR;
  const lineWidth = 4;

  // zIndex 설정 (포커스된 대상이 더 앞에 나오도록)
  graphics.zIndex = isFocused
    ? FOCUSED_BORDER_Z_INDEX
    : NON_FOCUSED_BORDER_Z_INDEX;

  // 점선 테두리 그리기 (오브젝트 크기에 맞게)
  const borderX = x - objectWidth / 2;
  const borderY = y - objectHeight / 2;
  const borderWidth = objectWidth;
  const borderHeight = objectHeight;

  dashedBorderRenderStateByEid.set(eid, nextRenderState);

  drawDashedRect(
    graphics,
    borderX,
    borderY,
    borderWidth,
    borderHeight,
    lineWidth,
    borderColor,
  );

  // 포커스된 대상에는 빗자루 그리기
  if (isFocused) {
    createOrUpdateBroom(eid, stage, world, x, y, objectWidth);
  } else {
    removeBroom(eid, stage);
  }

  // console.log(
  //   `[CleanableRenderSystem] Border graphics created for entity ${eid}, color: ${borderColor.toString(
  //     16
  //   )}, focused: ${isFocused}`
  // );
}

function updateCleaningDimOverlay(
  stage: PIXI.Container,
  world: MainSceneWorld,
) {
  const shouldShowOverlay = world.isCleaningMode;

  if (!shouldShowOverlay) {
    removeCleaningDimOverlay(stage);
    return;
  }

  if (!cleaningDimOverlay) {
    cleaningDimOverlay = new PIXI.Graphics();
    cleaningDimOverlay.zIndex = CLEANING_DIM_OVERLAY_Z_INDEX;
    cleaningDimOverlay.eventMode = "none";
    cleaningDimOverlay.visible = true;
    stage.addChild(cleaningDimOverlay);
  }

  const boundary = world.positionBoundary;
  const overlayX = boundary.x - CLEANING_DIM_OVERLAY_PADDING_PX;
  const overlayY = boundary.y - CLEANING_DIM_OVERLAY_PADDING_PX;
  const overlayWidth =
    boundary.width + CLEANING_DIM_OVERLAY_PADDING_PX * 2;
  const overlayHeight =
    boundary.height + CLEANING_DIM_OVERLAY_PADDING_PX * 2;
  const nextRenderState = {
    x: overlayX,
    y: overlayY,
    width: overlayWidth,
    height: overlayHeight,
  };

  cleaningDimOverlay.zIndex = CLEANING_DIM_OVERLAY_Z_INDEX;
  cleaningDimOverlay.visible = true;

  if (
    isSameCleaningDimOverlayRenderState(
      cleaningDimOverlayRenderState,
      nextRenderState,
    )
  ) {
    if (!stage.sortableChildren) {
      stage.sortableChildren = true;
    }
    return;
  }

  cleaningDimOverlay.clear();
  cleaningDimOverlay.beginFill(0x000000, CLEANING_DIM_OVERLAY_ALPHA);
  cleaningDimOverlay.drawRect(
    overlayX,
    overlayY,
    overlayWidth,
    overlayHeight,
  );
  cleaningDimOverlay.endFill();
  cleaningDimOverlayRenderState = nextRenderState;

  if (!stage.sortableChildren) {
    stage.sortableChildren = true;
  }
}

function isSameCleaningDimOverlayRenderState(
  previous: CleaningDimOverlayRenderState | null,
  next: CleaningDimOverlayRenderState,
): boolean {
  return (
    !!previous &&
    previous.x === next.x &&
    previous.y === next.y &&
    previous.width === next.width &&
    previous.height === next.height
  );
}

function removeCleaningDimOverlay(stage: PIXI.Container) {
  if (!cleaningDimOverlay) {
    return;
  }

  stage.removeChild(cleaningDimOverlay);
  cleaningDimOverlay.destroy();
  cleaningDimOverlay = null;
  cleaningDimOverlayRenderState = null;
}

/**
 * 점선 사각형 그리기
 */
function drawDashedRect(
  graphics: PIXI.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  lineWidth: number,
  color: number,
) {
  const dashLength = 4;
  const gapLength = 4;

  graphics.setStrokeStyle({ width: lineWidth, color: color, alignment: 0.5 });

  // 상단 선
  drawDashedLine(graphics, x, y, x + width, y, dashLength, gapLength);
  // 우측 선
  drawDashedLine(
    graphics,
    x + width,
    y,
    x + width,
    y + height,
    dashLength,
    gapLength,
  );
  // 하단 선
  drawDashedLine(
    graphics,
    x + width,
    y + height,
    x,
    y + height,
    dashLength,
    gapLength,
  );
  // 좌측 선
  drawDashedLine(graphics, x, y + height, x, y, dashLength, gapLength);
}

/**
 * 점선 그리기
 */
function drawDashedLine(
  graphics: PIXI.Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dashLength: number,
  gapLength: number,
) {
  const totalLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const unitX = (x2 - x1) / totalLength;
  const unitY = (y2 - y1) / totalLength;

  let currentLength = 0;
  let isDash = true;

  while (currentLength < totalLength) {
    const segmentLength = Math.min(
      isDash ? dashLength : gapLength,
      totalLength - currentLength,
    );

    if (isDash) {
      const startX = x1 + unitX * currentLength;
      const startY = y1 + unitY * currentLength;
      const endX = x1 + unitX * (currentLength + segmentLength);
      const endY = y1 + unitY * (currentLength + segmentLength);

      graphics.moveTo(startX, startY);
      graphics.lineTo(endX, endY);
    }

    currentLength += segmentLength;
    isDash = !isDash;
  }

  // stroke를 호출하여 실제로 그리기
  graphics.stroke();
}

/**
 * 점선 테두리 제거
 */
function removeDashedBorder(eid: number, stage: PIXI.Container) {
  const graphics = dashedBorderStore.get(eid);
  if (graphics) {
    stage.removeChild(graphics);
    dashedBorderStore.remove(eid);
  }
  dashedBorderRenderStateByEid.delete(eid);
  renderSizeStateByEid.delete(eid);

  // 빗자루도 함께 제거
  removeBroom(eid, stage);
}

/**
 * 빗자루 생성 또는 업데이트
 */
function createOrUpdateBroom(
  eid: number,
  stage: PIXI.Container,
  world: MainSceneWorld,
  targetX: number,
  targetY: number,
  targetWidth: number,
) {
  let broomSprite = broomStore.get(eid);

  if (!broomSprite) {
    // 빗자루 텍스처 가져오기
    const broomTexture = PIXI.Assets.get("common16x16")?.textures?.["broom"];
    if (!broomTexture) {
      console.warn("[CleanableRenderSystem] Broom texture not found");
      return;
    }

    broomSprite = new PIXI.Sprite(broomTexture);
    broomSprite.zIndex = BROOM_Z_INDEX;
    broomSprite.anchor.set(0.5, 0.5); // 중심점을 가운데로
    stage.addChild(broomSprite);
    broomStore.set(eid, broomSprite);
  }

  broomSprite.zIndex = BROOM_Z_INDEX;

  // 빗자루 방향에 따른 좌우 반전
  const sliderValue = world.sliderValue;
  const isMovingRight = sliderValue > 0.5;
  broomSprite.scale.x = isMovingRight
    ? BROOM_RENDER_SCALE
    : -BROOM_RENDER_SCALE; // 오른쪽으로 이동하면 정방향, 왼쪽으로 이동하면 반전
  broomSprite.scale.y = BROOM_RENDER_SCALE;

  const targetLeftX = targetX - targetWidth / 2;
  const broomTravelStartX = targetLeftX - BROOM_HORIZONTAL_OVERSHOOT_PX;
  const broomTravelWidth = targetWidth + BROOM_HORIZONTAL_OVERSHOOT_PX * 2;
  const broomX = broomTravelStartX + sliderValue * broomTravelWidth;
  const broomY = targetY - BROOM_VERTICAL_OFFSET_PX; // 타겟보다 10px 위에 (객체 중간보다 조금 더 낮게)

  // 빗자루 위치 설정
  broomSprite.x = broomX;
  broomSprite.y = broomY;
  broomSprite.visible = true;
}

/**
 * 빗자루 제거
 */
function removeBroom(eid: number, stage: PIXI.Container) {
  const broomSprite = broomStore.get(eid);
  if (broomSprite) {
    stage.removeChild(broomSprite);
    broomStore.remove(eid);
  }
}

/**
 * 청소 진행도에 따른 투명도 업데이트
 */
function updateCleaningOpacity(
  eid: number,
  world: MainSceneWorld,
  _stage: PIXI.Container,
): void {
  const cleaningProgress = CleanableComp.cleaningProgress[eid];

  if (hasComponent(world, RenderComp, eid)) {
    const storeIndex = RenderComp.storeIndex[eid];
    const spriteStore = getSpriteStore();
    const sprite = spriteStore.get(storeIndex);

    if (cleaningProgress > 0) {
      // console.log(
      //   `[CleanableRenderSystem] Entity ${eid}: progress=${cleaningProgress}, storeIndex=${storeIndex}, sprite=${!!sprite}`
      // );

      if (sprite) {
        // 청소 진행도에 따라 투명도 조정 (진행도가 높을수록 투명해짐)
        const opacity = 1.0 - cleaningProgress;
        const newAlpha = Math.max(0.1, opacity);
        sprite.alpha = newAlpha;
      } else {
        console.warn(
          `[CleanableRenderSystem] Sprite not found for entity ${eid} with storeIndex ${storeIndex}`,
        );
      }
    } else if (sprite && sprite.alpha < 1.0) {
      // 청소 진행도가 0이면 투명도를 원래대로 복원
      sprite.alpha = 1.0;
    }
  }
}

/**
 * 시스템 정리 함수 (필요시 사용)
 */
export function cleanupCleanableRenderSystem(stage: PIXI.Container): void {
  removeCleaningDimOverlay(stage);

  dashedBorderStore.forEach((dashedBorder, _eid) => {
    stage.removeChild(dashedBorder);
    dashedBorder.destroy();
  });
  dashedBorderStore.clear();
  dashedBorderRenderStateByEid.clear();
  renderSizeStateByEid.clear();

  broomStore.forEach((broomSprite, _eid) => {
    stage.removeChild(broomSprite);
    broomSprite.destroy();
  });
  broomStore.clear();
}

export function getDashedBorderStore() {
  return dashedBorderStore;
}

export function getBroomStore() {
  return broomStore;
}

export function getCleaningDimOverlay() {
  return cleaningDimOverlay;
}
