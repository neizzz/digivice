/**
 * 광고 컨텍스트 - 광고 표시 결정에 필요한 정보
 */
export interface AdContext {
  /** 광고 요청 트리거 (예: 'app_reenter', 'evolution_complete') */
  trigger: string;
  /** 캐릭터가 위급 상태인지 */
  isCharacterUrgent: boolean;
  /** 추가 메타데이터 (선택적) */
  metadata?: Record<string, unknown>;
}

/**
 * 광고 표시 정책 인터페이스
 * 새로운 정책을 추가하려면 이 인터페이스를 구현하세요
 */
export interface AdDisplayPolicy {
  /** 정책 이름 */
  name: string;

  /**
   * 광고를 표시해야 하는지 결정
   * @param context 광고 컨텍스트
   * @returns 표시 가능 여부
   */
  shouldShow(context: AdContext): Promise<boolean>;

  /**
   * 정책 우선순위 (높을수록 우선)
   * 여러 정책이 통과하면 우선순위가 높은 것이 선택됨
   */
  getPriority(): number;
}

/**
 * 광고 표시 조건 인터페이스
 * 정책에서 사용할 재사용 가능한 조건
 */
export interface AdDisplayCondition {
  /** 조건 이름 */
  name: string;

  /**
   * 조건 체크
   * @param context 광고 컨텍스트
   * @returns 조건 만족 여부
   */
  check(context: AdContext): Promise<boolean>;
}
