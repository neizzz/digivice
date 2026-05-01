import { defineQuery, hasComponent } from "bitecs";
import {
  PositionComp,
  SpeedComp,
  AngleComp,
  ObjectComp,
  DestinationComp,
} from "../raw-components";
import { MainSceneWorld } from "../world";
import { CharacterState, DestinationType, ObjectType } from "../types";
import { nomalizeRadian } from "@/utils/common";

const movingEntityQuery = defineQuery([PositionComp, SpeedComp, AngleComp]);
const TARGET_REACHED_EPSILON = 0.001;

/**
 * 공통 이동 시스템
 * - 속도와 각도를 이용한 위치 업데이트
 * - 경계 체크 및 반사
 * - 캐릭터 고유 속도 복원
 */
export function commonMovementSystem(params: {
  world: MainSceneWorld;
  delta: number;
}): typeof params {
  const { world, delta } = params;
  const entities = movingEntityQuery(world);
  const boundary = world.positionBoundary;

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    // 캐릭터인 경우 SLEEPING 또는 SICK 상태 체크
    if (
      ObjectComp.type[eid] === ObjectType.CHARACTER &&
      (ObjectComp.state[eid] === CharacterState.SLEEPING ||
        ObjectComp.state[eid] === CharacterState.SICK)
    ) {
      // 잠들거나 아픈 캐릭터는 움직임 중지
      SpeedComp.value[eid] = 0;
      continue;
    }

    const position = PositionComp;
    const angle = AngleComp;
    const speed = SpeedComp;

    // 이동하지 않는 엔티티는 건너뛰기
    if (speed.value[eid] === 0) continue;

    const targetedDestination = getTargetedDestination(world, eid);
    let nextX = position.x[eid];
    let nextY = position.y[eid];

    if (targetedDestination) {
      const deltaXToTarget = targetedDestination.x - position.x[eid];
      const deltaYToTarget = targetedDestination.y - position.y[eid];
      const remainingDistance = Math.sqrt(
        deltaXToTarget * deltaXToTarget + deltaYToTarget * deltaYToTarget,
      );

      if (remainingDistance <= TARGET_REACHED_EPSILON) {
        position.x[eid] = targetedDestination.x;
        position.y[eid] = targetedDestination.y;
        continue;
      }

      const targetAngle = Math.atan2(deltaYToTarget, deltaXToTarget);
      angle.value[eid] = targetAngle;

      const stepDistance = speed.value[eid] * delta;
      if (stepDistance >= remainingDistance) {
        position.x[eid] = targetedDestination.x;
        position.y[eid] = targetedDestination.y;
        continue;
      }

      nextX = position.x[eid] + Math.cos(targetAngle) * stepDistance;
      nextY = position.y[eid] + Math.sin(targetAngle) * stepDistance;
    } else {
      // 현재 각도를 이용해 직선으로 이동
      const velocityX = Math.cos(angle.value[eid]) * speed.value[eid];
      const velocityY = Math.sin(angle.value[eid]) * speed.value[eid];

      // 다음 위치 계산
      nextX = position.x[eid] + velocityX * delta;
      nextY = position.y[eid] + velocityY * delta;
    }

    // 경계 체크
    const maxX = boundary.x + boundary.width;
    const maxY = boundary.y + boundary.height;

    // 경계를 벗어나면 반대 방향으로 각도 변경
    if (
      nextX <= boundary.x ||
      nextX >= maxX ||
      nextY <= boundary.y ||
      nextY >= maxY
    ) {
      // x축(좌우) 경계에서만 x축 반전, y축(상하) 경계에서만 y축 반전
      if (nextX <= boundary.x || nextX >= maxX) {
        angle.value[eid] = nomalizeRadian(Math.PI - angle.value[eid]);
      }
      if (nextY <= boundary.y || nextY >= maxY) {
        angle.value[eid] = nomalizeRadian(-angle.value[eid]);
      }
    } else {
      // 경계 내부인 경우 위치 업데이트
      position.x[eid] = nextX;
      position.y[eid] = nextY;
    }
  }

  return params;
}

function getTargetedDestination(
  world: MainSceneWorld,
  eid: number,
): { x: number; y: number } | null {
  if (!hasComponent(world, DestinationComp, eid)) {
    return null;
  }

  if (DestinationComp.type[eid] !== DestinationType.TARGETED) {
    return null;
  }

  return {
    x: DestinationComp.x[eid],
    y: DestinationComp.y[eid],
  };
}
