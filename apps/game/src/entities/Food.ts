import * as PIXI from "pixi.js";

import type { FoodMask } from "../utils/FoodMask";
import { ThrowSprite } from "../utils/ThrowSprite";
import { AssetLoader } from "../utils/AssetLoader";
import { SparkleEffect } from "../effects/SparkleEffect";
import { ColorMatrixFilter } from "@pixi/filter-color-matrix";
import { DebugFlags } from "../utils/DebugFlags";
import { EventBus, EventTypes } from "../utils/EventBus";
import { FreshnessManager } from "../managers/FreshnessManager";
import { FOOD_FRESHNESS, INTENTED_FRONT_Z_INDEX } from "../config";
import { type ObjectData, ObjectType } from "../types/GameData";
import { ObjectBase } from "../interfaces/ObjectBase";
import { Cleanable } from "../interfaces/Cleanable";

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
  data: ObjectData[ObjectType.Food]; // 음식 데이터
}

/**
 * 음식 클래스 - 음식의 생명주기(던지기, 착지, 먹기)를 관리
 */
export class Food extends Cleanable {
  private sprite: PIXI.Sprite;
  private app: PIXI.Application;
  // private parent: PIXI.Container;
  private state: FoodState = FoodState.THROWING;
  private freshness: FoodFreshness;
  private eatingStartTime = 0;
  private eatingDuration = 4000; // 기본값: 4초
  private freshnessManager: FreshnessManager; // 신선도 지속 시간 관리 객체

  // 음식 마스크 처리를 위한 객체
  private foodMask?: FoodMask;

  // Promise 관련 변수
  private eatingFinishedResolve?: () => void;
  private eatingPromise: Promise<void>;

  // ThrowSprite 객체
  private throwSprite?: ThrowSprite;

  // 음식 기본 크기 설정
  private initialScale = 2.8;
  private finalScale = 1.3;
  private throwDuration = 1000; // 1초간 던지기 애니메이션

  // SparkleEffect 객체
  private sparkleEffect?: SparkleEffect;

  /**
   * @param app PIXI 애플리케이션
   * @param parent 부모 컨테이너
   * @param options 음식 옵션
   */
  constructor(
    app: PIXI.Application,
    // parent: PIXI.Container,
    options?: FoodOptions
  ) {
    super(options?.data.id); // 'food' prefix로 ID 생성
    this.app = app;
    // this.parent = parent;

    const data = options?.data;
    const texture = this.getFoodTexture(data?.textureKey);

    // 신선도 계산: createdAt과 현재 시각 차이로 freshness 결정
    const createdAt = data?._createdAt ?? Date.now();
    const elapsed = Date.now() - createdAt;
    if (elapsed < FOOD_FRESHNESS.FRESH_DURATION) {
      this.freshness = FoodFreshness.FRESH;
    } else if (
      elapsed <
      FOOD_FRESHNESS.FRESH_DURATION + FOOD_FRESHNESS.NORMAL_DURATION
    ) {
      this.freshness = FoodFreshness.NORMAL;
    } else {
      this.freshness = FoodFreshness.STALE;
    }

    // 스프라이트 생성 및 초기 설정
    this.sprite = new PIXI.Sprite(texture);
    this.sprite.anchor.set(0.5);
    ObjectBase.attachObjectRef(this.sprite, this);

    if (data?.position) {
      this.sprite.scale.set(this.finalScale);
      this.sprite.position.set(data.position.x, data.position.y);
      this.sprite.zIndex = data.position.y; // 깊이 정렬을 위해 y값으로 zIndex 설정
      // this.parent.addChild(this.sprite);
    } else {
      // ThrowSprite를 통해 던지기 기능 활용
      this.sprite.scale.set(this.initialScale);
      this._initThrowSprite();
    }

    this.freshnessManager = new FreshnessManager(
      (newFreshness) => {
        this.setFreshness(newFreshness);
      },
      this.id, // 음식 ID 전달
      createdAt
    );

    // 초기 신선도에 맞는 시각적 효과 적용
    this._applyFreshnessVisualEffect();

    // SparkleEffect 초기화
    this._initSparkleEffect();

    // 애니메이션 시작
    this.app.ticker.add(this.update, this);

    // 먹기 완료 Promise 생성
    this.eatingPromise = new Promise<void>((resolve) => {
      this.eatingFinishedResolve = resolve;
    });
  }

  public getType() {
    return ObjectType.Food;
  }
  public getId(): string {
    return this.id;
  }

  /**
   * 청소 시작 시 호출되는 메서드
   * @override
   */
  protected onCleaningStart(): void {
    this.state = FoodState.CLEANING;
  }

  /**
   * 청소 진행 중 호출되는 메서드
   * @override
   */
  protected onCleaningProgress(progress: number): void {
    // 투명도 조절 (청소가 진행될수록 점점 투명해짐)
    this.sprite.alpha = 1.0 - progress * 0.8; // 80%까지만 투명하게
  }

  /**
   * 청소가 완료될 때 호출되는 메서드
   * @override
   */
  protected onCleaningFinish(): void {
    this.state = FoodState.CLEANED;

    // 효과음 재생 등 추가 기능 구현 가능

    // 스프라이트 제거
    if (this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
    }
  }

  /**
   * 랜덤 음식 텍스처 가져오기
   * @returns 랜덤 선택된 음식 텍스처
   */
  private getFoodTexture(textureKey?: string): PIXI.Texture {
    const assets = AssetLoader.getAssets();
    const foodSprites = assets.foodSprites?.textures;

    // textureKey가 제공된 경우 해당 텍스처 반환
    if (textureKey) {
      return foodSprites?.[textureKey];
    }

    // 랜덤으로 foodSprites 중 하나 선택
    const foodKeys = Object.keys(foodSprites);
    const randomKey = foodKeys[Math.floor(Math.random() * foodKeys.length)];
    const texture = foodSprites[randomKey];

    console.log(`[Food] Selected random food texture: ${randomKey}`);
    return texture;
  }

  /**
   * 음식의 신선도 상태 설정
   * @param freshness 설정할 신선도 상태
   */
  public setFreshness(freshness: FoodFreshness): void {
    // 이미 먹기 시작(EATING) 또는 다 먹은(FINISHED) 상태라면 신선도 변경 금지
    if (this.state === FoodState.EATING || this.state === FoodState.FINISHED) {
      return;
    }
    this.freshness = freshness;
    this._applyFreshnessVisualEffect();
    this._updateSparkleEffect();
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
  private _applyFreshnessVisualEffect(): void {
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
  private _initThrowSprite(): void {
    // 선택된 음식 텍스처 이름 가져오기
    const foodTextureName = this.sprite.texture.textureCacheIds[0] || "unknown";

    // this.throwSprite = new ThrowSprite(this.app, this.parent, this.sprite, {
    this.throwSprite = new ThrowSprite(this.app, this.sprite, {
      initialScale: this.initialScale, // 음식 크기 조정 적용
      finalScale: this.finalScale, // 음식 크기 조정 적용
      duration: this.throwDuration,
      onLanded: (position) => this.onFoodLanded(position),
      onThrowStart: (finalPosition, textureKey) =>
        this.onThrowStart(finalPosition, textureKey),
      foodTextureName: foodTextureName, // 음식 텍스처 이름 전달
    });
  }

  /**
   * SparkleEffect 초기화
   */
  private _initSparkleEffect(): void {
    // this.sprite.updateTransform();
    this.sparkleEffect = new SparkleEffect(this.sprite, this.app);

    // 현재 신선도 상태에 따라 반짝임 효과를 켜거나 끔
    this._updateSparkleEffect();
  }

  /**
   * 신선도 상태에 따라 반짝임 효과 업데이트
   */
  private _updateSparkleEffect(): void {
    if (!this.sparkleEffect) return;

    // Fresh 상태일 때만 반짝이는 효과 활성화
    if (this.freshness === FoodFreshness.FRESH) {
      this.sparkleEffect.start();
    } else {
      this.sparkleEffect.stop();
    }
  }

  private onThrowStart(
    finalPosition: { x: number; y: number },
    textureKey: string
  ) {
    console.log("[Food] Throw started with texture:", textureKey);
    this.state = FoodState.THROWING;

    // Object.CREATED 이벤트 발행
    EventBus.publish(EventTypes.Object.OBJECT_CREATED, {
      type: ObjectType.Food,
      id: this.getId(),
      position: finalPosition,
      textureKey: textureKey,
    });
  }

  /**
   * 음식이 착지했을 때 호출되는 콜백
   */
  private onFoodLanded(position: { x: number; y: number }): void {
    console.log("[Food] Food landed at position:", position);
    this.state = FoodState.LANDED;

    // 디버그 모드에서 음식 먹기가 방지된 경우 먹지 않음
    if (DebugFlags.getInstance().isEatingPrevented()) {
      console.log(
        "[Food] 디버그 모드: preventEating 플래그가 활성화되어 음식에 접근하지 않습니다."
      );
      return;
    }

    // 상한 음식이 아닌 경우에만 착지 이벤트 발생
    if (this.freshness !== FoodFreshness.STALE) {
      // FOOD_LANDED 이벤트 발행 - FoodTracker가 이 이벤트를 수신하여 캐릭터를 관리
      EventBus.publish(EventTypes.Food.FOOD_LANDED, {
        id: this.id,
        position: position,
      });
    } else {
      console.log("상한 음식은 먹을 수 없습니다.");
    }
  }

  /**
   * 신선도 변화를 일시정지합니다.
   * 음식을 먹기 시작했을 때 호출하여 상태가 변하지 않도록 합니다.
   */
  public pauseFreshnessChange(): void {
    if (this.freshnessManager) {
      this.freshnessManager.pauseFreshnessChange();
    }
  }

  /**
   * 신선도 변화를 재개합니다.
   */
  public resumeFreshnessChange(): void {
    if (this.freshnessManager) {
      this.freshnessManager.resumeFreshnessChange();
    }
  }

  /**
   * 신선도 변화가 일시정지된 상태인지 확인합니다.
   * @returns 신선도 변화가 일시정지되었으면 true, 아니면 false
   */
  public isPausedState(): boolean {
    return this.freshnessManager
      ? this.freshnessManager.isPausedState()
      : false;
  }

  /**
   * 음식 먹기 시작
   */
  public startEating(): void {
    this.state = FoodState.EATING;
    this.eatingStartTime = Date.now();

    // 음식 먹기 시작 시 신선도 변화 일시정지
    this.pauseFreshnessChange();

    // 음식 마스크 초기화
    // this.foodMask = new FoodMask(this.sprite);
    // this.foodMask.init();

    // FOOD_EATING_STARTED 이벤트 발행
    // EventBus.publish(EventTypes.Food.FOOD_EATING_STARTED, {
    //   id: this.id,
    //   position: { x: this.sprite.position.x, y: this.sprite.position.y },
    // });
  }

  /**
   * 업데이트 메서드 - 매 프레임마다 호출
   */
  private update = (deltaTime: number): void => {
    switch (this.state) {
      case FoodState.THROWING:
        // ThrowSprite가 처리
        break;
      case FoodState.LANDED:
        // 착지 후 바로 다음 상태로 전환되므로 여기서는 아무것도 하지 않음
        break;
      case FoodState.APPROACHING:
        // FoodTracker에서 처리
        break;
      case FoodState.EATING:
        this.updateEating();
        break;
      case FoodState.FINISHED:
        // 이미 다 먹어서 처리할 필요 없음
        break;
    }

    if (this.state !== FoodState.FINISHED && this.state !== FoodState.CLEANED) {
      // 신선도 상태 업데이트
      this.freshnessManager.update();
    }
    if (this.sprite.zIndex !== INTENTED_FRONT_Z_INDEX) {
      this.sprite.zIndex = this.sprite.position.y;
    }
  };

  /**
   * 음식 먹는 상태 업데이트
   */
  private updateEating(): void {
    // 디버그 플래그가 활성화된 경우 먹기 방지
    if (DebugFlags.getInstance().isEatingPrevented()) {
      // 음식 먹기가 방지된 상태이면 진행하지 않음
      return;
    }

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
      this.finishEating();
    }
  }

  /**
   * 음식 먹기 완료
   */
  private finishEating(): void {
    this.state = FoodState.FINISHED;

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

    // // FOOD_EATING_FINISHED 이벤트 발행
    // EventBus.publish(EventTypes.Food.FOOD_EATING_FINISHED, {
    //   id: this.getId(),
    //   freshness: this.freshness,
    // });

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
   * 현재 상태를 반환합니다.
   */
  public getState(): FoodState {
    return this.state;
  }

  /**
   * 상태를 설정합니다.
   */
  public setState(newState: FoodState): void {
    this.state = newState;
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
