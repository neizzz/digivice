import * as PIXI from "pixi.js";
import * as Matter from "matter-js";

/**
 * 파이프 쌍 인터페이스
 */
export interface PipePair {
  top: PIXI.Sprite;
  bottom: PIXI.Sprite;
  topBody: Matter.Body;
  bottomBody: Matter.Body;
  passed: boolean;
}

/**
 * 게임 구성 옵션
 */
export interface GameOptions {
  pipeSpeed: number;
  pipeSpawnInterval: number;
  jumpVelocity: number;
}

/**
 * 게임 상태 enum
 */
export enum GameState {
  READY,
  PLAYING,
  GAME_OVER,
}

/**
 * 디버그 모드 옵션
 */
export interface DebugOptions {
  enabled: boolean;
  showHitboxes: boolean;
}
