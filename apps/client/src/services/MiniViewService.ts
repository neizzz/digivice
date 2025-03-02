import { MiniViewControlAdapter } from "../adapter/MiniViewControlAdapter";
import { StreamingService } from "./StreamingService";

/**
 * 미니뷰 추상화를 관리하는 서비스
 * (웹뷰 측에서만 사용하는 개념)
 */
export class MiniViewService {
  private isInMiniViewMode = false;

  /**
   * @param miniViewController 미니뷰 컨트롤 어댑터
   * @param streamingService 스트리밍 서비스
   */
  constructor(
    private miniViewController: MiniViewControlAdapter,
    private streamingService: StreamingService
  ) {
    // 이벤트 리스너 설정 (필요한 경우)
    this.setupEventListeners();
  }

  /**
   * 미니뷰 모드 진입
   * - Flutter에는 미니뷰 개념이 없으므로 필요한 기능만 호출
   * - 스트리밍 시작 및 PIP 설정
   */
  async enterMiniViewMode(
    quality: string = "medium"
  ): Promise<MiniViewServiceResult> {
    if (this.isInMiniViewMode) {
      console.log("이미 미니뷰 모드 상태입니다");
      return { success: true };
    }

    try {
      // 1. 스트리밍 시작 및 PIP 설정
      const result = await this.streamingService.startStreaming(quality);

      // 2. 미니뷰 상태 설정 (웹뷰 측 추상화)
      this.isInMiniViewMode = true;
      this.dispatchMiniViewEvent("enter");

      return { success: true, message: "미니뷰 모드 진입 성공" };
    } catch (error) {
      console.error("미니뷰 모드 진입 실패:", error);
      return { success: false, message: "미니뷰 모드 진입 실패" };
    }
  }

  /**
   * 미니뷰 모드 종료
   */
  async exitMiniViewMode(): Promise<MiniViewServiceResult> {
    if (!this.isInMiniViewMode) {
      console.log("이미 일반 모드 상태입니다");
      return { success: true };
    }

    try {
      // 1. 스트리밍 중지 및 PIP 종료
      const result = await this.streamingService.stopStreaming();

      // 2. 미니뷰 상태 종료 (웹뷰 측 추상화)
      this.isInMiniViewMode = false;
      this.dispatchMiniViewEvent("exit");

      return { success: true, message: "미니뷰 모드 종료 성공" };
    } catch (error) {
      console.error("미니뷰 모드 종료 실패:", error);
      return { success: false, message: "미니뷰 모드 종료 실패" };
    }
  }

  /**
   * 미니뷰 상태 이벤트 발생
   */
  private dispatchMiniViewEvent(type: "enter" | "exit", data: unknown = {}) {
    const event = new CustomEvent("miniview_status_change", {
      detail: { type, data },
    });
    document.dispatchEvent(event);
  }

  /**
   * 필요한 이벤트 리스너 설정
   */
  private setupEventListeners() {
    document.addEventListener("webview_streaming", (e: unknown) => {
      // 스트리밍 상태 변경 시 처리
      if (this.isInMiniViewMode && e.detail?.type === "status") {
        // 필요한 처리
      }
    });
  }

  /**
   * 현재 미니뷰 모드 상태 확인
   */
  isInMiniView(): boolean {
    return this.isInMiniViewMode;
  }
}
