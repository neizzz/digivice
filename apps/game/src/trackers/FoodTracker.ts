import type * as PIXI from "pixi.js";
import type { Character } from "../entities/Character";
import { Food } from "../entities/Food";
import { FoodFreshness } from "../entities/Food";
import { CharacterState } from "../types/Character";
import { MovementController } from "../controllers/MovementController";
import { EventBus, EventTypes } from "../utils/EventBus";
import { DebugFlags } from "../utils/DebugFlags";

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
  private foodMap: Map<string, Food> = new Map();
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
    this.eventBus.on(EventTypes.FOOD_LANDED, (data) => {
      this.onFoodLanded(data.foodId, data.position, data.freshness);
    });

    // 음식을 먹기 시작했을 때 처리
    this.eventBus.on(EventTypes.FOOD_EATING_STARTED, (data) => {
      this.onFoodEatingStarted(data.foodId);
    });

    // 음식을 다 먹었을 때 처리
    this.eventBus.on(EventTypes.FOOD_EATING_FINISHED, (data) => {
      this.onFoodEatingFinished(data.foodId, data.freshness);
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
    }, 3000) as unknown as number;
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
        // Food.isFood() 메서드를 사용하여 Food 객체인지 확인
        if (Food.isFood(child)) {
          // Food.extractObject()로 객체 추출
          const foodObj = Food.extractObject(child);
          if (foodObj) {
            foundFoods.push(foodObj);
          }
        }
      }

      // 찾은 음식들 중에서 상태가 LANDED인 것들만 필터링
      const landedFoods = foundFoods.filter((food) => {
        return food.getState() === 1; // LANDED 상태 (FoodState.LANDED)
      });

      // 먹을 수 있는 음식이 있으면 처리
      if (landedFoods.length > 0) {
        console.log(
          `${landedFoods.length}개의 먹을 수 있는 음식을 찾았습니다.`
        );

        // 가장 좋은 음식 찾기 (신선도와 거리를 모두 고려)
        const bestFood = this.findBestFood(landedFoods);

        if (bestFood) {
          const foodId = bestFood.getId();
          if (!this.foodMap.has(foodId)) {
            this.addFood(bestFood);
            this.foodQueue.push(foodId);
            console.log(
              `가장 좋은 음식을 찾아 대기열에 추가했습니다: ${foodId}`
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
      console.error("음식 검색 중 오류:", error);
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
   * Food 객체 추가
   */
  public addFood(food: Food): void {
    this.foodMap.set(food.getId(), food);
  }

  /**
   * Food가 착지했을 때 호출되는 핸들러
   */
  private onFoodLanded(
    foodId: string,
    position: { x: number; y: number },
    freshness: FoodFreshness
  ): void {
    console.log(`Food ${foodId} landed at position:`, position);

    // 이미 추적 중인 음식인지 확인
    if (!this.foodMap.has(foodId)) {
      console.warn(`Food ${foodId} not found in tracker, trying to add it`);

      let foundFood: Food | null = null;

      // MainScene의 직접 자식들만 확인
      for (const child of this.targetContainer.children) {
        // Food.isFood()로 Food 객체인지 확인하고, extractObject()로 객체 추출
        if (Food.isFood(child)) {
          const foodObj = Food.extractObject(child);
          if (foodObj && foodObj.getId() === foodId) {
            foundFood = foodObj;
            break; // 찾았으면 반복 중단
          }
        }
      }

      if (foundFood) {
        // Food 객체를 찾았다면 등록
        this.addFood(foundFood);
        console.log(`Found and added Food ${foodId} to tracker`);
      } else {
        // Food 객체를 찾지 못했다면 가상 객체 생성
        console.log(`Creating virtual food object for ${foodId}`);
        // 이벤트 정보만으로 처리 진행 (실제 Food 객체 없이)
        this.foodMap.set(foodId, {
          getId: () => foodId,
          getPosition: () => position,
          setState: () => {},
          startEating: () => {},
          getFreshness: () => freshness,
          waitForEatingFinished: () => Promise.resolve(),
        } as unknown as Food);
      }
    }

    // 디버그 모드에서 음식 먹기가 방지된 경우 무시
    if (DebugFlags.getInstance().isEatingPrevented()) {
      console.log(
        "디버그 모드: preventEating 플래그가 활성화되어 음식을 처리하지 않습니다."
      );
      return;
    }

    // 상한 음식은 먹지 않음
    if (freshness === FoodFreshness.STALE) {
      console.log("상한 음식은 먹을 수 없습니다.");
      return;
    }

    // 음식 대기열에 추가
    this.foodQueue.push(foodId);
    console.log(
      `음식이 대기열에 추가되었습니다. 현재 대기열 길이: ${this.foodQueue.length}`
    );

    // 현재 먹거나 이동 중이 아닐 때만 처리
    if (
      this.character.getState() !== CharacterState.EATING &&
      !this.isMovingToFood
    ) {
      this.processNextFood();
    }
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
      const food = this.foodMap.get(foodId);

      if (!food) {
        console.warn(
          `Food ${foodId} not found in tracker, removing from queue`
        );
        this.foodQueue.shift();
        this.isMovingToFood = false;
        this.processNextFood();
        return;
      }

      // 캐릭터의 랜덤 움직임 비활성화
      this.character.disableRandomMovement();

      // 캐릭터가 음식으로 이동
      await this.moveCharacterToFood(food);

      try {
        // 음식 먹기가 완료될 때까지 대기
        await food.waitForEatingFinished();

        // 대기열에서 제거
        this.foodQueue.shift();
        this.foodMap.delete(foodId);
      } catch (error) {
        console.error("음식 먹기 중 오류 발생:", error);
        // 오류가 발생한 음식은 대기열에서 제거
        this.foodQueue.shift();
        this.foodMap.delete(foodId);
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
          this.character.update(CharacterState.IDLE);
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
          console.log("음식이 상했습니다. 이동을 중단합니다.");

          // 캐릭터 상태 원래대로 복원하고 랜덤 움직임 다시 활성화
          this.character.update(CharacterState.IDLE);
          this.character.enableRandomMovement();

          // 음식 상태를 LANDED로 되돌림
          food.setState(1); // FoodState.LANDED와 동일한 값

          // 대기열에서 해당 음식 제거
          const foodId = food.getId();
          const index = this.foodQueue.indexOf(foodId);
          if (index > -1) {
            this.foodQueue.splice(index, 1);
          }
          this.foodMap.delete(foodId);

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
            console.log("음식이 상했습니다. 먹지 않습니다.");

            // 캐릭터 상태 원래대로 복원하고 랜덤 움직임 다시 활성화
            this.character.update(CharacterState.IDLE);
            this.character.enableRandomMovement();

            // 음식 상태를 LANDED로 되돌림
            food.setState(1); // FoodState.LANDED와 동일한 값

            // 대기열에서 해당 음식 제거
            const foodId = food.getId();
            const index = this.foodQueue.indexOf(foodId);
            if (index > -1) {
              this.foodQueue.splice(index, 1);
            }
            this.foodMap.delete(foodId);

            // Promise 해결
            resolve();

            // 다음 음식이 있으면 처리 (다음 프레임에서 처리)
            setTimeout(() => {
              this.isMovingToFood = false; // 중요: 이동 상태 초기화
              this.processNextFood();
            }, 0);
          } else {
            // 음식이 상하지 않았으면 먹기 시작
            this.character.update(CharacterState.EATING);
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

    // 캐릭터의 현재 위치에서 가까운 쪽으로 접근하도록 설정
    // X좌표: 음식의 좌우 15픽셀 지점으로 설정 (더 가깝게 변경)
    const offsetX = isCharacterLeftOfFood ? -15 : 15;

    // Y좌표: 음식보다 20픽셀 위에 위치하도록 설정
    const offsetY = -15;

    return {
      x: foodPos.x + offsetX,
      y: foodPos.y + offsetY, // 음식보다 위쪽에 위치하도록 함
    };
  }

  /**
   * 음식을 먹기 시작했을 때 호출되는 핸들러
   */
  private onFoodEatingStarted(foodId: string): void {
    // 캐릭터를 먹는 상태로 변경
    this.character.update(CharacterState.EATING);
  }

  /**
   * 음식을 다 먹었을 때 호출되는 핸들러
   */
  private onFoodEatingFinished(foodId: string, freshness: FoodFreshness): void {
    console.log(`음식 ID: ${foodId} 먹기 완료, 신선도: ${freshness}`);

    // 신선도에 따른 스태미나 회복량 결정
    const staminaRecovery: number = (() => {
      if (freshness === FoodFreshness.FRESH) {
        return STAMINA_RECOVERY; // 신선한 음식: 스태미나 +3
      }
      if (freshness === FoodFreshness.NORMAL) {
        return STAMINA_RECOVERY_NORMAL; // 일반 음식: 스태미나 +1
      }
      throw new Error("Not reached: Invalid food freshness");
    })();

    // 신선도에 따른 스태미나 회복
    if (staminaRecovery > 0) {
      this.character.increaseStamina(staminaRecovery);
      console.log(
        `음식을 먹고 스태미나가 ${staminaRecovery} 회복되었습니다. 현재 스태미나: ${this.character.getStamina()}`
      );
    }

    // 캐릭터 상태 변경 및 랜덤 움직임 다시 활성화
    this.character.update(CharacterState.IDLE);
    this.character.enableRandomMovement();

    // 맵에서 음식 제거
    const food = this.foodMap.get(foodId);
    if (food) {
      // 여기서 신선도 변화 일시정지 상태를 정확히 확인
      console.log(
        `음식 ${foodId}의 신선도 변화 상태: ${
          this.checkFoodFreshnessPauseState(food) ? "일시정지됨" : "활성화됨"
        }`
      );
    }

    // 맵과 대기열에서 음식 제거
    this.foodMap.delete(foodId);
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
      console.error("음식 신선도 변화 상태 확인 중 오류:", error);
      return false;
    }
  }

  /**
   * FoodTracker 정리
   */
  public destroy(): void {
    // 주기적 검색 인터벌 정리
    if (this.searchInterval !== null) {
      clearInterval(this.searchInterval);
      this.searchInterval = null;
    }

    // EventBus 이벤트 구독 해제
    const eventBus = EventBus.getInstance();
    eventBus.off(EventTypes.FOOD_LANDED);
    eventBus.off(EventTypes.FOOD_EATING_STARTED);
    eventBus.off(EventTypes.FOOD_EATING_FINISHED);
    eventBus.off(EventTypes.FOOD_CREATED);
  }
}
