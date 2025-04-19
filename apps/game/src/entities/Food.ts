import * as PIXI from "pixi.js";
import { MovementController } from "../controllers/MovementController";
import type { Character } from "./Character";
import { CharacterState } from "../types/Character";
import { FoodMask } from "../utils/FoodMask";
import { ThrowSprite } from "../utils/ThrowSprite";
import { AssetLoader } from "../utils/AssetLoader";

// 음식 상태를 나타내는 enum
enum FoodState {
  THROWING = 0, // 던져지는 중
  LANDED = 1, // 착지됨
  EATING = 2, // 먹는 중
  FINISHED = 3, // 다 먹음
  APPROACHING = 4, // 캐릭터가 음식으로 접근 중
}

export interface FoodOptions {
  character: Character; // 음식을 먹을 캐릭터 객체 (선택사항)
}

/**
 * 음식 클래스 - 음식의 생명주기(던지기, 착지, 먹기)를 관리
 */
export class Food {
  private sprite: PIXI.Sprite;
  private app: PIXI.Application;
  private parent: PIXI.Container;
  private options: FoodOptions;
  private foodState: FoodState = FoodState.THROWING;
  private eatingStartTime = 0;
  private eatingDuration = 4000; // 기본값: 4초
  private targetPosition?: { x: number; y: number }; // 캐릭터가 이동할 목표 위치
  private movementController?: MovementController;

  // 음식 마스크 처리를 위한 객체
  private foodMask?: FoodMask;

  // Promise 관련 변수
  private eatingFinishedResolve?: () => void;
  private eatingPromise: Promise<void>;

  // ThrowSprite 객체
  private throwSprite?: ThrowSprite;

  // 음식 기본 크기 설정
  private initialScale = 3;
  private finalScale = 1.5;
  private throwDuration = 1000; // 1초간 던지기 애니메이션

  /**
   * @param app PIXI 애플리케이션
   * @param parent 부모 컨테이너
   * @param options 음식 옵션
   */
  constructor(
    app: PIXI.Application,
    parent: PIXI.Container,
    options: FoodOptions
  ) {
    this.app = app;
    this.parent = parent;
    this.options = options;

    // 랜덤 음식 텍스처 선택
    const texture = this.getRandomFoodTexture();

    // 스프라이트 생성 및 초기 설정
    this.sprite = new PIXI.Sprite(texture);

    // 음식 크기를 더 작게 조정 (16x16 텍스처를 고려)
    const foodScale = this.initialScale * 0.7; // 30% 더 작게 조정
    this.sprite.scale.set(foodScale);
    this.sprite.anchor.set(0.5);

    // ThrowSprite를 통해 던지기 기능 활용
    this.initThrowSprite();

    // 애니메이션 시작
    this.app.ticker.add(this.update, this);

    // 먹기 완료 Promise 생성
    this.eatingPromise = new Promise<void>((resolve) => {
      this.eatingFinishedResolve = resolve;
    });
  }

  /**
   * 랜덤 음식 텍스처 가져오기
   * @returns 랜덤 선택된 음식 텍스처
   */
  private getRandomFoodTexture(): PIXI.Texture {
    const assets = AssetLoader.getAssets();
    const foodSprites = assets.foodSprites?.textures;

    if (!foodSprites || Object.keys(foodSprites).length === 0) {
      console.warn("Food sprites not loaded or empty. Using fallback texture.");
      return PIXI.Texture.WHITE;
    }

    // 랜덤으로 foodSprites 중 하나 선택
    const foodKeys = Object.keys(foodSprites);
    const randomKey = foodKeys[Math.floor(Math.random() * foodKeys.length)];
    const texture = foodSprites[randomKey];

    if (!texture) {
      console.warn(
        `Texture not found for key: ${randomKey}. Using fallback texture.`
      );
      return PIXI.Texture.WHITE;
    }

    console.log(`Selected random food texture: ${randomKey}`);
    return texture;
  }

  /**
   * ThrowSprite 초기화
   */
  private initThrowSprite(): void {
    this.throwSprite = new ThrowSprite(this.app, this.parent, this.sprite, {
      initialScale: this.initialScale * 0.7, // 음식 크기 조정 적용
      finalScale: this.finalScale * 0.7, // 음식 크기 조정 적용
      duration: this.throwDuration,
      onLanded: (position) => this.onFoodLanded(position),
    });
  }

  /**
   * 음식이 착지했을 때 호출되는 콜백
   */
  private onFoodLanded(position: { x: number; y: number }): void {
    console.log("Food landed at position:", position);
    this.foodState = FoodState.LANDED;

    // 캐릭터가 있으면 음식으로 이동하기 시작
    if (this.options.character) {
      this.startMovingToFood();
    } else {
      // 캐릭터가 없으면 바로 먹기 상태로 전환
      this.startEating();
    }
  }

  /**
   * 업데이트 메서드 - 매 프레임마다 호출
   */
  private update = (deltaTime: number): void => {
    switch (this.foodState) {
      case FoodState.THROWING:
        // ThrowSprite가 처리
        break;
      case FoodState.LANDED:
        // 착지 후 바로 다음 상태로 전환되므로 여기서는 아무것도 하지 않음
        break;
      case FoodState.APPROACHING:
        this.updateApproaching(deltaTime);
        break;
      case FoodState.EATING:
        this.updateEating(deltaTime);
        break;
      case FoodState.FINISHED:
        // 이미 다 먹어서 처리할 필요 없음
        break;
    }
  };

  /**
   * 캐릭터가 음식으로 이동하는 상태 업데이트
   */
  private updateApproaching(deltaTime: number): void {
    if (
      !this.options.character ||
      !this.targetPosition ||
      !this.movementController
    ) {
      return;
    }

    this.movementController.setMoveSpeed(this.options.character.getSpeed());

    // MovementController를 사용하여 캐릭터 이동
    const reachedTarget = this.movementController.moveTo(
      this.targetPosition.x,
      this.targetPosition.y,
      deltaTime
    );

    // 움직이는 동안 항상 음식을 향하도록 방향 설정
    const characterPos = this.options.character.getPosition();
    const foodPos = { x: this.sprite.position.x, y: this.sprite.position.y };
    const directionX = foodPos.x - characterPos.x;
    this.movementController.updateCharacterDirection(directionX);

    // 목표에 도달했으면 먹기 시작
    if (reachedTarget) {
      this.startEating();
      this.options.character.update(CharacterState.EATING);
    }
  }

  /**
   * 음식 먹는 상태 업데이트
   */
  private updateEating(deltaTime: number): void {
    // 경과 시간 계산 (ms)
    const now = Date.now();
    const elapsedEatingTime = now - this.eatingStartTime;

    // 총 먹는 시간 대비 진행률 계산 (0~1)
    const eatingProgress = Math.min(elapsedEatingTime / this.eatingDuration, 1);

    // 마스크 처리
    if (this.foodMask) {
      // 마스크가 표시되고 있는지 확인
      this.foodMask.checkVisibility();

      // 마스크 위치 업데이트
      this.foodMask.updatePosition();

      // 마스크 진행도 업데이트
      this.foodMask.updateProgress(eatingProgress);
    }

    // 다 먹었으면 마무리
    if (eatingProgress >= 1) {
      console.log("음식을 다 먹었습니다. 마무리 처리를 시작합니다.");
      this.finishEating();
    }
  }

  /**
   * 캐릭터가 음식으로 이동하기 시작
   */
  private startMovingToFood(): void {
    this.foodState = FoodState.APPROACHING;

    // 캐릭터의 현재 위치 기준으로 음식의 가까운 쪽 결정
    this.targetPosition = this.getTargetPositionNearFood();

    const moveSpeed = this.options.character.getSpeed();
    this.movementController = new MovementController(
      this.options.character,
      this.app,
      moveSpeed
    );
  }

  /**
   * 음식 근처의 목표 위치 계산
   */
  private getTargetPositionNearFood(): { x: number; y: number } {
    const characterPos = this.options.character.getPosition();
    const foodPos = { x: this.sprite.position.x, y: this.sprite.position.y };

    // 캐릭터가 음식의 왼쪽에 있는지 오른쪽에 있는지 확인
    const isCharacterLeftOfFood = characterPos.x < foodPos.x;

    // 캐릭터의 현재 위치에서 가까운 쪽으로 접근하도록 설정
    // 음식의 좌우 30픽셀 지점을 목표로 설정
    const offsetX = isCharacterLeftOfFood ? -30 : 30;

    return {
      x: foodPos.x + offsetX,
      y: foodPos.y,
    };
  }

  /**
   * 음식 먹기 시작
   */
  private startEating(): void {
    this.foodState = FoodState.EATING;
    this.eatingStartTime = Date.now();

    // 음식 마스크 초기화
    this.initFoodMask();

    // 캐릭터가 있으면 먹는 상태로 변경
    if (this.options.character) {
      this.options.character.update(CharacterState.EATING);
    }
  }

  /**
   * 음식 마스크 초기화
   */
  private initFoodMask(): void {
    // FoodMask 객체 생성 - AssetLoader에서 자동으로 텍스처를 가져옴
    this.foodMask = new FoodMask(this.sprite, this.parent);

    // 마스크 초기화 (AssetLoader에서 가져온 텍스처로 마스크 적용)
    this.foodMask.init();
  }

  /**
   * 음식 먹기 완료
   */
  private finishEating(): void {
    this.foodState = FoodState.FINISHED;

    // 마스크 제거
    if (this.foodMask) {
      this.foodMask.destroy();
      this.foodMask = undefined;
    }

    // 스프라이트 제거
    if (this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
    }

    // 캐릭터 상태 원래대로 복원
    if (this.options.character) {
      this.options.character.update(CharacterState.IDLE);
    }

    // Promise 해결
    if (this.eatingFinishedResolve) {
      this.eatingFinishedResolve();
      this.eatingFinishedResolve = undefined;
    }

    // 게임 tick에서 이 객체 제거
    this.app.ticker.remove(this.update);
  }

  /**
   * 음식 제거 및 정리
   */
  public destroy(): void {
    // 애니메이션 중단
    this.app.ticker.remove(this.update);

    // ThrowSprite 정리
    if (this.throwSprite) {
      this.throwSprite.destroy();
      this.throwSprite = undefined;
    }

    // 마스크 제거
    if (this.foodMask) {
      this.foodMask.destroy();
      this.foodMask = undefined;
    }

    // 음식 스프라이트 제거
    if (this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
    }

    // 캐릭터 상태 복원
    if (this.options.character && this.foodState === FoodState.EATING) {
      this.options.character.update(CharacterState.IDLE);
    }

    // Promise 해결 (아직 해결되지 않은 경우)
    if (this.eatingFinishedResolve) {
      this.eatingFinishedResolve();
      this.eatingFinishedResolve = undefined;
    }
  }

  /**
   * 음식 먹기가 완료될 때까지 기다리는 Promise를 반환합니다.
   * @returns 음식 먹기 완료 시 해결되는 Promise
   */
  public waitForEatingFinished(): Promise<void> {
    return this.eatingPromise;
  }
}
