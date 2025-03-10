import * as PIXI from "pixi.js";
import { applyRandomMovement } from "../utils/MovementHelper";
import {
  RandomMovementController,
  MovementOptions,
} from "../controllers/RandomMovementController";
import { Position } from "../types/Position";

export class Character extends PIXI.Container {
  public animatedSprite: PIXI.AnimatedSprite | undefined;
  private movementController: RandomMovementController | null = null;
  public name: string;
  private speed: number; // 캐릭터 이동 속도

  constructor(params: {
    spritesheet?: PIXI.Spritesheet;
    name: string;
    initialPosition: Position;
    speed: number;
  }) {
    super();

    // 캐릭터 이름 설정
    this.name = params.name;
    this.position.set(params.initialPosition.x, params.initialPosition.y);
    this.speed = params.speed;

    try {
      if (!params.spritesheet) {
        console.warn("Spritesheet not provided for character");
        this.createFallbackAnimation();
        return;
      }

      // spritesheet.animations이 정의되어 있는지 확인
      if (params.spritesheet.animations) {
        console.log(
          "Available animations:",
          Object.keys(params.spritesheet.animations)
        );

        // 정상적으로 animations이 있는 경우 idle 애니메이션 로드 시도
        const idleFrames = params.spritesheet.animations["idle"];
        if (idleFrames && idleFrames.length > 0) {
          this.animatedSprite = new PIXI.AnimatedSprite(idleFrames);
          this.addChild(this.animatedSprite);

          // 애니메이션 설정
          this.animatedSprite.anchor.set(0.5);
          this.animatedSprite.animationSpeed = 0.1;
          this.animatedSprite.play();

          // 적절한 크기로 조정
          this.animatedSprite.scale.set(0.3);

          console.log(
            "Character created successfully with spritesheet animations"
          );
          return;
        }
      }

      // animations이 없거나 idle 프레임이 없는 경우 대체 애니메이션 생성
      console.warn("No valid animations found in spritesheet, using fallback");
      this.createFallbackAnimation();
    } catch (error) {
      console.error("Error creating character:", error);
      this.createFallbackAnimation();
    }
  }

  /**
   * 스프라이트시트가 없거나 유효하지 않을 때 대체 애니메이션을 생성합니다
   */
  private createFallbackAnimation(): void {
    try {
      console.log("Creating fallback animation for character");

      // 복잡한 렌더 텍스처 생성 대신 기본 텍스처 사용
      const texture = PIXI.Texture.WHITE;

      // 빨간색 착색 필터 생성
      const colorMatrix = new PIXI.ColorMatrixFilter();
      colorMatrix.tint(0xff3300); // 빨간색

      // 단일 프레임으로 애니메이션 생성
      this.animatedSprite = new PIXI.AnimatedSprite([texture]);
      this.addChild(this.animatedSprite);

      // 필터 적용
      this.animatedSprite.filters = [colorMatrix];

      // 기본 속성 설정
      this.animatedSprite.anchor.set(0.5);
      this.animatedSprite.width = 50;
      this.animatedSprite.height = 50;

      console.log("Fallback animation created successfully");
    } catch (error) {
      // 최후의 방어선: 모든 것이 실패한 경우 빈 컨테이너만 유지
      console.error("Failed to create even fallback animation:", error);

      // animatedSprite가 생성되지 않았으면 null 참조 방지
      if (!this.animatedSprite) {
        // 빈 스프라이트라도 만들어 두기
        const emptyTexture = PIXI.Texture.EMPTY;
        this.animatedSprite = new PIXI.AnimatedSprite([emptyTexture]);
        this.addChild(this.animatedSprite);
        this.animatedSprite.anchor.set(0.5);
      }
    }
  }

  public update(deltaTime: number): void {
    // 애니메이션은 PIXI에서 자동 업데이트됨
    // 필요한 경우 여기에 추가 로직 구현
  }

  // 명시적으로 캐릭터 위치 설정하는 메서드 추가
  public setPosition(x: number, y: number): void {
    this.position.set(x, y);
  }

  /**
   * 캐릭터에 랜덤 움직임을 적용합니다.
   * @param app PIXI Application 인스턴스
   * @param options 움직임 옵션
   * @returns 생성된 RandomMovementController 인스턴스
   */
  public applyRandomMovement(
    app: PIXI.Application,
    options?: MovementOptions
  ): RandomMovementController | null {
    if (!this.animatedSprite) {
      console.error("Cannot apply movement: animatedSprite is not initialized");
      return null;
    }

    console.log("Applying random movement to character container");

    // 기존 컨트롤러가 있다면 제거
    this.stopRandomMovement();

    // 캐릭터의 speed 속성을 직접 moveSpeed로 사용
    const updatedOptions: MovementOptions = {
      ...(options || {}),
      moveSpeed: this.speed, // 캐릭터의 speed 속성을 직접 사용
    };

    console.log(`Using character speed for movement: ${this.speed}`);

    // 애니메이션된 스프라이트 대신 캐릭터 컨테이너에 랜덤 움직임 적용
    this.movementController = applyRandomMovement(this, app, updatedOptions);

    return this.movementController;
  }

  /**
   * 적용된 랜덤 움직임을 중지합니다.
   */
  public stopRandomMovement(): void {
    if (this.movementController) {
      this.movementController.destroy();
      this.movementController = null;
    }
  }
}
