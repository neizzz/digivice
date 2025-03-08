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
        return;
      }

      // 사용 가능한 애니메이션 목록 확인 (디버깅용)
      console.log(
        "Available animations:",
        Object.keys(params.spritesheet.animations)
      );

      // 슬라임 애니메이션 생성
      const idleFrames = params.spritesheet.animations["idle"];
      if (!idleFrames || idleFrames.length === 0) {
        throw new Error("Idle animation frames not found in spritesheet");
      }

      this.animatedSprite = new PIXI.AnimatedSprite(idleFrames);
      this.addChild(this.animatedSprite);

      // 애니메이션 설정
      this.animatedSprite.anchor.set(0.5);
      this.animatedSprite.animationSpeed = 0.1;
      this.animatedSprite.play();

      // 적절한 크기로 조정
      this.animatedSprite.scale.set(0.3);

      console.log("Character created successfully:", this.animatedSprite);
    } catch (error) {
      console.error("Error creating character:", error);
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
