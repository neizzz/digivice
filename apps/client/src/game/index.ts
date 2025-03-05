import * as PIXI from "pixi.js";
import { MainScene } from "./scenes/MainScene";
import { AssetLoader } from "./utils/AssetLoader";

export class Game {
  private app: PIXI.Application;
  private currentScene?: MainScene;

  constructor(parentElement: HTMLElement) {
    // PIXI 애플리케이션 생성
    this.app = new PIXI.Application({
      width: parentElement.clientWidth,
      height: parentElement.clientHeight,
      backgroundColor: 0xaaaaaa,
      autoDensity: true,
      // resolution: window.devicePixelRatio || 1,
    });

    // DOM에 캔버스 추가
    parentElement.appendChild(this.app.view as HTMLCanvasElement);

    // 리사이징 핸들러 설정
    window.addEventListener("resize", this.onResize.bind(this));
    this.onResize();

    // PIXI 앱이 완전히 초기화된 후 init 메서드 실행
    this.waitForAppInitialization().then(() => {
      this.init();
    });
  }

  /**
   * PIXI 애플리케이션이 완전히 초기화될 때까지 대기
   */
  private waitForAppInitialization(): Promise<void> {
    return new Promise<void>((resolve) => {
      // 첫 번째 렌더링 후에는 초기화가 완료된 것으로 간주
      const renderer = this.app.renderer;
      renderer.on("postrender", function onPostRender() {
        // 핸들러는 한 번만 실행되도록 제거
        renderer.off("postrender", onPostRender);
        resolve();
      });

      // 안전장치: 일정 시간 후에도 이벤트가 발생하지 않으면 resolve
      // setTimeout(resolve, 1000);
    });
  }

  private onResize(): void {
    // 화면 크기에 맞게 캔버스 조정
    const parent = this.app.view;
    if (!parent || !parent.getBoundingClientRect) {
      throw new Error("Parent element is not available.");
    }

    const { width, height } = parent.getBoundingClientRect();
    this.app.renderer.resize(width, height);

    if (this.currentScene) {
      this.currentScene.onResize(width, height);
    }
  }

  private async init(): Promise<void> {
    try {
      // 에셋 로딩 - MainScene 생성 전에 먼저 실행
      await AssetLoader.loadAssets();

      // MainScene 생성
      this.currentScene = new MainScene(this.app);
      this.app.stage.addChild(this.currentScene);

      // Override ticker to use fixed deltaTime of 250ms;
      this.app.ticker.add(() => {
        // Convert 250ms to PIXI's delta time format (60 = 1 second)
        const fixedDelta = (250 / 1000) * 60;
        this.update(fixedDelta);
      });
    } catch (error) {
      console.error("게임 초기화 오류:", error);
    }
  }

  private update(deltaTime: number): void {
    // 현재 씬 업데이트
    if (this.currentScene) {
      this.currentScene.update(deltaTime);
    }
  }

  public destroy(): void {
    // 정리 작업
    window.removeEventListener("resize", this.onResize.bind(this));
    this.app.destroy(true, {
      children: true,
      texture: true,
      baseTexture: true,
    });
  }
}
