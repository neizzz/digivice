import {
  Component,
  ComponentType,
  defineQuery,
  entityExists,
  type IWorld,
} from "bitecs";
import {
  PositionComp,
  SpeedComp,
  RenderComp,
  RandomMovementComp,
  AngleComp,
  ObjectComp,
  CharacterStatusComp,
  AnimationRenderComp,
} from "../raw-components";
import type * as PIXI from "pixi.js";
import { MainSceneWorld } from "../world";
import { renderSystem } from "./RenderSystem";
import { Render } from "matter-js";
import { nomalizeRadian } from "@/utils/common";

const characterQuery = defineQuery([CharacterStatusComp]);

// sprite 저장소 (다른 시스템과 공유)
let spriteStore: PIXI.Sprite[] = [];
export function setSpriteStore(store: PIXI.Sprite[]) {
  spriteStore = store;
}
function getSprite(idx: number): PIXI.Sprite | undefined {
  return spriteStore[idx];
}

export function randomMovementSystem(params: {
  world: MainSceneWorld;
  delta: number;
}): typeof params {
  const { world, delta } = params;
  const currentTime = Date.now();
  const chars = characterQuery(world);
  const boundary = world.positionBoundary;

  for (let i = 0; i < chars.length; i++) {
    const eid = chars[i];
    const position = PositionComp;
    const angle = AngleComp;
    const speed = SpeedComp;

    // 현재 상태 판단: speed가 0이면 idle, 0보다 크면 moving
    const isMoving = speed.value[eid] !== 0;

    // 현재 상태(idle/moving)가 끝났는지 확인
    if (currentTime >= RandomMovementComp.nextChange[eid]) {
      if (isMoving) {
        // moving -> idle 전환
        speed.value[eid] = 0;

        // 다음 idle 종료 시간 설정
        const idleTime = Math.round(
          RandomMovementComp.minIdleTime[eid] +
            Math.random() *
              (RandomMovementComp.maxIdleTime[eid] -
                RandomMovementComp.minIdleTime[eid])
        );
        RandomMovementComp.nextChange[eid] = currentTime + idleTime;
      } else {
        // idle -> moving 전환
        angle.value[eid] = nomalizeRadian(Math.random() * Math.PI * 2);
        speed.value[eid] = 0.1; // 기본 이동 속도 (pixels per ms)

        // 다음 이동 종료 시간 설정
        const moveTime = Math.round(
          RandomMovementComp.minMoveTime[eid] +
            Math.random() *
              (RandomMovementComp.maxMoveTime[eid] -
                RandomMovementComp.minMoveTime[eid])
        );
        RandomMovementComp.nextChange[eid] = currentTime + moveTime;
      }
    }

    if (isMoving) {
      // 현재 각도를 이용해 직선으로 이동
      const velocityX = Math.cos(angle.value[eid]) * speed.value[eid];
      const velocityY = Math.sin(angle.value[eid]) * speed.value[eid];

      // 다음 위치 계산
      const nextX = position.x[eid] + velocityX * delta;
      const nextY = position.y[eid] + velocityY * delta;

      // 경계 체크
      const maxX = boundary.x + boundary.width;
      const maxY = boundary.y + boundary.height;

      // 경계를 벗어나면 이동을 멈추고 idle 상태로 전환
      if (
        nextX <= boundary.x ||
        nextX >= maxX ||
        nextY <= boundary.y ||
        nextY >= maxY
      ) {
        // 경계를 벗어나면 반대 방향으로 각도 변경 및 스프라이트 반전
        // x축(좌우) 경계에서만 x축 반전, y축(상하) 경계에서만 y축 반전
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
    }
  }

  return params;
}

// export function uiStateSystem(world: IWorld): IWorld {
//   const chars = characterQuery(world);

//   for (let i = 0; i < chars.length; i++) {
//     const eid = chars[i];
//     const spriteIdx = RenderComp.spriteRefIndex[eid];
//     const sprite = getSprite(spriteIdx);

//     if (sprite) {
//       const pos = PositionComp;
//       const speed = SpeedComp;
//       const angle = AngleComp;

//       // 스프라이트 위치 업데이트
//       sprite.position.set(pos.x[eid], pos.y[eid]);

//       // zIndex 업데이트 (y 좌표 기반 depth 정렬)
//       sprite.zIndex = pos.y[eid];
//       RenderComp.zIndex[eid] = pos.y[eid];

//       // 캐릭터 방향 업데이트 (angle 기반으로 변경)
//       if (speed.value[eid] > 0.1) {
//         // 각도를 이용해 이동 방향 계산
//         const velocityX = Math.cos(angle.value[eid]) * speed.value[eid];
//         const shouldFlip = velocityX < 0;

//         // 스프라이트 반전 적용
//         if (sprite.scale) {
//           sprite.scale.x = shouldFlip
//             ? -Math.abs(sprite.scale.x)
//             : Math.abs(sprite.scale.x);
//         }
//       }
//     }
//   }

//   return world;
// }
