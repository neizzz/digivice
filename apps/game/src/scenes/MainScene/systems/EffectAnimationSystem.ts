import {
  defineQuery,
  hasComponent,
  addComponent,
  removeComponent,
} from "bitecs";
import {
  ObjectComp,
  PositionComp,
  EffectAnimationComp,
} from "../raw-components";
import { MainSceneWorld } from "../world";
import { ObjectType, EffectAnimationType } from "../types";
import * as PIXI from "pixi.js";

const effectAnimationQuery = defineQuery([
  ObjectComp,
  PositionComp,
  EffectAnimationComp,
]);

const effectSpriteMap = new Map<number, PIXI.Sprite>();

const RECOVERY_APPROACH_DURATION = 300;
const RECOVERY_HOLD_DURATION = 1000;
const RECOVERY_FADE_DURATION = 300;
const RECOVERY_TOTAL_DURATION =
  RECOVERY_APPROACH_DURATION + RECOVERY_HOLD_DURATION + RECOVERY_FADE_DURATION;
const RECOVERY_START_OFFSET_X = -18;
const RECOVERY_START_OFFSET_Y = -18;
const RECOVERY_TARGET_OFFSET_X = 0;
const RECOVERY_TARGET_OFFSET_Y = 0;
const RECOVERY_SCALE = 2.3;
const RECOVERY_Z_INDEX_OFFSET = 1;
const RECOVERY_ROTATION = Math.PI * 0.25;

function getSyringeTexture(): PIXI.Texture | null {
  try {
    const spritesheet = PIXI.Assets.get<PIXI.Spritesheet>("common16x16");
    if (!spritesheet) {
      console.warn(
        "[EffectAnimationSystem] common16x16 spritesheet is not loaded",
      );
      return null;
    }

    const texture = spritesheet.textures.syringe;
    if (!texture) {
      console.warn(
        "[EffectAnimationSystem] syringe texture not found in common16x16",
      );
      return null;
    }

    return texture;
  } catch (error) {
    console.error(
      "[EffectAnimationSystem] Failed to resolve syringe texture:",
      error,
    );
    return null;
  }
}

function cleanupEffectSprite(
  world: MainSceneWorld,
  eid: number,
  stage: PIXI.Container | null,
): void {
  const sprite = effectSpriteMap.get(eid);
  if (sprite) {
    if (stage && sprite.parent) {
      stage.removeChild(sprite);
    }
    sprite.destroy();
    effectSpriteMap.delete(eid);
  }

  if (hasComponent(world, EffectAnimationComp, eid)) {
    removeComponent(world, EffectAnimationComp, eid);
  }
}

function createRecoverySyringeSprite(
  eid: number,
  stage: PIXI.Container | null,
): PIXI.Sprite | null {
  if (!stage) {
    return null;
  }

  const texture = getSyringeTexture();
  if (!texture) {
    return null;
  }

  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.scale.set(RECOVERY_SCALE);
  sprite.rotation = RECOVERY_ROTATION;
  sprite.alpha = 1;
  stage.addChild(sprite);
  effectSpriteMap.set(eid, sprite);
  return sprite;
}

function updateRecoverySyringe(
  eid: number,
  currentTime: number,
): boolean {
  const startTime = EffectAnimationComp.startTime[eid];
  const elapsed = currentTime - startTime;
  const duration = EffectAnimationComp.duration[eid];
  const targetX = PositionComp.x[eid] + RECOVERY_TARGET_OFFSET_X;
  const targetY = PositionComp.y[eid] + RECOVERY_TARGET_OFFSET_Y;
  const startX = targetX + RECOVERY_START_OFFSET_X;
  const startY = targetY + RECOVERY_START_OFFSET_Y;

  if (elapsed >= duration) {
    return true;
  }

  const sprite = effectSpriteMap.get(eid);
  if (!sprite) {
    return false;
  }

  if (elapsed < RECOVERY_APPROACH_DURATION) {
    const progress = elapsed / RECOVERY_APPROACH_DURATION;
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    sprite.x = startX + (targetX - startX) * easedProgress;
    sprite.y = startY + (targetY - startY) * easedProgress;
    sprite.alpha = 1;
  } else if (elapsed < RECOVERY_APPROACH_DURATION + RECOVERY_HOLD_DURATION) {
    sprite.x = targetX;
    sprite.y = targetY;
    sprite.alpha = 1;
  } else {
    const fadeElapsed = elapsed - RECOVERY_APPROACH_DURATION - RECOVERY_HOLD_DURATION;
    const fadeProgress = Math.min(fadeElapsed / RECOVERY_FADE_DURATION, 1);
    sprite.x = targetX;
    sprite.y = targetY;
    sprite.alpha = 1 - fadeProgress;
  }

  sprite.zIndex = targetY + RECOVERY_Z_INDEX_OFFSET;
  return false;
}

export function effectAnimationSystem(params: {
  world: MainSceneWorld;
  currentTime: number;
  stage: PIXI.Container | null;
}): typeof params {
  const { world, currentTime, stage } = params;
  const entities = effectAnimationQuery(world);

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
      continue;
    }

    if (!EffectAnimationComp.isActive[eid]) {
      cleanupEffectSprite(world, eid, stage);
      continue;
    }

    const effectType = EffectAnimationComp.effectType[eid] as EffectAnimationType;

    if (stage && !effectSpriteMap.has(eid)) {
      switch (effectType) {
        case EffectAnimationType.RECOVERY_SYRINGE:
          createRecoverySyringeSprite(eid, stage);
          break;
        default:
          console.warn(
            `[EffectAnimationSystem] Unsupported effect type: ${effectType}`,
          );
          cleanupEffectSprite(world, eid, stage);
          continue;
      }
    }

    let shouldCleanup = false;
    switch (effectType) {
      case EffectAnimationType.RECOVERY_SYRINGE:
        shouldCleanup = updateRecoverySyringe(eid, currentTime);
        break;
      default:
        shouldCleanup = true;
        break;
    }

    if (shouldCleanup) {
      cleanupEffectSprite(world, eid, stage);
    }
  }

  return params;
}

export function startEffectAnimation(
  world: MainSceneWorld,
  eid: number,
  stage: PIXI.Container | null,
  currentTime: number,
  effectType: EffectAnimationType,
  customDuration?: number,
): void {
  cleanupEffectSprite(world, eid, stage);

  const duration =
    customDuration ??
    (effectType === EffectAnimationType.RECOVERY_SYRINGE
      ? RECOVERY_TOTAL_DURATION
      : RECOVERY_TOTAL_DURATION);

  addComponent(world, EffectAnimationComp, eid);
  EffectAnimationComp.storeIndex[eid] = eid;
  EffectAnimationComp.startTime[eid] = currentTime;
  EffectAnimationComp.duration[eid] = duration;
  EffectAnimationComp.effectType[eid] = effectType;
  EffectAnimationComp.isActive[eid] = 1;

  if (stage) {
    switch (effectType) {
      case EffectAnimationType.RECOVERY_SYRINGE:
        createRecoverySyringeSprite(eid, stage);
        updateRecoverySyringe(eid, currentTime);
        break;
      default:
        break;
    }
  }

  console.log(
    `[EffectAnimationSystem] Started ${EffectAnimationType[effectType]} for entity ${eid}`,
  );
}

export function startRecoveryAnimation(
  world: MainSceneWorld,
  eid: number,
  stage: PIXI.Container | null,
  currentTime: number,
): void {
  startEffectAnimation(
    world,
    eid,
    stage,
    currentTime,
    EffectAnimationType.RECOVERY_SYRINGE,
  );
}