import * as PIXI from "pixi.js";
import { AssetLoader } from "../utils/AssetLoader";
import type { SparkleEffect } from "../effects/SparkleEffect";
import type { Cleanable } from "../interfaces/Cleanable";
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
export class Poob implements Cleanable {
  private sprite: PIXI.Sprite;
  private app: PIXI.Application;
  private parent: PIXI.Container;
  private state: PoobState = PoobState.NORMAL;
  private cleanProgress = 0;
  private cleaningThreshold = 0.8; // 80% 이상 청소되면 완료로 간주
  private sparkleEffect?: SparkleEffect;
  private cleaningStartTime = 0;

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
    this.app = app;
    this.parent = parent;

    // 텍스처 가져오기 (common16x16Sprites에서 poo 텍스처 사용)
    const texture = this.getPoobTexture();

    // 스프라이트 생성 및 초기 설정
    this.sprite = new PIXI.Sprite(texture);
    this.sprite.scale.set(2.5); // 크기 조정
    this.sprite.anchor.set(0.5);

    // 위치 설정 로직
    if (options.position) {
      // 직접 위치가 지정된 경우
      this.sprite.position.set(options.position.x, options.position.y);
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
      this.sprite.position.set(x, y);
    }

    // zIndex 설정 - 깊이 정렬을 위해
    this.sprite.zIndex = this.sprite.position.y;

    // 부모 컨테이너에 추가
    this.parent.addChild(this.sprite);
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

    this.sprite.position.set(
      characterPos.x + offsetX,
      characterPos.y + offsetY
    );

    console.log(
      `Poob 생성 위치: (${this.sprite.position.x}, ${
        this.sprite.position.y
      }), 캐릭터 방향: ${isFlipped ? "왼쪽" : "오른쪽"}`
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
   * 청소 진행도 업데이트
   * @param progress 0-1 사이의 청소 진행도
   * @returns 청소가 완료되었는지 여부
   */
  public updateCleanProgress(progress: number): boolean {
    // 이미 청소가 완료된 상태라면 항상 true 반환
    if (this.state === PoobState.CLEANED) {
      return true;
    }

    // 처음 청소를 시작할 때 상태 변경
    if (this.state === PoobState.NORMAL && progress > 0) {
      this.state = PoobState.CLEANING;
      this.cleaningStartTime = Date.now();

      // 청소 중일 때 투명도 조절 시작
      this.sprite.alpha = 1.0;
    }

    if (this.state === PoobState.CLEANING) {
      this.cleanProgress = progress;

      // 투명도 조절 (청소가 진행될수록 점점 투명해짐)
      this.sprite.alpha = 1.0 - progress * 0.8; // 80%까지만 투명하게

      // 청소 임계값에 도달하면 청소 완료로 처리
      if (progress >= this.cleaningThreshold) {
        this.finishCleaning();
        return true;
      }
    }

    return false;
  }

  /**
   * 청소 완료 처리
   */
  public finishCleaning(): void {
    if (this.state === PoobState.CLEANED) {
      return; // 이미 청소 완료된 상태
    }

    this.state = PoobState.CLEANED;

    // 효과음 재생 등 추가 기능 구현 가능

    // 스프라이트 제거
    if (this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
    }
  }

  /**
   * 객체 위치 반환
   */
  public getPosition(): { x: number; y: number } {
    return { x: this.sprite.position.x, y: this.sprite.position.y };
  }

  /**
   * 객체의 스프라이트 반환
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
  public isCleaned(): boolean {
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
    }
  }
}
