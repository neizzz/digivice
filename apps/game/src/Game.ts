import * as PIXI from "pixi.js";
import { SceneKey } from "./SceneKey";
import type { Scene } from "./interfaces/Scene";
import type { ControlButtonParams, ControlButtonType } from "./ui/types";
import {
  MainSceneWorld,
  type MainSceneWorldData,
} from "./scenes/MainScene/world";
import type { SunTimesPayload } from "./scenes/MainScene/timeOfDay";
import { FlappyBirdGameScene } from "./scenes/FlappyBirdGameScene";
import { AssetLoader } from "./utils/AssetLoader";

PIXI.TexturePool.textureOptions.scaleMode = "nearest";

const SCREEN_HORIZONTAL_PADDING = 14;
const SCREEN_BOTTOM_PADDING = 14;
const SCREEN_TOP_PADDING = SCREEN_BOTTOM_PADDING + 6;
PIXI.TextureStyle.defaultOptions.scaleMode = "nearest";

export type ControlButtonsChangeCallback = (
  controlButtonParamsSet: [
    ControlButtonParams,
    ControlButtonParams,
    ControlButtonParams,
  ],
) => void;

export type CreateInitialGameDataCallback = () => Promise<{
  name: string;
  useLocalTime: boolean;
  cachedSunTimes?: SunTimesPayload | null;
}>;

// TODO: 컨트롤 버튼과 연계하는거 생각해야됨.
export type ShowSettingsCallback = (params: {
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
  onClose: () => void;
}) => void;
export type ShowAlertCallback = (message: string, title?: string) => void;
export type TriggerBiteVibrationCallback = () => void;
export type StartRecoveryVibrationCallback = () => void;
export type StopRecoveryVibrationCallback = () => void;
export type StartMiniGameCallback = () => unknown | Promise<unknown>;
export type SceneTransitionStateChangeCallback = (params: {
  requestId: number;
  from?: SceneKey;
  to: SceneKey;
  state: "loading" | "core_ready" | "failed";
}) => void;
export type GameDiagnosticsSnapshot = {
  currentSceneKey?: SceneKey;
  mainSceneData: MainSceneWorldData | null;
};

type NativeViewportSyncDetail = {
  reason?: string;
};

type FullscreenAdEventDetail = {
  state?: "showing" | "dismissed" | "failed";
};

function createMainScenePositionBoundary(width: number, height: number) {
  return {
    x: SCREEN_HORIZONTAL_PADDING,
    y: SCREEN_TOP_PADDING,
    width: width - 2 * SCREEN_HORIZONTAL_PADDING,
    height: height - SCREEN_TOP_PADDING - SCREEN_BOTTOM_PADDING,
  };
}

export class Game {
  public app: PIXI.Application;
  public changeControlButtons: ControlButtonsChangeCallback;
  public showSettings: ShowSettingsCallback; // 설정 화면 표시 콜백
  public showAlert: ShowAlertCallback; // 팝업 콜백 추가
  public triggerBiteVibration?: TriggerBiteVibrationCallback;
  public startRecoveryVibration?: StartRecoveryVibrationCallback;
  public stopRecoveryVibration?: StopRecoveryVibrationCallback;

  private _parentElement: HTMLElement;
  private _onSceneTransitionStateChange?: SceneTransitionStateChangeCallback;
  private _debugParentElement: HTMLElement;
  private _createInitialGameData: CreateInitialGameDataCallback;
  private _startMiniGame?: StartMiniGameCallback;
  private currentScene?: Scene;
  // private scenes: Map<SceneKey, Scene> = new Map();
  private currentSceneKey?: SceneKey;
  private assetsLoaded = false;
  private readonly _boundResizeHandler: () => void;
  private readonly _boundLifecycleResizeHandler: () => void;
  private readonly _boundVisibilityResizeHandler: () => void;
  private readonly _boundNativeViewportSyncHandler: (event: Event) => void;
  private readonly _boundFullscreenAdStateHandler: (event: Event) => void;
  private _resizeObserver?: ResizeObserver;
  private _resizeRafId: number | null = null;
  private _resizeRetryTimeoutIds: number[] = [];
  private _pendingResizeReason = "init";
  private _lastResizeMetricsKey: string | null = null;
  private _isPixiReady = false;
  private _isDestroyed = false;
  private _sceneTransitionRequestId = 0;
  private _isFullscreenAdActive = false;
  private _fullscreenAdResizeSuppressedUntil = 0;
  // private characterManager: CharacterManager; // CharacterManager 인스턴스 추가
  // private shouldSaveDataBeforeUnload = false;

  constructor(params: {
    parentElement: HTMLElement;
    debugParentElement?: HTMLElement;
    onCreateInitialGameData: CreateInitialGameDataCallback;
    changeControlButtons: ControlButtonsChangeCallback;
    showSettings: ShowSettingsCallback;
    showAlert: ShowAlertCallback; // 팝업 콜백 추가
    startMiniGame?: StartMiniGameCallback;
    triggerBiteVibration?: TriggerBiteVibrationCallback;
    startRecoveryVibration?: StartRecoveryVibrationCallback;
    stopRecoveryVibration?: StopRecoveryVibrationCallback;
    onSceneTransitionStateChange?: SceneTransitionStateChangeCallback;
  }) {
    const {
      parentElement,
      debugParentElement,
      onCreateInitialGameData,
      changeControlButtons,
      showSettings,
      showAlert,
      startMiniGame,
      triggerBiteVibration,
      startRecoveryVibration,
      stopRecoveryVibration,
      onSceneTransitionStateChange,
    } = params;
    this.changeControlButtons = changeControlButtons;
    this.showSettings = showSettings; // 설정 화면 표시 콜백
    this.showAlert = showAlert; // 팝업 콜백 저장
    this._startMiniGame = startMiniGame;
    this.triggerBiteVibration = triggerBiteVibration;
    this.startRecoveryVibration = startRecoveryVibration;
    this.stopRecoveryVibration = stopRecoveryVibration;
    this._onSceneTransitionStateChange = onSceneTransitionStateChange;
    this._createInitialGameData = onCreateInitialGameData;

    this.app = new PIXI.Application();
    this._boundResizeHandler = () => {
      this._requestAnimationFrameResize("window.resize");
    };
    this._boundLifecycleResizeHandler = () => {
      this._requestStableResize("window.lifecycle");
    };
    this._boundVisibilityResizeHandler = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        this._requestStableResize("document.visibilitychange");
      }
    };
    this._boundNativeViewportSyncHandler = (event: Event) => {
      const detail = (event as CustomEvent<NativeViewportSyncDetail>).detail;
      const reason =
        typeof detail?.reason === "string" && detail.reason.length > 0
          ? detail.reason
          : "unknown";

      this._requestAnimationFrameResize(`native.viewport_sync:${reason}`);
    };
    this._boundFullscreenAdStateHandler = (event: Event) => {
      const detail = (event as CustomEvent<FullscreenAdEventDetail>).detail;
      const state = detail?.state;

      if (state === "showing") {
        this._isFullscreenAdActive = true;
        this._fullscreenAdResizeSuppressedUntil = 0;
        this._clearResizeRetryTimeouts();

        if (this._resizeRafId !== null) {
          window.cancelAnimationFrame(this._resizeRafId);
          this._resizeRafId = null;
        }

        return;
      }

      if (state === "dismissed" || state === "failed") {
        this._isFullscreenAdActive = false;
        this._fullscreenAdResizeSuppressedUntil = Date.now() + 140;
      }
    };

    // 렌더링 주기를 60fps로 설정
    this._parentElement = parentElement;
    this._debugParentElement = debugParentElement ?? parentElement;

    // 리사이징 핸들러 설정
    window.addEventListener("resize", this._boundResizeHandler);
    window.addEventListener("focus", this._boundLifecycleResizeHandler);
    window.addEventListener("pageshow", this._boundLifecycleResizeHandler);
    document.addEventListener(
      "visibilitychange",
      this._boundVisibilityResizeHandler,
    );
    window.addEventListener(
      "digivice:native-viewport-sync",
      this._boundNativeViewportSyncHandler,
    );
    window.addEventListener(
      "digivice:fullscreen-ad",
      this._boundFullscreenAdStateHandler,
    );
    window.visualViewport?.addEventListener(
      "resize",
      this._boundLifecycleResizeHandler,
    );
    window.visualViewport?.addEventListener(
      "scroll",
      this._boundLifecycleResizeHandler,
    );

    if (typeof ResizeObserver !== "undefined") {
      this._resizeObserver = new ResizeObserver(() => {
        this._requestAnimationFrameResize("ResizeObserver");
      });
      this._resizeObserver.observe(this._parentElement);
    }
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
      this._isPixiReady = true;

      this.app.ticker.minFPS = 60;
      this.app.ticker.maxFPS = 0;
      this._parentElement.appendChild(this.app.canvas);
      this._onResize("initialize");

      this.assetsLoaded = true;

      // if (import.meta.env.DEV) {
      //   DebugUI.getInstance();
      // }

      await this._setupInitialScene();
      this._setupGameLoop();
      this.start();
    } catch (error) {
      console.error("[Game] 초기화 오류:", error);
      throw error;
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

  public preloadSceneAssets(key: SceneKey): Promise<void> {
    switch (key) {
      case SceneKey.FLAPPY_BIRD_GAME:
        return this._preloadFlappyBirdAssets();
      case SceneKey.MAIN:
      default:
        return Promise.resolve();
    }
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

  private _onResize(reason = "unknown"): void {
    if (this._isDestroyed) {
      return;
    }

    const parent = this._parentElement;
    if (!parent || !parent.getBoundingClientRect) {
      throw new Error("Parent element is not available.");
    }

    if (!this._isPixiReady || !this.app.renderer) {
      return;
    }

    const rect = parent.getBoundingClientRect();
    const width = parent.clientWidth || rect.width;
    const height = parent.clientHeight || rect.height;

    if (width <= 0 || height <= 0) {
      return;
    }

    const resolution = window.devicePixelRatio || 2;
    const metricsKey = [
      width,
      height,
      parent.clientWidth,
      parent.clientHeight,
      Math.round(rect.width),
      Math.round(rect.height),
      resolution,
    ].join("|");

    if (metricsKey === this._lastResizeMetricsKey) {
      return;
    }

    this._lastResizeMetricsKey = metricsKey;

    const previousStageScaleX = this.app.stage.scale.x;
    const previousStageScaleY = this.app.stage.scale.y;

    const stageScaleWasReset =
      Math.abs(previousStageScaleX - 1) > 1e-6 ||
      Math.abs(previousStageScaleY - 1) > 1e-6;

    if (stageScaleWasReset) {
      this.app.stage.scale.set(1, 1);
    }

    this.app.renderer.resolution = resolution;
    this.app.renderer.resize(width, height);

    if (stageScaleWasReset) {
      console.warn("[GameResize]", {
        phase: "stage-scale-reset",
        reason,
        width,
        height,
        previousStageScaleX,
        previousStageScaleY,
        normalizedStageScaleX: this.app.stage.scale.x,
        normalizedStageScaleY: this.app.stage.scale.y,
        screenWidth: this.app.screen.width,
        screenHeight: this.app.screen.height,
      });
    }

    if (
      this.currentScene &&
      "resize" in this.currentScene &&
      typeof this.currentScene.resize === "function"
    ) {
      this.currentScene.resize(width, height);
    }
  }

  private _requestAnimationFrameResize(reason = "unknown"): void {
    if (this._isDestroyed) {
      return;
    }

    if (this._shouldSuppressResize(reason)) {
      return;
    }

    if (typeof window === "undefined") {
      this._onResize(reason);
      return;
    }

    this._pendingResizeReason = reason;

    if (this._resizeRafId !== null) {
      window.cancelAnimationFrame(this._resizeRafId);
    }

    this._resizeRafId = window.requestAnimationFrame(() => {
      this._resizeRafId = null;
      const pendingReason = this._pendingResizeReason;
      this._pendingResizeReason = "raf-complete";
      this._onResize(pendingReason);
    });
  }

  private _clearResizeRetryTimeouts(): void {
    for (const timeoutId of this._resizeRetryTimeoutIds) {
      window.clearTimeout(timeoutId);
    }
    this._resizeRetryTimeoutIds = [];
  }

  private _requestStableResize(reason = "unknown"): void {
    if (this._isDestroyed) {
      return;
    }

    if (this._shouldSuppressResize(reason)) {
      return;
    }

    this._requestAnimationFrameResize(`${reason}:immediate`);
    this._clearResizeRetryTimeouts();

    for (const delay of [120, 320]) {
      const timeoutId = window.setTimeout(() => {
        this._requestAnimationFrameResize(`${reason}:retry-${delay}ms`);
      }, delay);
      this._resizeRetryTimeoutIds.push(timeoutId);
    }
  }

  private _shouldSuppressResize(reason: string): boolean {
    if (this._isFullscreenAdActive) {
      return true;
    }

    if (!reason.startsWith("native.viewport_sync")) {
      return Date.now() < this._fullscreenAdResizeSuppressedUntil;
    }

    return false;
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
          positionBoundary: createMainScenePositionBoundary(
            this.app.screen.width,
            this.app.screen.height,
          ),
          positionBoundaryInsets: {
            left: SCREEN_HORIZONTAL_PADDING,
            right: SCREEN_HORIZONTAL_PADDING,
            top: SCREEN_TOP_PADDING,
            bottom: SCREEN_BOTTOM_PADDING,
          },
          parentElement: this._parentElement,
          debugParentElement: this._debugParentElement,
          startMiniGame:
            this._startMiniGame ??
            (() => this.changeScene(SceneKey.FLAPPY_BIRD_GAME)),
          createInitialGameData: this._createInitialGameData,
          changeControlButtons: this.changeControlButtons,
          triggerBiteVibration: this.triggerBiteVibration,
          startRecoveryVibration: this.startRecoveryVibration,
          stopRecoveryVibration: this.stopRecoveryVibration,
        });
        await mainSceneWorld.init();
        return mainSceneWorld as unknown as Scene;

      case SceneKey.FLAPPY_BIRD_GAME:
        return new FlappyBirdGameScene(this).init();
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
    const previousSceneKey = this.currentSceneKey;
    const transitionRequestId = ++this._sceneTransitionRequestId;
    const transitionStartedAt =
      typeof performance !== "undefined" ? performance.now() : Date.now();

    try {
      console.log(
        `[GameTransition] start ${previousSceneKey ?? "none"} -> ${key} (#${transitionRequestId})`,
      );

      // 기존 씬과 같은 씬으로 전환하는 경우 무시
      if (this.currentSceneKey === key) {
        console.log(`[Game] 이미 ${key} 씬에 있습니다`);
        return true;
      }

      this._onSceneTransitionStateChange?.({
        requestId: transitionRequestId,
        from: previousSceneKey,
        to: key,
        state: "loading",
      });

      if (this.currentScene?.onSceneExit) {
        console.log(`[Game] 현재 씬 종료 처리 시작: ${this.currentSceneKey}`);
        await this.currentScene.onSceneExit();
      }

      if (this.currentScene) {
        this.currentScene.destroy();
        this.app.stage.removeChildren();
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

      if (this.currentScene instanceof PIXI.Container) {
        this.app.stage.addChild(this.currentScene);
      }

      this._onSceneTransitionStateChange?.({
        requestId: transitionRequestId,
        from: previousSceneKey,
        to: key,
        state: "core_ready",
      });

      // 새 씬이 DisplayObject이면 스테이지에 추가
      // if (this.currentScene instanceof PIXI.DisplayObject) {
      // this.app.stage.addChild(newScene);
      // }

      // 새 씬의 크기 조정
      // const { width, height } = this.app.renderer.screen;
      // this.currentScene.onResize(width, height);

      console.log(
        `[GameTransition] end ${previousSceneKey ?? "none"} -> ${key} (#${transitionRequestId}) in ${Math.round(
          (typeof performance !== "undefined"
            ? performance.now()
            : Date.now()) - transitionStartedAt,
        )}ms`,
      );
      return true;
    } catch (error) {
      console.error(`[Game] 씬 전환 오류 (${key}):`, error);
      this._onSceneTransitionStateChange?.({
        requestId: transitionRequestId,
        from: previousSceneKey,
        to: key,
        state: "failed",
      });
      return false;
    }
  }

  /**
   * 현재 활성화된 씬의 키를 반환합니다
   */
  public getCurrentSceneKey(): SceneKey | undefined {
    return this.currentSceneKey;
  }

  public getDiagnosticsSnapshot(): GameDiagnosticsSnapshot {
    return {
      currentSceneKey: this.currentSceneKey,
      mainSceneData:
        this.currentScene instanceof MainSceneWorld
          ? this.currentScene.getInMemoryData()
          : null,
    };
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

  private async _preloadFlappyBirdAssets(): Promise<void> {
    const preloadStartedAt =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    console.log("[GameTransition] mini-game preload start");

    await AssetLoader.preloadAssets();

    console.log(
      `[GameTransition] mini-game preload end in ${Math.round(
        (typeof performance !== "undefined" ? performance.now() : Date.now()) -
          preloadStartedAt,
      )}ms`,
    );
  }

  public destroy(): void {
    this._isDestroyed = true;
    this._isPixiReady = false;
    // 정리 작업
    window.removeEventListener("resize", this._boundResizeHandler);
    window.removeEventListener("focus", this._boundLifecycleResizeHandler);
    window.removeEventListener("pageshow", this._boundLifecycleResizeHandler);
    document.removeEventListener(
      "visibilitychange",
      this._boundVisibilityResizeHandler,
    );
    window.removeEventListener(
      "digivice:native-viewport-sync",
      this._boundNativeViewportSyncHandler,
    );
    window.removeEventListener(
      "digivice:fullscreen-ad",
      this._boundFullscreenAdStateHandler,
    );
    window.visualViewport?.removeEventListener(
      "resize",
      this._boundLifecycleResizeHandler,
    );
    window.visualViewport?.removeEventListener(
      "scroll",
      this._boundLifecycleResizeHandler,
    );
    this._resizeObserver?.disconnect();
    this._resizeObserver = undefined;
    this._clearResizeRetryTimeouts();
    if (this._resizeRafId !== null) {
      window.cancelAnimationFrame(this._resizeRafId);
      this._resizeRafId = null;
    }
    this.stop();
    this.app.destroy(true, {
      children: true,
      texture: true,
    });

    // 현재 씬이 MainScene이면 destroy 호출
    this.currentScene?.destroy?.();
  }
}
