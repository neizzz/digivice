import { defineQuery } from "bitecs";
import {
  SpeedComp,
  RandomMovementComp,
  AngleComp,
  CharacterStatusComp,
} from "../raw-components";
import type * as PIXI from "pixi.js";
import { MainSceneWorld } from "../world";
import { nomalizeRadian } from "@/utils/common";
import { getCharacterStats } from "../characterStats";

const characterQuery = defineQuery([CharacterStatusComp, RandomMovementComp]);

// sprite 저장소 (다른 시스템과 공유)
let spriteStore: PIXI.Sprite[] = [];
export function setSpriteStore(store: PIXI.Sprite[]) {
  spriteStore = store;
}

export function randomMovementSystem(params: {
  world: MainSceneWorld;
  delta: number;
}): typeof params {
  const { world } = params;
  const currentTime = Date.now();
  const chars = characterQuery(world);

  for (let i = 0; i < chars.length; i++) {
    const eid = chars[i];
    const angle = AngleComp;
    const speed = SpeedComp;

    // 캐릭터의 고유 속도를 가져와서 확인
    const characterKey = CharacterStatusComp.characterKey[eid];
    const characterStats = getCharacterStats(characterKey);
    const characterSpeed = characterStats.speed;

    // RandomMovementComp.nextChange가 올바르게 초기화되지 않은 경우 수정
    if (
      !RandomMovementComp.nextChange[eid] ||
      RandomMovementComp.nextChange[eid] <= 0
    ) {
      RandomMovementComp.nextChange[eid] = currentTime + 1000; // 1초 후 첫 상태 전환
      console.log(
        `[RandomMovementSystem] Fixed nextChange for character ${eid}`
      );
    }

    // 현재 상태(idle/moving)가 끝났는지 확인
    if (currentTime >= RandomMovementComp.nextChange[eid]) {
      if (speed.value[eid] !== 0) {
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

        // 캐릭터의 고유 속도 적용
        speed.value[eid] = characterSpeed;

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

    // 이동 로직은 CommonMovementSystem에서 처리됨
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
