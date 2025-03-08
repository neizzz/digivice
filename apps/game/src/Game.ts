import * as PIXI from "pixi.js";
import { Scene } from "./interfaces/Scene";
import { MainScene } from "./scenes/MainScene";
import { AssetLoader } from "./utils/AssetLoader";
import { DebugHelper } from "./utils/DebugHelper";
import { SceneKey } from "./SceneKey";

export class Game {
  private app: PIXI.Application;
  private currentScene?: Scene;
  private scenes: Map<SceneKey, Scene> = new Map();
  private currentSceneKey?: SceneKey;

  constructor(parentElement: HTMLElement) {
    // PIXI 애플리케이션 생성
    this.app = new PIXI.Application({
      width: parentElement.clientWidth,
      height: parentElement.clientHeight,
      backgroundColor: 0xaaaaaa,
      autoDensity: true,
      resolution: window.devicePixelRatio || 2, // 해상도를 디바이스 픽셀 비율로 설정하거나 원하는 값(예: 2)으로 설정
    });

    // DOM에 캔버스 추가
    parentElement.appendChild(this.app.view as HTMLCanvasElement);

    // 리사이징 핸들러 설정
    window.addEventListener("resize", this.onResize.bind(this));
    this.onResize();

    // PIXI 앱이 완전히 초기화된 후 init 메서드 실행
    this.waitForAppInitialization().then(() => {
      console.log("PIXI 애플리케이션 초기화 완료");
      this.init();
    });
  }

  /**
   * PIXI 애플리케이션이 완전히 초기화될 때까지 대기
   */
  private waitForAppInitialization(): Promise<void> {
    return new Promise<void>((resolve) => {
      // PIXI v7에서는 렌더러의 postrender 이벤트 대신
      // app.ticker를 이용해 첫 프레임 렌더링 확인
      const onFirstRender = () => {
        // 한 번 실행 후 제거
        this.app.ticker.remove(onFirstRender);
        resolve();
      };

      // 다음 프레임에서 초기화 완료로 간주
      this.app.ticker.add(onFirstRender);
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

    // 리사이징 시에도 해상도 설정 유지
    this.app.renderer.resolution = window.devicePixelRatio || 2;

    if (this.currentScene) {
      this.currentScene.onResize(width, height);
    }
  }

  private async init(): Promise<void> {
    try {
      // 에셋 로딩 - Scene 생성 전에 먼저 실행
      await AssetLoader.loadAssets();

      // 모든 씬을 내부적으로 생성하고 등록
      this.initializeScenes();

      // 기본적으로 메인 씬으로 시작
      this.changeScene(SceneKey.MAIN);

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

  /**
   * 게임에 필요한 모든 씬을 초기화하고 등록합니다
   */
  private initializeScenes(): void {
    // 메인 씬 생성 및 등록
    const mainScene = new MainScene(this.app);
    this.scenes.set(SceneKey.MAIN, mainScene);

    // 여기에 다른 씬들을 추가로 초기화하고 등록할 수 있습니다
    // 예: const battleScene = new BattleScene(this.app);
    //     this.scenes.set(SceneKey.BATTLE, battleScene);

    console.log("All scenes initialized successfully");
  }

  private update(deltaTime: number): void {
    // 현재 씬 업데이트
    if (this.currentScene) {
      this.currentScene.update(deltaTime);
    }
  }

  /**
   * 씬을 키를 통해 전환합니다
   * @param key 전환할 씬의 키
   * @returns 성공 여부
   */
  public changeScene(key: SceneKey): boolean {
    if (!this.scenes.has(key)) {
      console.error(`Scene '${key}' not found`);
      return false;
    }

    const newScene = this.scenes.get(key)!;

    // 기존 씬이 있으면 제거
    if (this.currentScene && this.currentScene instanceof PIXI.DisplayObject) {
      this.app.stage.removeChild(this.currentScene);
    }

    // 새 씬 설정
    this.currentScene = newScene;
    this.currentSceneKey = key;

    // 새 씬이 DisplayObject이면 스테이지에 추가
    if (this.currentScene instanceof PIXI.DisplayObject) {
      this.app.stage.addChild(this.currentScene);
    }

    // 새 씬의 크기 조정
    const { width, height } = this.app.renderer.screen;
    this.currentScene.onResize(width, height);

    console.log(`Changed to scene '${key}'`);
    return true;
  }

  /**
   * 현재 활성화된 씬의 키를 반환합니다
   */
  public getCurrentSceneKey(): SceneKey | undefined {
    return this.currentSceneKey;
  }

  /**
   * 사용 가능한 모든 씬 키 목록을 반환합니다
   */
  public getAvailableSceneKeys(): SceneKey[] {
    return Array.from(this.scenes.keys());
  }

  public destroy(): void {
    // 정리 작업
    window.removeEventListener("resize", this.onResize.bind(this));
    this.app.destroy(true, {
      children: true,
      texture: true,
      baseTexture: true,
    });

    // 디버그 헬퍼 정리
    DebugHelper.removeAll();
  }
}
