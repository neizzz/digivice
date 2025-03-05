import * as PIXI from "pixi.js";
import { applyRandomMovement } from "../utils/MovementHelper";
import {
  RandomMovementController,
  MovementOptions,
} from "../controllers/RandomMovementController";

export class Character extends PIXI.Container {
  public animatedSprite: PIXI.AnimatedSprite | undefined;
  private movementController: RandomMovementController | null = null;
  public name: string;

  constructor(spritesheet: PIXI.Spritesheet, name: string) {
    super();

    // 캐릭터 이름 설정
    this.name = name;

    try {
      // 사용 가능한 애니메이션 목록 확인 (디버깅용)
      console.log("Available animations:", Object.keys(spritesheet.animations));

      // 슬라임 애니메이션 생성 - AssetLoader에서 추가한 접두어 확인
      // AssetLoader에서 "slime_sprite_" 접두어를 추가했으므로 애니메이션 이름이 그대로인지 확인
      const idleFrames = spritesheet.animations["idle"];
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

      // 명시적으로 위치 설정 (화면 중앙에 배치)
      this.position.set(window.innerWidth / 2, window.innerHeight / 2);

      // 디버깅용: 스프라이트가 표시되는지 확인
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

    // 애니메이션된 스프라이트 대신 캐릭터 컨테이너에 랜덤 움직임 적용
    // 이렇게 하면 컨테이너가 움직이고, 스프라이트는 컨테이너에 상대적으로 고정됨
    this.movementController = applyRandomMovement(
      this, // 'this.animatedSprite' 대신 'this'를 사용하여 컨테이너에 직접 적용
      app,
      options
    );

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
