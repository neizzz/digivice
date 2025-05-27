import type { AnimatedSprite, Sprite } from "pixi.js";
import type { ObjectType } from "../types/GameData";
import { EventBus, EventTypes } from "../utils/EventBus";
import { ObjectBase } from "./ObjectBase";
import type { Position } from "../types/Position";

export abstract class Cleanable extends ObjectBase {
  protected _isCleaned = false;
  protected cleaningStartTime = 0;
  protected cleaningThreshold = 0.95; // 청소 완료로 간주할 임계값 (95%)
  protected cleanProgress = 0;

  public isCleaned(): boolean {
    return this._isCleaned;
  }

  public finishCleaning(): void {
    if (this._isCleaned) {
      return; // 이미 청소 완료된 상태
    }

    this._isCleaned = true;
    this.cleanProgress = 1;

    // GameData 반영을 위한 이벤트 발행
    EventBus.publish(EventTypes.Object.OBJECT_CLEANED, {
      type: this.getType(),
      id: this.getId(),
    });

    // 청소 완료 처리 (스프라이트 제거 등)
    this.onCleaningFinish();
  }

  public updateCleanProgress(progress: number): boolean {
    // 이미 청소가 완료된 상태라면 항상 true 반환
    if (this._isCleaned) {
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

  public resetCleaningState(): void {
    this.cleanProgress = 0;
    this.onCleaningProgress(0);
    this._isCleaned = false;
  }

  protected abstract onCleaningStart(): void;
  protected abstract onCleaningProgress(progress: number): void;
  protected abstract onCleaningFinish(): void;
  public abstract getPosition(): Position;
  public abstract getSprite(): Sprite | AnimatedSprite;
  public abstract getType(): ObjectType;
  public abstract getId(): string;
}
