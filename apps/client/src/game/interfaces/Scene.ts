import * as PIXI from "pixi.js";

/**
 * 게임 씬의 기본 인터페이스
 * 모든 씬은 이 인터페이스를 구현해야 합니다.
 */
export interface Scene {
  /**
   * 씬 업데이트 메서드
   * @param deltaTime 이전 프레임과의 시간 차이 (밀리초)
   */
  update(deltaTime: number): void;

  /**
   * 화면 크기 변경 시 호출되는 메서드
   * @param width 새 화면 너비
   * @param height 새 화면 높이
   */
  onResize(width: number, height: number): void;
}
