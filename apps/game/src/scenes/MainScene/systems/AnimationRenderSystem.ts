import { defineQuery, exitQuery } from "bitecs";
import {
  AnimationRenderComp,
  RenderComp,
  ObjectComp,
  CharacterStatusComp,
  PositionComp,
  AngleComp,
} from "../raw-components";
import {
  ObjectType,
  CharacterState,
  AnimationKey,
  SpritesheetKey,
} from "../types";
import { MainSceneWorld } from "../world";
import * as PIXI from "pixi.js";
import { renderCommonAttributes } from "./RenderSystem";

// const CHARACTER_STATE_TO_ANIMATION_KEY: Record<CharacterState, AnimationKey> = {
const CHARACTER_STATE_TO_ANIMATION_KEY: Record<CharacterState, AnimationKey> = {
  [CharacterState.EGG]: ECS_NULL_VALUE,
  [CharacterState.IDLE]: AnimationKey.IDLE,
  [CharacterState.MOVING]: AnimationKey.WALKING,
  [CharacterState.SLEEPING]: AnimationKey.SLEEPING,
  [CharacterState.SICK]: AnimationKey.SICK,
  [CharacterState.EATING]: AnimationKey.EATING,
  [CharacterState.DEAD]: ECS_NULL_VALUE,
};

export const SPRITESHEET_KEY_TO_NAME: Record<SpritesheetKey, string> = {
  [SpritesheetKey.NULL]: "null",
  [SpritesheetKey.TestGreenSlimeA1]: "test-green-slime_A1",
  [SpritesheetKey.TestGreenSlimeB1]: "test-green-slime_B1",
  [SpritesheetKey.TestGreenSlimeC1]: "test-green-slime_C1",
  [SpritesheetKey.TestGreenSlimeD1]: "test-green-slime_D1",
};

const ANIMATION_KEY_TO_NAME: Record<AnimationKey, string> = {
  [AnimationKey.NULL]: "null",
  [AnimationKey.IDLE]: "idle",
  [AnimationKey.WALKING]: "walking",
  [AnimationKey.SLEEPING]: "sleeping",
  [AnimationKey.EATING]: "eating",
  [AnimationKey.SICK]: "sick",
  [AnimationKey.FLY]: "fly",
};

const animationQuery = defineQuery([AnimationRenderComp]);
const characterAnimationQuery = defineQuery([
  AnimationRenderComp,
  CharacterStatusComp,
]);
const exitedAnimationQuery = exitQuery(animationQuery);

const spritesheetCache: Map<string, PIXI.Spritesheet> = new Map();
const animatedSpriteStore: PIXI.AnimatedSprite[] = [];

export function animationRenderSystem(params: {
  world: MainSceneWorld;
  delta: number;
}): typeof params {
  const { world } = params;
  const entities = animationQuery(world);
  const exitedEntities = exitedAnimationQuery(world);
  const stage = world.stage;

  // 캐릭터 상태에 따른 애니메이션 자동 변경
  updateCharacterAnimations(world);

  for (let i = 0; i < exitedEntities.length; i++) {
    const eid = exitedEntities[i];
    const storeIndex = AnimationRenderComp.storeIndex[eid];
    const animatedSprite = getAnimatedSprite(storeIndex);

    if (animatedSprite && animatedSprite.parent) {
      stage.removeChild(animatedSprite);
      animatedSprite.destroy();
      if (storeIndex < animatedSpriteStore.length) {
        animatedSpriteStore[storeIndex] = null as any;
      }
      console.log(
        `[AnimationSystem] Removed animated sprite from stage for entity ${eid}`
      );
    }
  }

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    const storeIndex = AnimationRenderComp.storeIndex[eid];

    let animatedSprite = getAnimatedSprite(storeIndex);

    // 애니메이션 스프라이트가 없으면 생성
    if (!animatedSprite) {
      animatedSprite = createAnimatedSpriteForEntity(eid);
      if (!animatedSprite) {
        continue;
      }

      stage.addChild(animatedSprite);
      animatedSpriteStore.push(animatedSprite);
      AnimationRenderComp.storeIndex[eid] = animatedSpriteStore.length - 1;
      console.log(
        `[AnimationSystem] Added animated sprite to stage for entity ${eid}`
      );
    }

    // const x = PositionComp.x[eid];
    // const y = PositionComp.y[eid];
    // animatedSprite.position.set(x, y);
    // const angle = AngleComp.value[eid];
    // animatedSprite.rotation = angle;
    // animatedSprite.zIndex = RenderComp.zIndex[eid];
    // animatedSprite.scale.set(RenderComp.scale[eid]);
    renderCommonAttributes(eid, animatedSprite, world);
    updateAnimatedSprite(animatedSprite, eid);
  }

  return params;
}

function getSpritesheet(name: string): PIXI.Spritesheet | null {
  // PIXI Assets에서 이미 로드된 스프라이트시트 가져오기
  try {
    const spritesheet = PIXI.Assets.get(name);
    if (spritesheet && spritesheet instanceof PIXI.Spritesheet) {
      if (!spritesheetCache.has(name)) {
        spritesheetCache.set(name, spritesheet);
        console.log(`[AnimationSystem] Cached spritesheet: ${name}`);
      }
      return spritesheet;
    }
  } catch (error) {
    console.warn(`[AnimationSystem] Spritesheet not found: ${name}`, error);
  }
  return null;
}

function getAnimationTextures(
  spritesheetName: string,
  animationName: string
): PIXI.Texture[] | null {
  const spritesheet = getSpritesheet(spritesheetName);
  if (!spritesheet) {
    console.warn(
      `[AnimationSystem] Spritesheet not loaded: ${spritesheetName}`
    );
    return null;
  }

  const animations = spritesheet.animations;
  if (!animations || !animations[animationName]) {
    console.warn(
      `[AnimationSystem] Animation not found: ${animationName} in ${spritesheetName}`
    );
    return null;
  }

  return animations[animationName];
}

function getAnimatedSprite(idx: number): PIXI.AnimatedSprite | undefined {
  return animatedSpriteStore[idx] || undefined;
}

function createAnimatedSpriteForEntity(
  eid: number
): PIXI.AnimatedSprite | undefined {
  const spritesheetKey = AnimationRenderComp.spritesheetKey[
    eid
  ] as SpritesheetKey;
  const spritesheetName = SPRITESHEET_KEY_TO_NAME[spritesheetKey];

  if (!spritesheetName) {
    console.warn(
      `[AnimationSystem] No spritesheet name found for texture key: ${spritesheetKey}`
    );
    return undefined;
  }

  const animationKey =
    (AnimationRenderComp.animationKey[eid] as AnimationKey) ||
    (AnimationKey.NULL as AnimationKey);
  const animationName = ANIMATION_KEY_TO_NAME[animationKey] || "null";

  const animationTextures = getAnimationTextures(
    spritesheetName,
    animationName
  );

  if (!animationTextures || animationTextures.length === 0) {
    console.warn(
      `[AnimationSystem] Animation ${animationName} not found in ${spritesheetName}`
    );
    return undefined;
  }

  const animatedSprite = new PIXI.AnimatedSprite(animationTextures);
  animatedSprite.anchor.set(0.5); // 앵커를 중앙으로 설정
  animatedSprite.animationSpeed = AnimationRenderComp.speed[eid];
  animatedSprite.loop = AnimationRenderComp.loop[eid] === 1;

  if (AnimationRenderComp.isPlaying[eid] === 1) {
    animatedSprite.play();
  }

  return animatedSprite;
}

function updateAnimatedSprite(sprite: PIXI.AnimatedSprite, eid: number): void {
  const spritesheetKey = AnimationRenderComp.spritesheetKey[
    eid
  ] as SpritesheetKey;
  const animationKey = AnimationRenderComp.animationKey[eid] as AnimationKey;
  const isPlaying = AnimationRenderComp.isPlaying[eid] === 1;
  const loop = AnimationRenderComp.loop[eid] === 1;
  const speed = AnimationRenderComp.speed[eid];

  // 애니메이션이 변경되었는지 확인
  const currentAnimationName = ANIMATION_KEY_TO_NAME[animationKey];
  const spritesheetName = SPRITESHEET_KEY_TO_NAME[spritesheetKey];

  if (spritesheetName && currentAnimationName) {
    const newAnimationTextures = getAnimationTextures(
      spritesheetName,
      currentAnimationName
    );

    // 애니메이션이 변경되었으면 텍스처 업데이트
    if (newAnimationTextures && newAnimationTextures.length > 0) {
      const currentTextures = sprite.textures as PIXI.Texture[];
      const isDifferent =
        !currentTextures ||
        currentTextures.length !== newAnimationTextures.length ||
        currentTextures.some(
          (tex, index) => tex !== newAnimationTextures[index]
        );

      if (isDifferent) {
        sprite.textures = newAnimationTextures;
        sprite.gotoAndPlay(0);
      }
    }
  }

  // 애니메이션 속도 및 루프 설정 업데이트
  sprite.animationSpeed = speed;
  sprite.loop = loop;

  // 재생 상태 업데이트
  if (isPlaying && !sprite.playing) {
    sprite.play();
  } else if (!isPlaying && sprite.playing) {
    sprite.stop();
  }
}

// export function startAnimation(
//   eid: number,
//   animationKey: AnimationKey,
//   loop: boolean = true,
//   speed: number = 0.1
// ): void {
//   AnimationRenderComp.animationKey[eid] = animationKey;
//   AnimationRenderComp.isPlaying[eid] = 1;
//   AnimationRenderComp.loop[eid] = loop ? 1 : 0;
//   AnimationRenderComp.speed[eid] = speed;

//   console.log(
//     `[AnimationSystem] Started animation ${AnimationKey[animationKey]} for entity ${eid}`
//   );
// }

// export function stopAnimation(eid: number): void {
//   AnimationRenderComp.isPlaying[eid] = 0;
// }

export function changeAnimation(eid: number, animationKey: AnimationKey): void {
  if (AnimationRenderComp.animationKey[eid] !== animationKey) {
    AnimationRenderComp.animationKey[eid] = animationKey;
    console.log(
      `[AnimationSystem] Changed animation to ${AnimationKey[animationKey]} for entity ${eid}`
    );
  }
}

function updateCharacterAnimations(world: MainSceneWorld): void {
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

    // 애니메이션이 변경되어야 하는 경우
    if (currentAnimation !== requiredAnimation) {
      changeAnimation(eid, requiredAnimation);
    }
  }
}

// 헬퍼 함수들
// export function isAnimationPlaying(eid: number): boolean {
//   return AnimationRenderComp.isPlaying[eid] === 1;
// }

// export function getAnimationKey(eid: number): AnimationKey {
//   return AnimationRenderComp.animationKey[eid];
// }

// export function setAnimationSpeed(eid: number, speed: number): void {
//   AnimationRenderComp.speed[eid] = speed;
// }

// export function setAnimationLoop(eid: number, loop: boolean): void {
//   AnimationRenderComp.loop[eid] = loop ? 1 : 0;
// }
