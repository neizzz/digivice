import type { AdContext, AdDisplayCondition } from "../AdDisplayPolicy";

const COOLDOWN_KEY = "ad_last_shown_timestamp";

/**
 * 쿨다운 조건
 * 마지막 광고 표시 이후 일정 시간이 경과했는지 확인
 */
export class CooldownCondition implements AdDisplayCondition {
  name = "cooldown";
  private cooldownMs: number;

  /**
   * @param cooldownMs 쿨다운 시간 (밀리초)
   */
  constructor(cooldownMs: number) {
    this.cooldownMs = cooldownMs;
  }

  async check(_context: AdContext): Promise<boolean> {
    const lastShownStr = localStorage.getItem(COOLDOWN_KEY);

    if (!lastShownStr) {
      return true; // 한 번도 표시한 적 없음
    }

    try {
      const lastShown = Number.parseInt(lastShownStr, 10);
      const now = Date.now();
      const elapsed = now - lastShown;

      return elapsed >= this.cooldownMs;
    } catch {
      // 파싱 실패 시 쿨다운 통과로 처리
      return true;
    }
  }

  /**
   * 쿨다운 업데이트 (광고 표시 후 호출)
   */
  static updateCooldown(): void {
    const now = Date.now();
    localStorage.setItem(COOLDOWN_KEY, now.toString());
    console.log("[CooldownCondition] Cooldown updated:", now);
  }

  /**
   * 쿨다운 리셋 (디버그용)
   */
  static resetCooldown(): void {
    localStorage.removeItem(COOLDOWN_KEY);
    console.log("[CooldownCondition] Cooldown reset");
  }

  /**
   * 마지막 광고 표시 시간 가져오기
   */
  static getLastShownTime(): number | null {
    const lastShownStr = localStorage.getItem(COOLDOWN_KEY);
    if (!lastShownStr) return null;

    try {
      return Number.parseInt(lastShownStr, 10);
    } catch {
      return null;
    }
  }
}
