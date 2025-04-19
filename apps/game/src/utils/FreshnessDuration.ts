import { FoodFreshness } from "../entities/Food";

/**
 * 음식의 신선도 상태 변화를 관리하는 클래스
 * 시간이 지남에 따라 신선도가 변화하는 로직을 구현
 */
export class FreshnessDuration {
  // 각 신선도 상태별 지속 시간 (밀리초)
  private static readonly FRESH_DURATION = 30000; // 신선한 상태: 30초
  private static readonly NORMAL_DURATION = 60000; // 보통 상태: 60초

  private startTime: number;
  private currentFreshness: FoodFreshness;
  private freshnessChangedCallback?: (freshness: FoodFreshness) => void;

  /**
   * @param callback 신선도가 변경될 때 호출되는 콜백 함수
   * @param initialFreshness 초기 신선도 상태 (기본값: FRESH)
   */
  constructor(
    callback?: (freshness: FoodFreshness) => void,
    initialFreshness: FoodFreshness = FoodFreshness.FRESH
  ) {
    this.startTime = Date.now();
    this.currentFreshness = initialFreshness;
    this.freshnessChangedCallback = callback;
  }

  /**
   * 현재 신선도 상태 업데이트
   * @returns 현재 신선도 상태
   */
  public update(): FoodFreshness {
    const elapsed = Date.now() - this.startTime;
    let newFreshness = this.currentFreshness;

    if (elapsed < FreshnessDuration.FRESH_DURATION) {
      newFreshness = FoodFreshness.FRESH;
    } else if (
      elapsed <
      FreshnessDuration.FRESH_DURATION + FreshnessDuration.NORMAL_DURATION
    ) {
      newFreshness = FoodFreshness.NORMAL;
    } else {
      newFreshness = FoodFreshness.STALE;
    }

    // 상태가 변경되었고 콜백이 등록되어 있으면 호출
    if (
      newFreshness !== this.currentFreshness &&
      this.freshnessChangedCallback
    ) {
      this.currentFreshness = newFreshness;
      this.freshnessChangedCallback(newFreshness);
    }

    return this.currentFreshness;
  }

  /**
   * 현재 신선도 상태 반환
   * @returns 현재 신선도 상태
   */
  public getCurrentFreshness(): FoodFreshness {
    return this.currentFreshness;
  }

  /**
   * 신선도 업데이트 시작 시간 재설정
   */
  public reset(): void {
    this.startTime = Date.now();
    this.currentFreshness = FoodFreshness.FRESH;
  }

  /**
   * 콜백 함수 변경
   * @param callback 신선도 변경 시 호출할 콜백 함수
   */
  public setCallback(callback: (freshness: FoodFreshness) => void): void {
    this.freshnessChangedCallback = callback;
  }

  /**
   * 신선도 상태별 시각적 표현을 위한 설명 텍스트 반환
   * @param freshness 신선도 상태
   * @returns 해당 상태에 대한 설명 문자열
   */
  public static getFreshnessDescription(freshness: FoodFreshness): string {
    switch (freshness) {
      case FoodFreshness.FRESH:
        return "신선함";
      case FoodFreshness.NORMAL:
        return "보통";
      case FoodFreshness.STALE:
        return "상함";
      default:
        return "알 수 없음";
    }
  }
}
