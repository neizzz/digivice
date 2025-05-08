import { FoodFreshness } from "../entities/Food";
import { FOOD_FRESHNESS } from "../config"; // config에서 시간 상수 가져오기

/**
 * 음식의 신선도 지속 시간을 관리하는 클래스
 */
export class FreshnessDuration {
  private freshness: FoodFreshness;
  private createdAt: number;
  private freshDuration = FOOD_FRESHNESS.FRESH_DURATION; // config에서 가져옴
  private normalDuration = FOOD_FRESHNESS.NORMAL_DURATION; // config에서 가져옴
  private onFreshnessChanged: (freshness: FoodFreshness) => void;
  private isPaused = false; // 신선도 변화 일시정지 상태
  private foodId: string; // 각 음식 객체를 구분하기 위한 ID

  /**
   * 신선도 지속 시간 관리 클래스 생성자
   * @param onFreshnessChanged 신선도 변경 콜백
   * @param foodId 음식의 고유 ID
   * @param initialFreshness 초기 신선도 (기본값: FRESH)
   */
  constructor(
    onFreshnessChanged: (freshness: FoodFreshness) => void,
    foodId: string,
    initialFreshness: FoodFreshness = FoodFreshness.FRESH
  ) {
    this.freshness = initialFreshness;
    this.createdAt = Date.now();
    this.onFreshnessChanged = onFreshnessChanged;
    this.foodId = foodId;
  }

  /**
   * 신선도 상태 업데이트
   */
  public update(): void {
    // 일시정지 상태라면 업데이트 하지 않음
    if (this.isPaused) {
      return;
    }

    const now = Date.now();
    const elapsedTime = now - this.createdAt;

    // 현재 신선도에 따른 처리
    if (this.freshness === FoodFreshness.FRESH) {
      // 신선한 상태가 지속 시간을 초과하면 보통 상태로 변경
      if (elapsedTime >= this.freshDuration) {
        this.freshness = FoodFreshness.NORMAL;
        this.onFreshnessChanged(this.freshness);
      }
    } else if (this.freshness === FoodFreshness.NORMAL) {
      // 보통 상태가 지속 시간을 초과하면 상한 상태로 변경
      if (elapsedTime >= this.freshDuration + this.normalDuration) {
        this.freshness = FoodFreshness.STALE;
        this.onFreshnessChanged(this.freshness);
      }
    }
  }

  /**
   * 현재 신선도 상태 반환
   */
  public getFreshness(): FoodFreshness {
    return this.freshness;
  }

  /**
   * 신선도 변화를 멈춥니다 - 음식을 먹기 시작했거나 특정 상태를 유지해야 할 때 사용
   */
  public pauseFreshnessChange(): void {
    this.isPaused = true;
    console.log(`음식 ID: ${this.foodId}의 신선도 변화가 일시정지되었습니다.`);
  }

  /**
   * 신선도 변화를 재개합니다
   */
  public resumeFreshnessChange(): void {
    this.isPaused = false;
    console.log(`음식 ID: ${this.foodId}의 신선도 변화가 재개되었습니다.`);
  }

  /**
   * 신선도 변화 일시정지 상태 확인
   */
  public isPausedState(): boolean {
    return this.isPaused;
  }

  /**
   * 음식 ID 반환
   */
  public getFoodId(): string {
    return this.foodId;
  }
}
