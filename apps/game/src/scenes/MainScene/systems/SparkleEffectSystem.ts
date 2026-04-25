import {
  defineQuery,
  hasComponent,
  addComponent,
  removeComponent,
  exitQuery,
} from "bitecs";
import {
  ObjectComp,
  FreshnessComp,
  SparkleEffectComp,
  PositionComp,
  RenderComp,
} from "../raw-components";
import { MainSceneWorld } from "../world";
import { ObjectType, Freshness } from "../types";
import * as PIXI from "pixi.js";

const freshFoodQuery = defineQuery([ObjectComp, FreshnessComp, PositionComp]);
const positionedObjectQuery = defineQuery([ObjectComp, PositionComp]);
const positionedObjectExitQuery = exitQuery(positionedObjectQuery);
const sparkleQuery = defineQuery([ObjectComp, SparkleEffectComp]);

// 엔티티별 간단한 스파클 컨테이너 저장
const entitySparkleContainers: Map<number, PIXI.Container[]> = new Map();

const STALE_FOOD_SMELL_LINE_COUNT = 3;
const STALE_FOOD_SMELL_COLOR = 0xc58cff;
const POOB_SMELL_COLOR = 0xa66a2f;
const STALE_FOOD_SMELL_PIXEL_SIZE = 2;
const STALE_FOOD_SMELL_BLOCK_COUNT = 7;
const STALE_FOOD_SMELL_BLOCK_GAP = STALE_FOOD_SMELL_PIXEL_SIZE;
const STALE_FOOD_SMELL_BLOCK_HEIGHT = STALE_FOOD_SMELL_PIXEL_SIZE + 1;
const STALE_FOOD_SMELL_SPACING = 8;
const STALE_FOOD_SMELL_Z_INDEX_OFFSET = 24;
const STALE_FOOD_SMELL_STEP_PATTERN = [-1, -1, 0, 0, 1, 1, 0, 0];

type StaleFoodSmellVisual = {
  container: PIXI.Container;
  graphics: PIXI.Graphics;
  phaseOffset: number;
};

type SmellConfig = {
  color: number;
  yOffset: number;
  zIndex: number;
};

// 상한 음식/똥 냄새선 컨테이너 저장
const entityStaleFoodSmellVisuals: Map<number, StaleFoodSmellVisual> =
  new Map();

// 애니메이션 중인 스파클들을 추적
const animatingSparkles: Map<
  PIXI.Container,
  {
    startTime: number;
    duration: number;
    initialAlpha: number;
    initialScale: number;
    onComplete: () => void;
  }
> = new Map();

function drawSparkleGraphic(graphics: PIXI.Graphics): void {
  graphics.clear();

  graphics.poly([
    0, -8, 1.9, -1.9, 8, 0, 1.9, 1.9, 0, 8, -1.9, 1.9, -8, 0, -1.9, -1.9,
  ]);
  graphics.fill({ color: 0xffffff, alpha: 0.9 });
}

/**
 * 애니메이션 중인 스파클들 업데이트
 */
function updateSparkleAnimations(currentTime: number): void {
  const toRemove: PIXI.Container[] = [];

  animatingSparkles.forEach((animData, sparkleContainer) => {
    const elapsed = currentTime - animData.startTime;
    const progress = Math.min(elapsed / animData.duration, 1);

    if (progress >= 1) {
      // 애니메이션 완료
      toRemove.push(sparkleContainer);

      // 콜백을 안전하게 실행
      try {
        animData.onComplete();
      } catch (error) {
        console.warn(
          "[SparkleEffectSystem] Error in animation complete callback:",
          error,
        );
      }
      return;
    }

    // 부드러운 easing 함수 사용 (ease-in-out-cubic)
    const easeInOutCubic = (t: number): number => {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    let alpha: number;
    let scale: number;

    if (progress < 0.25) {
      // 페이드 인 (0-25%)
      const fadeInProgress = easeInOutCubic(progress / 0.25);
      alpha = animData.initialAlpha * fadeInProgress;
      scale = animData.initialScale * (0.4 + 0.6 * fadeInProgress);
    } else if (progress < 0.75) {
      // 안정 상태 (25-75%) - 완전히 안정
      alpha = animData.initialAlpha;
      scale = animData.initialScale;
    } else {
      // 페이드 아웃 (75-100%)
      const fadeOutProgress = easeInOutCubic((progress - 0.75) / 0.25);
      alpha = animData.initialAlpha * (1 - fadeOutProgress);
      scale = animData.initialScale * (1 - fadeOutProgress * 0.4);
    }

    // 값 범위 보장
    sparkleContainer.alpha = Math.max(0, Math.min(1, alpha));
    const pulse = 1 + Math.sin(progress * Math.PI) * 0.04;
    sparkleContainer.scale.set(Math.max(0.01, scale * pulse));
  });

  // 완료된 애니메이션 제거
  toRemove.forEach((container) => {
    animatingSparkles.delete(container);
  });
}

/**
 * 스파클 이펙트 시스템
 * - 신선한 음식에 스파클 효과 적용
 * - 음식이 더 이상 신선하지 않으면 효과 제거
 */
export function sparkleEffectSystem(params: {
  world: MainSceneWorld;
  currentTime: number;
}): typeof params {
  const { world, currentTime } = params;

  // 신선한 음식에 스파클 효과 추가
  addSparkleToFreshFood(world, currentTime);

  // 신선하지 않은 음식에서 스파클 효과 제거
  removeSparkleFromNonFreshFood(world);

  // 스파클 효과 업데이트
  updateSparkleEffects(world, currentTime);

  // 상한 음식/똥 냄새선 표시
  updateDirtyObjectSmellEffects(world, currentTime);

  // 애니메이션 중인 스파클 업데이트
  updateSparkleAnimations(currentTime);

  return params;
}

/**
 * 상한 음식/똥에 냄새선 표시
 */
function updateDirtyObjectSmellEffects(
  world: MainSceneWorld,
  currentTime: number,
): void {
  const exitedObjects = positionedObjectExitQuery(world);
  for (let i = 0; i < exitedObjects.length; i++) {
    removeStaleFoodSmellEffect(exitedObjects[i]);
  }

  const objects = positionedObjectQuery(world);
  for (let i = 0; i < objects.length; i++) {
    const eid = objects[i];
    const smellConfig = getSmellConfig(world, eid);

    if (!smellConfig) {
      removeStaleFoodSmellEffect(eid);
      continue;
    }

    createOrUpdateStaleFoodSmellEffect(world, eid, currentTime, smellConfig);
  }

  entityStaleFoodSmellVisuals.forEach((_visual, eid) => {
    if (
      !hasComponent(world, ObjectComp, eid) ||
      !hasComponent(world, PositionComp, eid) ||
      !getSmellConfig(world, eid)
    ) {
      removeStaleFoodSmellEffect(eid);
    }
  });
}

function createOrUpdateStaleFoodSmellEffect(
  world: MainSceneWorld,
  eid: number,
  currentTime: number,
  smellConfig: SmellConfig,
): void {
  let visual = entityStaleFoodSmellVisuals.get(eid);

  if (!visual) {
    const container = new PIXI.Container();
    const graphics = new PIXI.Graphics();

    container.eventMode = "none";
    container.addChild(graphics);
    world.stage.addChild(container);
    world.stage.sortableChildren = true;

    visual = {
      container,
      graphics,
      phaseOffset: Math.random() * Math.PI * 2,
    };
    entityStaleFoodSmellVisuals.set(eid, visual);
  }

  visual.container.position.set(
    Math.round(PositionComp.x[eid]),
    Math.round(PositionComp.y[eid] + smellConfig.yOffset),
  );
  visual.container.zIndex = smellConfig.zIndex;
  visual.container.visible = true;

  drawStaleFoodSmellLines(
    visual.graphics,
    currentTime,
    visual.phaseOffset,
    smellConfig.color,
  );
}

function getSmellConfig(world: MainSceneWorld, eid: number): SmellConfig | null {
  if (ObjectComp.type[eid] === ObjectType.FOOD) {
    if (
      !hasComponent(world, FreshnessComp, eid) ||
      FreshnessComp.freshness[eid] !== Freshness.STALE
    ) {
      return null;
    }

    return {
      color: STALE_FOOD_SMELL_COLOR,
      yOffset: getStaleFoodSmellYOffset(world, eid),
      zIndex: getFoodEffectZIndex(world, eid),
    };
  }

  if (ObjectComp.type[eid] === ObjectType.POOB) {
    return {
      color: POOB_SMELL_COLOR,
      yOffset: getStaleFoodSmellYOffset(world, eid),
      zIndex: getFoodEffectZIndex(world, eid),
    };
  }

  return null;
}

function getStaleFoodSmellYOffset(world: MainSceneWorld, eid: number): number {
  const scale =
    hasComponent(world, RenderComp, eid) &&
    Number.isFinite(RenderComp.scale[eid]) &&
    RenderComp.scale[eid] > 0
      ? RenderComp.scale[eid]
      : 1;

  return -(4 * scale + 5);
}

function getFoodEffectZIndex(world: MainSceneWorld, eid: number): number {
  if (!hasComponent(world, RenderComp, eid)) {
    return Math.floor(PositionComp.y[eid]) + STALE_FOOD_SMELL_Z_INDEX_OFFSET;
  }

  const configuredZIndex = RenderComp.zIndex[eid];
  const foodZIndex =
    configuredZIndex === undefined || configuredZIndex === ECS_NULL_VALUE
      ? Math.floor(PositionComp.y[eid])
      : configuredZIndex;

  return foodZIndex + STALE_FOOD_SMELL_Z_INDEX_OFFSET;
}

function drawStaleFoodSmellLines(
  graphics: PIXI.Graphics,
  currentTime: number,
  phaseOffset: number,
  color: number,
): void {
  graphics.clear();

  const frameOffsetBase = Math.floor(currentTime / 260 + phaseOffset);
  const verticalNudge = frameOffsetBase % 2;

  for (let i = 0; i < STALE_FOOD_SMELL_LINE_COUNT; i++) {
    const normalizedIndex = i - (STALE_FOOD_SMELL_LINE_COUNT - 1) / 2;
    const baseX = normalizedIndex * STALE_FOOD_SMELL_SPACING;
    const frameOffset = frameOffsetBase % STALE_FOOD_SMELL_STEP_PATTERN.length;

    for (let block = 0; block < STALE_FOOD_SMELL_BLOCK_COUNT; block++) {
      const patternIndex =
        (block + frameOffset) % STALE_FOOD_SMELL_STEP_PATTERN.length;
      const x =
        baseX +
        STALE_FOOD_SMELL_STEP_PATTERN[patternIndex] *
          STALE_FOOD_SMELL_PIXEL_SIZE;
      const y = -(block * STALE_FOOD_SMELL_BLOCK_GAP + verticalNudge);
      const progress = block / (STALE_FOOD_SMELL_BLOCK_COUNT - 1);
      const alpha = 0.9 - progress * 0.34;

      graphics
        .rect(
          Math.round(x - STALE_FOOD_SMELL_PIXEL_SIZE / 2),
          Math.round(y),
          STALE_FOOD_SMELL_PIXEL_SIZE,
          STALE_FOOD_SMELL_BLOCK_HEIGHT,
        )
        .fill({
          color,
          alpha,
        });
    }
  }
}

function removeStaleFoodSmellEffect(eid: number): void {
  const visual = entityStaleFoodSmellVisuals.get(eid);
  if (!visual) {
    return;
  }

  if (visual.container.parent) {
    visual.container.parent.removeChild(visual.container);
  }
  visual.container.destroy({ children: true });
  entityStaleFoodSmellVisuals.delete(eid);
}

/**
 * 신선한 음식에 스파클 효과 추가
 */
function addSparkleToFreshFood(
  world: MainSceneWorld,
  currentTime: number,
): void {
  const freshFoods = freshFoodQuery(world);

  for (let i = 0; i < freshFoods.length; i++) {
    const eid = freshFoods[i];

    if (ObjectComp.type[eid] !== ObjectType.FOOD) continue;

    const freshness = FreshnessComp.freshness[eid];

    // 신선한 음식이고 아직 스파클 효과가 없는 경우
    if (
      freshness === Freshness.FRESH &&
      !hasComponent(world, SparkleEffectComp, eid)
    ) {
      addComponent(world, SparkleEffectComp, eid);
      SparkleEffectComp.isActive[eid] = 1;
      SparkleEffectComp.sparkleCount[eid] = 0;
      SparkleEffectComp.nextSpawnTime[eid] = currentTime + 1000; // 1초 후 첫 반짝임
      SparkleEffectComp.spawnInterval[eid] = 1200; // 1.8초마다 반짝임 (더 느리게)

      // 간단한 SparkleEffect 생성 (PIXI.Ticker 사용)
      createSimpleSparkleEffect(world, eid);

      console.log(
        `[SparkleEffectSystem] Added SparkleEffect to fresh food ${eid}`,
      );
    }
  }
}

/**
 * 신선하지 않은 음식에서 스파클 효과 제거
 */
function removeSparkleFromNonFreshFood(world: MainSceneWorld): void {
  const sparkleEntities = sparkleQuery(world);

  for (let i = 0; i < sparkleEntities.length; i++) {
    const eid = sparkleEntities[i];

    if (ObjectComp.type[eid] !== ObjectType.FOOD) continue;

    if (hasComponent(world, FreshnessComp, eid)) {
      const freshness = FreshnessComp.freshness[eid];

      // 더 이상 신선하지 않은 경우 스파클 효과 제거
      if (freshness !== Freshness.FRESH) {
        removeComponent(world, SparkleEffectComp, eid);
        destroySparkleEffect(eid);
      }
    } else {
      // FreshnessComp가 없는 경우에도 스파클 효과 제거
      removeComponent(world, SparkleEffectComp, eid);
      destroySparkleEffect(eid);
    }
  }
}

/**
 * 간단한 스파클 효과 생성
 */
function createSimpleSparkleEffect(_world: MainSceneWorld, eid: number): void {
  const containers: PIXI.Container[] = [];
  entitySparkleContainers.set(eid, containers);

  console.log(
    `[SparkleEffectSystem] Created simple sparkle effect for entity ${eid}`,
  );
}

/**
 * 스파클 효과 제거
 */
function destroySparkleEffect(eid: number): void {
  // 간단한 스파클 컨테이너 제거 (하지만 애니메이션 중인 것들은 완료될 때까지 유지)
  const containers = entitySparkleContainers.get(eid);
  if (containers) {
    // 새로운 스파클 생성을 막기 위해 컨테이너 배열만 제거
    // 실제 스파클들은 각자의 애니메이션이 완료될 때 자연스럽게 제거됨
    entitySparkleContainers.delete(eid);

    console.log(
      `[SparkleEffectSystem] Marked sparkle effect for removal for entity ${eid}, ${containers.length} sparkles will finish their animation`,
    );
  }
}

/**
 * 스파클 효과 업데이트
 */
function updateSparkleEffects(
  world: MainSceneWorld,
  currentTime: number,
): void {
  const sparkleEntities = sparkleQuery(world);

  for (let i = 0; i < sparkleEntities.length; i++) {
    const eid = sparkleEntities[i];

    if (!SparkleEffectComp.isActive[eid]) continue;

    const nextSpawnTime = SparkleEffectComp.nextSpawnTime[eid];
    const spawnInterval = SparkleEffectComp.spawnInterval[eid];

    // 새로운 반짝임 생성 시간이 되었는지 체크
    if (currentTime >= nextSpawnTime) {
      // 엔티티가 아직 유효하고 신선한지 확인
      if (
        !hasComponent(world, FreshnessComp, eid) ||
        FreshnessComp.freshness[eid] !== Freshness.FRESH
      ) {
        // 더 이상 신선하지 않으면 스파클 생성 중지
        SparkleEffectComp.isActive[eid] = 0;
        continue;
      }

      // 현재 활성화된 스파클 개수 확인 (너무 많으면 생성하지 않음)
      const containers = entitySparkleContainers.get(eid) || [];
      const activeSparkles = containers.filter(
        (container) => container.parent,
      ).length;

      if (activeSparkles < 2) {
        // 최대 2개까지만 동시 존재 (3에서 2로 줄임)
        // 반짝임 카운트 증가 (최대 5개까지)
        const currentCount = SparkleEffectComp.sparkleCount[eid];
        if (currentCount < 5) {
          SparkleEffectComp.sparkleCount[eid] = currentCount + 1;
        }

        // 실제 시각적 스파클 생성
        createSparkleVisual(world, eid);
      }

      // 다음 반짝임 생성 시간 설정 (약간의 랜덤성 추가)
      const randomDelay = spawnInterval + (Math.random() - 0.5) * 400; // ±200ms
      SparkleEffectComp.nextSpawnTime[eid] = currentTime + randomDelay;
    }
  }
}

/**
 * 시각적 반짝임 효과 생성
 */
function createSparkleVisual(world: MainSceneWorld, eid: number): void {
  if (!hasComponent(world, PositionComp, eid)) return;

  const position = {
    x: PositionComp.x[eid],
    y: PositionComp.y[eid],
  };

  // 별 중심의 반짝임 그래픽 생성
  const star = new PIXI.Graphics();
  drawSparkleGraphic(star);

  // 컨테이너에 별 추가
  const sparkleContainer = new PIXI.Container();
  sparkleContainer.addChild(star);

  // 음식 주변 랜덤한 위치에 배치
  sparkleContainer.position.x = position.x + (-0.5 + Math.random()) * 30;
  sparkleContainer.position.y = position.y + (-0.5 + Math.random()) * 30;

  // 랜덤 크기, 투명도, 회전 (더 안정적인 범위)
  const initialScale = 0.7 + Math.random() * 0.3; // 0.7-1.0로 범위 줄임
  sparkleContainer.scale.set(initialScale);
  sparkleContainer.alpha = 0.92;
  sparkleContainer.rotation = Math.random() * Math.PI * 2;

  // 스테이지에 추가
  world.stage.addChild(sparkleContainer);

  // 음식의 zIndex를 가져와서 +1로 설정 (음식 위에 그려지도록)
  let foodZIndex = 0;
  if (hasComponent(world, RenderComp, eid)) {
    const configuredZIndex = RenderComp.zIndex[eid];
    foodZIndex =
      configuredZIndex === undefined || configuredZIndex === 0
        ? Math.floor(PositionComp.y[eid]) // 정수로 변환
        : configuredZIndex;
  }
  sparkleContainer.zIndex = foodZIndex + 10; // 확실히 위에 그려지도록 +10
  world.stage.sortableChildren = true; // zIndex 정렬 활성화

  // 엔티티의 스파클 컨테이너 목록에 추가 (엔티티가 아직 유효한 경우에만)
  let containers = entitySparkleContainers.get(eid);
  if (!containers) {
    // 엔티티가 더 이상 스파클 효과를 받지 않는 경우 생성하지 않음
    if (!hasComponent(world, SparkleEffectComp, eid)) {
      // 스파클이 생성되었지만 엔티티가 제거된 경우, 스파클은 애니메이션 완료까지 유지
      console.log(
        `[SparkleEffectSystem] Sparkle created for removed entity ${eid}, will complete animation naturally`,
      );
      return;
    }
    containers = [];
    entitySparkleContainers.set(eid, containers);
  }
  containers.push(sparkleContainer);

  // 애니메이션 시작
  startSparkleAnimation(sparkleContainer, () => {
    // 애니메이션 완료 후 제거
    if (sparkleContainer.parent) {
      sparkleContainer.parent.removeChild(sparkleContainer);
    }

    // 컨테이너 목록에서도 제거 (목록이 아직 존재하는 경우에만)
    const containers = entitySparkleContainers.get(eid);
    if (containers) {
      const index = containers.indexOf(sparkleContainer);
      if (index > -1) {
        containers.splice(index, 1);
      }
    }
  });

  // console.log(
  //   `[SparkleEffectSystem] Created sparkle visual for entity ${eid} at (${position.x}, ${position.y})`
  // );
}

/**
 * 스파클 애니메이션 시작
 */
function startSparkleAnimation(
  sparkleContainer: PIXI.Container,
  onComplete: () => void,
): void {
  const duration = 800;
  const startTime = Date.now();
  const initialAlpha = sparkleContainer.alpha;
  const initialScale = sparkleContainer.scale.x;

  // 애니메이션 데이터 저장
  animatingSparkles.set(sparkleContainer, {
    startTime,
    duration,
    initialAlpha,
    initialScale,
    onComplete,
  });
}
