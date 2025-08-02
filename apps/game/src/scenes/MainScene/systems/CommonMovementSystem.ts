import { defineQuery } from "bitecs";
import {
  PositionComp,
  SpeedComp,
  AngleComp,
  CharacterStatusComp,
} from "../raw-components";
import { MainSceneWorld } from "../world";
import { nomalizeRadian } from "@/utils/common";
import { getCharacterStats } from "../characterStats";

const movingEntityQuery = defineQuery([PositionComp, SpeedComp, AngleComp]);

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
    const position = PositionComp;
    const angle = AngleComp;
    const speed = SpeedComp;

    // 이동하지 않는 엔티티는 건너뛰기
    if (speed.value[eid] === 0) continue;

    // 캐릭터인 경우 고유 속도 확인 및 복원
    if (CharacterStatusComp.characterKey[eid] !== undefined) {
      const characterKey = CharacterStatusComp.characterKey[eid];
      const characterStats = getCharacterStats(characterKey);
      const characterSpeed = characterStats.speed;

      // 이동 중일 때 속도가 캐릭터의 고유 속도와 다르다면 수정
      if (Math.abs(speed.value[eid] - characterSpeed) > 0.001) {
        speed.value[eid] = characterSpeed;
      }
    }

    // 현재 각도를 이용해 직선으로 이동
    const velocityX = Math.cos(angle.value[eid]) * speed.value[eid];
    const velocityY = Math.sin(angle.value[eid]) * speed.value[eid];

    // 다음 위치 계산
    const nextX = position.x[eid] + velocityX * delta;
    const nextY = position.y[eid] + velocityY * delta;

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
