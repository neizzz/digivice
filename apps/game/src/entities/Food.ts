import * as PIXI from "pixi.js";
import { MovementController } from "../controllers/MovementController";
import type { Character } from "./Character";
import { CharacterState } from "../types/Character";
import { FoodMask } from "../utils/FoodMask";
import { ThrowSprite } from "../utils/ThrowSprite";
import { AssetLoader } from "../utils/AssetLoader";
import { FreshnessDuration } from "../utils/FreshnessDuration";
import { SparkleEffect } from "../effects/SparkleEffect";
import { ColorMatrixFilter } from "@pixi/filter-color-matrix";
import type { Cleanable } from "../interfaces/Cleanable";

// 음식 상태를 나타내는 enum
enum FoodState {
  THROWING = 0, // 던져지는 중
  LANDED = 1, // 착지됨
  EATING = 2, // 먹는 중
  FINISHED = 3, // 다 먹음
  APPROACHING = 4, // 캐릭터가 음식으로 접근 중
  CLEANING = 5, // 청소 중
  CLEANED = 6, // 청소 완료
}

// 음식 신선도 상태를 나타내는 enum
export enum FoodFreshness {
  FRESH = 0, // 신선한 상태
  NORMAL = 1, // 보통 상태
  STALE = 2, // 상한 상태
}

export interface FoodOptions {
  character: Character; // 음식을 먹을 캐릭터 객체 (선택사항)
  freshness?: FoodFreshness; // 음식의 신선도 상태 (선택사항, 기본값: FRESH)
}

/**
 * 음식 클래스 - 음식의 생명주기(던지기, 착지, 먹기)를 관리
 */
export class Food implements Cleanable {
  private sprite: PIXI.Sprite;
  private app: PIXI.Application;
  private parent: PIXI.Container;
  private options: FoodOptions;
  private foodState: FoodState = FoodState.THROWING;
  private freshness: FoodFreshness;
  private eatingStartTime = 0;
  private eatingDuration = 4000; // 기본값: 4초
  private targetPosition?: { x: number; y: number }; // 캐릭터가 이동할 목표 위치
  private movementController?: MovementController;
  private freshnessDuration: FreshnessDuration; // 신선도 지속 시간 관리 객체

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

  // SparkleEffect 객체
  private sparkleEffect?: SparkleEffect;

  // 청소 관련 변수
  private cleanProgress = 0;
  private cleaningThreshold = 0.8; // 80% 이상 청소되면 완료로 간주

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

    // 신선도 설정 (기본값: FRESH)
    this.freshness = options.freshness ?? FoodFreshness.FRESH;

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

    // FreshnessDuration 초기화 - 신선도 변경시 콜백 설정
    this.freshnessDuration = new FreshnessDuration((newFreshness) => {
      this.setFreshness(newFreshness);
    }, this.freshness);

    // 초기 신선도에 맞는 시각적 효과 적용
    this.applyFreshnessVisualEffect();

    // SparkleEffect 초기화
    this.initSparkleEffect();

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
   * 음식의 신선도 상태 설정
   * @param freshness 설정할 신선도 상태
   */
  public setFreshness(freshness: FoodFreshness): void {
    this.freshness = freshness;
    this.applyFreshnessVisualEffect();
    this.updateSparkleEffect();
  }

  /**
   * 현재 신선도 상태 반환
   * @returns 현재 신선도 상태
   */
  public getFreshness(): FoodFreshness {
    return this.freshness;
  }

  /**
   * 신선도 상태에 따른 시각적 효과 적용
   */
  private applyFreshnessVisualEffect(): void {
    switch (this.freshness) {
      case FoodFreshness.FRESH:
        // 신선한 상태: 필터 없음 (원래 색상), 반짝임 효과는 updateSparkleEffect()에서 처리
        this.sprite.filters = [];
        break;

      case FoodFreshness.NORMAL:
        // 보통 상태: 필터 없음 (원래 색상)
        this.sprite.filters = [];
        break;

      case FoodFreshness.STALE: {
        // 상한 상태: 회색빛 + 약간 어둡게 처리
        this.sprite.filters = [new ColorMatrixFilter()];
        const staleFilter = this.sprite.filters[0] as ColorMatrixFilter;
        staleFilter.brightness(0.5, false); // 약간 어둡게
        staleFilter.desaturate(); // 채도 낮추기 (회색빛)
        break;
      }
    }
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
   * SparkleEffect 초기화
   */
  private initSparkleEffect(): void {
    this.sparkleEffect = new SparkleEffect(this.sprite, this.parent, this.app);

    // 현재 신선도 상태에 따라 반짝임 효과를 켜거나 끔
    this.updateSparkleEffect();
  }

  /**
   * 신선도 상태에 따라 반짝임 효과 업데이트
   */
  private updateSparkleEffect(): void {
    if (!this.sparkleEffect) return;

    // Fresh 상태일 때만 반짝이는 효과 활성화
    if (this.freshness === FoodFreshness.FRESH) {
      this.sparkleEffect.start();
    } else {
      this.sparkleEffect.stop();
    }
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
      case FoodState.CLEANING:
        // 청소 중일 때는 별도 처리 없음
        break;
      case FoodState.CLEANED:
        // 청소 완료 상태에서는 처리할 필요 없음
        break;
    }

    // 상태가 FINISHED 또는 CLEANED가 아닐 경우에만 신선도 업데이트
    if (
      this.foodState !== FoodState.FINISHED &&
      this.foodState !== FoodState.CLEANED
    ) {
      // 신선도 상태 업데이트
      this.freshnessDuration.update();
    }

    // zIndex를 position.y 값으로 설정하여 깊이 정렬
    this.sprite.zIndex = this.sprite.position.y;
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

    // SparkleEffect 제거
    if (this.sparkleEffect) {
      this.sparkleEffect.stop();
      this.sparkleEffect = undefined;
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

    // SparkleEffect 제거
    if (this.sparkleEffect) {
      this.sparkleEffect.stop();
      this.sparkleEffect = undefined;
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

  /**
   * 청소 진행도를 업데이트합니다. (Cleanable 인터페이스 구현)
   * @param progress 0-1 사이의 청소 진행도
   * @returns 청소 완료 여부
   */
  public updateCleanProgress(progress: number): boolean {
    // 이미 청소가 완료되었거나 먹는 중이거나 던져지는 중이면 청소 불가
    if (
      this.foodState === FoodState.CLEANED ||
      this.foodState === FoodState.EATING ||
      this.foodState === FoodState.THROWING
    ) {
      return true;
    }

    // 청소 상태로 전환
    if (this.foodState !== FoodState.CLEANING && progress > 0) {
      this.foodState = FoodState.CLEANING;
    }

    if (this.foodState === FoodState.CLEANING) {
      this.cleanProgress = progress;

      // 청소가 진행될수록 투명해짐
      this.sprite.alpha = 1.0 - progress * 0.7;

      // 임계값에 도달하면 청소 완료
      if (progress >= this.cleaningThreshold) {
        this.finishCleaning();
        return true;
      }
    }

    return false;
  }

  /**
   * 청소를 완료합니다. (Cleanable 인터페이스 구현)
   */
  public finishCleaning(): void {
    if (this.foodState === FoodState.CLEANED) {
      return;
    }

    this.foodState = FoodState.CLEANED;

    // 스프라이트 제거
    if (this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
    }

    // SparkleEffect 제거
    if (this.sparkleEffect) {
      this.sparkleEffect.stop();
      this.sparkleEffect = undefined;
    }

    // 애니메이션 중단
    this.app.ticker.remove(this.update);

    // 상태가 변경되었음을 콘솔에 기록
    console.log("음식이 청소되었습니다.");
  }

  /**
   * 객체의 위치를 반환합니다. (Cleanable 인터페이스 구현)
   */
  public getPosition(): { x: number; y: number } {
    return { x: this.sprite.position.x, y: this.sprite.position.y };
  }

  /**
   * 객체의 스프라이트를 반환합니다. (Cleanable 인터페이스 구현)
   */
  public getSprite(): PIXI.Sprite {
    return this.sprite;
  }
}
