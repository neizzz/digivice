import { DEFAULT_LOCALE, type LocaleCode } from "@shared/i18n";
import * as PIXI from "pixi.js";
import { SceneKey } from "./SceneKey";
import type { Scene } from "./interfaces/Scene";
import type { ControlButtonParams, ControlButtonType } from "./ui/types";
import { MainSceneWorld, type MainSceneWorldData } from "./scenes/MainScene/world";
import type { MainSceneLoadingTraceContext } from "./scenes/MainScene/diagnostics/mainSceneInitDiagnostics";
import {
  TimeOfDay,
  TimeOfDayMode,
  type SunTimesPayload,
} from "./scenes/MainScene/timeOfDay";
import { FlappyBirdGameScene } from "./scenes/FlappyBirdGameScene";
import { MonsterBookScene } from "./scenes/MonsterBookScene";
import {
  FLAPPY_BIRD_RETRO_FONT_PRELOAD_TIMEOUT_MS,
  preloadFlappyBirdRetroFont,
} from "./scenes/FlappyBirdGameScene/ui";
import { CharacterState } from "./scenes/MainScene/types";
import { CharacterKey } from "./types/Character";
import { AssetLoader } from "./utils/AssetLoader";
import { trustedClock, type TrustedClock } from "./utils/TrustedClock";

PIXI.TexturePool.textureOptions.scaleMode = "nearest";
PIXI.TextureStyle.defaultOptions.scaleMode = "nearest";

const SCREEN_HORIZONTAL_PADDING = 14;
const SCREEN_BOTTOM_PADDING = 14;
const SCREEN_TOP_PADDING = SCREEN_BOTTOM_PADDING + 6;
const MAX_RENDERER_RESOLUTION = 2;
const DEFAULT_TICKER_MIN_FPS = 30;
const DEFAULT_TICKER_MAX_FPS = 60;
const FLAPPY_BIRD_TICKER_MIN_FPS = 0;
const FLAPPY_BIRD_TICKER_MAX_FPS = 0;

export type ControlButtonsChangeCallback = (
  controlButtonParamsSet:
    | [ControlButtonParams, ControlButtonParams, ControlButtonParams]
    | null,
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
export type ShowMonsterInfoCallback = () => void;
export type ShowAlertCallback = (message: string, title?: string) => void;
export type TriggerBiteVibrationCallback = () => void;
export type TriggerTransientVibrationCallback = (params: {
  durationMs: number;
  strength: number;
}) => void;
export type MainSceneSfxKind = "food-throw" | "syringe-insert";
export type TriggerMainSceneSfxCallback = (kind: MainSceneSfxKind) => void;
export type StartRecoveryVibrationCallback = () => void;
export type StopRecoveryVibrationCallback = () => void;
export type StartMiniGameCallback = () => unknown | Promise<unknown>;
export type GetFlappyBirdBestScoreCallback = () => Promise<number>;
export type PersistFlappyBirdBestScoreCallback = (
  score: number,
) => Promise<void>;
export type ShowFlappyBirdGameOverCallback = (params: {
  onRestart: () => void;
  onExit: () => void | Promise<void>;
}) => void;
export type HideFlappyBirdGameOverCallback = () => void;
export type ShowFlappyBirdSettingsMenuCallback = (params: {
  isBgmEnabled: boolean;
  isSfxEnabled: boolean;
  onChangeBgm: (enabled: boolean) => void | Promise<void>;
  onChangeSfx: (enabled: boolean) => void | Promise<void>;
  selectedTimeOfDay?: TimeOfDay;
  onSelectTimeOfDay?: (timeOfDay: TimeOfDay) => void | Promise<void>;
  onResume: () => void | Promise<void>;
  onExit: () => void | Promise<void>;
}) => void;
export type HideFlappyBirdSettingsMenuCallback = () => void;
export type SceneTransitionStateChangeCallback = (params: {
  requestId: number;
  from?: SceneKey;
  to: SceneKey;
  state: "loading" | "core_ready" | "failed" | "interrupted";
}) => void;
export type MainSceneReentrySimulationStateChangeCallback = (params: {
  source: "init" | "app_resume" | "manual";
  phase: "started" | "finished";
  result?: "completed" | "skipped" | "failed";
  error?: unknown;
}) => void;
export type FlappyBirdSkyContext = {
  mode: TimeOfDayMode;
  timeOfDay: TimeOfDay;
  sunTimes: SunTimesPayload | null;
};
export type GameDiagnosticsSnapshot = {
  currentSceneKey?: SceneKey;
  mainSceneData: MainSceneWorldData | null;
};

export type MainCharacterInfoSnapshot = {
  monsterName: string;
  isEgg: boolean;
  evolutionPhase: number;
  stamina: number;
  maxStamina: number;
  unhappyThreshold: number;
  boostedThreshold: number;
  evolutionGauge: number;
  maxEvolutionGauge: number;
};

type NativeViewportSyncDetail = {
  reason?: string;
};

type FullscreenAdEventDetail = {
  state?: "showing" | "dismissed" | "failed";
};

type SceneTransitionInterruptReason = "back_navigation" | "app_hidden";
type PendingSceneTransitionInterruption = {
  fallbackScene: SceneKey;
  reason: SceneTransitionInterruptReason;
};
type ActiveSceneTransitionPhase = "exiting_current" | "creating_target";
type ActiveSceneTransition = {
  requestId: number;
  from?: SceneKey;
  to: SceneKey;
  phase: ActiveSceneTransitionPhase;
  parkedScene?: Scene;
  parkedSceneKey?: SceneKey;
  interruption: PendingSceneTransitionInterruption | null;
  restorationStarted: boolean;
  stateChangeEmitted: boolean;
};

function createMainScenePositionBoundary(width: number, height: number) {
  return {
    x: SCREEN_HORIZONTAL_PADDING,
    y: SCREEN_TOP_PADDING,
    width: width - 2 * SCREEN_HORIZONTAL_PADDING,
    height: height - SCREEN_TOP_PADDING - SCREEN_BOTTOM_PADDING,
  };
}

function getTransitionTimingNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function resolveTickerMaxFPS(sceneKey?: SceneKey): number {
  return sceneKey === SceneKey.FLAPPY_BIRD_GAME
    ? FLAPPY_BIRD_TICKER_MAX_FPS
    : DEFAULT_TICKER_MAX_FPS;
}

function resolveTickerMinFPS(sceneKey?: SceneKey): number {
  return sceneKey === SceneKey.FLAPPY_BIRD_GAME
    ? FLAPPY_BIRD_TICKER_MIN_FPS
    : DEFAULT_TICKER_MIN_FPS;
}

function resolveRendererResolution(devicePixelRatio?: number): number {
  if (
    typeof devicePixelRatio !== "number" ||
    !Number.isFinite(devicePixelRatio) ||
    devicePixelRatio <= 0
  ) {
    return MAX_RENDERER_RESOLUTION;
  }

  return Math.min(devicePixelRatio, MAX_RENDERER_RESOLUTION);
}

function summarizeTransitionError(error: unknown): {
  name?: string;
  message: string;
} {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    message: String(error),
  };
}

export class Game {
  public app: PIXI.Application;
  public changeControlButtons: ControlButtonsChangeCallback;
  public showSettings: ShowSettingsCallback; // 설정 화면 표시 콜백
  public showMonsterInfo: ShowMonsterInfoCallback;
  public showAlert: ShowAlertCallback; // 팝업 콜백 추가
  public triggerBiteVibration?: TriggerBiteVibrationCallback;
  public triggerMainSceneSfx?: TriggerMainSceneSfxCallback;
  public triggerTransientVibration?: TriggerTransientVibrationCallback;
  public startRecoveryVibration?: StartRecoveryVibrationCallback;
  public stopRecoveryVibration?: StopRecoveryVibrationCallback;
  public getFlappyBirdBestScore?: GetFlappyBirdBestScoreCallback;
  public persistFlappyBirdBestScore?: PersistFlappyBirdBestScoreCallback;
  public showFlappyBirdGameOver?: ShowFlappyBirdGameOverCallback;
  public hideFlappyBirdGameOver?: HideFlappyBirdGameOverCallback;
  public showFlappyBirdSettingsMenu?: ShowFlappyBirdSettingsMenuCallback;
  public hideFlappyBirdSettingsMenu?: HideFlappyBirdSettingsMenuCallback;

  private _locale: LocaleCode;
  private _parentElement: HTMLElement;
  private _onSceneTransitionStateChange?: SceneTransitionStateChangeCallback;
  private _onMainSceneReentrySimulationStateChange?: MainSceneReentrySimulationStateChangeCallback;
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
  private _pendingSceneTransitionInterruptions = new Map<
    number,
    PendingSceneTransitionInterruption
  >();
  private _activeSceneTransition: ActiveSceneTransition | null = null;
  private readonly _initialSceneKey: SceneKey;
  private readonly _debugMode: boolean;
  private _flappyBirdCharacterKey: CharacterKey | null = null;
  private _flappyBirdCharacterState: CharacterState | null = null;
  private _flappyBirdSkyContext: FlappyBirdSkyContext | null = null;
  private _loadingTraceContext: MainSceneLoadingTraceContext | null = null;
  private readonly _trustedClock: TrustedClock;
  // private characterManager: CharacterManager; // CharacterManager 인스턴스 추가
  // private shouldSaveDataBeforeUnload = false;

  constructor(params: {
    parentElement: HTMLElement;
    debugParentElement?: HTMLElement;
    debugMode?: boolean;
    locale?: LocaleCode;
    initialSceneKey?: SceneKey;
    onCreateInitialGameData: CreateInitialGameDataCallback;
    changeControlButtons: ControlButtonsChangeCallback;
    showSettings: ShowSettingsCallback;
    showMonsterInfo: ShowMonsterInfoCallback;
    showAlert: ShowAlertCallback; // 팝업 콜백 추가
    startMiniGame?: StartMiniGameCallback;
    triggerBiteVibration?: TriggerBiteVibrationCallback;
    triggerMainSceneSfx?: TriggerMainSceneSfxCallback;
    triggerTransientVibration?: TriggerTransientVibrationCallback;
    startRecoveryVibration?: StartRecoveryVibrationCallback;
    stopRecoveryVibration?: StopRecoveryVibrationCallback;
    getFlappyBirdBestScore?: GetFlappyBirdBestScoreCallback;
    persistFlappyBirdBestScore?: PersistFlappyBirdBestScoreCallback;
    showFlappyBirdGameOver?: ShowFlappyBirdGameOverCallback;
    hideFlappyBirdGameOver?: HideFlappyBirdGameOverCallback;
    showFlappyBirdSettingsMenu?: ShowFlappyBirdSettingsMenuCallback;
    hideFlappyBirdSettingsMenu?: HideFlappyBirdSettingsMenuCallback;
    onSceneTransitionStateChange?: SceneTransitionStateChangeCallback;
    onMainSceneReentrySimulationStateChange?: MainSceneReentrySimulationStateChangeCallback;
    loadingTraceContext?: MainSceneLoadingTraceContext | null;
    trustedClock?: TrustedClock;
  }) {
    const {
      parentElement,
      debugParentElement,
      debugMode,
      locale = DEFAULT_LOCALE,
      initialSceneKey,
      onCreateInitialGameData,
      changeControlButtons,
      showSettings,
      showMonsterInfo,
      showAlert,
      startMiniGame,
      triggerBiteVibration,
      triggerMainSceneSfx,
      triggerTransientVibration,
      startRecoveryVibration,
      stopRecoveryVibration,
      getFlappyBirdBestScore,
      persistFlappyBirdBestScore,
      showFlappyBirdGameOver,
      hideFlappyBirdGameOver,
      showFlappyBirdSettingsMenu,
      hideFlappyBirdSettingsMenu,
      onSceneTransitionStateChange,
      onMainSceneReentrySimulationStateChange,
      loadingTraceContext,
      trustedClock: providedTrustedClock,
    } = params;
    this.changeControlButtons = changeControlButtons;
    this.showSettings = showSettings; // 설정 화면 표시 콜백
    this.showMonsterInfo = showMonsterInfo;
    this.showAlert = showAlert; // 팝업 콜백 저장
    this._startMiniGame = startMiniGame;
    this.triggerBiteVibration = triggerBiteVibration;
    this.triggerMainSceneSfx = triggerMainSceneSfx;
    this.triggerTransientVibration = triggerTransientVibration;
    this.startRecoveryVibration = startRecoveryVibration;
    this.stopRecoveryVibration = stopRecoveryVibration;
    this.getFlappyBirdBestScore = getFlappyBirdBestScore;
    this.persistFlappyBirdBestScore = persistFlappyBirdBestScore;
    this.showFlappyBirdGameOver = showFlappyBirdGameOver;
    this.hideFlappyBirdGameOver = hideFlappyBirdGameOver;
    this.showFlappyBirdSettingsMenu = showFlappyBirdSettingsMenu;
    this.hideFlappyBirdSettingsMenu = hideFlappyBirdSettingsMenu;
    this._onSceneTransitionStateChange = onSceneTransitionStateChange;
    this._onMainSceneReentrySimulationStateChange =
      onMainSceneReentrySimulationStateChange;
    this._createInitialGameData = onCreateInitialGameData;
    this._initialSceneKey = initialSceneKey ?? SceneKey.MAIN;
    this._debugMode = debugMode ?? false;
    this._locale = locale;
    this._loadingTraceContext = loadingTraceContext ?? null;
    this._trustedClock = providedTrustedClock ?? trustedClock;

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


  public getLocale(): LocaleCode {
    return this._locale;
  }

  public setLocale(locale: LocaleCode): void {
    this._locale = locale;
    this.currentScene?.onLocaleChange?.(locale);
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
      await (this._trustedClock ?? trustedClock).initialize();
      await this.app.init({
        width: this._parentElement.clientWidth,
        height: this._parentElement.clientHeight,
        backgroundColor: 0xaaaaaa,
        autoDensity: true,
        roundPixels: true,
        preference: "webgl",
        preferWebGLVersion: 2,
        powerPreference: "high-performance",
        resolution: resolveRendererResolution(window.devicePixelRatio),
      });
      this._isPixiReady = true;
      console.log("[ImportantDiagnostics][RendererResolution]", {
        phase: "initialize",
        rawDevicePixelRatio: window.devicePixelRatio ?? null,
        appliedResolution: this.app.renderer.resolution,
        maxRendererResolution: MAX_RENDERER_RESOLUTION,
      });

      this._applyTickerFramePolicy();
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
    await this.changeScene(this._initialSceneKey);
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
    const scene = this.currentScene;

    if (!scene) {
      return;
    }

    scene.update(deltaTime);
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

    const rawDevicePixelRatio = window.devicePixelRatio || 0;
    const resolution = resolveRendererResolution(rawDevicePixelRatio);
    const metricsKey = [
      width,
      height,
      parent.clientWidth,
      parent.clientHeight,
      Math.round(rect.width),
      Math.round(rect.height),
      rawDevicePixelRatio,
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
    console.log("[ImportantDiagnostics][RendererResolution]", {
      phase: "resize",
      reason,
      width,
      height,
      rawDevicePixelRatio,
      appliedResolution: resolution,
      maxRendererResolution: MAX_RENDERER_RESOLUTION,
    });

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
        const loadingTraceContext = this._loadingTraceContext;
        this._loadingTraceContext = null;
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
          debugMode: this._debugMode,
          startMiniGame:
            this._startMiniGame ??
            (() => this.changeScene(SceneKey.FLAPPY_BIRD_GAME)),
          startMonsterBook: () => this.changeScene(SceneKey.MONSTER_BOOK),
          createInitialGameData: this._createInitialGameData,
          changeControlButtons: this.changeControlButtons,
          showMonsterInfo: this.showMonsterInfo,
          showAlert: this.showAlert,
          locale: this._locale,
          triggerBiteVibration: this.triggerBiteVibration,
          triggerTransientVibration: this.triggerTransientVibration,
          triggerMainSceneSfx: this.triggerMainSceneSfx,
          startRecoveryVibration: this.startRecoveryVibration,
          stopRecoveryVibration: this.stopRecoveryVibration,
          shouldDeferPersistence: () =>
            this.currentSceneKey === SceneKey.FLAPPY_BIRD_GAME,
          loadingTraceContext,
          trustedClock: this._trustedClock,
          onReentrySimulationStateChange:
            this._onMainSceneReentrySimulationStateChange,
        });
        await mainSceneWorld.init();
        return mainSceneWorld as unknown as Scene;

      case SceneKey.FLAPPY_BIRD_GAME:
        return new FlappyBirdGameScene(this).init();
      case SceneKey.MONSTER_BOOK:
        return new MonsterBookScene(this).init();
      default:
        throw new Error(`[Game] Unknown scene key: ${key}`);
    }
  }

  private _applyTickerFramePolicy(sceneKey = this.currentSceneKey): void {
    this.app.ticker.maxFPS = resolveTickerMaxFPS(sceneKey);
    this.app.ticker.minFPS = resolveTickerMinFPS(sceneKey);
  }

  private async _restoreParkedSceneAfterTransitionAbort(
    transition: ActiveSceneTransition,
    state: "interrupted" | "failed",
  ): Promise<void> {
    if (transition.restorationStarted) {
      return;
    }

    transition.restorationStarted = true;

    const parkedScene = transition.parkedScene;
    const parkedSceneKey = transition.parkedSceneKey;

    if (parkedScene) {
      this.currentScene = parkedScene;
      this.currentSceneKey = parkedSceneKey;
      this._applyTickerFramePolicy(parkedSceneKey);

      if (parkedScene instanceof PIXI.Container) {
        this.app.stage.removeChildren();

        if (parkedScene.parent !== this.app.stage) {
          this.app.stage.addChild(parkedScene);
        }
      }
    }

    if (!transition.stateChangeEmitted) {
      this._onSceneTransitionStateChange?.({
        requestId: transition.requestId,
        from: transition.from,
        to: transition.to,
        state,
      });
      transition.stateChangeEmitted = true;
    }

    if (parkedScene?.onSceneReenter) {
      try {
        await parkedScene.onSceneReenter();
      } catch (error) {
        console.error(
          "[Game] Failed to restore parked scene after aborted transition:",
          error,
        );
      }
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
    const transitionStartedAt = getTransitionTimingNow();
    const transitionContext: ActiveSceneTransition = {
      requestId: transitionRequestId,
      from: previousSceneKey,
      to: key,
      phase: "exiting_current",
      parkedScene: this.currentScene,
      parkedSceneKey: this.currentSceneKey,
      interruption: null,
      restorationStarted: false,
      stateChangeEmitted: false,
    };
    this._activeSceneTransition = transitionContext;
    const consumePendingInterruption = () => {
      const interruption =
        this._pendingSceneTransitionInterruptions.get(transitionRequestId) ??
        null;

      if (interruption) {
        this._pendingSceneTransitionInterruptions.delete(transitionRequestId);
      }

      return interruption;
    };
    const logTransitionPhase = (
      phase: string,
      payload: Record<string, unknown> = {},
    ) => {
      console.log("[ImportantDiagnostics][SceneTransitionTiming]", {
        phase,
        requestId: transitionRequestId,
        from: previousSceneKey ?? null,
        to: key,
        elapsedMs: Math.round(getTransitionTimingNow() - transitionStartedAt),
        initializationAttemptId:
          this._loadingTraceContext?.initializationAttemptId ?? null,
        setupFlowId: this._loadingTraceContext?.setupFlowId ?? null,
        bootstrapState: this._loadingTraceContext?.bootstrapState ?? null,
        ...payload,
      });
    };

    try {
      logTransitionPhase("changeScene_start");
      console.log(
        `[GameTransition] start ${previousSceneKey ?? "none"} -> ${key} (#${transitionRequestId})`,
      );

      // 기존 씬과 같은 씬으로 전환하는 경우 무시
      if (this.currentSceneKey === key) {
        console.log(`[Game] 이미 ${key} 씬에 있습니다`);
        logTransitionPhase("changeScene_skipped_same_scene");
        return true;
      }

      this._onSceneTransitionStateChange?.({
        requestId: transitionRequestId,
        from: previousSceneKey,
        to: key,
        state: "loading",
      });

      if (key === SceneKey.FLAPPY_BIRD_GAME) {
        const preloadSceneStartedAt = getTransitionTimingNow();
        logTransitionPhase("preloadSceneAssets_start");
        await this.preloadSceneAssets(key);
        logTransitionPhase("preloadSceneAssets_end", {
          durationMs: Math.round(
            getTransitionTimingNow() - preloadSceneStartedAt,
          ),
        });

        const interruptedAfterPreload = consumePendingInterruption();
        if (interruptedAfterPreload) {
          logTransitionPhase("changeScene_interrupted_after_preload", {
            reason: interruptedAfterPreload.reason,
            fallbackScene: interruptedAfterPreload.fallbackScene,
          });

          if (
            this.currentSceneKey === interruptedAfterPreload.fallbackScene &&
            this.currentScene?.onSceneReenter
          ) {
            await this.currentScene.onSceneReenter();
          }

          this._onSceneTransitionStateChange?.({
            requestId: transitionRequestId,
            from: previousSceneKey,
            to: key,
            state: "interrupted",
          });
          return false;
        }
      }

      if (this.currentScene?.onSceneExit) {
        console.log(`[Game] 현재 씬 종료 처리 시작: ${this.currentSceneKey}`);
        const sceneExitStartedAt = getTransitionTimingNow();
        logTransitionPhase("onSceneExit_start", {
          currentSceneKey: this.currentSceneKey ?? null,
        });
        await this.currentScene.onSceneExit();
        logTransitionPhase("onSceneExit_end", {
          currentSceneKey: this.currentSceneKey ?? null,
          durationMs: Math.round(getTransitionTimingNow() - sceneExitStartedAt),
        });
      }

      const interruptedBeforeDestroy = consumePendingInterruption();
      if (interruptedBeforeDestroy) {
        logTransitionPhase("changeScene_interrupted_before_destroy", {
          reason: interruptedBeforeDestroy.reason,
          fallbackScene: interruptedBeforeDestroy.fallbackScene,
        });

        if (
          this.currentSceneKey === interruptedBeforeDestroy.fallbackScene &&
          this.currentScene?.onSceneReenter
        ) {
          await this.currentScene.onSceneReenter();
        }

        this._onSceneTransitionStateChange?.({
          requestId: transitionRequestId,
          from: previousSceneKey,
          to: key,
          state: "interrupted",
        });
        return false;
      }

      if (this.currentScene instanceof MainSceneWorld) {
        this._syncFlappyBirdSkyContextFromMainScene(this.currentScene);
        this._syncFlappyBirdCharacterKeyFromMainScene(this.currentScene);
      }

      transitionContext.phase = "creating_target";
      transitionContext.parkedScene = this.currentScene;
      transitionContext.parkedSceneKey = this.currentSceneKey;
      this.app.stage.removeChildren();

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

      const createSceneStartedAt = getTransitionTimingNow();
      logTransitionPhase("createScene_start");
      const createdScene = await this._createScene(key);
      logTransitionPhase("createScene_end", {
        durationMs: Math.round(getTransitionTimingNow() - createSceneStartedAt),
      });

      if (
        transitionContext.interruption ||
        this._activeSceneTransition !== transitionContext
      ) {
        logTransitionPhase("changeScene_interrupted_during_create", {
          reason: transitionContext.interruption?.reason ?? "stale_transition",
          fallbackScene: transitionContext.interruption?.fallbackScene ?? null,
        });
        createdScene.destroy();
        return false;
      }

      transitionContext.parkedScene?.destroy();
      this.currentScene = createdScene;
      this.currentSceneKey = key;
      this._applyTickerFramePolicy(key);

      if (this.currentScene instanceof PIXI.Container) {
        this.app.stage.addChild(this.currentScene);
      }

      this._onSceneTransitionStateChange?.({
        requestId: transitionRequestId,
        from: previousSceneKey,
        to: key,
        state: "core_ready",
      });
      logTransitionPhase("changeScene_core_ready", {
        sceneMounted: this.currentScene instanceof PIXI.Container,
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
          getTransitionTimingNow() - transitionStartedAt,
        )}ms`,
      );
      this._activeSceneTransition = null;
      return true;
    } catch (error) {
      if (
        transitionContext.interruption ||
        this._activeSceneTransition !== transitionContext
      ) {
        logTransitionPhase("changeScene_cancelled_after_create_error", {
          reason: transitionContext.interruption?.reason ?? "stale_transition",
          fallbackScene: transitionContext.interruption?.fallbackScene ?? null,
          error: summarizeTransitionError(error),
        });
        return false;
      }

      if (transitionContext.phase === "creating_target") {
        await this._restoreParkedSceneAfterTransitionAbort(
          transitionContext,
          "failed",
        );
      }

      console.error(`[Game] 씬 전환 오류 (${key}):`, error);
      logTransitionPhase("changeScene_failed", {
        error: summarizeTransitionError(error),
      });
      if (!transitionContext.stateChangeEmitted) {
        this._onSceneTransitionStateChange?.({
          requestId: transitionRequestId,
          from: previousSceneKey,
          to: key,
          state: "failed",
        });
      }
      return false;
    } finally {
      this._pendingSceneTransitionInterruptions.delete(transitionRequestId);

      if (this._activeSceneTransition === transitionContext) {
        this._activeSceneTransition = null;
      }
    }
  }

  /**
   * 현재 활성화된 씬의 키를 반환합니다
   */
  public getCurrentSceneKey(): SceneKey | undefined {
    return this.currentSceneKey;
  }

  public prepareCurrentSceneForNativeBackExit(): boolean {
    if (!this.currentScene?.prepareForNativeBackExit) {
      return false;
    }

    this.currentScene.prepareForNativeBackExit();
    return true;
  }

  public requestSceneTransitionInterruption(params: {
    requestId: number;
    fallbackScene: SceneKey;
    reason: SceneTransitionInterruptReason;
  }): boolean {
    if (this._sceneTransitionRequestId !== params.requestId) {
      return false;
    }

    const interruption = {
      fallbackScene: params.fallbackScene,
      reason: params.reason,
    };

    this._pendingSceneTransitionInterruptions.set(params.requestId, interruption);

    const activeTransition = this._activeSceneTransition;
    if (
      activeTransition &&
      activeTransition.requestId === params.requestId &&
      activeTransition.phase === "creating_target" &&
      !activeTransition.interruption
    ) {
      activeTransition.interruption = interruption;
      this._activeSceneTransition = null;
      void this._restoreParkedSceneAfterTransitionAbort(
        activeTransition,
        "interrupted",
      );
    }

    console.log("[ImportantDiagnostics][SceneTransitionInterruption]", {
      requestId: params.requestId,
      fallbackScene: params.fallbackScene,
      reason: params.reason,
      currentSceneKey: this.currentSceneKey ?? null,
      activeTransitionRequestId: this._sceneTransitionRequestId,
      activeTransitionPhase: activeTransition?.phase ?? null,
    });

    return true;
  }

  public getActiveSceneTransitionRequestId(): number | null {
    return this._activeSceneTransition?.requestId ?? null;
  }

  public async getFlappyBirdSkyContext(): Promise<FlappyBirdSkyContext> {
    if (this.currentScene instanceof MainSceneWorld) {
      this._syncFlappyBirdSkyContextFromMainScene(this.currentScene);
      this._syncFlappyBirdCharacterKeyFromMainScene(this.currentScene);
    }

    if (this._flappyBirdSkyContext) {
      return {
        mode: this._flappyBirdSkyContext.mode,
        timeOfDay: this._flappyBirdSkyContext.timeOfDay,
        sunTimes: this._flappyBirdSkyContext.sunTimes
          ? { ...this._flappyBirdSkyContext.sunTimes }
          : null,
      };
    }

    const initialGameData = await this._createInitialGameData();

    return {
      mode: initialGameData.useLocalTime
        ? TimeOfDayMode.Auto
        : TimeOfDayMode.Manual,
      timeOfDay: TimeOfDay.Day,
      sunTimes: initialGameData.cachedSunTimes ?? null,
    };
  }

  public getFlappyBirdCharacterKey(): CharacterKey {
    if (this.currentScene instanceof MainSceneWorld) {
      this._syncFlappyBirdCharacterKeyFromMainScene(this.currentScene);
    }

    return this._flappyBirdCharacterKey ?? CharacterKey.GreenSlimeA1;
  }

  public getFlappyBirdCharacterState(): CharacterState | null {
    if (this.currentScene instanceof MainSceneWorld) {
      this._syncFlappyBirdCharacterStateFromMainScene(this.currentScene);
    }

    return this._flappyBirdCharacterState;
  }

  public isDebugModeEnabled(): boolean {
    return this._debugMode;
  }

  public getMainCharacterStaminaSnapshot(): {
    stamina: number;
    maxStamina: number;
    unhappyThreshold: number;
    boostedThreshold: number;
  } | null {
    if (!(this.currentScene instanceof MainSceneWorld)) {
      return null;
    }

    return this.currentScene.getMainCharacterStaminaSnapshot();
  }

  public getMainCharacterInfoSnapshot(): MainCharacterInfoSnapshot | null {
    if (!(this.currentScene instanceof MainSceneWorld)) {
      return null;
    }

    return this.currentScene.getMainCharacterInfoSnapshot();
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

  public getHomeWidgetSyncWorldData(): MainSceneWorldData | null {
    if (!(this.currentScene instanceof MainSceneWorld)) {
      return null;
    }

    return this.currentScene.buildHomeWidgetSyncWorldData();
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

    const [, isFontLoaded] = await Promise.all([
      AssetLoader.preloadAssets(this.getFlappyBirdCharacterKey()),
      preloadFlappyBirdRetroFont({
        timeoutMs: FLAPPY_BIRD_RETRO_FONT_PRELOAD_TIMEOUT_MS,
      }),
    ]);

    if (!isFontLoaded) {
      console.warn(
        `[GameTransition] mini-game font preload did not finish before scene transition (timeoutMs: ${FLAPPY_BIRD_RETRO_FONT_PRELOAD_TIMEOUT_MS})`,
      );
    }

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

  private _syncFlappyBirdSkyContextFromMainScene(
    mainSceneWorld: MainSceneWorld,
  ): void {
    const inMemoryData = mainSceneWorld.getInMemoryData();
    const cachedSunTimes =
      inMemoryData.world_metadata.app_state?.cached_sun_times ?? null;

    this._flappyBirdSkyContext = {
      mode: mainSceneWorld.getTimeOfDayMode(),
      timeOfDay: mainSceneWorld.getTimeOfDay(),
      sunTimes: cachedSunTimes,
    };
  }

  private _syncFlappyBirdCharacterKeyFromMainScene(
    mainSceneWorld: MainSceneWorld,
  ): void {
    this._flappyBirdCharacterKey = mainSceneWorld.getFlappyBirdCharacterKey();
  }

  private _syncFlappyBirdCharacterStateFromMainScene(
    mainSceneWorld: MainSceneWorld,
  ): void {
    this._flappyBirdCharacterState = mainSceneWorld.getFlappyBirdCharacterState();
  }
}
