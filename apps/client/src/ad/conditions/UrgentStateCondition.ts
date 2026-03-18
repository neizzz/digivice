import type { AdContext, AdDisplayCondition } from "../AdDisplayPolicy";

/**
 * 위급 상태 조건
 * 캐릭터가 위급 상태가 아닌지 확인
 */
export class UrgentStateCondition implements AdDisplayCondition {
  name = "urgent_state";

  async check(context: AdContext): Promise<boolean> {
    // 위급 상태가 아니면 true (광고 표시 가능)
    return !context.isCharacterUrgent;
  }
}
