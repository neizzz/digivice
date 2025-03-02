import { MiniViewControlPort } from "../application/port/out/MiniViewControlPort";

export class MiniViewControlAdapter implements MiniViewControlPort {
  private static instance: MiniViewControlAdapter;
  private pipVideo: HTMLVideoElement | null = null;

  constructor() {
    if (MiniViewControlAdapter.instance) {
      return MiniViewControlAdapter.instance;
    }
    MiniViewControlAdapter.instance = this;
  }

  /**
   * 미니뷰 모드로 전환
   */
  enterMiniViewMode() {
    if (!window.MiniViewController) {
      console.warn("MiniViewController is not available");
      return Promise.resolve({
        success: false,
        message: "MiniViewController not available",
      });
    }

    return this.sendMessage("enterMiniViewMode");
  }

  /**
   * 미니뷰 모드 종료
   */
  exitMiniViewMode() {
    if (!window.MiniViewController) {
      console.warn("MiniViewController is not available");
      return Promise.resolve({
        success: false,
        message: "MiniViewController not available",
      });
    }

    return this.sendMessage("exitMiniViewMode");
  }

  /**
   * PIP 모드 시작
   * @param videoStream 비디오 스트림
   */
  async startPictureInPicture(videoStream: MediaStream) {
    try {
      // 기존 PIP 비디오 요소가 있으면 정리
      if (this.pipVideo) {
        await this.stopPictureInPicture();
      }

      // 새 비디오 요소 생성
      this.pipVideo = document.createElement("video");
      this.pipVideo.srcObject = videoStream;
      this.pipVideo.autoplay = true;
      this.pipVideo.muted = true;
      this.pipVideo.style.display = "none";
      document.body.appendChild(this.pipVideo);

      // PIP 모드 시작
      await this.pipVideo.requestPictureInPicture();
      return { success: true };
    } catch (error) {
      console.error("PIP 시작 실패:", error);
      return { success: false, error };
    }
  }

  /**
   * iOS 스트리밍 기반 PIP 모드 시작
   * @param streamUrl 스트리밍 URL 또는 비디오 스트림
   */
  async startIosPictureInPicture(streamUrl: string | MediaStream) {
    try {
      // 기존 PIP 비디오 요소가 있으면 정리
      if (this.pipVideo) {
        await this.stopPictureInPicture();
      }

      // 새 비디오 요소 생성
      this.pipVideo = document.createElement("video");

      // URL 문자열이면 src 속성으로 설정, MediaStream이면 srcObject 설정
      if (typeof streamUrl === "string") {
        this.pipVideo.src = streamUrl;
      } else {
        this.pipVideo.srcObject = streamUrl;
      }

      this.pipVideo.autoplay = true;
      this.pipVideo.playsInline = true;
      this.pipVideo.muted = true;
      this.pipVideo.style.width = "1px";
      this.pipVideo.style.height = "1px";
      this.pipVideo.style.position = "fixed";
      this.pipVideo.style.top = "0";
      this.pipVideo.style.left = "0";
      this.pipVideo.style.zIndex = "-1";

      document.body.appendChild(this.pipVideo);

      // 비디오가 로드되면 재생 및 PIP 모드 시작
      await new Promise<void>((resolve, reject) => {
        if (!this.pipVideo) return reject("비디오 요소가 없습니다");

        this.pipVideo.onloadedmetadata = async () => {
          try {
            await this.pipVideo!.play();
            // iOS Safari에서 PIP API 지원 확인
            if (
              document.pictureInPictureEnabled ||
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore - Safari 전용 API
              this.pipVideo!.webkitSupportsPresentationMode
            ) {
              // 표준 PIP API
              if (document.pictureInPictureEnabled) {
                await this.pipVideo?.requestPictureInPicture();
              }
              // Safari 전용 PIP API
              else if (
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore - Safari 전용 API
                this.pipVideo.webkitSupportsPresentationMode &&
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                typeof this.pipVideo.webkitSetPresentationMode === "function"
              ) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                this.pipVideo.webkitSetPresentationMode("picture-in-picture");
              }
              resolve();
            } else {
              reject("이 브라우저는 PIP를 지원하지 않습니다");
            }
          } catch (error) {
            reject(error);
          }
        };

        this.pipVideo.onerror = (e) => {
          reject(`비디오 로드 오류: ${e}`);
        };
      });

      return { success: true };
    } catch (error) {
      console.error("iOS PIP 시작 실패:", error);
      return { success: false, error };
    }
  }

  /**
   * PIP 모드 종료
   */
  async stopPictureInPicture() {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }
      // Safari 전용 PIP API 처리
      else if (
        this.pipVideo &&
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - Safari 전용 API
        this.pipVideo.webkitPresentationMode === "picture-in-picture" &&
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - Safari 전용 API
        typeof this.pipVideo.webkitSetPresentationMode === "function"
      ) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - Safari 전용 API
        this.pipVideo.webkitSetPresentationMode("inline");
      }

      if (this.pipVideo) {
        // 비디오 요소의 리소스 해제
        this.pipVideo.pause();
        this.pipVideo.src = "";

        // MediaStream이 있는 경우 트랙 중지
        if (this.pipVideo.srcObject instanceof MediaStream) {
          const tracks = this.pipVideo.srcObject as MediaStream;
          tracks.getTracks().forEach((track) => track.stop());
        }

        this.pipVideo.remove();
        this.pipVideo = null;
      }

      return { success: true };
    } catch (error) {
      console.error("PIP 종료 실패:", error);
      return { success: false, error };
    }
  }

  /**
   * MiniViewController로 메시지 전송
   */
  private sendMessage(action: string, data: Record<string, any> = {}) {
    return window.__createPromise((promiseId: string) => {
      const message = JSON.stringify({
        action,
        data,
        promiseId,
      });

      window.MiniViewController?.postMessage(message);
    });
  }
}
