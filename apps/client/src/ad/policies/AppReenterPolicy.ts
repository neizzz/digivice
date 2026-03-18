import type { AdContext, AdDisplayPolicy } from "../AdDisplayPolicy";
import { AndCondition } from "../conditions/combinators";
import { CooldownCondition } from "../conditions/CooldownCondition";
import { UrgentStateCondition } from "../conditions/UrgentStateCondition";

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

/**
 * 앱 재진입 정책
 * 조건: 4시간 쿨다운 + 위급 상태 아님 + 재진입 트리거
 */
export class AppReenterPolicy implements AdDisplayPolicy {
  name = "app_reenter";
  private condition: AndCondition;

  constructor() {
    this.condition = new AndCondition([
      new CooldownCondition(FOUR_HOURS_MS),
      new UrgentStateCondition(),
    ]);
  }

  async shouldShow(context: AdContext): Promise<boolean> {
    // 재진입 트리거인지 확인
    if (context.trigger !== "app_reenter") {
      return false;
    }

    // 조건 체크
    const result = await this.condition.check(context);

    if (!result) {
      console.log(`[AppReenterPolicy] Ad blocked - conditions not met`);
    }

    return result;
  }

  getPriority(): number {
    return 5; // 기본 우선순위
  }
}
