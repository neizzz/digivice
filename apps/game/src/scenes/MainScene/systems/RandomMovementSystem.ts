import { defineQuery, hasComponent } from "bitecs";
import {
  SpeedComp,
  RandomMovementComp,
  AngleComp,
  CharacterStatusComp,
  ObjectComp,
  DestinationComp,
} from "../raw-components";
import { MainSceneWorld } from "../world";
import { CharacterState, DestinationType } from "../types";
import { nomalizeRadian } from "@/utils/common";
import { getCharacterMovementSpeedForEntity } from "../characterStats";
import { repairCharacterEntityRuntimeComponents } from "../entityDataHelpers";

const characterQuery = defineQuery([CharacterStatusComp, RandomMovementComp]);
const allCharacterQuery = defineQuery([CharacterStatusComp, ObjectComp]);

function hasDirectedMovement(world: MainSceneWorld, eid: number): boolean {
  return (
    hasComponent(world, DestinationComp, eid) &&
    DestinationComp.type[eid] === DestinationType.TARGETED &&
    DestinationComp.target[eid] !== 0
  );
}

export function randomMovementSystem(params: {
  world: MainSceneWorld;
  delta: number;
}): typeof params {
  const { world } = params;
  const currentTime = world.currentTime;
  const shouldLog =
    !world.isSimulationMode && world.isRandomMovementDebugEnabled();
  const chars = characterQuery(world);
  const allChars = allCharacterQuery(world);

  for (let i = 0; i < allChars.length; i++) {
    const eid = allChars[i];
    const state = ObjectComp.state[eid];
    const shouldHaveRandomMovement =
      state === CharacterState.IDLE || state === CharacterState.MOVING;

    if (
      shouldHaveRandomMovement &&
      !hasComponent(world, RandomMovementComp, eid) &&
      !hasDirectedMovement(world, eid)
    ) {
      const repaired = repairCharacterEntityRuntimeComponents(
        world,
        eid,
        currentTime,
      );

      if (
        repaired.includes("RandomMovementComp") &&
        state === CharacterState.MOVING &&
        SpeedComp.value[eid] <= 0
      ) {
        ObjectComp.state[eid] = CharacterState.IDLE;
      }
    }
  }

  // 첫 번째 실행 시 전체 캐릭터 상태 로그
  if (
    shouldLog &&
    Math.floor(currentTime / 3000) !== Math.floor((currentTime - 100) / 3000)
  ) {
    const suspiciousChars = allChars.filter((eid) => {
      const state = ObjectComp.state[eid];
      const shouldHaveRandomMovement =
        state === CharacterState.IDLE || state === CharacterState.MOVING;

      return (
        shouldHaveRandomMovement &&
        !hasComponent(world, RandomMovementComp, eid) &&
        !hasDirectedMovement(world, eid)
      );
    });

    console.debug(
      `[RandomMovementSystem] Found ${chars.length} entities with RandomMovementComp, ${allChars.length} total character entities`,
    );
    if (suspiciousChars.length > 0) {
      console.warn(
        `[RandomMovementSystem] ${suspiciousChars.length} active character entities are missing RandomMovementComp`,
      );
      const firstChar = suspiciousChars[0];
      console.debug(
        `[RandomMovementSystem] First suspicious character entity ${firstChar} - state=${ObjectComp.state[firstChar]}, has RandomMovementComp=${hasComponent(world, RandomMovementComp, firstChar)}`,
      );
    }
  }

  for (let i = 0; i < chars.length; i++) {
    const eid = chars[i];

    // SLEEPING 또는 SICK 상태일 때는 움직임 건너뛰기
    if (
      ObjectComp.state[eid] === CharacterState.SLEEPING ||
      ObjectComp.state[eid] === CharacterState.SICK
    ) {
      // 움직임 중지
      SpeedComp.value[eid] = 0;
      continue;
    }

    const angle = AngleComp;
    const speed = SpeedComp;

    const characterSpeed = getCharacterMovementSpeedForEntity(eid);

    // RandomMovementComp.nextChange가 올바르게 초기화되지 않은 경우 수정
    const nextChange = RandomMovementComp.nextChange[eid];
    if (!nextChange || nextChange <= 0 || nextChange > currentTime + 100000) {
      RandomMovementComp.nextChange[eid] = currentTime + 1000; // 1초 후 첫 상태 전환
      if (shouldLog) {
        console.debug(
          `[RandomMovementSystem] Fixed nextChange for character ${eid} - was: ${nextChange}, now: ${currentTime + 1000}`,
        );
      }
    }

    // 디버그: RandomMovementComp 값들 검증
    const minIdle = RandomMovementComp.minIdleTime[eid];
    const maxIdle = RandomMovementComp.maxIdleTime[eid];
    const minMove = RandomMovementComp.minMoveTime[eid];
    const maxMove = RandomMovementComp.maxMoveTime[eid];

    if (!minIdle || !maxIdle || !minMove || !maxMove) {
      if (shouldLog) {
        console.warn(
          `[RandomMovementSystem] Entity ${eid} has invalid time ranges - idle: ${minIdle}-${maxIdle}, move: ${minMove}-${maxMove}`,
        );
      }
    }

    // 현재 상태(idle/moving)가 끝났는지 확인
    const nextChangeTime = RandomMovementComp.nextChange[eid];
    const timeUntilChange = nextChangeTime - currentTime;

    // 주기적으로 상태 정보 로그 (3초마다)
    if (
      shouldLog &&
      eid === chars[0] &&
      Math.floor(currentTime / 3000) !== Math.floor((currentTime - 100) / 3000)
    ) {
      console.debug(
        `[RandomMovementSystem] Entity ${eid} - Current: ${currentTime}, NextChange: ${nextChangeTime}, TimeLeft: ${timeUntilChange}ms, Speed: ${speed.value[eid]}, State: ${ObjectComp.state[eid]}`,
      );
    }

    if (currentTime >= nextChangeTime) {
      if (speed.value[eid] !== 0) {
        // moving -> idle 전환
        speed.value[eid] = 0;
        ObjectComp.state[eid] = CharacterState.IDLE;

        // 다음 idle 종료 시간 설정
        const minIdle = RandomMovementComp.minIdleTime[eid];
        const maxIdle = RandomMovementComp.maxIdleTime[eid];
        const idleTime = Math.round(
          minIdle + Math.random() * (maxIdle - minIdle),
        );
        RandomMovementComp.nextChange[eid] = currentTime + idleTime;
        if (shouldLog) {
          console.debug(
            `[RandomMovementSystem] Entity ${eid}: MOVING -> IDLE, idle time: ${idleTime}ms (${minIdle}-${maxIdle})`,
          );
        }
      } else {
        // idle -> moving 전환
        angle.value[eid] = nomalizeRadian(Math.random() * Math.PI * 2);

        // 캐릭터의 현재 상태를 반영한 이동 속도 적용
        speed.value[eid] = characterSpeed;
        ObjectComp.state[eid] = CharacterState.MOVING;

        // 다음 이동 종료 시간 설정
        const minMove = RandomMovementComp.minMoveTime[eid];
        const maxMove = RandomMovementComp.maxMoveTime[eid];
        const moveTime = Math.round(
          minMove + Math.random() * (maxMove - minMove),
        );
        RandomMovementComp.nextChange[eid] = currentTime + moveTime;
        if (shouldLog) {
          console.debug(
            `[RandomMovementSystem] Entity ${eid}: IDLE -> MOVING, move time: ${moveTime}ms (${minMove}-${maxMove})`,
          );
        }
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
