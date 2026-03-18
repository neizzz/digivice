import { PlatformAdapter } from "./PlatformAdapter";

/**
 * 광고 어댑터
 * Native AdController를 TypeScript에서 사용하기 위한 래퍼
 */
export class AdAdapter {
  private platformAdapter: PlatformAdapter;

  constructor() {
    this.platformAdapter = new PlatformAdapter();
  }

  /**
   * 전면광고 표시
   */
  async showInterstitial(): Promise<void> {
    if (!this.platformAdapter.isRunningInNativeApp()) {
      console.warn("[AdAdapter] showInterstitial called but not in native app");
      throw new Error("Not running in native app");
    }

    if (!window.adController) {
      console.error("[AdAdapter] window.adController not available");
      throw new Error("AdController not available");
    }

    try {
      const result = await window.adController.showInterstitial();
      console.log("[AdAdapter] Ad shown:", result);
    } catch (error) {
      console.error("[AdAdapter] Error showing ad:", error);
      throw error;
    }
  }

  /**
   * 광고 표시 가능 여부 확인 (쿨다운 체크)
   */
  async canShowAd(): Promise<boolean> {
    if (!this.platformAdapter.isRunningInNativeApp()) {
      return false;
    }

    if (!window.adController) {
      return false;
    }

    try {
      const result = await window.adController.canShowAd();
      return result === "true";
    } catch (error) {
      console.error("[AdAdapter] Error checking canShowAd:", error);
      return false;
    }
  }

  /**
   * 네이티브 앱에서 실행 중인지 확인
   */
  isAvailable(): boolean {
    return this.platformAdapter.isRunningInNativeApp() && !!window.adController;
  }
}
