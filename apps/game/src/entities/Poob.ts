import * as PIXI from "pixi.js";
import { AssetLoader } from "../utils/AssetLoader";
import type { SparkleEffect } from "../effects/SparkleEffect";
import type { Character } from "./Character";
import { ObjectBase } from "../interfaces/ObjectBase";
import { ObjectType } from "../types/GameData";
import { Cleanable } from "../interfaces/Cleanable";

/**
 * Poob 상태를 나타내는 enum
 */
enum PoobState {
  NORMAL = 0, // 보통 상태
  CLEANING = 1, // 청소 중
  CLEANED = 2, // 청소 완료
}

export interface PoobOptions {
  position: { x: number; y: number }; // 생성 위치 (선택사항, 기본값: 랜덤)
  character?: Character; // 캐릭터 객체 (선택 사항, 캐릭터 기준 위치 계산 시 사용)
}

/**
 * Poob 클래스 - 청소가 필요한 배설물 객체
 */
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
    this.sprite.scale.set(2.5); // 크기 조정
    this.sprite.anchor.set(0.5);

    // sprite에 Poob 객체 참조 추가 (클린업을 위해)
    ObjectBase.attachObjectRef(this.sprite, this);

    // 위치 설정 로직
    if (options.position) {
      // 직접 위치가 지정된 경우
      this.setPosition(options.position.x, options.position.y);
    }

    // zIndex 설정 - 깊이 정렬을 위해
    this.sprite.zIndex = this.position.y;

    // 부모 컨테이너에 스프라이트 추가
    this.parentContainer.addChild(this.sprite);
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

  /**
   * Poob 텍스처 가져오기
   * @returns 사용할 텍스처
   */
  private getPoobTexture(): PIXI.Texture {
    const assets = AssetLoader.getAssets();
    let texture: PIXI.Texture;

    // common16x16Sprites에서 poob 텍스처 사용 시도
    if (assets.common16x16Sprites?.textures.poob) {
      texture = assets.common16x16Sprites.textures.poob;
    } else {
      console.warn("Poob texture not found. Using fallback texture.");
      texture = PIXI.Texture.WHITE;
    }

    return texture;
  }

  /**
   * 청소 시작 시 호출되는 메서드
   * @override
   */
  protected onCleaningStart(): void {
    this.state = PoobState.CLEANING;
  }

  /**
   * 청소 진행 중 호출되는 메서드
   * @override
   */
  protected onCleaningProgress(progress: number): void {
    // 투명도 조절 (청소가 진행될수록 점점 투명해짐)
    this.sprite.alpha = 1.0 - progress * 0.8; // 80%까지만 투명하게
  }

  /**
   * 청소가 완료될 때 호출되는 메서드
   * @override
   */
  protected onCleaningFinish(): void {
    this.state = PoobState.CLEANED;

    // 효과음 재생 등 추가 기능 구현 가능

    // 스프라이트 제거
    if (this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
    }
  }

  /**
   * 객체 위치 반환
   * @override
   */
  public getPosition(): { x: number; y: number } {
    return { x: this.position.x, y: this.position.y };
  }

  /**
   * 객체의 스프라이트 반환
   * @override
   */
  public getSprite(): PIXI.Sprite {
    return this.sprite;
  }

  /**
   * 청소 중인지 여부 확인
   */
  public isCleaning(): boolean {
    return this.state === PoobState.CLEANING;
  }

  /**
   * 청소 완료 여부 확인
   */
  public isCleanFinished(): boolean {
    return this.state === PoobState.CLEANED;
  }

  /**
   * 객체 제거
   */
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
