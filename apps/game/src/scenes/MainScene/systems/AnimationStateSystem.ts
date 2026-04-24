import { defineQuery } from "bitecs";
import {
  AnimationRenderComp,
  ObjectComp,
  CharacterStatusComp,
} from "../raw-components";
import { ObjectType, CharacterState, AnimationKey } from "../types";
import { MainSceneWorld } from "../world";

const IDLE_ANIMATION_SPEED = 0.03;
const DEFAULT_ANIMATION_SPEED = 0.04;
const SLEEPING_ANIMATION_SPEED = DEFAULT_ANIMATION_SPEED / 2;

const CHARACTER_STATE_TO_ANIMATION_KEY: Record<CharacterState, AnimationKey> = {
  [CharacterState.EGG]: AnimationKey.NULL,
  [CharacterState.IDLE]: AnimationKey.IDLE,
  [CharacterState.MOVING]: AnimationKey.WALKING,
  [CharacterState.SLEEPING]: AnimationKey.SLEEPING,
  [CharacterState.SICK]: AnimationKey.SICK,
  [CharacterState.EATING]: AnimationKey.EATING,
  [CharacterState.DEAD]: AnimationKey.NULL,
};

const characterAnimationQuery = defineQuery([
  AnimationRenderComp,
  CharacterStatusComp,
]);

/**
 * 애니메이션 상태만 업데이트하는 시스템 (렌더링과 분리)
 * 시뮬레이션 모드에서도 실행되어 애니메이션 상태를 올바르게 유지
 */
export function animationStateSystem(params: {
  world: MainSceneWorld;
  delta: number;
}): typeof params {
  const { world } = params;

  // 캐릭터 애니메이션 상태 업데이트 (시뮬레이션에서도 필요)
  updateCharacterAnimationStates(world);

  return params;
}

function updateCharacterAnimationStates(world: MainSceneWorld): void {
  const characters = characterAnimationQuery(world);

  for (let i = 0; i < characters.length; i++) {
    const eid = characters[i];

    // 캐릭터 타입인지 확인
    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
      continue;
    }

    const currentState = ObjectComp.state[eid] as CharacterState;
    const requiredAnimation = CHARACTER_STATE_TO_ANIMATION_KEY[currentState];
    const currentAnimation = AnimationRenderComp.animationKey[eid];
    const requiredSpeed = getAnimationSpeedForState(currentState);

    // 애니메이션이 변경되어야 하는 경우
    if (currentAnimation !== requiredAnimation) {
      changeAnimation(eid, requiredAnimation);
    }

    if (AnimationRenderComp.speed[eid] !== requiredSpeed) {
      AnimationRenderComp.speed[eid] = requiredSpeed;
    }
  }
}

function changeAnimation(eid: number, animationKey: AnimationKey): void {
  if (AnimationRenderComp.animationKey[eid] !== animationKey) {
    AnimationRenderComp.animationKey[eid] = animationKey;
    AnimationRenderComp.isPlaying[eid] =
      animationKey !== AnimationKey.NULL ? 1 : 0;

    console.log(
      `[AnimationStateSystem] Changed animation to ${AnimationKey[animationKey]} for entity ${eid}`
    );
  }
}

function getAnimationSpeedForState(state: CharacterState): number {
  if (state === CharacterState.IDLE) {
    return IDLE_ANIMATION_SPEED;
  }

  if (state === CharacterState.SLEEPING) {
    return SLEEPING_ANIMATION_SPEED;
  }

  return DEFAULT_ANIMATION_SPEED;
}
