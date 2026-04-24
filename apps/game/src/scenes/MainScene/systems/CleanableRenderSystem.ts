import { defineQuery, hasComponent, exitQuery } from "bitecs";
import * as PIXI from "pixi.js";
import { CleanableComp, PositionComp, RenderComp } from "../raw-components";
import { ObjectStore } from "../utils/ObjectStore";
import { INTENTED_FRONT_Z_INDEX } from "../../../constants";
import { getSpriteStore } from "./RenderSystem";
import type { MainSceneWorld } from "../world";

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
      // 포커스된 대상의 렌더링 zIndex 조정
      updateEntityZIndex(eid, isFocused, world);

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
 * 엔티티의 zIndex 업데이트 (포커스된 대상을 앞으로)
 */
function updateEntityZIndex(
  eid: number,
  isFocused: boolean,
  world: MainSceneWorld,
) {
  // RenderComp가 있는 경우 zIndex 조정
  if (hasComponent(world, RenderComp, eid)) {
    RenderComp.zIndex[eid] = isFocused
      ? INTENTED_FRONT_Z_INDEX
      : RenderComp.zIndex[eid];
    // console.log(
    //   `[CleanableRenderSystem] Updated zIndex for entity ${eid}: ${RenderComp.zIndex[eid]} (focused: ${isFocused})`
    // );
  }
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

  // 오브젝트 크기 결정 (실제 렌더링된 스프라이트에서 가져오기)
  let objectWidth = 32; // 기본값
  let objectHeight = 32; // 기본값

  // RenderComp가 있으면 실제 스프라이트에서 크기 가져오기
  if (hasComponent(world, RenderComp, eid)) {
    const storeIndex = RenderComp.storeIndex[eid];
    const spriteStore = getSpriteStore();
    const sprite = spriteStore.get(storeIndex);

    if (sprite) {
      // 실제 렌더링된 스프라이트의 bounds 사용
      const bounds = sprite.getBounds();
      objectWidth = bounds.width;
      objectHeight = bounds.height;
    }
  }

  let graphics = dashedBorderStore.get(eid);

  const DEFAULT_BORDER_Z_INDEX = INTENTED_FRONT_Z_INDEX + 1;

  if (!graphics) {
    graphics = new PIXI.Graphics();
    graphics.zIndex = DEFAULT_BORDER_Z_INDEX;
    graphics.visible = true;
    stage.addChild(graphics);
    dashedBorderStore.set(eid, graphics);

    // stage의 sortableChildren이 활성화되어 있는지 확인
    if (!stage.sortableChildren) {
      stage.sortableChildren = true;
    }
  } else {
    graphics.clear();
    graphics.visible = true;
  }

  // 테두리 색상 결정 (포커스된 대상은 조금 더 밝은 핑크, 일반은 빨간색)
  const borderColor = isFocused ? 0xff7dc2 : 0xff0000;
  const lineWidth = isFocused ? 4 : 3;

  // zIndex 설정 (포커스된 대상이 더 앞에 나오도록)
  graphics.zIndex = isFocused
    ? DEFAULT_BORDER_Z_INDEX + 1
    : DEFAULT_BORDER_Z_INDEX;

  // 점선 테두리 그리기 (오브젝트 크기에 맞게)
  const borderX = x - objectWidth / 2;
  const borderY = y - objectHeight / 2;
  const borderWidth = objectWidth;
  const borderHeight = objectHeight;

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
    broomSprite.zIndex = INTENTED_FRONT_Z_INDEX + 20; // 테두리보다도 더 위에
    broomSprite.anchor.set(0.5, 0.5); // 중심점을 가운데로
    stage.addChild(broomSprite);
    broomStore.set(eid, broomSprite);
  }

  // 빗자루 방향에 따른 좌우 반전
  const sliderValue = world.sliderValue;
  const isMovingRight = sliderValue > 0.5;
  broomSprite.scale.x = isMovingRight ? 3.0 : -3.0; // 오른쪽으로 이동하면 정방향, 왼쪽으로 이동하면 반전
  broomSprite.scale.y = 3.0;

  const targetLeftX = targetX - targetWidth / 2;
  const broomX = targetLeftX + sliderValue * targetWidth;
  const broomY = targetY - 10; // 타겟보다 10px 위에 (객체 중간보다 조금 더 낮게)

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
  dashedBorderStore.forEach((dashedBorder, _eid) => {
    stage.removeChild(dashedBorder);
    dashedBorder.destroy();
  });
  dashedBorderStore.clear();

  broomStore.forEach((broomSprite, _eid) => {
    stage.removeChild(broomSprite);
    broomSprite.destroy();
  });
  broomStore.clear();
}
