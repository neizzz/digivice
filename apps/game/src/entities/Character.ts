import * as PIXI from "pixi.js";
import {
  CharacterDictionary,
  type CharacterKey,
  CharacterState,
} from "../types/Character";
import type { Position } from "../types/Position";
import { AssetLoader } from "../utils/AssetLoader";

export class Character extends PIXI.Container {
  public animatedSprite: PIXI.AnimatedSprite | undefined;
  private speed: number; // 캐릭터 이동 속도
  private currentAnimation = "idle"; // 현재 애니메이션 상태
  private spritesheet?: PIXI.Spritesheet; // spritesheet 객체
  private scaleFactor: number; // 캐릭터 크기 조정 인자
  private currentState: CharacterState = CharacterState.IDLE; // 현재 상태
  private animationMapping: Record<CharacterState, string>; // 상태와 애니메이션 이름 매핑
  private flipCharacter = false; // 캐릭터 좌우 반전 여부

  constructor(params: {
    characterKey: CharacterKey; // CharacterKey 사용
    initialPosition: Position;
  }) {
    super();

    const characterInfo = CharacterDictionary[params.characterKey];

    this.position.set(params.initialPosition.x, params.initialPosition.y);
    this.speed = characterInfo.speed;
    this.scaleFactor = characterInfo.scale;
    this.animationMapping = characterInfo.animationMapping;

    // AssetLoader에서 스프라이트시트 가져오기
    const assets = AssetLoader.getAssets();
    this.spritesheet = assets.characterSprites[params.characterKey];

    // 기본 매핑 설정 (외부에서 주입된 매핑이 있으면 덮어씀)

    this.loadCharacterSprite(this.spritesheet).then(() => {
      // 초기 애니메이션 설정
      this.setAnimation("idle");
    });
  }

  private async loadCharacterSprite(
    spritesheet?: PIXI.Spritesheet
  ): Promise<void> {
    if (!spritesheet) {
      throw new Error("Spritesheet not provided for character");
    }

    // spritesheet 설정
    this.spritesheet = spritesheet;

    // spritesheet.animations이 정의되어 있는지 확인
    if (this.spritesheet.animations) {
      console.log(
        "Available animations:",
        Object.keys(this.spritesheet.animations)
      );

      // 초기 애니메이션 설정
      await this.setAnimation(this.currentAnimation);
      return;
    }

    // animations이 없거나 유효하지 않은 경우 대체 애니메이션 생성
    throw new Error("No valid animations found in spritesheet, using fallback");
  }

  private async setAnimation(animationName: string): Promise<boolean> {
    if (!this.spritesheet) {
      console.error("Cannot set animation, spritesheet is not loaded");
      return false;
    }

    const textures = this.spritesheet.animations[animationName];
    if (!textures || textures.length === 0) {
      console.error(`Animation not found: ${animationName}`);
      return false;
    }

    // 기존 애니메이션 제거
    if (this.animatedSprite) {
      this.removeChild(this.animatedSprite);
      this.animatedSprite.destroy();
    }

    // 새 애니메이션 생성
    this.animatedSprite = new PIXI.AnimatedSprite(textures);

    // 프레임 개수에 따라 애니메이션 속도 설정
    const frameCount = textures.length;
    this.animatedSprite.animationSpeed = 0.02 * frameCount;

    // 기본 루프 설정
    this.animatedSprite.loop = true;

    // 스프라이트 설정
    this.animatedSprite.width = textures[0].width * this.scaleFactor;
    this.animatedSprite.height = textures[0].height * this.scaleFactor;
    this.animatedSprite.play();
    this.addChild(this.animatedSprite);
    // flipCharacter 상태에 따라 스프라이트 반전 적용
    this.animatedSprite.scale.x = this.flipCharacter
      ? -Math.abs(this.animatedSprite.scale.x)
      : Math.abs(this.animatedSprite.scale.x);

    // pivot과 anchor 설정
    this.animatedSprite.anchor.set(0.5, 0.5);

    this.currentAnimation = animationName;
    return true;
  }

  public update(state: CharacterState): void {
    if (this.currentState !== state) {
      this.currentState = state;
      // 상태에 따른 애니메이션 이름 가져오기
      const animationName = this.animationMapping[state];
      if (animationName) {
        this.setAnimation(animationName);
      } else {
        console.warn(`No animation mapped for state: ${state}`);
      }
    }
  }

  // 명시적으로 캐릭터 위치 설정하는 메서드 추가
  public setPosition(x: number, y: number): void {
    this.position.set(x, y);
    this.zIndex = y;
  }

  /**
   * 캐릭터의 방향을 설정합니다 (좌우 반전)
   */
  public setFlipped(flipped: boolean): void {
    // 이미 같은 방향이면 변경하지 않음
    if (this.flipCharacter === flipped) return;

    this.flipCharacter = flipped;

    // 스프라이트 반전 적용
    if (this.animatedSprite) {
      this.animatedSprite.scale.x = flipped
        ? -Math.abs(this.animatedSprite.scale.x)
        : Math.abs(this.animatedSprite.scale.x);
    }
  }

  /**
   * 캐릭터의 현재 위치를 반환합니다
   */
  public getPosition(): { x: number; y: number } {
    return {
      x: this.position.x,
      y: this.position.y,
    };
  }

  public getSpeed(): number {
    return this.speed;
  }
}
