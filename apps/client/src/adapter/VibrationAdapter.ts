import { PlatformAdapter } from "./PlatformAdapter";

/**
 * 진동 어댑터
 * Native VibrationController를 TypeScript에서 사용하기 위한 래퍼
 */
export class VibrationAdapter {
  private platformAdapter: PlatformAdapter;

  constructor() {
    this.platformAdapter = new PlatformAdapter();
  }

  /**
   * 진동 실행
   * @param duration 진동 지속 시간(ms). 기본값: 50ms
   */
  async vibrate(duration = 50): Promise<void> {
    if (!this.platformAdapter.isRunningInNativeApp()) {
      console.warn("[VibrationAdapter] vibrate called but not in native app");
      return;
    }

    if (!window.vibrationController) {
      console.warn("[VibrationAdapter] window.vibrationController not available");
      return;
    }

    try {
      const result = await window.vibrationController.vibrate(duration);
      console.log("[VibrationAdapter] Vibration result:", result);
    } catch (error) {
      console.error("[VibrationAdapter] Error during vibration:", error);
    }
  }

  /**
   * 네이티브 앱에서 실행 중인지 확인
   */
  isAvailable(): boolean {
    return (
      this.platformAdapter.isRunningInNativeApp() &&
      !!window.vibrationController
    );
  }
}
