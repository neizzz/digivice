import * as PIXI from "pixi.js";
import {
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
import type { CharacterStatusData, GameData } from "../types/GameData";
import { CharacterStatusViewManager } from "../managers/CharacterStatusViewManager";
import type { Scene } from "../interfaces/Scene";
import { ObjectType } from "../types/GameData";
import { CHARACTER_MOVEMENT } from "../config";

export class Character extends PIXI.Container {
  public animatedSprite: PIXI.AnimatedSprite | undefined;
  private speed!: number; // 캐릭터 이동 속도
  private scaleFactor!: number; // 캐릭터 크기 조정 인자
  private randomMovementController!: RandomMovementController; // 랜덤 움직임 컨트롤러 참조
  private spritesheet?: PIXI.Spritesheet; // spritesheet 객체
  private currentState!: CharacterState; // 현재 상태, NOTE: 초기화전에는 "undefined"
  private flipCharacter = false; // 캐릭터 좌우 반전 여부
  private app: PIXI.Application; // PIXI 애플리케이션 참조
  private eventBus: EventBus; // 이벤트 버스 인스턴스
  private characterInfo!: (typeof CharacterDictionary)[CharacterKey]; // 캐릭터 정보 저장
  private characterKey!: CharacterKey; // CharacterKey 저장
  private foodTracker: FoodTracker | null = null; // FoodTracker 인스턴스
  private statusViewManager!: CharacterStatusViewManager;
  private _initialized = false; // 초기화 여부

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
    this.eventBus = EventBus.getInstance();
    this.app = params.app;
  }

  // NOTE: 코드 순서 중요!
  public initialize(characterInfo: GameData["character"], scene: Scene): void {
    if (this._initialized) {
      console.warn("[Character] 이미 초기화된 캐릭터입니다.");
      return;
    }
    const { key, status } = characterInfo;
    this.setPosition(
      status.position.x ?? this.app.screen.width / 2,
      status.position.y ?? this.app.screen.height / 2
    );
    this.setCharacterKey(key as CharacterKey);
    this.statusViewManager = new CharacterStatusViewManager(this);
    scene.addChild(this);

    const onInitialized = () => {
      this.reflectCharacterStatus(status);
      this._initialized = true;
    };

    if (this.getState() !== CharacterState.DEAD) {
      this.randomMovementController = this._initRandomMovementController({
        minIdleTime: CHARACTER_MOVEMENT.MIN_IDLE_TIME,
        maxIdleTime: CHARACTER_MOVEMENT.MAX_IDLE_TIME,
        minMoveTime: CHARACTER_MOVEMENT.MIN_MOVE_TIME,
        maxMoveTime: CHARACTER_MOVEMENT.MAX_MOVE_TIME,
      });
      this.randomMovementController.enable();
      this.randomMovementController.setMoveSpeed(this.speed);
      this._initFoodTracker().then(onInitialized);
    } else {
      onInitialized();
    }
  }

  // NOTE: 코드 순서 중요!
  public reflectCharacterStatus(status: CharacterStatusData): void {
    console.log(
      "[Character] 캐릭터 상태 반영:",
      JSON.stringify(status, null, 2)
    );
    if (this.getState() !== status.state) {
      this.setState(status.state);
    }
    if (this.getState() === CharacterState.DEAD) {
      return;
    }
    status.stamina === 0
      ? this.statusViewManager.addStatus("urgent")
      : this.statusViewManager.removeStatus("urgent");
  }

  /**
   * 캐릭터를 죽은 상태로 초기화합니다.
   */
  private _initializeAsDead(): void {
    try {
      // 랜덤 움직임 비활성화
      this.disableRandomMovement();
      this.statusViewManager.clearStatus();

      const assets = AssetLoader.getAssets();
      // common32x32에서 tomb 텍스처 가져오기
      const commonSheet = assets.common32x32Sprites;

      if (commonSheet?.textures.tomb) {
        // 무덤 스프라이트 생성
        const tombSprite = new PIXI.Sprite(commonSheet.textures.tomb);
        tombSprite.anchor.set(0.5, 0.5);
        tombSprite.scale.set(2.4);

        if (this.app) {
          const screenBounds = this.app.screen;
          const halfWidth = tombSprite.width / 2;
          const halfHeight = tombSprite.height / 2;

          // Clamp position to keep sprite on screen
          const x = Math.max(
            halfWidth,
            Math.min(screenBounds.width - halfWidth, this.position.x)
          );
          const y = Math.max(
            halfHeight,
            Math.min(screenBounds.height - halfHeight, this.position.y)
          );

          // Update position if needed
          if (x !== this.position.x || y !== this.position.y) {
            this.setPosition(x, y);
          }
        }
        if (this.animatedSprite) {
          this.removeChild(this.animatedSprite);
          this.animatedSprite.destroy();
          this.animatedSprite = undefined;
        }
        tombSprite.scale.x *= this.flipCharacter ? 1 : -1;
        this.addChild(tombSprite);

        console.log("[Character] 캐릭터가 죽은 상태로 초기화되었습니다.");
      } else {
        console.warn("[Character] 무덤 스프라이트를 찾을 수 없습니다.");
      }
    } catch (e) {
      console.error("[Character] 죽은 상태 초기화 중 오류:", e);
    }
  }

  private _initFoodTracker(): Promise<void> {
    // 캐릭터의 부모 컨테이너가 있는지 확인 (MainScene일 가능성 높음)
    const targetContainer = this.parent;

    if (targetContainer) {
      this.foodTracker = new FoodTracker(this, this.app, targetContainer);
      this.foodTracker.enable();
      console.log("[Character] FoodTracker가 초기화되었습니다.");
      return Promise.resolve();
    }

    console.warn(
      "[Character] 캐릭터가 씬에 추가되지 않아 다음 프레임에 FoodTracker 초기화됩니다."
    );
    // 부모 컨테이너가 없는 경우 다시 시도
    return new Promise((resolve) => {
      setTimeout(() => {
        this._initFoodTracker();
        resolve();
      });
    });
  }

  /**
   * RandomMovementController 초기화
   */
  private _initRandomMovementController(movementOptions?: {
    minIdleTime: number;
    maxIdleTime: number;
    minMoveTime: number;
    maxMoveTime: number;
  }): RandomMovementController {
    if (!this.app) {
      throw new Error("[Character] App reference is not set");
    }
    const options = movementOptions;
    return new RandomMovementController(this, this.app, options);
  }

  private _loadCharacterSprite(spritesheet?: PIXI.Spritesheet): void {
    if (!spritesheet) {
      throw new Error("[Character] Spritesheet not provided for character");
    }

    // spritesheet 설정
    this.spritesheet = spritesheet;

    // spritesheet.animations이 정의되어 있는지 확인
    if (this.spritesheet.animations) {
      console.log(
        "[Character] Available animations:",
        Object.keys(this.spritesheet.animations)
      );
      return;
    }

    // animations이 없거나 유효하지 않은 경우 대체 애니메이션 생성
    throw new Error(
      "[Character] No valid animations found in spritesheet, using fallback"
    );
  }

  private _setAnimation(animationName?: string): boolean {
    if (!animationName) {
      console.error("[Character] Animation name is not provided");
      return false;
    }
    if (!this.spritesheet) {
      console.error(
        "[Character] Cannot set animation, spritesheet is not loaded"
      );
      return false;
    }

    const textures = this.spritesheet.animations[animationName];
    if (!textures || textures.length === 0) {
      console.error(`[Character] Animation not found: ${animationName}`);
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
    this.animatedSprite.loop = true;
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
    return true;
  }

  public setCharacterKey(characterKey: CharacterKey): void {
    if (this.characterKey === characterKey) {
      console.warn(
        `[Character] 캐릭터 키("${this.characterKey}")가 이미 설정되어 있습니다. ignore.`
      );
      return;
    }
    this.characterKey = characterKey;
    const assets = AssetLoader.getAssets();
    this.spritesheet = assets.characterSprites[this.characterKey];
    this._loadCharacterSprite(this.spritesheet);
    this.characterInfo = CharacterDictionary[this.characterKey];
    this.speed = this.characterInfo.speed;
    this.scaleFactor = this.characterInfo.scale;
    this.randomMovementController?.setMoveSpeed(this.speed);
  }
  public getCharacterKey(): CharacterKey {
    return this.characterKey;
  }
  public setPosition(x: number, y: number): void {
    this.position.set(x, y);
    this.zIndex = y;
  }
  public getPosition(): { x: number; y: number } {
    return {
      x: this.position.x,
      y: this.position.y,
    };
  }
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
  public getSpeed(): number {
    return this.speed;
  }
  /**
   * NOTE: 호출 단에서, 같은 상태일 경우 호출하지 않아야 함.
   * 상태에 따른 캐릭터 뷰 설정.
   */
  public setState(state: CharacterState, shouldTriggerEvent = false): void {
    if (this.currentState === state) {
      console.warn(
        `[Character] 캐릭터 상태가 이미 "${state}"로 설정되어 있습니다. skipped.`
      );
    } else {
      console.log(
        `[Character] 캐릭터 상태 변경: ${this.currentState} -> ${state}`
      );
    }
    if (shouldTriggerEvent) {
      this.eventBus.emit(EventTypes.Character.CHARACTER_STATUS_UPDATED, {
        status: { state },
      });
    }
    if (state === CharacterState.DEAD) {
      this._initializeAsDead();
      this.currentState = state;
      return;
    }
    const healed =
      this.currentState === CharacterState.SICK &&
      state !== CharacterState.SICK;
    const sicked =
      this.currentState !== CharacterState.SICK &&
      state === CharacterState.SICK;

    if (healed) this._healedSideEffect();
    if (sicked) this._sickStateSideEffect();

    const animationName = this.characterInfo.animationMapping[state];
    this._setAnimation(animationName);
    this.currentState = state;
  }
  public getState(): CharacterState {
    return this.currentState;
  }
  public async getStamina(): Promise<number> {
    try {
      const gameData = await GameDataManager.getData();
      if (!gameData) return Number.NaN;
      return gameData?.character.status.stamina ?? Number.NaN;
    } catch (error) {
      console.error("[Character] 스태미나 가져오기 오류:", error);
      return Number.NaN;
    }
  }
  public getMaxStamina(): number {
    return this.characterInfo.maxStamina;
  }

  public disableRandomMovement(): void {
    if (this.randomMovementController) {
      this.randomMovementController.disable();
      console.log("[Character] Random movement disabled for character");
    }
  }
  public enableRandomMovement(): void {
    if (this.randomMovementController) {
      this.randomMovementController.enable();
      console.log("[Character] Random movement enabled for character");
    }
  }

  public discoverEmotion(): void {
    this.statusViewManager.setEmotion("discover");
  }

  public happyEmotion(): void {
    this.statusViewManager.setEmotion("happy");
  }

  private _sickStateSideEffect(): void {
    this.statusViewManager.addStatus("sick");
    this.disableRandomMovement();
    this.foodTracker?.disable();
  }

  private _healedSideEffect(): void {
    this.statusViewManager.removeStatus("sick");
    this.enableRandomMovement();
    this.foodTracker?.enable();
  }

  public async increaseStamina(amount: number): Promise<void> {
    try {
      const gameData = await GameDataManager.getData();
      if (!gameData) {
        console.error("[Character] 게임 데이터가 없습니다.");
        return;
      }

      gameData.character.status.timeOfZeroStamina = undefined;
      this.statusViewManager.removeStatus("urgent");
      const currentStamina = gameData.character.status.stamina;
      const maxStamina = this.characterInfo.maxStamina;
      const newStamina = Math.min(maxStamina, currentStamina + amount);
      if (newStamina === maxStamina) {
        this.happyEmotion;
      }
      this.eventBus.emit(EventTypes.Character.CHARACTER_STATUS_UPDATED, {
        status: {
          stamina: newStamina,
        },
      });
    } catch (error) {
      console.error("[Character] 스태미나 증가 오류:", error);
    }
  }

  public createPoob(): Poob | null {
    if (!this.app) {
      console.error("[Character] App reference is not set, cannot create Poob");
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
    EventBus.publish(EventTypes.Object.OBJECT_CREATED, {
      type: ObjectType.Poob,
      position: poobPosition,
      id: poob.getId(),
    });

    return poob;
  }

  public savePositionAndState(): void {
    try {
      const position = this.getPosition();
      const state = this.getState();

      EventBus.publish(EventTypes.Character.CHARACTER_STATUS_UPDATED, {
        status: {
          position,
          state,
        },
      });

      console.log(
        "[Character] 캐릭터의 위치와 상태 저장 이벤트가 발행되었습니다:",
        position,
        state
      );
    } catch (error) {
      console.error(
        "[Character] 캐릭터 위치와 상태 저장 이벤트 발행 중 오류:",
        error
      );
    }
  }

  public destroy(): void {
    if (this.foodTracker) {
      this.foodTracker.destroy();
      this.foodTracker = null;
    }
    if (this.randomMovementController) {
      this.randomMovementController.disable();
    }
    if (this.animatedSprite) {
      this.removeChild(this.animatedSprite);
      this.animatedSprite.destroy();
      this.animatedSprite = undefined;
    }
    // 상태/감정 아이콘 관련 정리 불필요 (statusViewManager에서 관리)
  }
}
