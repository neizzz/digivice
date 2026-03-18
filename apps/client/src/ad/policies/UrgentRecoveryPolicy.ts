import type { AdContext, AdDisplayPolicy } from "../AdDisplayPolicy";
import { AndCondition } from "../conditions/combinators";
import { CooldownCondition } from "../conditions/CooldownCondition";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * 위급 상태 회복 정책
 * 조건: 2시간 쿨다운 + urgent_recovery 트리거
 * 캐릭터가 URGENT 상태에서 벗어나면 광고 표시
 */
export class UrgentRecoveryPolicy implements AdDisplayPolicy {
  name = "urgent_recovery";

  private condition: AndCondition;

  constructor() {
    this.condition = new AndCondition([new CooldownCondition(TWO_HOURS_MS)]);
  }

  async shouldShow(context: AdContext): Promise<boolean> {
    // urgent_recovery 트리거인지 확인
    if (context.trigger !== "urgent_recovery") {
      return false;
    }

    // 이미 위급 상태가 아니어야 함 (회복된 상태)
    if (context.isCharacterUrgent) {
      console.log("[UrgentRecoveryPolicy] Blocked - still in urgent state");
      return false;
    }

    // 쿨다운 체크
    const result = await this.condition.check(context);

    if (!result) {
      console.log("[UrgentRecoveryPolicy] Blocked - conditions not met");
    }

    return result;
  }

  getPriority(): number {
    return 10; // 재진입(5)보다 높은 우선순위
  }
}
