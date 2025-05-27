import * as PIXI from "pixi.js";
import { AssetLoader } from "../utils/AssetLoader";
import type { SparkleEffect } from "../effects/SparkleEffect";
import type { Character } from "./Character";
import { ObjectBase } from "../interfaces/ObjectBase";
import { ObjectType } from "../types/GameData";
import { Cleanable } from "../interfaces/Cleanable";
import { EventBus, EventTypes } from "../utils/EventBus";

enum PoobState {
  NORMAL = 0, // 보통 상태
  CLEANING = 1, // 청소 중
  CLEANED = 2, // 청소 완료
}

export interface PoobOptions {
  position: { x: number; y: number }; // 생성 위치 (선택사항, 기본값: 랜덤)
  character?: Character; // 캐릭터 객체 (선택 사항, 캐릭터 기준 위치 계산 시 사용)
}

export class Poob extends Cleanable {
  private sprite: PIXI.Sprite;
  private parentContainer: PIXI.Container;
  private state: PoobState = PoobState.NORMAL;
  private sparkleEffect?: SparkleEffect;
  private position: { x: number; y: number };

  /**
   * @param app PIXI 애플리케이션
   * @param parent 부모 컨테이너
   * @param options Poob 옵션
   */
  constructor(parent: PIXI.Container, options: PoobOptions) {
    super("poob"); // 'poob' prefix로 ID 생성

    this.parentContainer = parent;
    this.position = { x: 0, y: 0 };

    // 텍스처 가져오기 (common16x16Sprites에서 poo 텍스처 사용)
    const texture = this.getPoobTexture();

    // 스프라이트 생성 및 초기 설정
    this.sprite = new PIXI.Sprite(texture);
    this.sprite.scale.set(2.5 + Math.random());
    this.sprite.anchor.set(0.5);
    this.sprite.zIndex = this.position.y;
    this.parentContainer.addChild(this.sprite);

    if (options.position) {
      // 직접 위치가 지정된 경우
      this.setPosition(options.position.x, options.position.y);
    }

    ObjectBase.attachObjectRef(this.sprite, this);

    const pos = this.getPosition();
    EventBus.publish(EventTypes.Object.OBJECT_CREATED, {
      type: ObjectType.Poob,
      id: this.getId(),
      position: { x: pos.x, y: pos.y },
    });
  }

  public getType() {
    return ObjectType.Poob;
  }

  public getId() {
    return this.id;
  }

  public setPosition(x: number, y: number): void {
    this.position.x = x;
    this.position.y = y;

    if (this.sprite) {
      this.sprite.position.set(x, y);
      this.sprite.zIndex = y;
    }
  }

  private getPoobTexture(): PIXI.Texture {
    const assets = AssetLoader.getAssets();
    return assets.common16x16Sprites.textures.poob;
  }

  protected onCleaningStart(): void {
    this.state = PoobState.CLEANING;
  }

  protected onCleaningProgress(progress: number): void {
    // 투명도 조절 (청소가 진행될수록 점점 투명해짐)
    this.sprite.alpha = 1.0 - progress * 0.8; // 80%까지만 투명하게
  }

  protected onCleaningFinish(): void {
    this.state = PoobState.CLEANED;

    // 효과음 재생 등 추가 기능 구현 가능

    // 스프라이트 제거
    if (this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
    }
  }

  public getPosition(): { x: number; y: number } {
    return { x: this.position.x, y: this.position.y };
  }

  public getSprite(): PIXI.Sprite {
    return this.sprite;
  }

  public isCleaning(): boolean {
    return this.state === PoobState.CLEANING;
  }

  public isCleanFinished(): boolean {
    return this.state === PoobState.CLEANED;
  }

  public destroy(): void {
    if (this.sparkleEffect) {
      this.sparkleEffect.stop();
      this.sparkleEffect = undefined;
    }

    if (this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
      this.sprite.destroy();
    }
  }
}
