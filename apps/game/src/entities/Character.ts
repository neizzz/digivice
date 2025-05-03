import * as PIXI from "pixi.js";
import {
  CharacterDictionary,
  type CharacterKey,
  CharacterState,
} from "../types/Character";
import type { Position } from "../types/Position";
import { AssetLoader } from "../utils/AssetLoader";
import { RandomMovementController } from "../controllers/RandomMovementController";
import type { Food } from "./Food";
import { EventBus, EventTypes } from "../utils/EventBus";

// 캐릭터 관련 전역 상수
export const CHARACTER_MAX_STAMINA = 10; // 최대 스태미나

export class Character extends PIXI.Container {
  public animatedSprite: PIXI.AnimatedSprite | undefined;
  private speed: number; // 캐릭터 이동 속도
  private currentAnimation = "idle"; // 현재 애니메이션 상태
  private spritesheet?: PIXI.Spritesheet; // spritesheet 객체
  private scaleFactor: number; // 캐릭터 크기 조정 인자
  private currentState: CharacterState = CharacterState.IDLE; // 현재 상태
  private animationMapping: Record<CharacterState, string>; // 상태와 애니메이션 이름 매핑
  private flipCharacter = false; // 캐릭터 좌우 반전 여부
  private randomMovementController: RandomMovementController; // 랜덤 움직임 컨트롤러 참조
  private app?: PIXI.Application; // PIXI 애플리케이션 참조
  private stamina = 5; // 캐릭터 스태미나 (기본값 5, 최소 0, 최대 10)
  private foodQueue: Food[] = []; // 먹을 음식 대기열
  private eventBus: EventBus; // 이벤트 버스 인스턴스
  private isMovingToFood = false; // 캐릭터가 음식으로 이동 중인지 나타내는 플래그

  constructor(params: {
    characterKey: CharacterKey; // CharacterKey 사용
    initialPosition: Position;
    app: PIXI.Application; // PIXI 애플리케이션 참조
    movementOptions?: {
      minIdleTime: number;
      maxIdleTime: number;
      minMoveTime: number;
      maxMoveTime: number;
      boundaryPadding: number;
    };
    initialStamina?: number; // 초기 스태미나 (선택사항)
  }) {
    super();

    // 이벤트 버스 인스턴스 가져오기
    this.eventBus = EventBus.getInstance();

    const characterInfo = CharacterDictionary[params.characterKey];

    this.position.set(params.initialPosition.x, params.initialPosition.y);
    this.speed = characterInfo.speed;
    this.scaleFactor = characterInfo.scale;
    this.animationMapping = characterInfo.animationMapping;
    this.app = params.app;

    // 초기 스태미나 설정 (우선순위: 파라미터 > 메타데이터 > 기본값)
    if (params.initialStamina !== undefined) {
      this.stamina = Math.max(
        0,
        Math.min(CHARACTER_MAX_STAMINA, params.initialStamina)
      );
    } else if (characterInfo.initialStamina !== undefined) {
      this.stamina = Math.max(
        0,
        Math.min(CHARACTER_MAX_STAMINA, characterInfo.initialStamina)
      );
    }

    // RandomMovementController 초기화
    this.randomMovementController = this.initRandomMovementController(
      params.movementOptions
    );

    // AssetLoader에서 스프라이트시트 가져오기
    const assets = AssetLoader.getAssets();
    this.spritesheet = assets.characterSprites[params.characterKey];

    this.loadCharacterSprite(this.spritesheet).then(() => {
      // 초기 애니메이션 설정
      this.setAnimation("idle");
    });

    // 초기 상태 이벤트 발생
    this.emitStaminaChanged();
  }

  /**
   * RandomMovementController 초기화
   */
  private initRandomMovementController(movementOptions?: {
    minIdleTime: number;
    maxIdleTime: number;
    minMoveTime: number;
    maxMoveTime: number;
    boundaryPadding: number;
  }): RandomMovementController {
    if (!this.app) {
      throw new Error("App reference is not set");
    }

    // 사용자 옵션과 기본 옵션 병합
    const options = movementOptions;

    // RandomMovementController 생성
    return new RandomMovementController(this, this.app, options);
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

  /**
   * 캐릭터의 랜덤 움직임을 비활성화합니다
   */
  public disableRandomMovement(): void {
    if (this.randomMovementController) {
      this.randomMovementController.disable();
      console.log("Random movement disabled for character");
    }
  }

  /**
   * 캐릭터의 랜덤 움직임을 활성화합니다
   */
  public enableRandomMovement(): void {
    if (this.randomMovementController) {
      this.randomMovementController.enable();
      console.log("Random movement enabled for character");
    }
  }

  /**
   * 음식을 대기열에 추가합니다.
   * @param food 먹을 음식 객체
   */
  public addFoodToQueue(food: Food): void {
    this.foodQueue.push(food);
    console.log(
      `음식이 대기열에 추가되었습니다. 현재 대기열 길이: ${this.foodQueue.length}`
    );

    // 현재 먹고 있지 않고, 먹는 중이 아니고, 다른 음식으로 이동하는 중이 아닐 때만 먹기 시작
    if (this.currentState !== CharacterState.EATING && !this.isMovingToFood) {
      this.processNextFood();
    }
  }

  /**
   * 대기열에서 다음 음식을 처리합니다.
   */
  private async processNextFood(): Promise<void> {
    // 대기열이 비어있거나 이미 먹는 중이거나 다른 음식으로 이동 중이면 처리하지 않음
    if (
      this.foodQueue.length === 0 ||
      this.currentState === CharacterState.EATING ||
      this.isMovingToFood
    ) {
      return;
    }

    try {
      // 음식을 먹기 위해 이동 중임을 표시
      this.isMovingToFood = true;

      // 대기열의 첫 번째 음식 가져오기 (아직 제거하지 않음)
      const food = this.foodQueue[0];

      // 음식이 존재하면 접근 명령 실행
      if (food) {
        // 랜덤 움직임 비활성화 및 음식으로 접근 시작
        food.startMovingToFood();

        try {
          // 음식 먹기가 완료될 때까지 대기
          await food.waitForEatingFinished();

          // 음식 먹기가 완료되었으므로 대기열에서 제거
          this.foodQueue.shift();
          console.log(`음식을 먹었습니다. 현재 스태미나: ${this.stamina}`);
        } catch (error) {
          console.error("음식 먹기 중 오류 발생:", error);
          // 오류가 발생한 음식은 대기열에서 제거
          this.foodQueue.shift();
        }
      }
    } finally {
      // 이동/식사 상태 플래그 초기화
      this.isMovingToFood = false;

      // 다음 음식이 있고 아직 먹는 중이 아니라면 다음 음식 처리
      if (
        this.foodQueue.length > 0 &&
        this.currentState !== CharacterState.EATING
      ) {
        // 다음 프레임에서 처리하여 상태가 제대로 업데이트되도록 함
        setTimeout(() => this.processNextFood(), 0);
      }
    }
  }

  /**
   * 캐릭터의 현재 스태미나를 반환합니다.
   */
  public getStamina(): number {
    return this.stamina;
  }

  /**
   * 캐릭터의 최대 스태미나를 반환합니다.
   */
  public getMaxStamina(): number {
    return CHARACTER_MAX_STAMINA;
  }

  /**
   * 스태미나를 증가시킵니다.
   * @param amount 증가시킬 양
   */
  public increaseStamina(amount: number): void {
    const prevStamina = this.stamina;
    this.stamina = Math.min(CHARACTER_MAX_STAMINA, this.stamina + amount);

    // 스태미나가 변경되었을 때만 이벤트 발생
    if (prevStamina !== this.stamina) {
      this.emitStaminaChanged();
    }
  }

  /**
   * 스태미나를 감소시킵니다.
   * @param amount 감소시킬 양
   * @returns 스태미나가 충분했는지 여부
   */
  public decreaseStamina(amount: number): boolean {
    if (this.stamina >= amount) {
      const prevStamina = this.stamina;
      this.stamina -= amount;

      // 스태미나가 변경되었을 때만 이벤트 발생
      if (prevStamina !== this.stamina) {
        this.emitStaminaChanged();
      }
      return true;
    }
    return false;
  }

  /**
   * 스태미나 변경 이벤트 발생
   */
  private emitStaminaChanged(): void {
    this.eventBus.emit(EventTypes.CHARACTER.STAMINA_CHANGED, {
      current: this.stamina,
      max: CHARACTER_MAX_STAMINA,
    });
  }

  /**
   * 캐릭터가 현재 음식을 먹고 있는지 여부를 반환합니다.
   */
  public isEatingFood(): boolean {
    return this.currentState === CharacterState.EATING;
  }

  /**
   * 현재 대기열에 있는 음식의 수를 반환합니다.
   */
  public getFoodQueueLength(): number {
    return this.foodQueue.length;
  }
}
