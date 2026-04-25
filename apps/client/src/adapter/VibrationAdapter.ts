import { PlatformAdapter } from "./PlatformAdapter";
import { isVibrationEnabled } from "../settings/gameSettings";

const DEFAULT_VIBRATION_DURATION = 20;
const DEFAULT_VIBRATION_STRENGTH = 60;
const MIN_VIBRATION_STRENGTH = 10;
const MAX_VIBRATION_STRENGTH = 255;

function normalizeVibrationStrength(strength?: number): number | undefined {
  if (strength === undefined) {
    return undefined;
  }

  if (!Number.isFinite(strength)) {
    return undefined;
  }

  return Math.min(
    MAX_VIBRATION_STRENGTH,
    Math.max(MIN_VIBRATION_STRENGTH, Math.round(strength)),
  );
}

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
   * @param strength 진동 강도. 1-255 범위, 지원 기기에서만 적용
   */
  async vibrate(
    duration = DEFAULT_VIBRATION_DURATION,
    strength = DEFAULT_VIBRATION_STRENGTH,
  ): Promise<void> {
    if (!isVibrationEnabled()) {
      return;
    }

    if (!this.platformAdapter.isRunningInNativeApp()) {
      return;
    }

    if (!window.vibrationController) {
      return;
    }

    try {
      const normalizedStrength = normalizeVibrationStrength(strength);
      await window.vibrationController.vibrate(
        duration,
        normalizedStrength,
      );
    } catch {
      // Ignore vibration failures. Vibration is an optional haptic effect.
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
