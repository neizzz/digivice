import * as PIXI from "pixi.js";
import { AssetLoader } from "../utils/AssetLoader";
import type { SparkleEffect } from "../effects/SparkleEffect";
import { Cleanable } from "../interfaces/Cleanable";
import type { Character } from "./Character";

/**
 * Poob 상태를 나타내는 enum
 */
enum PoobState {
  NORMAL = 0, // 보통 상태
  CLEANING = 1, // 청소 중
  CLEANED = 2, // 청소 완료됨
}

export interface PoobOptions {
  position?: { x: number; y: number }; // 생성 위치 (선택사항, 기본값: 랜덤)
  character?: Character; // 캐릭터 객체 (선택 사항, 캐릭터 기준 위치 계산 시 사용)
  offsetDistance?: number; // 캐릭터로부터의 거리 (기본값: 70)
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
  constructor(
    app: PIXI.Application,
    parent: PIXI.Container,
    options: PoobOptions = {}
  ) {
    super();

    this.parentContainer = parent;
    this.position = { x: 0, y: 0 };

    // 텍스처 가져오기 (common16x16Sprites에서 poo 텍스처 사용)
    const texture = this.getPoobTexture();

    // 스프라이트 생성 및 초기 설정
    this.sprite = new PIXI.Sprite(texture);
    this.sprite.scale.set(2.5); // 크기 조정
    this.sprite.anchor.set(0.5);

    // sprite에 Poob 객체 참조 추가 (클린업을 위해)
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    (this.sprite as any).__objectRef = this;

    // 위치 설정 로직
    if (options.position) {
      // 직접 위치가 지정된 경우
      this.setPosition(options.position.x, options.position.y);
    } else if (options.character) {
      // 캐릭터 객체가 제공된 경우, 캐릭터 위치 기반으로 설정
      this.positionRelativeToCharacter(
        options.character,
        options.offsetDistance || 70
      );
    } else {
      // 랜덤 위치 (화면 내에서)
      const padding = 50; // 화면 가장자리로부터의 패딩
      const x = padding + Math.random() * (app.screen.width - padding * 2);
      const y = padding + Math.random() * (app.screen.height - padding * 2);
      this.setPosition(x, y);
    }

    // zIndex 설정 - 깊이 정렬을 위해
    this.sprite.zIndex = this.position.y;

    // 부모 컨테이너의 sortableChildren을 활성화하여 zIndex 기반 정렬이 작동하도록 함
    this.parentContainer.sortableChildren = true;

    // 부모 컨테이너에 스프라이트 추가
    this.parentContainer.addChild(this.sprite);

    console.log(
      "Poob 객체가 생성되었습니다. 위치:",
      this.position.x,
      this.position.y,
      "zIndex:",
      this.sprite.zIndex
    );
  }

  /**
   * 위치를 설정합니다.
   * @param x X 좌표
   * @param y Y 좌표
   */
  public setPosition(x: number, y: number): void {
    this.position.x = x;
    this.position.y = y;

    if (this.sprite) {
      this.sprite.position.set(x, y);
      this.sprite.zIndex = y;
    }
  }

  /**
   * 캐릭터 기준으로 Poob의 위치를 설정합니다.
   * 캐릭터가 바라보는 방향의 반대쪽으로 배치됩니다.
   * @param character 위치 기준이 되는 캐릭터
   * @param distance 캐릭터로부터의 거리
   */
  private positionRelativeToCharacter(
    character: Character,
    distance: number
  ): void {
    const characterPos = character.getPosition();

    // 캐릭터의 flipCharacter 상태를 확인하여 바라보는 방향 결정
    // Character 클래스의 animatedSprite의 scale.x 값을 확인하여 방향 결정
    let isFlipped = false;
    if (character.animatedSprite) {
      isFlipped = character.animatedSprite.scale.x < 0;
    }

    // 캐릭터가 바라보는 방향과 반대 방향으로 배치
    // isFlipped가 true면 캐릭터는 왼쪽을 보고 있으므로 Poob은 오른쪽에 배치
    // isFlipped가 false면 캐릭터는 오른쪽을 보고 있으므로 Poob은 왼쪽에 배치
    const offsetX = isFlipped ? distance : -distance;

    // Y 좌표는 약간 아래쪽으로 배치
    const offsetY = 20;

    this.setPosition(characterPos.x + offsetX, characterPos.y + offsetY);

    console.log(
      `Poob 생성 위치: (${this.position.x}, ${this.position.y}), 캐릭터 방향: ${
        isFlipped ? "왼쪽" : "오른쪽"
      }`
    );
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
    // 투명도 시작 값 설정
    this.sprite.alpha = 1.0;
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
