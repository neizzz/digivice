import * as PIXI from "pixi.js";
import type { Character } from "../entities/Character";
import type { Food } from "../entities/Food";
import { FoodFreshness } from "../entities/Food";
import { CharacterState } from "../types/Character";
import { MovementController } from "../controllers/MovementController";
import { EventBus, EventTypes } from "../utils/EventBus";
import { DebugFlags } from "../utils/DebugFlags";
import { ObjectBase } from "../interfaces/ObjectBase";
import { ObjectType } from "../types/GameData";
import { GameDataManager } from "../managers/GameDataManager";

const STAMINA_RECOVERY = 3; // 스태미나 회복량
const STAMINA_RECOVERY_NORMAL = 1; // 일반 음식 회복량

/**
 * FoodTracker - Food와 Character 간의 상호작용을 관리
 * 이벤트 기반 구조를 통해 두 객체 간의 직접적인 의존성 제거
 */
export class FoodTracker {
  private character: Character;
  private app: PIXI.Application;
  private movementController: MovementController;
  private foodQueue: string[] = []; // 먹을 음식 ID 대기열
  private isMovingToFood = false;
  private eventBus: EventBus;
  private searchInterval: number | null = null; // 주기적 음식 검색 인터벌
  private isSearchingFood = false; // 음식 검색 중인지 여부
  private targetContainer: PIXI.Container; // 음식을 찾을 컨테이너 (MainScene)

  constructor(
    character: Character,
    app: PIXI.Application,
    targetContainer: PIXI.Container
  ) {
    this.character = character;
    this.app = app;
    this.targetContainer = targetContainer;
    this.eventBus = EventBus.getInstance();
    this.movementController = new MovementController(
      this.character,
      this.app,
      this.character.getSpeed()
    );

    // 이벤트 리스너 등록
    this.setupEventListeners();

    // 주기적으로 음식을 찾는 로직 시작
    this.startFoodSearchInterval();
  }

  /**
   * 이벤트 리스너 설정
   */
  private setupEventListeners(): void {
    // Food가 착지했을 때 처리
    this.eventBus.on(EventTypes.Food.FOOD_LANDED, (data) => {
      this.onFoodLanded(data.id);
    });

    // 음식을 다 먹었을 때 처리
    this.eventBus.on(EventTypes.Food.FOOD_EATING_FINISHED, (data) => {
      this.onFoodEatingFinished(data.id, data.freshness);
    });
  }

  /**
   * 주기적으로 음식을 검색하는 인터벌 시작
   */
  private startFoodSearchInterval(): void {
    // 이미 인터벌이 실행 중이면 중단하고 새로 시작
    if (this.searchInterval !== null) {
      clearInterval(this.searchInterval);
    }

    // 3초 간격으로 음식 검색
    this.searchInterval = setInterval(() => {
      this.searchAndProcessFood();
    }, 2000) as unknown as number;
  }

  /**
   * 음식을 검색하고 처리하는 메서드
   */
  private async searchAndProcessFood(): Promise<void> {
    // 이미 검색 중이거나 이동/먹기 중이면 무시
    if (
      this.isSearchingFood ||
      this.isMovingToFood ||
      this.character.getState() === CharacterState.EATING
    ) {
      return;
    }

    try {
      this.isSearchingFood = true;

      // 먼저 스태미나가 최대인지 확인
      const currentStamina = await this.character.getStamina();
      const maxStamina = this.character.getMaxStamina();

      // 스태미나가 이미 최대면 음식을 찾지 않음
      if (currentStamina >= maxStamina) {
        return;
      }

      // 이미 대기열에 음식이 있으면 처리
      if (this.foodQueue.length > 0) {
        this.processNextFood();
        return;
      }

      // MainScene의 직접 자식들만 확인
      const foundFoods: Food[] = [];

      for (const child of this.targetContainer.children) {
        if (!(child instanceof PIXI.Sprite)) {
          continue;
        }

        const objectRef = ObjectBase.getObjectRef(child);
        if (!objectRef) {
          continue; // ObjectBase 참조가 없는 경우 무시
        }

        if (objectRef.getType?.() === ObjectType.Food) {
          foundFoods.push(objectRef as Food); // Food 객체로 캐스팅
        }
      }

      // 찾은 음식들 중에서 상태가 LANDED인 것들만 필터링
      const landedFoods = foundFoods.filter((food) => {
        return food.getState() === 1; // LANDED 상태 (FoodState.LANDED)
      });

      // 먹을 수 있는 음식이 있으면 처리
      if (landedFoods.length > 0) {
        // 가장 좋은 음식 찾기 (신선도와 거리를 모두 고려)
        const bestFood = this.findBestFood(landedFoods);

        if (bestFood) {
          const foodId = bestFood.getId();

          // GameDataManager에서 이미 해당 음식 ID가 있는지 확인
          const gameData = await GameDataManager.getData();
          const foodExists = gameData?.objectsMap?.[ObjectType.Food]?.some(
            (food) => food.id === foodId
          );

          if (foodExists && !this.foodQueue.includes(foodId)) {
            this.foodQueue.push(foodId);
            console.log(
              `[FoodTracker] 가장 좋은 음식을 찾아 대기열에 추가했습니다: ${foodId}`
            );

            // 이동 상태가 아니고 먹는 중이 아니면 음식으로 이동 시작
            if (
              !this.isMovingToFood &&
              this.character.getState() !== CharacterState.EATING
            ) {
              this.processNextFood();
            }
          }
        }
      }
    } catch (error) {
      console.error("[FoodTracker] 음식 검색 중 오류:", error);
    } finally {
      this.isSearchingFood = false;
    }
  }

  /**
   * 가장 좋은 음식 찾기 (신선도와 거리를 고려)
   * - 신선한 음식 > 보통 음식
   * - 동일한 신선도 내에서는 가장 가까운 음식 선택
   */
  private findBestFood(foods: Food[]): Food | null {
    if (foods.length === 0) return null;

    // 신선도별로 음식 그룹화
    const freshFoods: Food[] = [];
    const normalFoods: Food[] = [];

    for (const food of foods) {
      const freshness = food.getFreshness();
      if (freshness === FoodFreshness.FRESH) {
        freshFoods.push(food);
      } else if (freshness === FoodFreshness.NORMAL) {
        normalFoods.push(food);
      }
      // STALE 음식은 무시
    }

    // 캐릭터 위치
    const characterPos = this.character.getPosition();

    // 거리 계산 함수
    const calculateDistance = (food: Food): number => {
      const foodPos = food.getPosition();
      return Math.sqrt(
        (foodPos.x - characterPos.x) ** 2 + (foodPos.y - characterPos.y) ** 2
      );
    };

    // 가장 가까운 신선한 음식 찾기
    if (freshFoods.length > 0) {
      return freshFoods.sort(
        (a, b) => calculateDistance(a) - calculateDistance(b)
      )[0];
    }

    // 신선한 음식이 없으면 가장 가까운 보통 음식 찾기
    if (normalFoods.length > 0) {
      return normalFoods.sort(
        (a, b) => calculateDistance(a) - calculateDistance(b)
      )[0];
    }

    return null;
  }

  /**
   * Food가 착지했을 때 호출되는 핸들러
   */
  private onFoodLanded(foodId: string): void {
    // GameDataManager에서 해당 Food가 존재하는지 확인
    GameDataManager.getData().then((gameData) => {
      // Food 존재 여부 확인
      if (
        !gameData?.objectsMap?.[ObjectType.Food]?.some(
          (food) => food.id === foodId
        )
      ) {
        console.warn(
          `Food ${foodId} not found in GameDataManager, trying to add it`
        );

        let foundFood: Food | null = null;
        foundFood = this.findFoodById(foodId) || null;
      }

      // 디버그 모드에서 음식 먹기가 방지된 경우 무시
      if (DebugFlags.getInstance().isEatingPrevented()) {
        console.log(
          "[FoodTracker] 디버그 모드: preventEating 플래그가 활성화되어 음식을 처리하지 않습니다."
        );
        return;
      }

      // 씬에서 해당 ID의 Food 객체 찾기
      let food: Food | null = null;
      food = this.findFoodById(foodId) || null;

      if (!food) {
        console.warn(`Food object ${foodId} not found in scene`);
        return;
      }

      // 상한 음식은 먹지 않음
      if (food.getFreshness() === FoodFreshness.STALE) {
        console.log("상한 음식은 먹을 수 없습니다.");
        return;
      }

      // 음식 대기열에 추가
      if (!this.foodQueue.includes(foodId)) {
        this.foodQueue.push(foodId);
        console.log(
          `[FoodTracker] 음식이 대기열에 추가되었습니다. 현재 대기열 길이: ${this.foodQueue.length}`
        );

        // 현재 먹거나 이동 중이 아닐 때만 처리
        if (
          this.character.getState() !== CharacterState.EATING &&
          !this.isMovingToFood
        ) {
          this.processNextFood();
        }
      }
    });
  }

  /**
   * 대기열에서 다음 음식 처리
   */
  private async processNextFood(): Promise<void> {
    // 대기열이 비어있거나 이미 처리 중이면 무시
    if (this.foodQueue.length === 0 || this.isMovingToFood) {
      return;
    }

    try {
      // 음식을 먹기 위해 이동 중임을 표시
      this.isMovingToFood = true;

      // 대기열의 첫 번째 음식 ID 가져오기
      const foodId = this.foodQueue[0];

      // 씬에서 해당 ID의 Food 객체 찾기
      const food = this.findFoodById(foodId);

      if (!food) {
        console.warn(
          `[FoodTracker] Food ${foodId} not found in scene, removing from queue`
        );
        this.foodQueue.shift();
        this.isMovingToFood = false;
        this.processNextFood();
        return;
      }

      // 캐릭터의 랜덤 움직임 비활성화
      this.character.disableRandomMovement();
      await this.moveCharacterToFood(food);

      try {
        await food.waitForEatingFinished();
        // 대기열에서 제거
        this.foodQueue.shift();
      } catch (error) {
        console.error("[FoodTracker] 음식 먹기 중 오류 발생:", error);
        // 오류가 발생한 음식은 대기열에서 제거
        this.foodQueue.shift();
      }
    } finally {
      // 이동/식사 상태 플래그 초기화
      this.isMovingToFood = false;

      // 다음 음식이 있고 현재 먹는 중이 아니라면 다음 음식 처리
      if (
        this.foodQueue.length > 0 &&
        this.character.getState() !== CharacterState.EATING
      ) {
        // 다음 프레임에서 처리하여 상태가 제대로 업데이트되도록 함
        setTimeout(() => this.processNextFood(), 0);
      }
    }
  }

  /**
   * 캐릭터를 음식으로 이동시키는 로직
   */
  private async moveCharacterToFood(food: Food): Promise<void> {
    return new Promise<void>((resolve) => {
      // NOTE: 접근할 음식을 찾았을 때
      this.character.discoverEmotion();
      // 음식의 상태를 "접근 중"으로 변경
      food.setState(4); // FoodState.APPROACHING과 동일한 값

      // 캐릭터가 음식에 접근할 목표 위치 계산
      const targetPosition = this.getTargetPositionNearFood(food);

      // MovementController 속도 업데이트
      this.movementController.setMoveSpeed(this.character.getSpeed());

      // 목표 위치로 이동을 시작하는 틱 함수 정의
      const moveToFoodTick = (deltaTime: number) => {
        // 디버그 플래그 확인
        if (DebugFlags.getInstance().isEatingPrevented()) {
          console.log(
            "디버그 모드: preventEating 플래그가 활성화되어 음식으로의 이동을 중단합니다."
          );

          // 캐릭터 상태 원래대로 복원하고 랜덤 움직임 다시 활성화
          this.character.setState(CharacterState.IDLE, true);
          this.character.enableRandomMovement();

          // 음식 상태를 LANDED로 되돌림 (상태값 1)
          food.setState(1); // FoodState.LANDED와 동일한 값

          // 틱 제거 및 Promise 해결
          this.app.ticker.remove(moveToFoodTick);
          resolve();
          return;
        }

        // 이동 중에 음식이 상한 상태인지 확인
        if (food.getFreshness() === FoodFreshness.STALE) {
          console.log("[FoodTracker] 음식이 상했습니다. 이동을 중단합니다.");

          // 캐릭터 상태 원래대로 복원하고 랜덤 움직임 다시 활성화
          this.character.setState(CharacterState.IDLE, true);
          this.character.enableRandomMovement();

          // 음식 상태를 LANDED로 되돌림
          food.setState(1); // FoodState.LANDED와 동일한 값

          // 대기열에서 해당 음식 제거
          const foodId = food.getId();
          const index = this.foodQueue.indexOf(foodId);
          if (index > -1) {
            this.foodQueue.splice(index, 1);
          }

          // 틱 제거 및 Promise 해결
          this.app.ticker.remove(moveToFoodTick);
          resolve();

          // 다음 음식이 있으면 처리 (다음 프레임에서 처리)
          setTimeout(() => {
            this.isMovingToFood = false; // 중요: 이동 상태 초기화
            this.processNextFood();
          }, 0);

          return;
        }

        // MovementController를 사용하여 캐릭터 이동
        const reachedTarget = this.movementController.moveTo(
          targetPosition.x,
          targetPosition.y,
          deltaTime
        );

        // 움직이는 동안 항상 음식을 향하도록 방향 설정
        const characterPos = this.character.getPosition();
        const foodPos = food.getPosition();
        const directionX = foodPos.x - characterPos.x;
        this.movementController.updateCharacterDirection(directionX);

        // 목표에 도달했으면 먹기 시작
        if (reachedTarget) {
          this.app.ticker.remove(moveToFoodTick);

          // 마지막 순간에 음식이 상한 상태인지 다시 확인
          if (food.getFreshness() === FoodFreshness.STALE) {
            console.log("[FoodTracker] 음식이 상했습니다. 먹지 않습니다.");

            // 캐릭터 상태 원래대로 복원하고 랜덤 움직임 다시 활성화
            this.character.setState(CharacterState.IDLE, true);
            this.character.enableRandomMovement();

            // 음식 상태를 LANDED로 되돌림
            food.setState(1); // FoodState.LANDED와 동일한 값

            // 대기열에서 해당 음식 제거
            const foodId = food.getId();
            const index = this.foodQueue.indexOf(foodId);
            if (index > -1) {
              this.foodQueue.splice(index, 1);
            }

            // Promise 해결
            resolve();

            // 다음 음식이 있으면 처리 (다음 프레임에서 처리)
            setTimeout(() => {
              this.isMovingToFood = false; // 중요: 이동 상태 초기화
              this.processNextFood();
            }, 0);
          } else {
            // 음식이 상하지 않았으면 먹기 시작
            this.character.setState(CharacterState.EATING);
            food.startEating();
            resolve();
          }
        }
      };

      // 틱 함수 등록
      this.app.ticker.add(moveToFoodTick);
    });
  }

  /**
   * 음식 근처의 목표 위치 계산
   */
  private getTargetPositionNearFood(food: Food): { x: number; y: number } {
    const characterPos = this.character.getPosition();
    const foodPos = food.getPosition();

    // 캐릭터가 음식의 왼쪽에 있는지 오른쪽에 있는지 확인
    const isCharacterLeftOfFood = characterPos.x < foodPos.x;
    const offsetX = isCharacterLeftOfFood ? -15 : 15;
    const offsetY = -15;

    return {
      x: foodPos.x + offsetX,
      y: foodPos.y + offsetY,
    };
  }

  /**
   * 음식을 다 먹었을 때 호출되는 핸들러
   */
  private onFoodEatingFinished(foodId: string, freshness: FoodFreshness): void {
    console.log(
      `[FoodTracker] 음식 ID: ${foodId} 먹기 완료, 신선도: ${freshness}`
    );

    // 신선도에 따른 스태미나 회복량 결정
    const staminaRecovery: number = (() => {
      if (freshness === FoodFreshness.FRESH) {
        return STAMINA_RECOVERY; // 신선한 음식: 스태미나 +3
      }
      if (freshness === FoodFreshness.NORMAL) {
        return STAMINA_RECOVERY_NORMAL; // 일반 음식: 스태미나 +1
      }
      return 0;
    })();

    this.character.increaseStamina(staminaRecovery);
    console.log(
      `[FoodTracker] 음식을 먹고 스태미나가 ${staminaRecovery} 회복되었습니다.`
    );

    // 캐릭터 상태 변경 및 랜덤 움직임 다시 활성
    this.character.setState(CharacterState.IDLE, true);
    this.character.enableRandomMovement();

    // 씬에서 해당 ID의 Food 객체 찾기 (신선도 상태 체크를 위해)
    const food = this.findFoodById(foodId);
    if (food) {
      // 신선도 변화 일시정지 상태 확인
      console.log(
        `[FoodTracker] 음식 ${foodId}의 신선도 변화 상태: ${
          this.checkFoodFreshnessPauseState(food) ? "일시정지됨" : "활성화됨"
        }`
      );
    }
  }

  private findFoodById(foodId: string): Food | undefined {
    for (const child of this.targetContainer.children) {
      if (!(child instanceof PIXI.Sprite)) continue;
      const objectRef = ObjectBase.getObjectRef(child);
      if (!objectRef || objectRef.getType() !== ObjectType.Food) continue;
      const food = objectRef as Food;
      if (food.getId() === foodId) {
        return food;
      }
    }
    return undefined;
  }

  /**
   * 음식의 신선도 변화 일시정지 상태 확인
   */
  private checkFoodFreshnessPauseState(food: Food): boolean {
    try {
      // Food 클래스에 isPausedState 메서드가 있을 경우에만 호출
      if (
        food &&
        "isPausedState" in food &&
        typeof food.isPausedState === "function"
      ) {
        return food.isPausedState();
      }
      return false;
    } catch (error) {
      console.error("[FoodTracker] 음식 신선도 변화 상태 확인 중 오류:", error);
      return false;
    }
  }

  /**
   * FoodTracker 정리
   */
  public destroy(): void {
    // EventBus 이벤트 구독 해제
    const eventBus = EventBus.getInstance();
    eventBus.off(EventTypes.Food.FOOD_LANDED);
    eventBus.off(EventTypes.Food.FOOD_EATING_STARTED);
    eventBus.off(EventTypes.Food.FOOD_EATING_FINISHED);
    eventBus.off(EventTypes.Food.FOOD_CREATED);
  }
}
