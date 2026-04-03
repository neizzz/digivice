import { defineQuery, hasComponent, addComponent } from "bitecs";
import {
  ObjectComp,
  EggHatchComp,
  RandomMovementComp,
  AnimationRenderComp,
  CharacterStatusComp,
} from "../raw-components";
import { MainSceneWorld } from "../world";
import { CharacterState, AnimationKey } from "../types";
import {
  ensureCharacterSpritesheetLoaded,
} from "../../../utils/asset";

const eggQuery = defineQuery([ObjectComp, EggHatchComp]);

/**
 * 알 부화 시스템
 * - EGG 상태의 캐릭터가 일정 시간 후 부화하여 IDLE 상태로 변경
 * - 부화 시 RandomMovementComp과 AnimationRenderComp를 추가
 * - 필요한 스프라이트시트를 동적으로 로드
 */
export function eggHatchSystem(params: {
  world: MainSceneWorld;
  currentTime: number;
}): typeof params {
  const { world, currentTime } = params;
  const entities = eggQuery(world);

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    // EGG 상태가 아니면 건너뛰기
    if (ObjectComp.state[eid] !== CharacterState.EGG) continue;

    // 부화 시간이 되었는지 확인
    if (
      currentTime >= EggHatchComp.hatchTime[eid] &&
      !EggHatchComp.isReadyToHatch[eid]
    ) {
      // 부화 준비 완료 표시
      EggHatchComp.isReadyToHatch[eid] = 1;

      console.log(`[EggHatchSystem] Character ${eid} is ready to hatch!`);

      // 부화 처리를 비동기로 실행
      hatchCharacter(eid, world, currentTime);
    }
  }

  return params;
}

/**
 * 캐릭터 부화 처리 (비동기)
 */
async function hatchCharacter(
  eid: number,
  world: MainSceneWorld,
  currentTime: number
): Promise<void> {
  try {
    // 캐릭터의 실제 characterKey 사용
    const characterKey = CharacterStatusComp.characterKey[eid];

    const isLoaded = await ensureCharacterSpritesheetLoaded({
      characterKey,
      reason: "hatch",
      eid,
      maxRetries: 2,
    });
    if (!isLoaded) {
      console.error(
        `[EggHatchSystem] Hatch delayed for character ${eid}. Keeping EGG state because spritesheet could not be loaded.`
      );
      EggHatchComp.isReadyToHatch[eid] = 0;
      return;
    }

    // 캐릭터 상태를 IDLE로 변경
    ObjectComp.state[eid] = CharacterState.IDLE;

    // RandomMovementComp 추가 (이제 움직일 수 있음)
    if (!hasComponent(world, RandomMovementComp, eid)) {
      addComponent(world, RandomMovementComp, eid);
      // 기본값으로 설정
      RandomMovementComp.minIdleTime[eid] = 2000;
      RandomMovementComp.maxIdleTime[eid] = 8000;
      RandomMovementComp.minMoveTime[eid] = 1000;
      RandomMovementComp.maxMoveTime[eid] = 8000;
      // 부화 후 잠시 후 첫 이동 시작
      RandomMovementComp.nextChange[eid] =
        currentTime + 2000 + Math.random() * 3000; // 2-5초 후 첫 이동
    }

    // AnimationRenderComp 추가 (이제 애니메이션 표시 가능)
    if (!hasComponent(world, AnimationRenderComp, eid)) {
      addComponent(world, AnimationRenderComp, eid);
      AnimationRenderComp.storeIndex[eid] = ECS_NULL_VALUE;

      AnimationRenderComp.spritesheetKey[eid] = characterKey;
      AnimationRenderComp.animationKey[eid] = AnimationKey.IDLE;
      AnimationRenderComp.isPlaying[eid] = 1;
      AnimationRenderComp.loop[eid] = 1;
      AnimationRenderComp.speed[eid] = 0.04;

      console.log(
        `[EggHatchSystem] Added AnimationRenderComp with characterKey: ${characterKey}`
      );
    }

    console.log(
      `[EggHatchSystem] Character ${eid} has hatched! State changed to IDLE with characterKey: ${characterKey}`
    );
  } catch (error) {
    console.error(
      `[EggHatchSystem] Error during hatching process for character ${eid}:`,
      error
    );
  }
}
