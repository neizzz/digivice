import {
  defineQuery,
  enterQuery,
  exitQuery,
  addComponent,
  hasComponent,
  removeComponent,
  removeEntity,
} from "bitecs";
import {
  ObjectComp,
  PositionComp,
  CleanableComp,
  FreshnessComp,
} from "../raw-components";
import { ObjectType, Freshness, FoodState } from "../types";
import type { MainSceneWorld } from "../world";

// 청소 시스템 상수
const CLEANING_DISTANCE = 5;

// 청소 가능한 엔티티 쿼리 (poob, stale food)
const cleanableEntitiesQuery = defineQuery([
  ObjectComp,
  PositionComp,
  CleanableComp,
]);

const allCleanableQuery = defineQuery([CleanableComp]);

// 새로 추가된 청소 대상 엔티티 쿼리
const enterCleanableQuery = enterQuery(cleanableEntitiesQuery);

// 제거된 청소 대상 엔티티 쿼리
const exitCleanableQuery = exitQuery(cleanableEntitiesQuery);

// 청소 후보 엔티티 쿼리
const cleaningCandidateQuery = defineQuery([ObjectComp, PositionComp]);

interface CleaningSystemParams {
  world: MainSceneWorld;
  delta: number;
}

/**
 * 청소 시스템 - 청소 모드 관리, 청소 대상 하이라이트, 빗자루 렌더링
 */
export function cleaningSystem(params: CleaningSystemParams): {
  world: MainSceneWorld;
  delta: number;
} {
  const { world, delta } = params;

  // 청소 모드가 활성화되어 있지 않으면 스킵
  if (!world.isCleaningMode) {
    return { world, delta };
  }

  // 청소 모드 동안 매 프레임 청소 가능 대상을 동기화한다.
  // 그래야 청소 모드 진입 이후에 상한 음식이 생겨도 즉시 청소 타겟으로 잡힌다.
  syncCleanableEntities(world);

  // 청소 모드 진입 시 초기 포커스/슬라이더 상태만 세팅
  if (world.isEnteringCleaningMode) {
    handleEnterCleaningMode(world);
  }

  // 새로 추가된 청소 대상 엔티티 처리
  const newCleanableEntities = enterCleanableQuery(world);
  for (let i = 0; i < newCleanableEntities.length; i++) {
    const eid = newCleanableEntities[i];
    handleEnterCleanable(world, eid);
  }

  // 제거된 청소 대상 엔티티 처리
  const exitedCleanableEntities = exitCleanableQuery(world);
  for (let i = 0; i < exitedCleanableEntities.length; i++) {
    const eid = exitedCleanableEntities[i];
    handleExitCleanable(world, eid);
  }

  // 포커스된 대상이 있으면 빗자루 업데이트
  if (world.focusedTargetEid !== -1) {
    updateBroomMovement(world, world.focusedTargetEid);
  }

  return { world, delta };
}

export function clearCleaningTargets(world: MainSceneWorld): void {
  const cleanableEntities = allCleanableQuery(world);

  for (let i = 0; i < cleanableEntities.length; i++) {
    const eid = cleanableEntities[i];
    CleanableComp.isHighlighted[eid] = 0;
    CleanableComp.isBeingCleaned[eid] = 0;
  }
}

/**
 * 청소 모드 진입 시 처리
 */
function handleEnterCleaningMode(world: MainSceneWorld): void {
  // 첫 번째 청소 대상을 포커스
  const cleanableEntities = cleanableEntitiesQuery(world);
  if (cleanableEntities.length > 0) {
    const firstTarget = cleanableEntities[0];
    world.setFocusedTargetEid(firstTarget);
  }

  // 빗자루 관련 초기 설정
  world.setBroomProgress(world.sliderValue);
}

/**
 * 새로운 청소 대상 엔티티 처리
 */
function handleEnterCleanable(world: MainSceneWorld, eid: number): void {
  if (world.focusedTargetEid === -1) {
    world.setFocusedTargetEid(eid);
  }
}

/**
 * 제거된 청소 대상 엔티티 처리
 */
function handleExitCleanable(world: MainSceneWorld, eid: number): void {
  // 포커스된 대상이 제거되었다면 다음 대상으로 이동
  if (world.focusedTargetEid === eid) {
    const nextTarget = findNextCleanableTarget(world, eid);
    if (nextTarget !== -1) {
      world.setFocusedTargetEid(nextTarget);
    } else {
      // 더 이상 청소할 대상이 없으면 청소 모드 종료
      // Note: 실제 모드 종료는 MainSceneWorld에서 처리
    }
  }
}

/**
 * 빗자루 움직임 업데이트
 */
function updateBroomMovement(
  world: MainSceneWorld,
  focusedTargetEid: number,
): void {
  const sliderValue = world.sliderValue;
  const progressDelta = world.consumePendingCleaningSliderDelta();
  const cleaningProgress = CleanableComp.cleaningProgress[focusedTargetEid];

  world.setBroomProgress(sliderValue);

  if (progressDelta > 0.002) {
    // 최소 임계값 이상 움직였을 때만 청소 진행
    const newCleaningProgress = Math.min(
      1.0,
      cleaningProgress + progressDelta / CLEANING_DISTANCE,
    );
    CleanableComp.cleaningProgress[focusedTargetEid] = newCleaningProgress;

    // 청소 완료 확인
    if (newCleaningProgress >= 1.0) {
      // 청소 완료된 엔티티 제거
      console.log(
        `[CleaningSystem] Entity ${focusedTargetEid} cleaning completed, removing entity`,
      );
      removeEntity(world, focusedTargetEid);

      // 다음 대상으로 이동 (청소 모드 종료는 슬라이더 종료 시 처리)
      const nextTarget = findNextCleanableTarget(world, focusedTargetEid);
      if (nextTarget !== -1) {
        world.setFocusedTargetEid(nextTarget);
        world.setBroomProgress(world.sliderValue);
      } else {
        // 모든 청소가 완료되었지만 슬라이더가 아직 활성화되어 있을 수 있음
        world.setFocusedTargetEid(-1);
        console.log(
          `[CleaningSystem] All cleaning completed, waiting for slider end to exit cleaning mode`,
        );
      }
    }
  }
}

/**
 * 현재 엔티티가 청소 가능한 대상인지 확인
 */
function isCleanableEntity(world: MainSceneWorld, eid: number): boolean {
  const isPoob = ObjectComp.type[eid] === ObjectType.POOB;
  const isStaleFood =
    ObjectComp.type[eid] === ObjectType.FOOD &&
    hasComponent(world, FreshnessComp, eid) &&
    FreshnessComp.freshness[eid] === Freshness.STALE &&
    ObjectComp.state[eid] !== FoodState.BEING_THROWING;

  return isPoob || isStaleFood;
}

/**
 * 청소 가능 대상 동기화
 * - 새로 청소 가능해진 엔티티에는 CleanableComp 추가
 * - 더 이상 청소 가능하지 않은 엔티티에서는 CleanableComp 제거
 */
function syncCleanableEntities(world: MainSceneWorld): void {
  const candidateEntities = cleaningCandidateQuery(world);

  for (let i = 0; i < candidateEntities.length; i++) {
    const eid = candidateEntities[i];
    if (!isCleanableEntity(world, eid)) {
      continue;
    }

    if (!hasComponent(world, CleanableComp, eid)) {
      addComponent(world, CleanableComp, eid);
      CleanableComp.cleaningProgress[eid] = 0;
      CleanableComp.isBeingCleaned[eid] = 0;
    }

    CleanableComp.isHighlighted[eid] = 1;
  }

  const existingCleanableEntities = allCleanableQuery(world);
  for (let i = 0; i < existingCleanableEntities.length; i++) {
    const eid = existingCleanableEntities[i];
    if (isCleanableEntity(world, eid)) {
      continue;
    }

    CleanableComp.isHighlighted[eid] = 0;
    CleanableComp.isBeingCleaned[eid] = 0;
    CleanableComp.cleaningProgress[eid] = 0;
    removeComponent(world, CleanableComp, eid);
  }
}

/**
 * 다음 청소 대상 찾기
 */
function findNextCleanableTarget(
  world: MainSceneWorld,
  currentEid: number,
): number {
  const cleanableEntities = cleanableEntitiesQuery(world);

  // 현재 대상 이후의 엔티티부터 찾기
  let startIndex = 0;
  if (currentEid !== -1) {
    startIndex = cleanableEntities.findIndex((eid) => eid === currentEid) + 1;
  }

  for (let i = startIndex; i < cleanableEntities.length; i++) {
    const eid = cleanableEntities[i];
    if (CleanableComp.cleaningProgress[eid] < 1.0) {
      return eid;
    }
  }

  // 처음부터 다시 찾기
  for (let i = 0; i < startIndex; i++) {
    const eid = cleanableEntities[i];
    if (CleanableComp.cleaningProgress[eid] < 1.0) {
      return eid;
    }
  }

  return -1; // 청소할 대상이 없음
}
