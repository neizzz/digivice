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
const REFLECTION_DIRECTION_PROBE_EPSILON = 0.000001;

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

      const nextX = position.x[eid] + Math.cos(targetAngle) * stepDistance;
      const nextY = position.y[eid] + Math.sin(targetAngle) * stepDistance;

      const maxX = boundary.x + boundary.width;
      const maxY = boundary.y + boundary.height;

      if (
        nextX <= boundary.x ||
        nextX >= maxX ||
        nextY <= boundary.y ||
        nextY >= maxY
      ) {
        if (nextX <= boundary.x || nextX >= maxX) {
          angle.value[eid] = nomalizeRadian(Math.PI - angle.value[eid]);
        }
        if (nextY <= boundary.y || nextY >= maxY) {
          angle.value[eid] = nomalizeRadian(-angle.value[eid]);
        }
      } else {
        position.x[eid] = nextX;
        position.y[eid] = nextY;
      }

      continue;
    }

    const freeMovementResult = calculateFreeMovementStep({
      x: position.x[eid],
      y: position.y[eid],
      angle: angle.value[eid],
      speed: speed.value[eid],
      delta,
      boundary,
    });

    position.x[eid] = freeMovementResult.x;
    position.y[eid] = freeMovementResult.y;
    angle.value[eid] = freeMovementResult.angle;
  }

  return params;
}

function calculateFreeMovementStep(params: {
  x: number;
  y: number;
  angle: number;
  speed: number;
  delta: number;
  boundary: MainSceneWorld["positionBoundary"];
}): { x: number; y: number; angle: number } {
  const { x, y, angle, speed, delta, boundary } = params;
  const maxX = boundary.x + boundary.width;
  const maxY = boundary.y + boundary.height;
  const deltaX = Math.cos(angle) * speed * delta;
  const deltaY = Math.sin(angle) * speed * delta;
  const reflectedX = reflectAxisPosition(x, deltaX, boundary.x, maxX);
  const reflectedY = reflectAxisPosition(y, deltaY, boundary.y, maxY);

  let nextAngle = angle;
  if (reflectedX.reflected) {
    nextAngle = nomalizeRadian(Math.PI - nextAngle);
  }
  if (reflectedY.reflected) {
    nextAngle = nomalizeRadian(-nextAngle);
  }

  return {
    x: reflectedX.value,
    y: reflectedY.value,
    angle: nextAngle,
  };
}

function reflectAxisPosition(
  currentValue: number,
  deltaValue: number,
  minValue: number,
  maxValue: number,
): { value: number; reflected: boolean } {
  const axisLength = maxValue - minValue;
  if (axisLength <= 0) {
    return {
      value: minValue,
      reflected: false,
    };
  }

  const period = axisLength * 2;
  const relativeEndValue = currentValue - minValue + deltaValue;
  const normalizedEndValue = positiveModulo(relativeEndValue, period);
  const reflectedValue =
    normalizedEndValue <= axisLength
      ? normalizedEndValue
      : period - normalizedEndValue;

  if (deltaValue === 0) {
    return {
      value: clampAxisValue(minValue + reflectedValue, minValue, maxValue),
      reflected: false,
    };
  }

  const probeValue =
    relativeEndValue + Math.sign(deltaValue) * REFLECTION_DIRECTION_PROBE_EPSILON;
  const normalizedProbeValue = positiveModulo(probeValue, period);

  return {
    value: clampAxisValue(minValue + reflectedValue, minValue, maxValue),
    reflected: normalizedProbeValue > axisLength,
  };
}

function positiveModulo(value: number, base: number): number {
  return ((value % base) + base) % base;
}

function clampAxisValue(value: number, minValue: number, maxValue: number): number {
  return Math.min(maxValue, Math.max(minValue, value));
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
