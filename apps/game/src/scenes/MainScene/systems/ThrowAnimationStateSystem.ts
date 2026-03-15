import { defineQuery, removeComponent } from "bitecs";
import {
  ObjectComp,
  PositionComp,
  RenderComp,
  ThrowAnimationComp,
} from "../raw-components";
import { ObjectType, FoodState } from "../types";
import { MainSceneWorld } from "../world";
import { INTENTED_FRONT_Z_INDEX } from "@/constants";

// 던지기 애니메이션 상수들
const THROW_DURATION = 1000; // 1초
const INITIAL_SCALE = 5.0; // 큰 크기로 시작 (앞쪽)
const FINAL_SCALE = 1.4; // 작은 크기로 끝 (뒤쪽)
const MAX_HEIGHT = 150; // 포물선 최대 높이

// 던지기 애니메이션이 활성화된 음식들을 쿼리
const throwAnimationQuery = defineQuery([
  ThrowAnimationComp,
  PositionComp,
  RenderComp,
  ObjectComp,
]);

/**
 * 던지기 애니메이션 시스템 (상태 + 렌더링 통합)
 * 시뮬레이션 모드에서는 상태만, 실시간 모드에서는 시각적 효과도 처리
 */
export function throwAnimationStateSystem(params: {
  world: MainSceneWorld;
  delta: number;
}): typeof params {
  const { world, delta } = params;
  const entities = throwAnimationQuery(world);
  const isSimulationMode = world.isSimulationMode;

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    // 활성화되지 않은 애니메이션은 건너뛰기
    if (!ThrowAnimationComp.isActive[eid]) {
      continue;
    }

    // 경과 시간 업데이트
    const deltaTime = delta * 1000; // delta를 밀리초로 변환
    ThrowAnimationComp.elapsedTime[eid] += deltaTime;

    const duration = THROW_DURATION;
    const elapsedTime = ThrowAnimationComp.elapsedTime[eid];

    // 진행률 계산 (0 ~ 1)
    const progress = Math.min(elapsedTime / duration, 1);

    // 초기 및 최종 위치
    const initialX = ThrowAnimationComp.initialX[eid];
    const initialY = ThrowAnimationComp.initialY[eid];
    const finalX = ThrowAnimationComp.finalX[eid];
    const finalY = ThrowAnimationComp.finalY[eid];

    // 위치 보간 (easeOut 효과로 더 자연스럽게)
    const easeOutProgress = 1 - Math.pow(1 - progress, 2);

    if (isSimulationMode) {
      // 시뮬레이션 모드: 기본적인 위치만 계산 (시각적 효과 생략)
      const currentX = initialX + (finalX - initialX) * easeOutProgress;
      const currentY = initialY + (finalY - initialY) * progress;

      PositionComp.x[eid] = currentX;
      PositionComp.y[eid] = currentY;
    } else {
      // 실시간 모드: 시각적 효과 포함
      const visualX = initialX + (finalX - initialX) * easeOutProgress;

      // 중력 효과를 포함한 y 위치 계산 - 포물선 효과
      const maxHeight = MAX_HEIGHT;
      const gravity = 4 * maxHeight * (progress - progress * progress);
      const visualY = initialY + (finalY - initialY) * progress - gravity;

      PositionComp.x[eid] = visualX;
      PositionComp.y[eid] = visualY;

      // 크기 애니메이션 (원근감을 위해 비선형적으로 변화)
      const initialScale = INITIAL_SCALE;
      const finalScale = FINAL_SCALE;
      // 크기는 빠르게 줄어들다가 점점 느려지는 곡선 적용 (원근감 효과)
      const scaleProgress = Math.pow(progress, 1.5);
      const scale = initialScale + (finalScale - initialScale) * scaleProgress;
      RenderComp.scale[eid] = scale;

      // 던져지는 동안에는 zIndex를 최상위로 설정
      RenderComp.zIndex[eid] = INTENTED_FRONT_Z_INDEX;
    }

    // 애니메이션 완료 처리
    if (progress >= 1) {
      // 애니메이션 비활성화
      ThrowAnimationComp.isActive[eid] = 0;

      // 최종 위치 설정
      PositionComp.x[eid] = finalX;
      PositionComp.y[eid] = finalY;

      if (!isSimulationMode) {
        // 실시간 모드에서만 시각적 정리
        RenderComp.scale[eid] = FINAL_SCALE;
        RenderComp.zIndex[eid] = 0;
      }

      // 음식 상태를 LANDED로 변경
      if (ObjectComp.type[eid] === ObjectType.FOOD) {
        ObjectComp.state[eid] = FoodState.LANDED;
      }

      // ThrowAnimationComp 제거
      removeComponent(world, ThrowAnimationComp, eid);

      console.log(
        `[ThrowAnimationSystem] Food ${eid} completed throw animation and landed at (${finalX}, ${finalY})`
      );
    }
  }

  return params;
}
