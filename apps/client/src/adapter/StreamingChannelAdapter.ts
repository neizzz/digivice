export class StreamingChannelAdapter {
  private static instance: StreamingChannelAdapter;

  constructor() {
    if (StreamingChannelAdapter.instance) {
      return StreamingChannelAdapter.instance;
    }
    StreamingChannelAdapter.instance = this;
  }

  /**
   * 스트리밍 시작 요청
   * @param options 스트리밍 옵션
   * @returns 요청 처리 결과
   */
  startStreaming(options: { quality?: string; fps?: number } = {}) {
    const { quality = "medium", fps = 30 } = options;
    return this.sendMessage("startStreaming", { quality, fps });
  }

  /**
   * 스트리밍 중지 요청
   * @returns 요청 처리 결과
   */
  stopStreaming() {
    return this.sendMessage("stopStreaming");
  }

  /**
   * 현재 스트리밍 상태 요청
   * @returns 스트리밍 상태 정보
   */
  getStreamingStatus() {
    return this.sendMessage("getStreamingStatus");
  }

  /**
   * 웹뷰 캡처 요청
   * @returns 캡처 처리 결과
   */
  captureWebView() {
    return this.sendMessage("captureWebView");
  }

  /**
   * 웹뷰 스트리밍 URL을 가져옵니다.
   * Flutter에서 실행 중인 로컬 스트리밍 서버의 URL을 반환합니다.
   */
  async getStreamingUrl(): Promise<string | null> {
    try {
      const result = await this.sendMessage("getStreamingUrl");

      if (!result.success || !result.url) {
        console.error("스트리밍 URL을 가져올 수 없습니다:", result.message);
        return null;
      }

      return result.url;
    } catch (error) {
      console.error("스트리밍 URL 요청 실패:", error);
      return null;
    }
  }

  /**
   * iOS 환경에서 스트리밍 설정을 업데이트합니다.
   */
  updateIosStreamingConfig(config: {
    quality?: string;
    fps?: number;
    captureRate?: number;
  }) {
    return this.sendMessage("updateIosStreamingConfig", config);
  }

  /**
   * StreamingChannel로 메시지 전송
   * @param action 액션 타입
   * @param data 전송할 데이터
   * @returns Promise 객체
   */
  private sendMessage(action: string, data: Record<string, any> = {}) {
    if (!window.StreamingChannel) {
      console.warn("StreamingChannel is not available");
      return Promise.resolve({
        success: false,
        message: "StreamingChannel not available",
      });
    }

    return window.__createPromise((promiseId: string) => {
      const message = JSON.stringify({
        action,
        data,
        promiseId,
      });

      window.StreamingChannel?.postMessage(message);
    });
  }
}
