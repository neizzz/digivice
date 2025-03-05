import * as PIXI from "pixi.js";
import {
  RandomMovementController,
  MovementOptions,
} from "../controllers/RandomMovementController";

/**
 * 캐릭터에 랜덤 움직임을 적용하는 헬퍼 함수
 * @param target 움직일 디스플레이 오브젝트 (Sprite, AnimatedSprite, Container 등)
 * @param app PIXI Application 인스턴스
 * @param options 움직임 옵션
 * @returns 생성된 RandomMovementController 인스턴스
 */
export function applyRandomMovement(
  target: PIXI.DisplayObject,
  app: PIXI.Application,
  options?: MovementOptions
): RandomMovementController {
  return new RandomMovementController(target, app, options);
}
