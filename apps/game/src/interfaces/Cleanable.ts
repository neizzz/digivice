import type * as PIXI from "pixi.js";

/**
 * 청소 가능한 객체들의 기본 클래스
 */
export abstract class Cleanable {
  protected cleanProgress = 0;
  protected cleaningStartTime = 0;
  protected cleaningThreshold = 0.95; // 청소 완료로 간주할 임계값 (95%)
  protected isCleaned = false;

  /**
   * 청소 진행도를 업데이트합니다.
   * @param progress 0-1 사이의 청소 진행도 값
   * @returns 청소가 완료되었는지 여부
   */
  public updateCleanProgress(progress: number): boolean {
    // 이미 청소가 완료된 상태라면 항상 true 반환
    if (this.isCleaned) {
      return true;
    }

    // 처음 청소를 시작할 때 상태 변경
    if (this.cleanProgress === 0 && progress > 0) {
      this.cleaningStartTime = Date.now();
      this.onCleaningStart();
    }

    // 진행도 업데이트
    this.cleanProgress = progress;

    // 하위 클래스에서 구현할 청소 중 처리
    this.onCleaningProgress(progress);

    // 청소 임계값에 도달하면 청소 완료로 처리
    if (progress >= this.cleaningThreshold) {
      this.finishCleaning();
      return true;
    }

    return false;
  }

  /**
   * 청소를 완료합니다.
   */
  public finishCleaning(): void {
    if (this.isCleaned) {
      return; // 이미 청소 완료된 상태
    }

    this.isCleaned = true;
    this.cleanProgress = 1;

    // 하위 클래스에서 구현할 청소 완료 처리
    this.onCleaningFinish();
  }

  /**
   * 현재 청소 진행도를 반환합니다.
   */
  public getCleanProgress(): number {
    return this.cleanProgress;
  }

  /**
   * 청소가 시작될 때 호출되는 메서드.
   * 하위 클래스에서 필요에 따라 오버라이드합니다.
   */
  protected onCleaningStart(): void {}

  /**
   * 청소 진행 중 호출되는 메서드.
   * 하위 클래스에서 필요에 따라 오버라이드합니다.
   * @param progress 현재 청소 진행도 (0-1)
   */
  protected onCleaningProgress(progress: number): void {}

  /**
   * 청소가 완료되었을 때 호출되는 메서드.
   * 하위 클래스에서 필요에 따라 오버라이드합니다.
   */
  protected onCleaningFinish(): void {}

  /**
   * 객체의 위치를 반환합니다.
   */
  public abstract getPosition(): { x: number; y: number };

  /**
   * 객체의 스프라이트를 반환합니다.
   */
  public abstract getSprite(): PIXI.Sprite | PIXI.Container;
}
