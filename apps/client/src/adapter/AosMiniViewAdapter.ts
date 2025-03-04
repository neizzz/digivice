import { MiniViewControlPort } from "../application/port/out/MiniViewControlPort";

export class AosMiniViewAdapter implements MiniViewControlPort {
  private static instance: AosMiniViewAdapter;

  constructor() {
    if (AosMiniViewAdapter.instance) {
      return AosMiniViewAdapter.instance;
    }
    AosMiniViewAdapter.instance = this;
  }

  /**
   * 미니뷰 모드로 전환
   * TODO: ios의 경우 스트리밍 관련 로직(video element 관리 등)이 추가되어야할 수 있음.
   */
  enterMiniViewMode() {
    if (!window.PipController) {
      throw new Error("PipController not available");
    }
    return window.PipController.enterPipMode();
  }

  /**
   * 미니뷰 모드 종료
   */
  exitMiniViewMode() {
    if (!window.PipController) {
      throw new Error("PipController not available");
    }

    return window.PipController.exitPipMode();
  }
}
