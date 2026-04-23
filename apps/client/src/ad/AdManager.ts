import type { AdContext, AdDisplayPolicy } from "./AdDisplayPolicy";
import { CooldownCondition } from "./conditions/CooldownCondition";
import { PlatformAdapter } from "../adapter/PlatformAdapter";

/**
 * 광고 관리자
 * 정책을 관리하고 광고 표시를 결정
 */
export class AdManager {
  private policies: AdDisplayPolicy[] = [];
  private platformAdapter: PlatformAdapter;

  constructor() {
    this.platformAdapter = new PlatformAdapter();
  }

  /**
   * 정책 추가
   */
  addPolicy(policy: AdDisplayPolicy): void {
    this.policies.push(policy);
    // 우선순위 순으로 정렬
    this.policies.sort((a, b) => b.getPriority() - a.getPriority());
    console.log(`[AdManager] Policy added: ${policy.name}`);
  }

  /**
   * 광고 요청
   * @param trigger 트리거 이벤트
   * @param context 광고 컨텍스트
   */
  async requestAd(
    trigger: string,
    context: Partial<AdContext> = {},
  ): Promise<boolean> {
    const fullContext: AdContext = {
      trigger,
      isCharacterUrgent: false,
      ...context,
    };

    console.log("[AdManager] Ad requested:", fullContext);

    // 네이티브 환경이 아니면 로그만
    if (!this.platformAdapter.isRunningInNativeApp()) {
      console.log("[AdManager] Not running in native app - ad request ignored");
      return false;
    }

    // AdController 존재 확인
    if (!window.adController) {
      console.warn("[AdManager] window.adController not available");
      return false;
    }

    // 정책 체크
    const policy = await this.findMatchingPolicy(fullContext);
    if (!policy) {
      console.log("[AdManager] No matching policy found");
      return false;
    }

    console.log(`[AdManager] Policy matched: ${policy.name}`);

    // 네이티브 쿨다운 체크 (안전장치)
    try {
      const canShowStr = await window.adController.canShowAd();
      const canShow = canShowStr === "true";

      if (!canShow) {
        console.log("[AdManager] Blocked by native cooldown");
        return false;
      }
    } catch (error) {
      console.error("[AdManager] Error checking native cooldown:", error);
      return false;
    }

    // 광고 표시
    try {
      await window.adController.showInterstitial();
      console.log("[AdManager] Ad shown successfully");

      // 쿨다운 업데이트
      CooldownCondition.updateCooldown();

      return true;
    } catch (error) {
      console.error("[AdManager] Error showing ad:", error);
      return false;
    }
  }

  /**
   * 매칭되는 정책 찾기
   */
  private async findMatchingPolicy(
    context: AdContext,
  ): Promise<AdDisplayPolicy | null> {
    for (const policy of this.policies) {
      try {
        const shouldShow = await policy.shouldShow(context);
        if (shouldShow) {
          return policy;
        }
      } catch (error) {
        console.error(`[AdManager] Error in policy ${policy.name}:`, error);
      }
    }
    return null;
  }

  /**
   * 등록된 정책 목록
   */
  getPolicies(): AdDisplayPolicy[] {
    return [...this.policies];
  }

  /**
   * 쿨다운 리셋 (디버그용)
   */
  resetCooldown(): void {
    CooldownCondition.resetCooldown();
  }

  /**
   * 강제로 광고 표시 (디버그용)
   */
  async forceShowAd(): Promise<boolean> {
    if (!window.adController) {
      console.warn("[AdManager] window.adController not available");
      return false;
    }

    try {
      await window.adController.showInterstitial();
      CooldownCondition.updateCooldown();
      return true;
    } catch (error) {
      console.error("[AdManager] Error forcing ad:", error);
      return false;
    }
  }
}
