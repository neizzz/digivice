import * as PIXI from "pixi.js";
import { SceneKey } from "./SceneKey";
import type { Scene } from "./interfaces/Scene";
import type { ControlButtonParams, ControlButtonType } from "./ui/types";
import { MainSceneWorld } from "./scenes/MainScene/world";

PIXI.TexturePool.textureOptions.scaleMode = "nearest";

const SCREEN_PADDING = 10;

export type ControlButtonsChangeCallback = (
  controlButtonParamsSet: [
    ControlButtonParams,
    ControlButtonParams,
    ControlButtonParams,
  ],
) => void;

export type CreateInitialGameDataCallback = () => Promise<{
  name: string;
}>;

// TODO: 컨트롤 버튼과 연계하는거 생각해야됨.
export type ShowSettingsCallback = (params: {
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
  onClose: () => void;
}) => void;
export type ShowAlertCallback = (message: string, title?: string) => void;

export class Game {
  public app: PIXI.Application;
  public changeControlButtons: ControlButtonsChangeCallback;
  public showSettings: ShowSettingsCallback; // 설정 화면 표시 콜백
  public showAlert: ShowAlertCallback; // 팝업 콜백 추가

  private _parentElement: HTMLElement;
  private _createInitialGameData: CreateInitialGameDataCallback;
  private currentScene?: Scene;
  // private scenes: Map<SceneKey, Scene> = new Map();
  private currentSceneKey?: SceneKey;
  private assetsLoaded = false;
  private readonly _boundResizeHandler: () => void;
  // private characterManager: CharacterManager; // CharacterManager 인스턴스 추가
  // private shouldSaveDataBeforeUnload = false;

  constructor(params: {
    parentElement: HTMLElement;
    onCreateInitialGameData: CreateInitialGameDataCallback;
    changeControlButtons: ControlButtonsChangeCallback;
    showSettings: ShowSettingsCallback;
    showAlert: ShowAlertCallback; // 팝업 콜백 추가
  }) {
    const {
      parentElement,
      onCreateInitialGameData,
      changeControlButtons,
      showSettings,
      showAlert,
    } = params;
    this.changeControlButtons = changeControlButtons;
    this.showSettings = showSettings; // 설정 화면 표시 콜백
    this.showAlert = showAlert; // 팝업 콜백 저장
    this._createInitialGameData = onCreateInitialGameData;

    this.app = new PIXI.Application();
    this._boundResizeHandler = this._onResize.bind(this);

    // 렌더링 주기를 60fps로 설정
    this._parentElement = parentElement;

    // 리사이징 핸들러 설정
    window.addEventListener("resize", this._boundResizeHandler);
  }

  /**
   * ControlButton 클릭 이벤트를 처리합니다
   * @param buttonType 클릭된 버튼 타입
   */
  public handleControlButtonClick(buttonType: ControlButtonType): void {
    this.currentScene?.handleControlButtonClick(buttonType);
  }

  public handleSliderValueChange(value: number): void {
    this.currentScene?.handleSliderValueChange?.(value);
  }
  public handleSliderEnd(): void {
    this.currentScene?.handleSliderEnd?.();
  }

  /** NOTE: 싱글턴 인스턴스가 모두 초기화되고 호출되어야 함. */
  public async initialize(): Promise<void> {
    try {
      await this.app.init({
        width: this._parentElement.clientWidth,
        height: this._parentElement.clientHeight,
        backgroundColor: 0xaaaaaa,
        autoDensity: true,
        resolution: window.devicePixelRatio || 2, // 해상도를 디바이스 픽셀 비율로 설정하거나 원하는 값(예: 2)으로 설정
      });

      this.app.ticker.minFPS = 60;
      this.app.ticker.maxFPS = 60;
      this._parentElement.appendChild(this.app.canvas);
      this._onResize();

      this.assetsLoaded = true;

      // if (import.meta.env.DEV) {
      //   DebugUI.getInstance();
      // }

      await this._setupInitialScene();
      this._setupGameLoop();
      this.start();
    } catch (error) {
      console.error("[Game] 초기화 오류:", error);
    }
  }

  public start(): void {
    this.app.ticker.start();
  }

  public stop(): void {
    this.app.ticker.stop();
  }

  private async _setupInitialScene(): Promise<void> {
    await this.changeScene(SceneKey.MAIN);
  }

  private _setupGameLoop(): void {
    // 앱 포커스 이벤트 리스너 설정
    this._setupAppLifecycleListeners();

    this.app.ticker.add((ticker: PIXI.Ticker) => {
      this._update(ticker.deltaMS);
    });
  }

  /**
   * 앱 포커스 이벤트 리스너 설정
   */
  private _setupAppLifecycleListeners(): void {
    // 브라우저 환경에서만 동작
    // NOTE: ❗️❗️❗️❗️❗️
    // if (typeof document !== "undefined" && typeof window !== "undefined") {
    //   // NOTE: PC브라우저 디버깅용 새로고침/탭 닫힘 감지용 플래그
    //   window.addEventListener("reload", async () => {
    //     const gameData = await GameDataManager._loadData();
    //     this.shouldSaveDataBeforeUnload = !!gameData;
    //   });
    //   window.addEventListener("beforeunload", async () => {
    //     const gameData = await GameDataManager._loadData();
    //     this.shouldSaveDataBeforeUnload = !!gameData;
    //   });
    //   // 페이지 숨김/표시 이벤트
    //   document.addEventListener("visibilitychange", async () => {
    //     // NOTE: 앱이 새로 켜질때는 Game생성자에서 처리. 여기서는 앱끄기/홈버튼/resume 케이스만 다룸.
    //     if (document.hidden) {
    //       // "앱끄기/홈버튼" 시점
    //       console.log("[Game] 앱 상태 변경: background-running");
    //       this.app.ticker.stop(); // 게임 루프 중지
    //       if (this.shouldSaveDataBeforeUnload) {
    //         console.log("[Game] 화면이 꺼지기 전에 게임 데이터 저장.");
    //         this.saveGameState();
    //       }
    //     } else {
    //       // "resume" 시점
    //       console.log("[Game] 앱 상태 변경: active");
    //       const gameData = (await GameDataManager.getData()) as GameData;
    //       const lastCheckData =
    //         (await LastCheckDataManager.loadData()) as LastCheckData;
    //       const elapsedTime = Date.now() - gameData._savedAt;
    //       const { resultGameData, resultLastCheckData } =
    //         simulateCharacterStatus({
    //           elapsedTime: elapsedTime,
    //           inputGameData: gameData,
    //           inputCheckData: lastCheckData,
    //         });
    //       this.characterManager.updateCharacter({
    //         before: gameData.character,
    //         after: resultGameData.character,
    //       });
    //       this.app.ticker.start();
    //       GameDataManager._saveData(resultGameData);
    //       LastCheckDataManager._saveData(resultLastCheckData);
    //     }
    //   });
    // }
  }

  /**
   * 게임 상태(캐릭터 위치, 상태 등)를 저장합니다.
   */
  // private saveGameState(): void {
  //   // 캐릭터 위치와 상태 저장
  //   const character = this.characterManager.getCharacter();
  //   if (character) {
  //     character.savePositionAndState();
  //   }
  //   false;
  // }

  private _update(deltaTime: number): void {
    this.currentScene?.update(deltaTime);
  }

  /**
   * PIXI 애플리케이션이 완전히 초기화될 때까지 대기
   */
  // private _waitForAppInitialization = (): Promise<void> => {
  //   return new Promise<void>((resolve) => {
  //     const onFirstRender = () => {
  //       // 한 번 실행 후 제거
  //       this.app.ticker.remove(onFirstRender);
  //       resolve();
  //     };

  //     // 다음 프레임에서 초기화 완료로 간주
  //     this.app.ticker.add(onFirstRender);
  //   });
  // };

  private _onResize(): void {
    const parent = this._parentElement;
    if (!parent || !parent.getBoundingClientRect) {
      throw new Error("Parent element is not available.");
    }
    const { width, height } = parent.getBoundingClientRect();
    this.app.renderer.resize(width, height);
    this.app.renderer.resolution = window.devicePixelRatio || 2;
    this.app.stage.setSize(width, height);
    if (
      this.currentScene &&
      "resize" in this.currentScene &&
      typeof this.currentScene.resize === "function"
    ) {
      this.currentScene.resize(width, height);
    }
  }

  /**
   * SceneKey에 맞는 씬 객체를 생성합니다
   * @param key 생성할 씬의 키
   * @returns 생성된 씬 객체
   */
  private async _createScene(
    key: SceneKey,
    // gameData: GameData
  ): Promise<Scene> {
    console.log(`[Game] Creating new scene: ${key}`);

    // 에셋이 로드되지 않았으면 오류 표시
    if (!this.assetsLoaded) {
      console.warn(
        "[Game] 에셋이 아직 로드되지 않았습니다. 씬이 제대로 표시되지 않을 수 있습니다.",
      );
    }

    switch (key) {
      case SceneKey.MAIN:
        const mainSceneWorld = new MainSceneWorld({
          stage: this.app.stage,
          positionBoundary: {
            x: SCREEN_PADDING,
            y: SCREEN_PADDING,
            width: this.app.screen.width - 2 * SCREEN_PADDING,
            height: this.app.screen.height - 2 * SCREEN_PADDING,
          },
          parentElement: this._parentElement,
          createInitialGameData: this._createInitialGameData,
          changeControlButtons: this.changeControlButtons,
        });
        await mainSceneWorld.init();
        return mainSceneWorld as unknown as Scene;

      // case SceneKey.FLAPPY_BIRD_GAME:
      //   return new FlappyBirdGameScene(this).init();
      default:
        throw new Error(`[Game] Unknown scene key: ${key}`);
    }
  }

  /**
   * 씬을 키를 통해 전환합니다
   * @param key 전환할 씬의 키
   * @returns 성공 여부
   */
  public async changeScene(key: SceneKey): Promise<boolean> {
    try {
      console.log(`[Game] 씬 전환 요청: ${key}`);

      // 기존 씬과 같은 씬으로 전환하는 경우 무시
      if (this.currentSceneKey === key) {
        console.log(`[Game] 이미 ${key} 씬에 있습니다`);
        return true;
      }

      if (this.currentScene?.onSceneExit) {
        console.log(`[Game] 현재 씬 종료 처리 시작: ${this.currentSceneKey}`);
        await this.currentScene.onSceneExit();
      }

      // 캐시된 씬이 없으면 새로 생성
      // if (!this.scenes.has(key)) {
      //   console.log(`[Game] 새로운 씬 생성: ${key}`);
      //   // const gameData = await GameDataManager.getData();
      //   // const newScene = await this._createScene(key, gameData as GameData);
      //   this.scenes.set(key, newScene);
      // }

      // // 기존 씬이 있으면 제거
      // if (
      //   this.currentScene &&
      //   this.currentScene instanceof PIXI.DisplayObject
      // ) {
      //   console.log(`[Game] 기존 씬 제거: ${this.currentSceneKey}`);
      //   this.app.stage.removeChild(this.currentScene);
      // }

      this.currentScene = await this._createScene(key);
      this.currentSceneKey = key;

      // 새 씬이 DisplayObject이면 스테이지에 추가
      // if (this.currentScene instanceof PIXI.DisplayObject) {
      // this.app.stage.addChild(newScene);
      // }

      // 새 씬의 크기 조정
      // const { width, height } = this.app.renderer.screen;
      // this.currentScene.onResize(width, height);

      console.log(`[Game] 씬 전환 완료: ${key}`);
      return true;
    } catch (error) {
      console.error(`[Game] 씬 전환 오류 (${key}):`, error);
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

  // public getCharacterManager(): CharacterManager {
  //   return this.characterManager;
  // }

  // /**
  //  * 게임 데이터를 가져옵니다
  //  * @returns 게임 데이터
  //  */
  // public async getData(): Promise<GameData | undefined> {
  //   try {
  //     const gameData = await GameDataManager.getData();
  //     return gameData;
  //   } catch (error) {
  //     console.error("[Game] 게임 데이터 로드 중 오류:", error);
  //     return undefined;
  //   }
  // }

  public async destroyForReset(): Promise<void> {
    this.stop();

    if (this.currentScene instanceof MainSceneWorld) {
      await this.currentScene.disablePersistenceAndClearData();
    }

    this.destroy();
  }

  public destroy(): void {
    // 정리 작업
    window.removeEventListener("resize", this._boundResizeHandler);
    this.stop();
    this.app.destroy(true, {
      children: true,
      texture: true,
    });

    // 현재 씬이 MainScene이면 destroy 호출
    this.currentScene?.destroy?.();
  }
}
