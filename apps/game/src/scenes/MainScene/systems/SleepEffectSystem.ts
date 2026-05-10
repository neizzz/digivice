import * as PIXI from "pixi.js";
import { MainSceneWorld } from "../world";

export function sleepEffectSystem(params: {
  world: MainSceneWorld;
  delta: number;
  stage: PIXI.Container | null;
}): typeof params {
  return params;
}

export function cleanupSleepEffects(_stage: PIXI.Container): void {}

export function cleanupSleepEffectStateForTests(): void {}
