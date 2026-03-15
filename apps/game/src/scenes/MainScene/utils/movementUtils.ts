import { hasComponent } from "bitecs";
import {
  PositionComp,
  SpeedComp,
  AngleComp,
  DestinationComp,
  CharacterStatusComp,
} from "../raw-components";
import { MainSceneWorld } from "../world";
import { DestinationType } from "../types";
import { getCharacterStats } from "../characterStats";

/**
 * 목표 지점을 향한 이동 유틸 함수
 * @param world 월드 인스턴스
 * @param eid 엔티티 ID
 * @param _delta 델타 타임 (미사용, CommonMovementSystem에서 처리)
 * @param arrivalThreshold 도착 판정 거리 (선택사항)
 * @returns { distance: 목표까지의 거리, hasArrived: 도착 여부 }
 */
export function moveTowardsTarget(
  world: MainSceneWorld,
  eid: number,
  _delta: number,
  arrivalThreshold?: number
): { distance: number; hasArrived: boolean } {
  // TARGETED 타입이 아니면 이동하지 않음
  if (DestinationComp.type[eid] !== DestinationType.TARGETED) {
    return { distance: Infinity, hasArrived: false };
  }

  const currentX = PositionComp.x[eid];
  const currentY = PositionComp.y[eid];
  const targetX = DestinationComp.x[eid];
  const targetY = DestinationComp.y[eid];

  // 목표 지점까지의 거리 계산
  const deltaX = targetX - currentX;
  const deltaY = targetY - currentY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  // 도착 판정 (선택사항)
  let hasArrived = false;
  if (arrivalThreshold !== undefined) {
    hasArrived = distance <= arrivalThreshold;
  }

  // 목표 방향으로의 각도 계산
  const targetAngle = Math.atan2(deltaY, deltaX);
  AngleComp.value[eid] = targetAngle;

  // 속도 확인 및 설정
  let baseSpeed = 0;
  if (hasComponent(world, CharacterStatusComp, eid)) {
    const characterKey = CharacterStatusComp.characterKey[eid];
    const characterStats = getCharacterStats(characterKey);
    baseSpeed = characterStats.speed;
  } else {
    // 기본 속도 (Bird 등)
    baseSpeed = 0.03;
  }

  // 일정한 속도 유지
  SpeedComp.value[eid] = baseSpeed;

  // CommonMovementSystem이 실제 위치 업데이트를 담당
  return { distance, hasArrived };
}
