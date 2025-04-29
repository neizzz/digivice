import type * as PIXI from "pixi.js";

/**
 * 청소 가능한 객체가 구현해야 하는 인터페이스
 */
export interface Cleanable {
  /**
   * 청소 진행도를 업데이트합니다.
   * @param progress 0-1 사이의 청소 진행도 값
   * @returns 청소가 완료되었는지 여부
   */
  updateCleanProgress(progress: number): boolean;

  /**
   * 청소를 완료합니다.
   */
  finishCleaning(): void;

  /**
   * 객체의 위치를 반환합니다.
   */
  getPosition(): { x: number; y: number };

  /**
   * 객체의 스프라이트를 반환합니다.
   */
  getSprite(): PIXI.Sprite | PIXI.Container;
}
