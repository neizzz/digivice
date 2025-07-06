import { Component, ComponentType, defineQuery, type IWorld } from "bitecs";
import {
  PositionComp,
  SpeedComp,
  RenderComp,
  RandomMovementComp,
  AngleComp,
  ObjectComp,
} from "../raw-components";
import type * as PIXI from "pixi.js";
import { MainSceneWorld } from "../world";

const characterQuery = defineQuery([
  ObjectComp,
  PositionComp,
  AngleComp,
  SpeedComp,
  RandomMovementComp,
  RenderComp,
]);

// sprite 저장소 (다른 시스템과 공유)
let spriteStore: PIXI.Sprite[] = [];
export function setSpriteStore(store: PIXI.Sprite[]) {
  spriteStore = store;
}
function getSprite(idx: number): PIXI.Sprite | undefined {
  return spriteStore[idx];
}

export function randomMovementSystem(
  world: MainSceneWorld,
  deltaTime: number
): MainSceneWorld {
  const currentTime = Date.now();
  const chars = characterQuery(world);
  const boundary = world.positionBoundary;

  for (let i = 0; i < chars.length; i++) {
    const eid = chars[i];
    const position = PositionComp;
    const angle = AngleComp;
    const speed = SpeedComp;
    const randomMovement = RandomMovementComp;

    // 현재 상태 판단: speed가 0이면 idle, 0보다 크면 moving
    const isIdle = speed.value[eid] === 0;

    // 현재 상태(idle/moving)가 끝났는지 확인
    if (currentTime >= randomMovement.nextChange[eid]) {
      if (isIdle) {
        // idle -> moving 전환
        // 랜덤 방향과 속도 설정
        angle.value[eid] = Math.random() * Math.PI * 2;
        speed.value[eid] = 0.1; // 기본 이동 속도 (pixels per ms)

        // 다음 이동 종료 시간 설정
        const moveTime =
          randomMovement.minMoveTime[eid] +
          Math.random() *
            (randomMovement.maxMoveTime[eid] - randomMovement.minMoveTime[eid]);
        randomMovement.nextChange[eid] = currentTime + moveTime;
      } else {
        // moving -> idle 전환
        speed.value[eid] = 0;

        // 다음 idle 종료 시간 설정
        const idleTime =
          randomMovement.minIdleTime[eid] +
          Math.random() *
            (randomMovement.maxIdleTime[eid] - randomMovement.minIdleTime[eid]);
        randomMovement.nextChange[eid] = currentTime + idleTime;
      }
    }

    // 이동 중일 때만 위치 업데이트 및 경계 체크
    if (speed.value[eid] > 0) {
      // 현재 속도와 각도를 이용해 다음 위치 계산
      const velocityX = Math.cos(angle.value[eid]) * speed.value[eid];
      const velocityY = Math.sin(angle.value[eid]) * speed.value[eid];

      const nextX = position.x[eid] + velocityX * deltaTime;
      const nextY = position.y[eid] + velocityY * deltaTime;

      // 경계 체크 및 각도 반사
      let newAngle = angle.value[eid];
      let bounced = false;
      const maxX = boundary.x + boundary.width;
      const maxY = boundary.y + boundary.height;

      if (nextX < boundary.x || nextX > maxX) {
        // X축 경계에 충돌 - 각도를 X축에 대해 반사 (π - angle)
        newAngle = Math.PI - newAngle;
        bounced = true;
      }

      if (nextY < boundary.y || nextY > maxY) {
        // Y축 경계에 충돌 - 각도를 Y축에 대해 반사 (-angle)
        newAngle = -newAngle;
        bounced = true;
      }

      // 각도 정규화 (0 ~ 2π)
      if (bounced) {
        angle.value[eid] =
          ((newAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      }

      // 실제 위치 업데이트 (경계 안에서)
      const finalVelocityX = Math.cos(angle.value[eid]) * speed.value[eid];
      const finalVelocityY = Math.sin(angle.value[eid]) * speed.value[eid];

      position.x[eid] = Math.max(
        boundary.x,
        Math.min(maxX, position.x[eid] + finalVelocityX * deltaTime)
      );
      position.y[eid] = Math.max(
        boundary.y,
        Math.min(maxY, position.y[eid] + finalVelocityY * deltaTime)
      );
    }
  }

  return world;
}

export function uiStateSystem(world: IWorld): IWorld {
  const chars = characterQuery(world);

  for (let i = 0; i < chars.length; i++) {
    const eid = chars[i];
    const spriteIdx = RenderComp.spriteRefIndex[eid];
    const sprite = getSprite(spriteIdx);

    if (sprite) {
      const pos = PositionComp;
      const speed = SpeedComp;
      const angle = AngleComp;

      // 스프라이트 위치 업데이트
      sprite.position.set(pos.x[eid], pos.y[eid]);

      // zIndex 업데이트 (y 좌표 기반 depth 정렬)
      sprite.zIndex = pos.y[eid];
      RenderComp.zIndex[eid] = pos.y[eid];

      // 캐릭터 방향 업데이트 (angle 기반으로 변경)
      if (speed.value[eid] > 0.1) {
        // 각도를 이용해 이동 방향 계산
        const velocityX = Math.cos(angle.value[eid]) * speed.value[eid];
        const shouldFlip = velocityX < 0;

        // 스프라이트 반전 적용
        if (sprite.scale) {
          sprite.scale.x = shouldFlip
            ? -Math.abs(sprite.scale.x)
            : Math.abs(sprite.scale.x);
        }
      }
    }
  }

  return world;
}
