import * as PIXI from "pixi.js";
import { Scene } from "./interfaces/Scene";
import { MainScene } from "./scenes/MainScene";
import { AssetLoader } from "./utils/AssetLoader";
import { DebugHelper } from "./utils/DebugHelper";
import { SceneKey } from "./SceneKey";
import { ControlButtonType } from "./ui/types";

export class Game {
  private app: PIXI.Application;
  private currentScene?: Scene;
  private scenes: Map<SceneKey, Scene> = new Map();
  private currentSceneKey?: SceneKey;
  private assetsLoaded: boolean = false;

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

    // 초기화 프로세스 시작
    this.startInitialization();
  }

  /**
   * 초기화 프로세스를 시작합니다 (비동기 작업을 동기적으로 관리)
   */
  private startInitialization(): void {
    console.log("게임 초기화 프로세스 시작");

    // PIXI 앱이 렌더링 준비되면 에셋 로딩 시작
    this.waitForAppInitialization().then(() => {
      console.log("PIXI 애플리케이션 초기화 완료");

      // 에셋 로딩 시작 (비동기 작업이지만 동기적으로 관리)
      AssetLoader.loadAssets()
        .then(() => {
          this.assetsLoaded = true;
          console.log("에셋 로딩 완료");

          // 기본 씬 설정
          this.setupInitialScene();

          // 게임 루프 설정
          this.setupGameLoop();
        })
        .catch((error) => {
          console.error("에셋 로딩 오류:", error);
        });
    });
  }

  /**
   * ControlButton 클릭 이벤트를 처리합니다
   * @param buttonType 클릭된 버튼 타입
   */
  public handleControlButtonClick(buttonType: ControlButtonType): void {
    // 현재 씬이 MainScene인 경우 해당 씬에 컨트롤 이벤트 전달
    if (this.currentScene instanceof MainScene) {
      (this.currentScene as MainScene).handleControlButtonClick(buttonType);
    }
  }

  /**
   * 기본 씬을 설정합니다
   */
  private setupInitialScene(): void {
    this.changeScene(SceneKey.MAIN);
  }

  /**
   * 게임 루프를 설정합니다
   */
  private setupGameLoop(): void {
    // 고정 델타타임으로 업데이트 설정 (250ms)
    this.app.ticker.add(() => {
      const fixedDelta = (250 / 1000) * 60;
      this.update(fixedDelta);
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

  /**
   * SceneKey에 맞는 씬 객체를 생성합니다
   * @param key 생성할 씬의 키
   * @returns 생성된 씬 객체
   */
  private createScene(key: SceneKey): Scene {
    console.log(`Creating new scene: ${key}`);

    // 에셋이 로드되지 않았으면 오류 표시
    if (!this.assetsLoaded) {
      console.warn(
        "에셋이 아직 로드되지 않았습니다. 씬이 제대로 표시되지 않을 수 있습니다."
      );
    }

    switch (key) {
      case SceneKey.MAIN:
        return new MainScene(this.app);
      // 추가 씬을 여기에 구현할 수 있습니다
      // case SceneKey.BATTLE:
      //   return new BattleScene(this.app);
      default:
        throw new Error(`Unknown scene key: ${key}`);
    }
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
    try {
      // 기존 씬과 같은 씬으로 전환하는 경우 무시
      if (this.currentSceneKey === key) {
        console.log(`Already in scene '${key}'`);
        return true;
      }

      // 캐시된 씬이 없으면 새로 생성
      if (!this.scenes.has(key)) {
        const newScene = this.createScene(key);
        this.scenes.set(key, newScene);
      }

      const nextScene = this.scenes.get(key)!;

      // 기존 씬이 있으면 제거
      if (
        this.currentScene &&
        this.currentScene instanceof PIXI.DisplayObject
      ) {
        this.app.stage.removeChild(this.currentScene);
      }

      // 새 씬 설정
      this.currentScene = nextScene;
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
    } catch (error) {
      console.error(`Error changing to scene '${key}':`, error);
      return false;
    }
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
    return Object.values(SceneKey);
  }

  public destroy(): void {
    // 정리 작업
    window.removeEventListener("resize", this.onResize.bind(this));
    this.app.destroy(true, {
      children: true,
      texture: true,
      baseTexture: true,
    });

    // 현재 씬이 MainScene이면 destroy 호출
    if (
      this.currentScene &&
      typeof (this.currentScene as any).destroy === "function"
    ) {
      (this.currentScene as any).destroy();
    }

    // 디버그 헬퍼 정리
    DebugHelper.removeAll();
  }
}
