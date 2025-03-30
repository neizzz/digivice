import type * as Matter from "matter-js";
import type * as PIXI from "pixi.js";

/**
 * 파이프 쌍 인터페이스
 */
export interface PipePair {
	top: PIXI.Container;
	bottom: PIXI.Container;
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
	READY = 0,
	PLAYING = 1,
	GAME_OVER = 2,
}

/**
 * 디버그 모드 옵션
 */
export interface DebugOptions {
	enabled: boolean;
	showHitboxes: boolean;
}
