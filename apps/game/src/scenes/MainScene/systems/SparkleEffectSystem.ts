import {
  defineQuery,
  hasComponent,
  addComponent,
  removeComponent,
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
const sparkleQuery = defineQuery([ObjectComp, SparkleEffectComp]);

// 엔티티별 간단한 스파클 컨테이너 저장
const entitySparkleContainers: Map<number, PIXI.Container[]> = new Map();

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
          error
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
    sparkleContainer.scale.set(Math.max(0.01, scale));
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

  // 애니메이션 중인 스파클 업데이트
  updateSparkleAnimations(currentTime);

  return params;
}

/**
 * 신선한 음식에 스파클 효과 추가
 */
function addSparkleToFreshFood(
  world: MainSceneWorld,
  currentTime: number
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
        `[SparkleEffectSystem] Added SparkleEffect to fresh food ${eid}`
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
    `[SparkleEffectSystem] Created simple sparkle effect for entity ${eid}`
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
      `[SparkleEffectSystem] Marked sparkle effect for removal for entity ${eid}, ${containers.length} sparkles will finish their animation`
    );
  }
}

/**
 * 스파클 효과 업데이트
 */
function updateSparkleEffects(
  world: MainSceneWorld,
  currentTime: number
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
        (container) => container.parent
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

  // 부드럽고 빛나는 별 그래픽 생성
  const star = new PIXI.Graphics();

  // 글로우 효과를 위한 외부 원 (더 큰 반투명 원)
  star.fill({ color: 0xffffff, alpha: 0.2 });
  star.circle(0, 0, 12);

  // 중간 글로우
  star.fill({ color: 0xffffff, alpha: 0.4 });
  star.circle(0, 0, 8);

  // 중앙 밝은 별 모양
  const outerRadius = 6;
  const innerRadius = 2.5;
  const numPoints = 4;

  star.fill({ color: 0xffffff, alpha: 1.0 });
  star.moveTo(0, -outerRadius);

  for (let i = 0; i < numPoints * 2; i++) {
    const radius = i % 2 === 0 ? innerRadius : outerRadius;
    const angle = (Math.PI / numPoints) * (i + 1);
    const x = Math.sin(angle) * radius;
    const y = -Math.cos(angle) * radius;
    star.lineTo(x, y);
  }

  star.closePath();

  // 컨테이너에 별 추가
  const sparkleContainer = new PIXI.Container();
  sparkleContainer.addChild(star);

  // 음식 주변 랜덤한 위치에 배치 (범위도 조금 늘림)
  sparkleContainer.position.x = position.x + (-0.5 + Math.random()) * 48; // 32에서 48로 증가
  sparkleContainer.position.y = position.y + (-0.5 + Math.random()) * 48; // 32에서 48로 증가

  // 랜덤 크기, 투명도, 회전 (더 안정적인 범위)
  const initialScale = 0.7 + Math.random() * 0.3; // 0.7-1.0로 범위 줄임
  sparkleContainer.scale.set(initialScale);
  sparkleContainer.alpha = 0.85; // 더 불투명하게 변경 (0.6 → 0.85)
  sparkleContainer.rotation = Math.random() * Math.PI * 2; // 0~360도 랜덤 회전

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
        `[SparkleEffectSystem] Sparkle created for removed entity ${eid}, will complete animation naturally`
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
  onComplete: () => void
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
