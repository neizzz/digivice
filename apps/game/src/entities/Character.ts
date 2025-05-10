import * as PIXI from "pixi.js";
import {
  type CharacterAnimationMapping,
  CharacterDictionary,
  type CharacterKey,
  CharacterState,
} from "../types/Character";
import { AssetLoader } from "../utils/AssetLoader";
import { RandomMovementController } from "../controllers/RandomMovementController";
import { FoodTracker } from "../trackers/FoodTracker"; // FoodTracker 임포트
import { EventBus, EventTypes } from "../utils/EventBus";
import { GameDataManager } from "../managers/GameDataManager";
import { Poob } from "./Poob"; // Poob 클래스 임포트 추가
import type { CharacterStatusData } from "../types/GameData";
import { CHARACTER_MOVEMENT } from "../config";

export class Character extends PIXI.Container {
  public animatedSprite: PIXI.AnimatedSprite | undefined;
  private speed: number; // 캐릭터 이동 속도
  private currentAnimation = "idle"; // 현재 애니메이션 상태
  private spritesheet?: PIXI.Spritesheet; // spritesheet 객체
  private scaleFactor: number; // 캐릭터 크기 조정 인자
  private currentState: CharacterState = CharacterState.IDLE; // 현재 상태
  private animationMapping: CharacterAnimationMapping; // 상태와 애니메이션 이름 매핑
  private flipCharacter = false; // 캐릭터 좌우 반전 여부
  private randomMovementController: RandomMovementController; // 랜덤 움직임 컨트롤러 참조
  private app?: PIXI.Application; // PIXI 애플리케이션 참조
  private eventBus: EventBus; // 이벤트 버스 인스턴스
  private characterInfo: (typeof CharacterDictionary)[CharacterKey]; // 캐릭터 정보 저장
  private characterKey: CharacterKey; // CharacterKey 저장
  private foodTracker: FoodTracker | null = null; // FoodTracker 인스턴스
  private status: CharacterStatusData; // 캐릭터 상태 데이터

  // 캐릭터 정보를 반환하는 메서드 추가
  protected getCharacterInfo(): (typeof CharacterDictionary)[CharacterKey] {
    return this.characterInfo;
  }

  constructor(params: {
    characterKey: CharacterKey; // 캐릭터 키
    app: PIXI.Application; // PIXI 애플리케이션 참조
    status: CharacterStatusData; // 캐릭터 상태 데이터
  }) {
    super();
    // 이벤트 버스 인스턴스 가져오기
    this.eventBus = EventBus.getInstance();

    this.status = params.status; // 캐릭터 상태 데이터 저장
    this.characterKey = params.characterKey; // 캐릭터 키 저장
    this.characterInfo = CharacterDictionary[params.characterKey]; // 캐릭터 정보 가져오기
    this.app = params.app;
    this.setPosition(
      this.status.position.x ?? this.app.screen.width / 2,
      this.status.position.y ?? this.app.screen.height / 2
    );

    this.speed = this.characterInfo.speed;
    this.scaleFactor = this.characterInfo.scale;
    this.animationMapping = this.characterInfo.animationMapping;

    // RandomMovementController 초기화
    this.randomMovementController = this.initRandomMovementController({
      minIdleTime: CHARACTER_MOVEMENT.MIN_IDLE_TIME,
      maxIdleTime: CHARACTER_MOVEMENT.MAX_IDLE_TIME,
      minMoveTime: CHARACTER_MOVEMENT.MIN_MOVE_TIME,
      maxMoveTime: CHARACTER_MOVEMENT.MAX_MOVE_TIME,
    });

    // AssetLoader에서 스프라이트시트 가져오기
    const assets = AssetLoader.getAssets();
    this.spritesheet = assets.characterSprites[params.characterKey];

    // 초기 상태 설정 - status에서 가져온 상태를 현재 상태로 설정
    this.currentState = params.status.state || CharacterState.IDLE;

    // 이미 dead 상태인 경우 무덤 스프라이트로 초기화
    if (this.currentState === CharacterState.DEAD) {
      this.initializeAsDead();
    } else {
      // 살아있는 경우 정상적으로 스프라이트 로드
      this.loadCharacterSprite(this.spritesheet).then(() => {
        // 초기 애니메이션 설정
        this.setAnimation(
          this.animationMapping[
            this.currentState as Exclude<CharacterState, CharacterState.DEAD>
          ] || "idle"
        );
        this.initFoodTracker();
      });
    }
  }

  /**
   * 캐릭터를 죽은 상태로 초기화합니다.
   */
  private initializeAsDead(): void {
    try {
      // 랜덤 움직임 비활성화
      this.disableRandomMovement();

      const assets = AssetLoader.getAssets();
      // common32x32에서 tomb 텍스처 가져오기
      const commonSheet = assets.common32x32Sprites;

      if (commonSheet?.textures.tomb) {
        // 무덤 스프라이트 생성
        const tombSprite = new PIXI.Sprite(commonSheet.textures.tomb);
        tombSprite.anchor.set(0.5, 0.5);
        tombSprite.scale.set(2.4);

        // Ensure tomb stays within screen bounds
        if (this.app) {
          // Get screen bounds
          const screenBounds = this.app.screen;

          // Calculate sprite boundaries with scale
          const halfWidth = tombSprite.width / 2;
          const halfHeight = tombSprite.height / 2;

          // Get current position
          let x = this.position.x;
          let y = this.position.y;

          // Clamp position to keep sprite on screen
          x = Math.max(halfWidth, Math.min(screenBounds.width - halfWidth, x));
          y = Math.max(
            halfHeight,
            Math.min(screenBounds.height - halfHeight, y)
          );

          // Update position if needed
          if (x !== this.position.x || y !== this.position.y) {
            this.setPosition(x, y);
          }
        }
        this.addChild(tombSprite);

        console.log("캐릭터가 죽은 상태로 초기화되었습니다.");
      } else {
        console.warn("무덤 스프라이트를 찾을 수 없습니다.");
      }
    } catch (e) {
      console.error("죽은 상태 초기화 중 오류:", e);
    }
  }

  /**
   * FoodTracker 초기화 - 캐릭터가 씬에 추가된 후 호출
   */
  private initFoodTracker(): void {
    if (this.app) {
      // 캐릭터의 부모 컨테이너가 있는지 확인 (MainScene일 가능성 높음)
      const targetContainer = this.parent;

      if (targetContainer) {
        this.foodTracker = new FoodTracker(this, this.app, targetContainer);
        console.log("FoodTracker가 초기화되었습니다.");
      } else {
        console.warn(
          "캐릭터가 씬에 추가되지 않아 FoodTracker 초기화가 지연됩니다."
        );
        // 부모 컨테이너가 없는 경우 다시 시도
        setTimeout(() => this.initFoodTracker(), 100);
      }
    }
  }

  /**
   * RandomMovementController 초기화
   */
  private initRandomMovementController(movementOptions?: {
    minIdleTime: number;
    maxIdleTime: number;
    minMoveTime: number;
    maxMoveTime: number;
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

      // 캐릭터 상태 변경 이벤트 발행
      this.eventBus.emit(EventTypes.CHARACTER_STATUS_UPDATED, {
        status: {
          state,
          position: this.getPosition(),
        },
      });

      if (state === CharacterState.DEAD) {
        return;
      }

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
   * 캐릭터의 현재 상태를 반환합니다.
   */
  public getState(): CharacterState {
    return this.currentState;
  }

  /**
   * 캐릭터의 현재 스태미나를 반환합니다.
   */
  public async getStamina(): Promise<number> {
    try {
      const gameData = await GameDataManager.loadData();
      if (!gameData) return Number.NaN;
      return gameData?.character.status.stamina ?? Number.NaN;
    } catch (error) {
      console.error("스태미나 가져오기 오류:", error);
      return Number.NaN;
    }
  }

  /**
   * 캐릭터의 최대 스태미나를 반환합니다.
   */
  public getMaxStamina(): number {
    return this.characterInfo.maxStamina;
  }

  /**
   * 스태미나를 증가시킵니다.
   * @param amount 증가시킬 양
   */
  public async increaseStamina(amount: number): Promise<void> {
    try {
      const gameData = await GameDataManager.loadData();
      if (!gameData) return;

      const currentStamina = gameData.character.status.stamina;
      const maxStamina = this.characterInfo.maxStamina;
      const newStamina = Math.min(maxStamina, currentStamina + amount);
      this.emitStaminaChanged(newStamina);
    } catch (error) {
      console.error("스태미나 증가 오류:", error);
    }
  }

  /**
   * 스태미나를 감소시킵니다.
   * @param amount 감소시킬 양
   * @returns 스태미나가 충분했는지 여부
   */
  public async decreaseStamina(amount: number): Promise<void> {
    try {
      const gameData = await GameDataManager.loadData();
      if (!gameData) return;

      const currentStamina = gameData.character.status.stamina;

      if (currentStamina >= amount) {
        const newStamina = currentStamina - amount;
        this.emitStaminaChanged(newStamina);
      }
    } catch (error) {}
  }

  /**
   * 스태미나 변경 이벤트를 발행합니다.
   * @param current 현재 스태미나
   */
  private emitStaminaChanged(current: number): void {
    try {
      // CHARACTER_STATUS_UPDATED 이벤트 발행
      this.eventBus.emit(EventTypes.CHARACTER_STATUS_UPDATED, {
        status: {
          stamina: current,
        },
      });

      console.log(`스태미나가 변경되었습니다: ${current}/10`);
    } catch (error) {
      console.error("스태미나 변경 이벤트 발행 중 오류:", error);
    }
  }

  /**
   * 캐릭터 위치에 Poob을 생성합니다.
   * @returns 생성된 Poob 객체
   */
  public createPoob(): Poob | null {
    if (!this.app) {
      console.error("App reference is not set, cannot create Poob");
      return null;
    }

    const isFlipped = this.flipCharacter;
    const position = this.getPosition();
    const poobPosition = {
      x: isFlipped ? position.x + 20 : position.x - 20, // 뒤집힌 경우 왼쪽에 생성
      y: position.y - 10, // y좌표는 캐릭터보다 10 더 크게 설정
    };

    // Poob 생성
    const poob = new Poob(this.parent, { position: poobPosition });

    // 이벤트 발생 (위치 정보만 포함)
    this.eventBus.emit(EventTypes.POOB_CREATED, {
      position: poobPosition,
      id: poob.getId(),
    });

    return poob;
  }

  // CharacterKey getter 추가
  public getCharacterKey(): CharacterKey {
    return this.characterKey;
  }

  /**
   * 캐릭터의 현재 위치와 상태를 저장하기 위해 이벤트를 발행합니다.
   */
  public savePositionAndState(): void {
    try {
      const position = this.getPosition();
      const state = this.getState();

      // CHARACTER_STATUS_UPDATED 이벤트 발행
      this.eventBus.emit(EventTypes.CHARACTER_STATUS_UPDATED, {
        status: {
          position,
          state,
        },
      });

      console.log(
        "캐릭터의 위치와 상태 저장 이벤트가 발행되었습니다:",
        position,
        state
      );
    } catch (error) {
      console.error("캐릭터 위치와 상태 저장 이벤트 발행 중 오류:", error);
    }
  }

  /**
   * 저장된 마지막 위치로 캐릭터를 이동시킵니다.
   * @param position 이동시킬 위치
   * @param state 설정할 상태
   */
  public restorePositionAndState(
    position: { x: number; y: number },
    state: CharacterState
  ): void {
    // 위치가 NaN이 아닐 때만 적용
    if (!Number.isNaN(position.x) && !Number.isNaN(position.y)) {
      this.setPosition(position.x, position.y);
    }

    // 상태 설정
    this.update(state);
    console.log("캐릭터의 위치와 상태가 복원되었습니다:", position, state);
  }

  /**
   * 캐릭터를 죽음 상태로 만듭니다.
   * 상태를 DEAD로 변경하고 필요에 따라 tomb 스프라이트를 표시합니다.
   */
  public async die(): Promise<void> {
    try {
      // 원래 characterKey 기록 (로깅용)
      const characterKey = this.characterKey;

      // 상태를 DEAD로 변경
      this.update(CharacterState.DEAD);

      // 랜덤 움직임 비활성화
      this.disableRandomMovement();

      // 기존 애니메이션 스프라이트 제거
      if (this.animatedSprite) {
        this.removeChild(this.animatedSprite);
        this.animatedSprite.destroy();
        this.animatedSprite = undefined;
      }

      try {
        const assets = AssetLoader.getAssets();
        // common32x32에서 tomb 텍스처 가져오기
        const commonSheet = assets.common32x32Sprites;

        if (commonSheet?.textures.tomb) {
          // 무덤 스프라이트 생성
          const tombSprite = new PIXI.Sprite(commonSheet.textures.tomb);
          tombSprite.anchor.set(0.5, 0.5);
          tombSprite.scale.set(this.scaleFactor);
          this.addChild(tombSprite);

          console.log("캐릭터가 사망하여 무덤 스프라이트로 표시됩니다.");
        } else {
          console.warn("무덤 스프라이트를 찾을 수 없습니다.");
        }
      } catch (e) {
        console.error("무덤 스프라이트를 로드할 수 없습니다:", e);
      }

      console.log(
        `캐릭터가 사망했습니다. 캐릭터 타입: ${characterKey}, 상태: ${CharacterState.DEAD}`
      );

      // CHARACTER_STATUS_UPDATED 이벤트 발행 - dead 플래그 설정
      this.eventBus.emit(EventTypes.CHARACTER_STATUS_UPDATED, {
        status: {
          state: CharacterState.DEAD,
        },
      });

      // 위치와 상태 저장 이벤트 발행
      this.savePositionAndState();

      // 죽음 이벤트 발생
      this.eventBus.emit(EventTypes.CHARACTER_DEATH, undefined);
    } catch (error) {
      console.error("캐릭터 사망 처리 중 오류:", error);
    }
  }

  /**
   * Character 클래스 정리 메서드
   */
  public destroy(): void {
    // FoodTracker 정리
    if (this.foodTracker) {
      this.foodTracker.destroy();
      this.foodTracker = null;
    }

    // 랜덤 움직임 컨트롤러 정리
    if (this.randomMovementController) {
      this.randomMovementController.disable();
    }

    // 스프라이트 정리
    if (this.animatedSprite) {
      this.removeChild(this.animatedSprite);
      this.animatedSprite.destroy();
      this.animatedSprite = undefined;
    }
  }
}
