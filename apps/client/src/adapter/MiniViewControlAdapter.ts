import { MiniViewControlPort } from "../application/port/out/MiniViewControlPort";

declare global {
  interface Window {
    pipController: {
      enterPipMode: () => Promise<void>;
      exitPipMode: () => Promise<void>;
    };
  }
}

export class MiniViewControlAdapter implements MiniViewControlPort {
  // private _currentVideoElement: HTMLVideoElement | null = null;

  async enterMiniViewMode(): Promise<void> {
    // const videoEl = document.createElement("video");
    // videoEl.id = "pipVideo";
    // videoEl.src = "https://www.w3schools.com/html/mov_bbb.mp4";
    // videoEl.setAttribute("width", "1");
    // videoEl.setAttribute("height", "1");
    // videoEl.setAttribute("playsinline", "");
    // document.body.appendChild(videoEl);
    // this._currentVideoElement = videoEl;
    // try {
    //   await videoEl.play();
    //   await videoEl.requestPictureInPicture();
    // } catch (error) {
    //   console.error("PIP 모드 진입 실패:", error);
    // }
    try {
      await window.pipController.enterPipMode();
    } catch (error) {
      console.error("Failed to enter PIP mode:", error);
    }
  }

  async exitMiniViewMode(): Promise<void> {
    // this._currentVideoElement?.remove();
    try {
      await window.pipController.exitPipMode();
    } catch (error) {
      console.error("Failed to exit PIP mode:", error);
    }
  }
}
