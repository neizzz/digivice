import {
  addEntity,
  createWorld,
  IWorld,
  pipe,
  defineQuery,
  hasComponent,
} from "bitecs";
import * as PIXI from "pixi.js";
import "@pixi/gif"; // GIF 지원 추가
import { SHOW_DEBUG_GAUGE_EVENT } from "../../debugEvents";
import {
  AngleComponent,
  Boundary,
  CharacterState,
  CharacterStatus,
  CharacterStatusComponent,
  DestinationComponent,
  FreshnessComponent,
  ObjectComponent,
  ObjectType,
  PositionComponent,
  RandomMovementComponent,
  RenderComponent,
  AnimationRenderComponent,
  StatusIconRenderComponent,
  SpeedComponent,
  AnimationKey,
  SpritesheetKey,
  TextureKey,
  ThrowAnimationComponent,
  DigestiveSystemComponent,
  DiseaseSystemComponent,
  SleepSystemComponent,
  VitalityComponent,
  TemporaryStatusComponent,
  EggHatchComponent,
  FreshnessTimerComponent,
  SparkleEffectComponent,
  CleanableComponent,
  BroomRenderComponent,
  EGG_TEXTURE_KEYS,
} from "./types";
import { randomMovementSystem } from "./systems/RandomMovementSystem";
import { commonMovementSystem } from "./systems/CommonMovementSystem";
import { animationRenderSystem } from "./systems/AnimationRenderSystem";
import { animationStateSystem } from "./systems/AnimationStateSystem";
import { statusIconRenderSystem } from "./systems/StatusIconRenderSystem";
import { renderSystem } from "./systems/RenderSystem";
import {
  characterNameLabelSystem,
  cleanupCharacterNameLabels,
} from "./systems/CharacterNameLabelSystem";
import {
  characterLayoutDebugSystem,
  cleanupCharacterLayoutDebug,
} from "./systems/CharacterLayoutDebugSystem";
import {
  ensureCharacterOpaqueBoundsComputed,
  precomputeLoadedCharacterOpaqueBounds,
  precomputeLoadedTextureOpaqueBounds,
} from "./systems/CharacterOpaqueBounds";
import { dataSyncSystem } from "./systems/DataSyncSystem";
import { throwAnimationSystem } from "./systems/ThrowAnimationSystem";
import { foodEatingSystem } from "./systems/FoodEatingSystem";
import { sparkleEffectSystem } from "./systems/SparkleEffectSystem";
import { cleaningSystem, clearCleaningTargets } from "./systems/CleaningSystem";
import { cleanableRenderSystem } from "./systems/CleanableRenderSystem";
import {
  effectAnimationSystem,
  startRecoveryAnimation,
} from "./systems/EffectAnimationSystem";
import { HTMLDebugStatusUI } from "./ui/HTMLDebugStatusUI";
import { HTMLDebugToggleButton } from "./ui/HTMLDebugToggleButton";
import { HTMLDebugGameConstantsUI } from "./ui/HTMLDebugGameConstantsUI";
import { HTMLDebugGaugeUI } from "./ui/HTMLDebugGaugeUI";
import { StorageManager } from "../../managers/StorageManager";
import { Background } from "../../entities/Background";
import {
  applySavedEntityToECS,
  convertECSEntityToSavedEntity,
  repairCharacterEntityRuntimeComponents,
} from "./entityDataHelpers";
import {
  createCharacterEntity,
  createThrowingFoodEntity,
} from "./entityFactory";
import {
  ObjectComp,
  CharacterStatusComp,
  PositionComp,
  CleanableComp,
  DiseaseSystemComp,
  EffectAnimationComp,
} from "./raw-components";
import { generatePersistentNumericId } from "@/utils/generate";
import {
  loadSpritesheets,
  LoadSpritesheetOptions,
  loadSpritesheet,
} from "../../utils/asset";
import type { TriggerBiteVibrationCallback } from "../../Game";
import type {
  StartRecoveryVibrationCallback,
  StopRecoveryVibrationCallback,
} from "../../Game";
import { SPRITESHEET_KEY_TO_NAME } from "./systems/AnimationRenderSystem";
import { Scene } from "../../interfaces/Scene";
import {
  ControlButtonParams,
  ControlButtonType,
  NavigationAction,
  NavigationActionPayload,
} from "../../ui/types";
import { GameMenu } from "../../ui/GameMenu";
import { freshnessSystem } from "./systems/FreshnessSystem";
import { digestiveSystem } from "./systems/DigestiveSystem";
import { diseaseSystem } from "./systems/DiseaseSystem";
import { eggHatchSystem } from "./systems/EggHatchSystem";
import { sleepScheduleSystem } from "./systems/SleepScheduleSystem";
import {
  characterManagerSystem,
  validateAndFixStatusIcons,
} from "./systems/CharacterManageSystem";
import { characterStatusSystem } from "./systems/CharacterStatusSystem";
import {
  sleepEffectSystem,
  cleanupSleepEffects,
} from "./systems/SleepEffectSystem";
import { ReentrySimulator } from "./ReentrySimulator";
import { getNativeSunTimes, requestNativeLocationPermission } from "./sunTimes";
import {
  type AutoTimeOfDayState,
  getProjectedUpcomingSunTimes as projectUpcomingSunTimes,
  getManualSkyVisualState,
  getTimeOfDayLabel,
  hasSunTimesDateRolledOver,
  projectSunTimesForDate,
  type ProjectedUpcomingSunTimes,
  resolveAutoTimeOfDayState,
  type SunLocationSource,
  type SunTimesPayload,
  TimeOfDay,
  TimeOfDayMode,
} from "./timeOfDay";

const liveCharacterEntitiesQuery = defineQuery([ObjectComp, CharacterStatusComp]);

export type EntityComponents = {
  characterStatus?: CharacterStatusComponent;
  position?: PositionComponent;
  angle?: AngleComponent;
  object?: ObjectComponent;
  render?: RenderComponent;
  animationRender?: AnimationRenderComponent;
  statusIconRender?: StatusIconRenderComponent;
  speed?: SpeedComponent;
  freshness?: FreshnessComponent;
  destination?: DestinationComponent;
  randomMovement?: RandomMovementComponent;
  throwAnimation?: ThrowAnimationComponent;
  digestiveSystem?: DigestiveSystemComponent;
  diseaseSystem?: DiseaseSystemComponent;
  sleepSystem?: SleepSystemComponent;
  vitality?: VitalityComponent;
  temporaryStatus?: TemporaryStatusComponent;
  eggHatch?: EggHatchComponent;
  freshnessTimer?: FreshnessTimerComponent;
  sparkleEffect?: SparkleEffectComponent;
  cleanable?: CleanableComponent;
  broomRender?: BroomRenderComponent;
};

export type SavedEntity = {
  components: EntityComponents;
};

export type MainSceneAdMenu = "feed" | "clean" | "hospital" | "mini_game";

export type MainSceneAdPendingReservation = {
  menu: MainSceneAdMenu;
  queued_at: number;
  cooldown_ms: number;
  threshold: number;
  deep_night: boolean;
};

export type MainSceneAdState = {
  menu_use_count: number;
  pending?: MainSceneAdPendingReservation;
};

export type WorldMetadata = {
  name: string;
  monster_name?: string;
  last_ecs_saved: number;
  version: string;
  // 앱 상태 관리
  app_state?: {
    last_active_time: number;
    is_first_load: boolean;
    use_local_time: boolean;
    cached_sun_times?: SunTimesPayload;
    main_scene_ad?: MainSceneAdState;
  };
  // // 캐릭터별 위치 추적 (캐릭터 ID를 키로 사용)
  // character_positions?: Record<
  //   number,
  //   {
  //     last_known_x: number;
  //     last_known_y: number;
  //     last_update_time: number;
  //   }
  // >;
  // // 캐릭터별 질병 추적
  // character_disease_tracking?: Record<
  //   number,
  //   {
  //     total_checks: number;
  //     last_disease_time: number;
  //     disease_count: number;
  //   }
  // >;
  // // 캐릭터별 똥 추적
  // character_poop_tracking?: Record<
  //   number,
  //   {
  //     last_poop_time: number;
  //     poop_count: number;
  //     scheduled_poop_time: number;
  //   }
  // >;
};

export type MainSceneWorldData = {
  world_metadata: WorldMetadata;
  entities: SavedEntity[];
};

type MainSceneAppState = NonNullable<WorldMetadata["app_state"]>;

const WORLD_DATA_STORAGE_KEY = "MainSceneWorldData";
const DEFAULT_USE_LOCAL_TIME = import.meta.env.DEV;
const MAIN_SCENE_AD_NORMAL_THRESHOLD = 5;
const MAIN_SCENE_AD_DEEP_NIGHT_THRESHOLD = 10;
const MAIN_SCENE_AD_NORMAL_COOLDOWN_MS = 5 * 60 * 1000;
const MAIN_SCENE_AD_DEEP_NIGHT_COOLDOWN_MS = 60 * 60 * 1000;
const MAIN_SCENE_AD_POST_ACTION_DELAY_MS = 200;
const MAIN_SCENE_AD_FEED_FALLBACK_AFTER_LAND_MS = 3000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const COMMON_SPRITESHEET_ASSETS: LoadSpritesheetOptions[] = [
  {
    jsonPath: "/assets/game/sprites/bird.json",
    alias: "bird",
    // pixelArt: true,
  },
  {
    jsonPath: "/assets/game/sprites/eggs.json",
    alias: "eggs",
    // pixelArt: true,
  },
  {
    jsonPath: "/assets/game/sprites/foods.json",
    alias: "foods",
    // pixelArt: true,
  },
  {
    jsonPath: "/assets/game/sprites/common16x16.json",
    alias: "common16x16",
    // pixelArt: true,
  },
  {
    jsonPath: "/assets/game/sprites/common32x32.json",
    alias: "common32x32",
    // pixelArt: true,
  },
  {
    jsonPath: "/assets/game/sprites/vite-food-mask.json",
    alias: "vite-food-mask",
    // pixelArt: true,
  },
  // {
  //   jsonPath: "/assets/game/sprites/monsters/test-green-slime_A1.json",
  //   alias: "test-green-slime_A1",
  //   // pixelArt: true,
  // },
  // {
  //   jsonPath: "/assets/game/sprites/monsters/test-green-slime_B1.json",
  //   alias: "test-green-slime_B1",
  //   // pixelArt: true,
  // },
  // {
  //   jsonPath: "/assets/game/sprites/monsters/test-green-slime_C1.json",
  //   alias: "test-green-slime_C1",
  //   // pixelArt: true,
  // },
  // {
  //   jsonPath: "/assets/game/sprites/monsters/test-green-slime_D1.json",
  //   alias: "test-green-slime_D1",
  //   // pixelArt: true,
  // },
];
const IMAGE_ASSETS = {
  grass: "/assets/game/tiles/grass-tile.jpg",
};

// GIF 에셋들은 @pixi/gif로 처리
const GIF_ASSETS = {
  recovery: "/assets/game/gifs/recovery.gif",
  // 추가 GIF들을 필요에 따라 여기에 추가
  // effect1: "/assets/game/gifs/effect1.gif",
  // effect2: "/assets/game/gifs/effect2.gif",
  // sparkle: "/assets/game/gifs/sparkle.gif",
  // healing: "/assets/game/gifs/healing.gif",
};

/**
 * a) ecs구조에서 다루기 힘든 browser event핸들링
 * b) 전역 데이터 저장
 * c) PIXI v8 Assets API를 활용한 에셋 관리
 */
export class MainSceneWorld implements IWorld, Scene {
  public readonly VERSION = "1.0.0";
  private static readonly SCENE_DARKNESS_OVERLAY_Z_INDEX = 1_000_000;
  private _stage: PIXI.Container;
  private _positionBoundary: Boundary;
  private _positionBoundaryInsets: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  private _background?: Background;
  private _sceneDarknessOverlay?: PIXI.Graphics;
  private _persistentData?: MainSceneWorldData;
  private _debugStatusUI?: HTMLDebugStatusUI;
  private _debugToggleButton?: HTMLDebugToggleButton;
  private _debugGameConstantsUI?: HTMLDebugGameConstantsUI;
  private _debugGaugeUI?: HTMLDebugGaugeUI;
  private _isDebugGaugeEventListenerRegistered = false;
  private _gameMenu?: GameMenu;
  private _parentElement?: HTMLElement;
  private _debugParentElement?: HTMLElement;
  private _navigationActionIndex = 0;
  private _changeControlButtons?: (
    controlButtonParamsSet: [
      ControlButtonParams,
      ControlButtonParams,
      ControlButtonParams,
    ],
  ) => void;
  private _triggerBiteVibration?: TriggerBiteVibrationCallback;
  private _startRecoveryVibration?: StartRecoveryVibrationCallback;
  private _stopRecoveryVibration?: StopRecoveryVibrationCallback;
  private _isCleaningMode = false; // 청소 모드 상태
  private _previousCleaningMode = false; // 이전 청소 모드 상태 (진입 감지용)
  private _focusedTargetEid = -1; // 현재 포커스된 청소 대상 엔티티 ID
  private _broomProgress = 0; // 빗자루 움직인 거리 (0.0 ~ 1.0)
  private _currentSliderValue = 0.5; // 현재 슬라이더 값 (0.0 ~ 1.0)
  private _cleaningSliderSessionKey = 0;
  private _pendingCleaningSliderDelta = 0; // 입력 이벤트 동안 누적된 실제 슬라이더 이동량
  private _isPaused = false; // 앱이 일시정지 상태인지 여부
  private _pauseStartTime = 0; // 일시정지 시작 시간
  private _isRunningReentrySimulation = false;
  private _simulationTime: number | null = null;
  private _visibilityChangeHandler?: () => void; // Page Visibility API 이벤트 핸들러
  private _statusSystemsEnabled = true; // 상태 관리 시스템들 활성화 여부
  private _sleepDebugEffectEnabled = true;
  private _randomMovementDebugEnabled = false;
  private readonly _handleShowDebugGauge = (): void => {
    this._debugGaugeUI?.toggle();
  };
  private _pendingRecoveryCureEids = new Set<number>();
  private _isPersistenceDisabled = false;
  private _createInitialGameData?: () => Promise<{
    name: string;
    useLocalTime: boolean;
    cachedSunTimes?: SunTimesPayload | null;
  }>;
  private _pendingStorageWrite: Promise<void> = Promise.resolve();
  private _startMiniGame?: () => unknown | Promise<unknown>;
  private _timeOfDay: TimeOfDay = TimeOfDay.Day;
  private _timeOfDayMode: TimeOfDayMode = TimeOfDayMode.Manual;
  private _sunTimes: SunTimesPayload | null = null;
  private _autoTimeOfDayState: AutoTimeOfDayState | null = null;
  private _autoTimeOfDayMinuteKey: number | null = null;
  private _sunTimesRefreshPromise: Promise<void> | null = null;
  private _hasLocationPermission = false;
  private _sunLocationSource: SunLocationSource | null = null;
  private _pendingFeedAdFoodEid: number | null = null;
  private _feedAdFallbackTimerId: number | null = null;
  private _mainSceneAdTimerIds = new Set<number>();

  // 실시간 모드용 시스템 파이프라인 (렌더링 포함)
  private _pipedSystems = pipe(
    // 시간 기반 시스템들 (상태 관리 시스템 토글 적용)
    (params: any) =>
      this._statusSystemsEnabled
        ? freshnessSystem({ ...params, currentTime: this.currentTime })
        : params,
    (params: any) =>
      this._statusSystemsEnabled
        ? digestiveSystem({ ...params, currentTime: this.currentTime })
        : params,
    (params: any) =>
      this._statusSystemsEnabled
        ? sleepScheduleSystem({
            ...params,
            currentTime: this.currentTime,
          })
        : params,
    (params: any) =>
      this._statusSystemsEnabled
        ? diseaseSystem({ ...params, currentTime: this.currentTime })
        : params,
    (params: any) =>
      eggHatchSystem({ ...params, currentTime: this.currentTime }),
    (params: any) =>
      this._statusSystemsEnabled ? characterManagerSystem(params) : params,
    // 캐릭터 상태 시스템 (임시 상태 만료, 긴급 상태, 사망 처리)
    (params: any) =>
      this._statusSystemsEnabled
        ? characterStatusSystem({ ...params, currentTime: this.currentTime })
        : params,
    // 배달 시스템
    // pillDeliverySystem,
    // 이펙트 시스템
    (params: any) =>
      sparkleEffectSystem({ ...params, currentTime: this.currentTime }),
    // 범용 effect 애니메이션 시스템 (실시간 모드에서만 실행)
    (params: any) =>
      effectAnimationSystem({
        ...params,
        currentTime: this.currentTime,
        stage: this._stage,
      }),
    // 청소 시스템 (실시간 모드에서만 실행)
    (params: any) => cleaningSystem({ ...params, stage: this._stage }),
    // 이동 및 게임플레이 시스템들
    randomMovementSystem,
    commonMovementSystem,
    // 착지한 프레임에 바로 음식 탐색이 가능해야 하므로 착지 상태를 먼저 반영한다.
    throwAnimationSystem,
    (params: any) =>
      foodEatingSystem({ ...params, currentTime: this.currentTime }),
    // 애니메이션 상태 시스템들
    animationStateSystem,
    // 모든 렌더링 시스템들을 하나로 통합 (실시간 모드에서만 실행)
    (params: any) => this._renderAllSystems(params),
    dataSyncSystem,
  );

  get stage(): PIXI.Container {
    return this._stage;
  }
  get positionBoundary(): Boundary {
    return this._positionBoundary;
  }
  get sliderValue(): number {
    return this._currentSliderValue;
  }
  get isCleaningMode(): boolean {
    return this._isCleaningMode;
  }

  get isEnteringCleaningMode(): boolean {
    return this._isCleaningMode && !this._previousCleaningMode;
  }

  get focusedTargetEid(): number {
    return this._focusedTargetEid;
  }
  get broomProgress(): number {
    return this._broomProgress;
  }
  get isPaused(): boolean {
    return this._isPaused;
  }
  get timeOfDay(): TimeOfDay {
    return this._timeOfDay;
  }
  get timeOfDayMode(): TimeOfDayMode {
    return this._timeOfDayMode;
  }

  public getProjectedUpcomingSunTimes(
    referenceTime: number = this.currentTime,
  ): {
    sunriseAt: number;
    sunsetAt: number;
    nextSunriseAt: number;
    nextSunsetAt: number;
  } | null {
    if (this._timeOfDayMode !== TimeOfDayMode.Auto || !this._sunTimes) {
      return null;
    }

    const projectedSunTimes: ProjectedUpcomingSunTimes = projectUpcomingSunTimes(
      new Date(referenceTime),
      this._sunTimes,
    );

    return {
      sunriseAt: projectedSunTimes.sunriseAt.getTime(),
      sunsetAt: projectedSunTimes.sunsetAt.getTime(),
      nextSunriseAt: projectedSunTimes.nextSunriseAt.getTime(),
      nextSunsetAt: projectedSunTimes.nextSunsetAt.getTime(),
    };
  }

  constructor(params: {
    stage: PIXI.Container;
    positionBoundary: Boundary;
    positionBoundaryInsets?: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    };
    parentElement?: HTMLElement;
    debugParentElement?: HTMLElement;
    startMiniGame?: () => unknown | Promise<unknown>;
    createInitialGameData?: () => Promise<{
      name: string;
      useLocalTime: boolean;
      cachedSunTimes?: SunTimesPayload | null;
    }>;
    changeControlButtons?: (
      controlButtonParamsSet: [
        ControlButtonParams,
        ControlButtonParams,
        ControlButtonParams,
      ],
    ) => void;
    triggerBiteVibration?: TriggerBiteVibrationCallback;
    startRecoveryVibration?: StartRecoveryVibrationCallback;
    stopRecoveryVibration?: StopRecoveryVibrationCallback;
  }) {
    this._stage = params.stage;
    this._positionBoundary = params.positionBoundary;
    this._positionBoundaryInsets = params.positionBoundaryInsets ?? {
      left: params.positionBoundary.x,
      right: params.positionBoundary.x,
      top: params.positionBoundary.y,
      bottom: params.positionBoundary.y,
    };
    this._parentElement = params.parentElement;
    this._debugParentElement = params.debugParentElement ?? params.parentElement;
    this._startMiniGame = params.startMiniGame;
    this._createInitialGameData = params.createInitialGameData;
    this._changeControlButtons = params.changeControlButtons;
    this._triggerBiteVibration = params.triggerBiteVibration;
    this._startRecoveryVibration = params.startRecoveryVibration;
    this._stopRecoveryVibration = params.stopRecoveryVibration;

    // MainScene용 초기 컨트롤 버튼 설정 (메뉴에 포커스가 없는 상태)
    this._updateControlButtonsForMenuState(false);
  }

  public triggerBiteVibration(): void {
    this._triggerBiteVibration?.();
  }

  public startRecoveryVibration(): void {
    this._startRecoveryVibration?.();
  }

  public stopRecoveryVibration(): void {
    this._stopRecoveryVibration?.();
  }

  private _ensureAppState(): MainSceneAppState | null {
    if (!this._persistentData) {
      return null;
    }

    const currentAppState = this._persistentData.world_metadata.app_state;
    if (currentAppState) {
      return currentAppState;
    }

    const appState: MainSceneAppState = {
      last_active_time: Date.now(),
      is_first_load: false,
      use_local_time: true,
    };

    this._persistentData.world_metadata.app_state = appState;
    return appState;
  }

  private _getMainSceneAdState(): MainSceneAdState | null {
    const appState = this._ensureAppState();
    if (!appState) {
      return null;
    }

    if (!this._isValidMainSceneAdState(appState.main_scene_ad)) {
      appState.main_scene_ad = {
        menu_use_count: 0,
      };
    }

    return appState.main_scene_ad;
  }

  private _isValidMainSceneAdState(
    value: MainSceneAdState | undefined,
  ): value is MainSceneAdState {
    if (
      !value ||
      typeof value.menu_use_count !== "number" ||
      !Number.isFinite(value.menu_use_count) ||
      value.menu_use_count < 0
    ) {
      return false;
    }

    if (
      value.pending &&
      !this._isValidMainSceneAdPendingReservation(value.pending)
    ) {
      value.pending = undefined;
    }

    value.menu_use_count = Math.floor(value.menu_use_count);
    return true;
  }

  private _isValidMainSceneAdPendingReservation(
    value: MainSceneAdPendingReservation | undefined,
  ): value is MainSceneAdPendingReservation {
    return (
      !!value &&
      this._isMainSceneAdMenu(value.menu) &&
      typeof value.queued_at === "number" &&
      Number.isFinite(value.queued_at) &&
      value.queued_at > 0 &&
      typeof value.cooldown_ms === "number" &&
      Number.isFinite(value.cooldown_ms) &&
      value.cooldown_ms > 0 &&
      typeof value.threshold === "number" &&
      Number.isFinite(value.threshold) &&
      value.threshold > 0 &&
      typeof value.deep_night === "boolean"
    );
  }

  private _isMainSceneAdMenu(value: unknown): value is MainSceneAdMenu {
    return (
      value === "feed" ||
      value === "clean" ||
      value === "hospital" ||
      value === "mini_game"
    );
  }

  private _recordMainSceneMenuUse(
    menu: MainSceneAdMenu,
  ): MainSceneAdPendingReservation | null {
    const adState = this._getMainSceneAdState();
    if (!adState) {
      return null;
    }

    adState.menu_use_count = Math.max(
      0,
      Math.floor(adState.menu_use_count),
    ) + 1;

    let createdReservation: MainSceneAdPendingReservation | null = null;
    if (!adState.pending) {
      const config = this._getMainSceneAdConfig();
      if (adState.menu_use_count >= config.threshold) {
        createdReservation = {
          menu,
          queued_at: this.currentTime,
          cooldown_ms: config.cooldownMs,
          threshold: config.threshold,
          deep_night: config.deepNight,
        };
        adState.pending = createdReservation;

        console.log("[MainSceneWorld] MainScene menu ad reserved", {
          menu,
          menuUseCount: adState.menu_use_count,
          ...config,
        });
      }
    }

    this._persistMainSceneAdState();
    return createdReservation;
  }

  private _getMainSceneAdConfig(): {
    threshold: number;
    cooldownMs: number;
    deepNight: boolean;
  } {
    const deepNight = this._isMainSceneAdDeepNight();

    return deepNight
      ? {
          threshold: MAIN_SCENE_AD_DEEP_NIGHT_THRESHOLD,
          cooldownMs: MAIN_SCENE_AD_DEEP_NIGHT_COOLDOWN_MS,
          deepNight,
        }
      : {
          threshold: MAIN_SCENE_AD_NORMAL_THRESHOLD,
          cooldownMs: MAIN_SCENE_AD_NORMAL_COOLDOWN_MS,
          deepNight,
        };
  }

  private _isMainSceneAdDeepNight(
    referenceTime: number = this.currentTime,
  ): boolean {
    if (this._timeOfDayMode !== TimeOfDayMode.Auto || !this._sunTimes) {
      return false;
    }

    try {
      const now = new Date(referenceTime);
      const previousDay = projectSunTimesForDate(
        new Date(referenceTime - DAY_MS),
        this._sunTimes,
      );
      const currentDay = projectSunTimesForDate(now, this._sunTimes);
      const nextDay = projectSunTimesForDate(
        new Date(referenceTime + DAY_MS),
        this._sunTimes,
      );

      const intervals = [
        {
          start: previousDay.sunsetAt.getTime() + 4 * HOUR_MS,
          end: currentDay.sunriseAt.getTime() - HOUR_MS,
        },
        {
          start: currentDay.sunsetAt.getTime() + 4 * HOUR_MS,
          end: nextDay.sunriseAt.getTime() - HOUR_MS,
        },
      ];

      return intervals.some(({ start, end }) => {
        return (
          Number.isFinite(start) &&
          Number.isFinite(end) &&
          end > start &&
          referenceTime >= start &&
          referenceTime < end
        );
      });
    } catch (error) {
      console.warn("[MainSceneWorld] Failed to resolve deep-night ad window", {
        error,
      });
      return false;
    }
  }

  private _persistMainSceneAdState(): void {
    if (!this._persistentData || this._isPersistenceDisabled) {
      return;
    }

    void this.setData(this._persistentData);
  }

  private _schedulePendingMainSceneAdForMenu(
    menu: MainSceneAdMenu,
    delayMs: number = MAIN_SCENE_AD_POST_ACTION_DELAY_MS,
  ): void {
    const pending = this._getMainSceneAdState()?.pending;
    if (!pending || pending.menu !== menu) {
      return;
    }

    this._setMainSceneAdTimer(() => {
      void this._requestPendingMainSceneAd(menu);
    }, delayMs);
  }

  private async _requestPendingMainSceneAd(
    expectedMenu?: MainSceneAdMenu,
  ): Promise<void> {
    const adState = this._getMainSceneAdState();
    const pending = adState?.pending;

    if (!adState || !pending) {
      return;
    }

    if (expectedMenu && pending.menu !== expectedMenu) {
      return;
    }

    if (!this._canRequestMainSceneAdNow()) {
      console.log("[MainSceneWorld] MainScene menu ad request deferred", {
        menu: pending.menu,
      });
      return;
    }

    const requestMainSceneMenuAd =
      typeof window !== "undefined"
        ? window.digiviceAdBridge?.requestMainSceneMenuAd
        : undefined;

    if (!requestMainSceneMenuAd) {
      console.log("[MainSceneWorld] MainScene ad bridge is not available");
      return;
    }

    try {
      const didShow = await requestMainSceneMenuAd({
        menu: pending.menu,
        cooldownMs: pending.cooldown_ms,
        threshold: pending.threshold,
        queuedAt: pending.queued_at,
        deepNight: pending.deep_night,
        menuUseCount: adState.menu_use_count,
      });

      if (didShow) {
        adState.menu_use_count = 0;
        adState.pending = undefined;
        this._pendingFeedAdFoodEid = null;
        this._clearFeedAdFallbackTimer();
        console.log("[MainSceneWorld] MainScene menu ad shown; state reset");
      } else {
        console.log("[MainSceneWorld] MainScene menu ad was not shown", {
          menu: pending.menu,
        });
      }
    } catch (error) {
      console.warn("[MainSceneWorld] MainScene menu ad request failed", {
        menu: pending.menu,
        error,
      });
    } finally {
      this._persistMainSceneAdState();
    }
  }

  private _canRequestMainSceneAdNow(): boolean {
    if (this._isPaused || this._isRunningReentrySimulation || this.isSimulationMode) {
      return false;
    }

    if (typeof document !== "undefined" && document.hidden) {
      return false;
    }

    return true;
  }

  private _setMainSceneAdTimer(callback: () => void, delayMs: number): number {
    if (typeof window === "undefined") {
      callback();
      return 0;
    }

    let timerId = 0;
    timerId = window.setTimeout(() => {
      this._mainSceneAdTimerIds.delete(timerId);
      callback();
    }, Math.max(0, delayMs));
    this._mainSceneAdTimerIds.add(timerId);
    return timerId;
  }

  private _clearMainSceneAdTimers(): void {
    if (typeof window === "undefined") {
      this._mainSceneAdTimerIds.clear();
      this._feedAdFallbackTimerId = null;
      return;
    }

    this._mainSceneAdTimerIds.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    this._mainSceneAdTimerIds.clear();
    this._feedAdFallbackTimerId = null;
  }

  private _clearFeedAdFallbackTimer(): void {
    if (this._feedAdFallbackTimerId === null || typeof window === "undefined") {
      this._feedAdFallbackTimerId = null;
      return;
    }

    window.clearTimeout(this._feedAdFallbackTimerId);
    this._mainSceneAdTimerIds.delete(this._feedAdFallbackTimerId);
    this._feedAdFallbackTimerId = null;
  }

  private _trackPendingFeedAdFood(foodEid: number): void {
    const pending = this._getMainSceneAdState()?.pending;
    if (!pending || pending.menu !== "feed") {
      return;
    }

    this._pendingFeedAdFoodEid = foodEid;
    this._clearFeedAdFallbackTimer();
  }

  public handleThrownFoodLanded(foodEid: number): void {
    if (this.isSimulationMode || this._pendingFeedAdFoodEid !== foodEid) {
      return;
    }

    this._clearFeedAdFallbackTimer();
    this._feedAdFallbackTimerId = this._setMainSceneAdTimer(() => {
      this._feedAdFallbackTimerId = null;
      this._schedulePendingMainSceneAdForMenu(
        "feed",
        MAIN_SCENE_AD_POST_ACTION_DELAY_MS,
      );
    }, MAIN_SCENE_AD_FEED_FALLBACK_AFTER_LAND_MS);
  }

  public handleFoodConsumedForAd(foodEid: number): void {
    if (this.isSimulationMode || this._pendingFeedAdFoodEid !== foodEid) {
      return;
    }

    this._pendingFeedAdFoodEid = null;
    this._clearFeedAdFallbackTimer();
    this._schedulePendingMainSceneAdForMenu(
      "feed",
      MAIN_SCENE_AD_POST_ACTION_DELAY_MS,
    );
  }

  public handleHospitalRecoveryAnimationComplete(_characterEid: number): void {
    if (this.isSimulationMode) {
      return;
    }

    this._schedulePendingMainSceneAdForMenu(
      "hospital",
      MAIN_SCENE_AD_POST_ACTION_DELAY_MS,
    );
  }

  /**
   * 에셋 로딩 - 스프라이트시트와 일반 이미지, GIF를 병렬로 로드
   */
  private async _loadGameAssets(): Promise<void> {
    console.groupCollapsed("[MainSceneWorld] 🎨 Loading game assets...");

    try {
      // 스프라이트시트, 일반 이미지, GIF를 병렬로 로드
      const [spritesheetResults] = await Promise.all([
        loadSpritesheets(COMMON_SPRITESHEET_ASSETS),
        this._loadImageAssets(),
        this._loadGifAssets(),
      ]);

      // 로드 결과 로깅
      console.log(
        `Successfully loaded ${spritesheetResults.length} spritesheets`,
      );
      spritesheetResults.forEach((result) => {
        console.log(
          `- Spritesheet '${result.alias}': ${result.animations.length} animations, ${result.textures.length} textures`,
        );
      });

      await precomputeLoadedCharacterOpaqueBounds();
      await precomputeLoadedTextureOpaqueBounds(EGG_TEXTURE_KEYS);

      console.log("All game assets loaded successfully");
    } catch (error) {
      console.error("Failed to load game assets:", error);
      throw error;
    } finally {
      console.groupEnd();
    }
  }

  /**
   * GIF 에셋들을 @pixi/gif를 사용해서 애니메이션으로 로드
   */
  private async _loadGifAssets(): Promise<void> {
    console.log(
      `[MainSceneWorld] Loading ${
        Object.keys(GIF_ASSETS).length
      } GIF assets with @pixi/gif...`,
    );
    console.log(`[MainSceneWorld] GIF assets to load:`, GIF_ASSETS);

    const gifLoadPromises = Object.entries(GIF_ASSETS).map(
      async ([key, path]) => {
        try {
          console.log(
            `[MainSceneWorld] Loading GIF asset: ${key} from ${path}`,
          );

          // @pixi/gif를 사용한 GIF 로딩
          const animatedGif = await PIXI.Assets.load({
            alias: key,
            src: path,
          });

          console.log(
            `[MainSceneWorld] Successfully loaded animated GIF: ${key}`,
            animatedGif,
          );
        } catch (error) {
          console.error(
            `[MainSceneWorld] Failed to load GIF asset ${key} from ${path}:`,
            error,
          );
        }
      },
    );

    await Promise.all(gifLoadPromises);

    // 로딩 완료 후 캐시 상태 확인
    console.log(
      `[MainSceneWorld] GIF assets loading completed. Checking cache...`,
    );
    Object.keys(GIF_ASSETS).forEach((key) => {
      const asset = PIXI.Assets.get(key);
      console.log(
        `[MainSceneWorld] GIF Asset '${key}' in cache:`,
        asset ? "YES (animated GIF)" : "NO",
      );
      if (asset) {
        console.log(
          `[MainSceneWorld] GIF Asset '${key}' type:`,
          asset.constructor.name,
        );
      }
    });
  }
  private async _loadImageAssets(): Promise<void> {
    console.log(
      `[MainSceneWorld] Loading ${
        Object.keys(IMAGE_ASSETS).length
      } image assets...`,
    );
    console.log(`[MainSceneWorld] Image assets to load:`, IMAGE_ASSETS);

    const imageLoadPromises = Object.entries(IMAGE_ASSETS).map(
      async ([key, path]) => {
        try {
          console.log(
            `[MainSceneWorld] Loading image asset: ${key} from ${path}`,
          );

          await PIXI.Assets.load({
            alias: key,
            src: path,
          });

          // 로드 후 캐시에서 확인
          const loadedAsset = PIXI.Assets.get(key);
          console.log(
            `[MainSceneWorld] Successfully loaded image asset: ${key}`,
            loadedAsset ? "Found in cache" : "NOT found in cache",
          );
        } catch (error) {
          console.error(
            `[MainSceneWorld] Failed to load image asset ${key} from ${path}:`,
            error,
          );
        }
      },
    );

    await Promise.all(imageLoadPromises);

    // 로딩 완료 후 캐시 상태 확인
    console.log(
      `[MainSceneWorld] Image assets loading completed. Checking cache...`,
    );
    Object.keys(IMAGE_ASSETS).forEach((key) => {
      const asset = PIXI.Assets.get(key);
      console.log(
        `[MainSceneWorld] Asset '${key}' in cache:`,
        asset ? "YES" : "NO",
      );
    });
  }

  async init(): Promise<void> {
    console.groupCollapsed("[MainSceneWorld] 🚀 Initializing world...");

    try {
      createWorld(this, 100);

      // 스토리지에서 데이터 로드 시도
      console.log("Loading saved data from storage...");
      const loadedData = await this.getData();

      if (!this._hasPlayableSavedData(loadedData)) {
        const initialGameData = await this._createInitialGameData?.();
        console.warn(
          "No playable saved data found, initializing with default entities...",
        );
        this._persistentData = this._initializeData(initialGameData);
      } else {
        console.log(`Found saved data, validating and loading...`);

        const validatedData = this._validateAndMigrateData(loadedData);

        if (!this._hasPlayableSavedData(validatedData)) {
          const initialGameData = await this._createInitialGameData?.();
          console.warn(
            "Saved data is missing required setup info or recoverable character entities, reinitializing with default entities...",
          );
          this._persistentData = this._initializeData(initialGameData);
        } else {
          this._persistentData = validatedData;
          this._loadEcsEntitiesFromStorage();
        }
      }

      // PIXI v8 Assets API로 게임 에셋 로드
      await this._loadGameAssets();

      const characterSpritesheetKeys = Array.from(
        new Set(
          this._persistentData.entities
            .filter((entity) => {
              return entity.components.object?.type === ObjectType.CHARACTER;
            })
            .map((entity) => {
              return (
                entity.components.animationRender?.spritesheetKey ??
                entity.components.characterStatus?.characterKey
              );
            })
            .filter((key): key is SpritesheetKey => {
              return (
                typeof key === "number" &&
                Number.isFinite(key) &&
                !!SPRITESHEET_KEY_TO_NAME[key as SpritesheetKey]
              );
            }),
        ),
      );

      await Promise.all(
        characterSpritesheetKeys.map(async (characterSpritesheetKey) => {
          const spritesheetName =
            SPRITESHEET_KEY_TO_NAME[characterSpritesheetKey];
          await loadSpritesheet({
            jsonPath: `/assets/game/sprites/monsters/${spritesheetName}.json`,
            alias: spritesheetName,
            // pixelArt: true,
          });
          await ensureCharacterOpaqueBoundsComputed(characterSpritesheetKey);
        }),
      );

      // 배경 설정
      this._background = new Background(PIXI.Assets.get("grass"));
      this._stage.addChild(this._background);
      this._sceneDarknessOverlay = this._createSceneDarknessOverlay();
      this._stage.addChild(this._sceneDarknessOverlay);

      const { width, height } = this._getSceneSize();
      this._background.resize(width, height);
      this._resizeSceneDarknessOverlay(width, height);
      if (this._isLocalTimeEnabled()) {
        if (!this._applyCachedAutoTimeOfDay()) {
          this._applyCurrentSkyState();
        }
        void this._initializeSunTimes();
      } else {
        this._setRandomManualTimeOfDay();
      }

      // zIndex 정렬을 위해 sortableChildren 활성화
      this._stage.sortableChildren = true;

      // UI 초기화
      if (this._parentElement) {
        // 게임 메뉴 초기화
        this._gameMenu = new GameMenu(this._parentElement, {
          onMiniGameSelect: () => {
            console.log("[MainSceneWorld] Mini game selected");
            if (!this._startMiniGame) {
              console.warn("[MainSceneWorld] Mini game start callback is not set");
              return;
            }

            this._recordMainSceneMenuUse("mini_game");
            void this._startMiniGame();
          },
          onFeedSelect: () => {
            console.log("[MainSceneWorld] Feed selected");
            const foodEid = this._throwFood();
            if (foodEid !== null) {
              this._recordMainSceneMenuUse("feed");
              this._trackPendingFeedAdFood(foodEid);
            }
          },
          onDrugSelect: () => {
            console.log("[MainSceneWorld] Drug selected");
            if (this._handleHospitalSelection()) {
              this._recordMainSceneMenuUse("hospital");
            }
          },
          onCleanSelect: () => {
            console.log("[MainSceneWorld] Clean selected");
            if (this._enterCleaningMode()) {
              this._recordMainSceneMenuUse("clean");
            }
          },
          onHospitalSelect: () => {
            console.log("[MainSceneWorld] Hospital selected");
            if (this._handleHospitalSelection()) {
              this._recordMainSceneMenuUse("hospital");
            }
          },
          onCancel: () => {
            console.log("[MainSceneWorld] Menu cancelled");
          },
          onFocusChange: (focusedIndex: number | null) => {
            // 메뉴에 포커스가 있는지 여부에 따라 컨트롤 버튼 업데이트
            this._updateControlButtonsForMenuState(focusedIndex !== null);
          },
        });

        // 디버그 Gauge UI는 dev 또는 native debug build에서 노출 가능
        if (
          (import.meta.env.DEV ||
            import.meta.env.NATIVE_FEATURE_DEBUG_MODE === "true") &&
          this._debugParentElement
        ) {
          this._debugGaugeUI = new HTMLDebugGaugeUI(
            this,
            this._debugParentElement,
            {
              initiallyVisible: import.meta.env.DEV,
            },
          );
          this._addDebugGaugeEventListener();
        }

        // 상세 디버그 UI (개발 환경에서만)
        if (import.meta.env.DEV && this._debugParentElement) {
          this._debugGameConstantsUI = new HTMLDebugGameConstantsUI(
            this._debugParentElement,
          );
          this._debugStatusUI = new HTMLDebugStatusUI(
            this,
            this._debugParentElement,
          );
          this._debugToggleButton = new HTMLDebugToggleButton(() => {
            this._debugStatusUI?.toggle();
            return this._debugStatusUI?.isDebugVisible() ?? false;
          }, this._debugParentElement);
        }
      }

      // Page Visibility API 이벤트 리스너 등록
      this._setupVisibilityChangeHandler();

      // 재진입 시뮬레이션 처리
      await this._processReentrySimulation();

      console.log("World initialization completed");
    } finally {
      console.groupEnd();
    }
  }

  private _addDebugGaugeEventListener(): void {
    if (
      this._isDebugGaugeEventListenerRegistered ||
      typeof window === "undefined"
    ) {
      return;
    }

    window.addEventListener(
      SHOW_DEBUG_GAUGE_EVENT,
      this._handleShowDebugGauge,
    );
    this._isDebugGaugeEventListenerRegistered = true;
  }

  private _removeDebugGaugeEventListener(): void {
    if (
      !this._isDebugGaugeEventListenerRegistered ||
      typeof window === "undefined"
    ) {
      return;
    }

    window.removeEventListener(
      SHOW_DEBUG_GAUGE_EVENT,
      this._handleShowDebugGauge,
    );
    this._isDebugGaugeEventListenerRegistered = false;
  }

  /**
   * 기본 캐릭터(알) 생성
   */
  private _createDefaultCharacterEntity(): SavedEntity {
    const eid = createCharacterEntity(this, {
      position: {
        x: this._positionBoundary.x + this._positionBoundary.width / 2,
        y: this._positionBoundary.y + this._positionBoundary.height / 2,
      },
      angle: { value: 0 },
      object: {
        id: generatePersistentNumericId(),
        type: ObjectType.CHARACTER,
        state: CharacterState.EGG,
      },
      characterStatus: {
        characterKey: ECS_NULL_VALUE,
        stamina: 5, // 초기 스테미나 최대값으로 설정
        evolutionGage: 0, // 초기 진화 게이지 0으로 설정
        evolutionPhase: 1,
        statuses: new Array(ECS_CHARACTER_STATUS_LENGTH).fill(ECS_NULL_VALUE),
      },
      render: {
        storeIndex: ECS_NULL_VALUE,
        scale: 3,
        textureKey: ECS_NULL_VALUE,
        zIndex: ECS_NULL_VALUE,
      },
      animationRender: {
        storeIndex: ECS_NULL_VALUE,
        spritesheetKey: SpritesheetKey.TestGreenSlimeA1,
        animationKey: AnimationKey.IDLE,
        isPlaying: true,
        loop: true,
        speed: 0.04,
      },
      speed: { value: ECS_NULL_VALUE },
    });

    this._requestLocationPermissionOnCharacterCreation();

    return convertECSEntityToSavedEntity(this, eid);
  }

  /**
   * 스토리지에서 엔티티들을 로드하여 ECS 월드에 복원
   */
  private _loadEcsEntitiesFromStorage(): void {
    console.groupCollapsed("📦 Loading entities from storage...");

    try {
      if (!this._persistentData?.entities) {
        console.warn("No entities data found in storage");
        return;
      }

      let loadedEntitiesCount = 0;
      let errorCount = 0;

      // 이미 로딩된 Object ID들을 추적
      const loadedObjectIds = new Set<number>();

      this._persistentData.entities.forEach((savedEntity, index) => {
        try {
          const objectId = savedEntity.components.object?.id;

          // Object ID가 없으면 에러
          if (!objectId) {
            throw new Error(
              `Entity ${
                index + 1
              } has no Object ID - critical data corruption detected`,
            );
          }

          // 중복 Object ID가 있으면 에러
          if (loadedObjectIds.has(objectId)) {
            throw new Error(
              `Duplicate Object ID ${objectId} detected at entity ${
                index + 1
              } - critical data corruption detected`,
            );
          }

          loadedObjectIds.add(objectId);

          const eid = addEntity(this);
          applySavedEntityToECS(this, eid, savedEntity);
          const repairedComponents = repairCharacterEntityRuntimeComponents(
            this,
            eid,
            this.currentTime,
          );

          if (repairedComponents.length > 0) {
            console.warn(
              `[MainSceneWorld] Repaired entity ${index + 1} (ID=${objectId}) missing runtime components: ${repairedComponents.join(", ")}`,
            );
          }

          loadedEntitiesCount++;

          console.log(
            `Loaded entity ${index + 1}: ID=${objectId}, Type=${
              savedEntity.components.object?.type
            }`,
          );
        } catch (error) {
          errorCount++;
          console.error(`Failed to load entity ${index + 1}:`, error);
          console.error("  Problematic entity data:", savedEntity);

          // 에러를 다시 던져서 게임 초기화 실패로 처리
          throw error;
        }
      });

      console.log(
        `Loaded ${loadedEntitiesCount} entities successfully, ${errorCount} failed`,
      );

      // 로딩 실패한 엔티티들이 있고 성공한 엔티티가 하나도 없다면 기본 캐릭터 생성
      if (loadedEntitiesCount === 0 && errorCount > 0) {
        console.warn(
          "All entities failed to load, creating default character...",
        );
        this._createDefaultCharacterEntity();
      }

      // 로드된 엔티티의 상태 아이콘 검증 및 수정
      validateAndFixStatusIcons(this);

      this._logLoadedEcsEntities(); // 로드된 엔티티 상태 요약 로그
    } finally {
      console.groupEnd();
    }
  }

  /**
   * 로드된 엔티티들의 상태를 로깅하는 디버그 메소드
   */
  private _logLoadedEcsEntities(): void {
    if (!this._persistentData?.entities) return;

    console.groupCollapsed("📊 Loaded Entities Summary:");

    const entityStats = {
      total: this._persistentData.entities.length,
      byType: {} as Record<string, number>,
      byState: {} as Record<string, number>,
    };

    this._persistentData.entities.forEach((entity) => {
      if (entity.components.object) {
        const type = ObjectType[entity.components.object.type] || "UNKNOWN";
        entityStats.byType[type] = (entityStats.byType[type] || 0) + 1;

        if (entity.components.object.type === ObjectType.CHARACTER) {
          const state =
            CharacterState[entity.components.object.state] || "UNKNOWN";
          entityStats.byState[state] = (entityStats.byState[state] || 0) + 1;
        }
      }
    });

    console.log(`Total entities: ${entityStats.total}`);
    console.log("By type:", entityStats.byType);
    if (Object.keys(entityStats.byState).length > 0) {
      console.log("Character states:", entityStats.byState);
    }

    console.groupEnd();
  }

  /**
   * Scene 종료 시 호출 (scene 변경 전 정리 작업)
   *
   * 사용법:
   * // Scene Manager에서 scene 변경 시
   * if (currentScene.onSceneExit) {
   *   currentScene.onSceneExit();
   * }
   */
  public async onSceneExit(): Promise<void> {
    console.log(
      "[MainSceneWorld] 🚪 Scene exit - saving state and cleaning up...",
    );

    // 현재 상태 저장
    if (!this._isPersistenceDisabled) {
      await this._saveCurrentState();
    }

    // 이벤트 핸들러 정리
    this._cleanupVisibilityChangeHandler();
    this._clearMainSceneAdTimers();

    // 수면 효과 정리
    if (this._stage) {
      cleanupSleepEffects(this._stage);
      cleanupCharacterNameLabels();
      cleanupCharacterLayoutDebug(this._stage);
    }
    this._pendingRecoveryCureEids.clear();
    this.stopRecoveryVibration();

    // 일시정지 상태로 설정 (다른 scene으로 전환되므로)
    this._isPaused = true;

    console.log("[MainSceneWorld] Scene exit cleanup completed");
  }

  /**
   * Scene 재진입 시 호출 (다른 scene에서 돌아올 때)
   *
   * 사용법:
   * // Scene Manager에서 MainScene으로 돌아올 때
   * if (mainScene.onSceneReenter) {
   *   await mainScene.onSceneReenter();
   * }
   */
  public async onSceneReenter(): Promise<void> {
    console.log(
      "[MainSceneWorld] 🔄 Scene reenter - restoring state and handlers...",
    );

    try {
      // 이벤트 핸들러 재등록
      this._setupVisibilityChangeHandler();

      // 재진입 시뮬레이션 실행 (다른 scene에 있던 시간 계산)
      await this._processReentrySimulation();

      // 일시정지 해제
      this._isPaused = false;
      this._pauseStartTime = 0;

      console.log("[MainSceneWorld] Scene reenter completed");
    } catch (error) {
      console.error("[MainSceneWorld] Failed to reenter scene:", error);
      // 에러가 발생해도 기본 상태는 복원
      this._isPaused = false;
      this._setupVisibilityChangeHandler();
    }
  }

  public async disablePersistenceAndClearData(): Promise<void> {
    this._isPersistenceDisabled = true;
    this._persistentData = undefined;
    this._isPaused = true;
    this._cleanupVisibilityChangeHandler();

    await this.clearData();
  }

  destroy(): void {
    console.groupCollapsed("[MainSceneWorld] 🧹 Destroying world...");

    try {
      this._cleanupVisibilityChangeHandler();
      this._clearMainSceneAdTimers();

      // Scene 종료 처리 (아직 호출되지 않았다면)
      if (!this._isPaused && !this._isPersistenceDisabled) {
        void this.onSceneExit();
      }

      // 게임 메뉴 정리
      if (this._gameMenu) {
        this._gameMenu.destroy();
        this._gameMenu = undefined;
      }

      this._removeDebugGaugeEventListener();

      // 디버그 게이지 UI 정리
      if (this._debugGaugeUI) {
        this._debugGaugeUI.destroy();
        this._debugGaugeUI = undefined;
      }

      // 디버그 UI 정리
      if (this._debugStatusUI) {
        this._debugStatusUI.destroy();
        this._debugStatusUI = undefined;
      }
      if (this._debugToggleButton) {
        this._debugToggleButton.destroy();
        this._debugToggleButton = undefined;
      }
      if (this._debugGameConstantsUI) {
        this._debugGameConstantsUI.destroy();
        this._debugGameConstantsUI = undefined;
      }

      if (this._sceneDarknessOverlay) {
        this._stage.removeChild(this._sceneDarknessOverlay);
        this._sceneDarknessOverlay.destroy();
        this._sceneDarknessOverlay = undefined;
      }

      cleanupSleepEffects(this._stage);
      cleanupCharacterNameLabels();
      cleanupCharacterLayoutDebug(this._stage);
      this._pendingRecoveryCureEids.clear();

      this._background && this._stage.removeChild(this._background);
      // this._assetsLoaded = false;

      // PIXI v8에서는 필요시 특정 에셋만 언로드 가능
      // PIXI.Assets.unload(Object.keys(GAME_ASSETS));

      console.log("World destroyed successfully");
      // TODO: 모든 엔티티 제거
    } finally {
      console.groupEnd();
    }
  }
  update(delta: number): void {
    // 앱이 일시정지 상태일 때는 시스템 업데이트 건너뛰기
    if (this._isPaused || this._isRunningReentrySimulation) {
      return;
    }

    this._updateAutoTimeOfDayIfNeeded();
    this._background?.animate(this.currentTime);

    // 시스템 파이프라인 실행
    this._pipedSystems({
      world: this,
      delta,
    });

    // UI 업데이트
    if (this._debugGaugeUI) {
      this._debugGaugeUI.update();
    }

    // 디버그 UI 업데이트
    if (this._debugStatusUI) {
      this._debugStatusUI.update();

      // 디버그 토글 버튼 상태 동기화
      if (this._debugToggleButton) {
        this._debugToggleButton.updateState(
          this._debugStatusUI.isDebugVisible(),
        );
      }
    }

    // 이전 상태 업데이트 (진입 감지용)
    this._previousCleaningMode = this._isCleaningMode;
  }

  private _initializeData(initialGameData?: {
    name: string;
    useLocalTime: boolean;
    cachedSunTimes?: SunTimesPayload | null;
  }): MainSceneWorldData {
    const useLocalTime =
      initialGameData?.useLocalTime ?? DEFAULT_USE_LOCAL_TIME;
    const cachedSunTimes = useLocalTime
      ? initialGameData?.cachedSunTimes ?? undefined
      : undefined;

    return {
      world_metadata: {
        name: "MainScene",
        monster_name: initialGameData?.name,
        last_ecs_saved: Date.now(),
        version: this.VERSION,
        app_state: {
          last_active_time: Date.now(),
          is_first_load: false,
          use_local_time: useLocalTime,
          cached_sun_times: cachedSunTimes,
          main_scene_ad: {
            menu_use_count: 0,
          },
        },
      },
      entities: [this._createDefaultCharacterEntity()],
    };
  }

  getInMemoryData(): MainSceneWorldData {
    return this._persistentData as MainSceneWorldData;
  }

  async getData(): Promise<MainSceneWorldData | null> {
    console.groupCollapsed("💾 Loading saved data from storage...");

    try {
      const data = (await StorageManager.getData(
        WORLD_DATA_STORAGE_KEY,
      )) as MainSceneWorldData;

      if (!data) {
        console.log("No saved data found in storage");
        return null;
      }

      console.log("Successfully loaded data from storage");
      return data;
    } catch (error) {
      console.error("Failed to load data from storage:", error);

      // 스토리지에서 데이터를 읽는 데 실패한 경우, 빈 데이터로 덮어쓰기
      // try {
      //   await StorageManager.setData(WORLD_DATA_STORAGE_KEY, null);
      //   console.log("[MainSceneWorld] Cleared corrupted storage data");
      // } catch (clearError) {
      //   console.error(
      //     "[MainSceneWorld] Failed to clear corrupted data:",
      //     clearError
      //   );
      // }

      return null;
    } finally {
      console.groupEnd();
    }
  }

  private _enqueueStorageWrite(operation: () => Promise<void>): Promise<void> {
    const nextWrite = this._pendingStorageWrite
      .catch(() => undefined)
      .then(() => operation());

    this._pendingStorageWrite = nextWrite.catch(() => undefined);
    return nextWrite;
  }

  async setData(data: MainSceneWorldData): Promise<void> {
    this._persistentData = data;

    if (this._isPersistenceDisabled) {
      console.debug("[MainSceneWorld] setData:skip_persistence_disabled", {
        key: WORLD_DATA_STORAGE_KEY,
        monsterName: data.world_metadata?.monster_name,
        entityCount: data.entities?.length ?? 0,
        savedAt: data.world_metadata?.last_ecs_saved,
      });
      return;
    }

    await this._enqueueStorageWrite(async () => {
      try {
        console.debug("[MainSceneWorld] setData:start", {
          key: WORLD_DATA_STORAGE_KEY,
          monsterName: data.world_metadata?.monster_name,
          entityCount: data.entities?.length ?? 0,
          savedAt: data.world_metadata?.last_ecs_saved,
        });
        await StorageManager.setData(WORLD_DATA_STORAGE_KEY, data);
        console.debug("[MainSceneWorld] setData:success", {
          key: WORLD_DATA_STORAGE_KEY,
          monsterName: data.world_metadata?.monster_name,
          entityCount: data.entities?.length ?? 0,
        });
      } catch (error) {
        console.error("[MainSceneWorld] Failed to save data:", error);
        throw error;
      }
    });
  }

  async clearData(): Promise<void> {
    this._persistentData = undefined;

    await this._enqueueStorageWrite(async () => {
      try {
        console.warn("[MainSceneWorld] clearData:start", {
          key: WORLD_DATA_STORAGE_KEY,
        });
        await StorageManager.removeData(WORLD_DATA_STORAGE_KEY);
        console.warn("[MainSceneWorld] clearData:success", {
          key: WORLD_DATA_STORAGE_KEY,
        });
      } catch (error) {
        console.error("[MainSceneWorld] Failed to clear data:", error);
        throw error;
      }
    });
  }

  private _sanitizeSavedEntities(entities: SavedEntity[]): SavedEntity[] {
    const sanitizedEntities: SavedEntity[] = [];
    const seenObjectIds = new Set<number>();

    entities.forEach((entity, index) => {
      if (!entity?.components) {
        console.warn(
          `[MainSceneWorld] Dropping corrupted entity ${index}: missing components`,
        );
        return;
      }

      const objectComponent = entity.components.object;

      if (!objectComponent) {
        console.warn(
          `[MainSceneWorld] Dropping corrupted entity ${index}: missing object component`,
        );
        return;
      }

      const objectId = objectComponent.id;

      if (
        typeof objectId !== "number" ||
        !Number.isFinite(objectId) ||
        objectId <= 0
      ) {
        console.warn(
          `[MainSceneWorld] Dropping corrupted entity ${index}: invalid Object ID ${objectId}`,
        );
        return;
      }

      if (seenObjectIds.has(objectId)) {
        console.warn(
          `[MainSceneWorld] Dropping duplicated entity ${index}: Object ID ${objectId}`,
        );
        return;
      }

      seenObjectIds.add(objectId);
      sanitizedEntities.push(entity);
    });

    return sanitizedEntities;
  }

  private _hasPlayableSavedData(
    data: MainSceneWorldData | null | undefined,
  ): data is MainSceneWorldData {
    if (!data) {
      return false;
    }

    const monsterName = data.world_metadata?.monster_name?.trim();

    if (!monsterName) {
      return false;
    }

    return (
      data.entities?.some((entity) => {
        return entity.components.object?.type === ObjectType.CHARACTER;
      }) ?? false
    );
  }

  /**
   * 저장된 데이터의 유효성을 검증하고 필요시 마이그레이션 수행
   */
  private _validateAndMigrateData(
    data: MainSceneWorldData,
  ): MainSceneWorldData {
    console.groupCollapsed("🔍 Validating saved data...");

    try {
      // 기본 구조 검증
      if (!data.world_metadata) {
        console.warn("Missing world_metadata, creating default");
        data.world_metadata = {
          name: "MainScene",
          last_ecs_saved: Date.now(),
          version: this.VERSION,
          app_state: {
            last_active_time: Date.now(),
            is_first_load: false,
            use_local_time: true,
            main_scene_ad: {
              menu_use_count: 0,
            },
          },
        };
      }

      if (!data.world_metadata.app_state) {
        data.world_metadata.app_state = {
          last_active_time: Date.now(),
          is_first_load: false,
          use_local_time: true,
          main_scene_ad: {
            menu_use_count: 0,
          },
        };
      } else if (
        typeof data.world_metadata.app_state.use_local_time !== "boolean"
      ) {
        data.world_metadata.app_state.use_local_time = true;
      }

      if (!data.world_metadata.app_state.main_scene_ad) {
        data.world_metadata.app_state.main_scene_ad = {
          menu_use_count: 0,
        };
      }

      if (!data.entities) {
        console.warn("Missing entities array, creating empty array");
        data.entities = [];
      }

      // 버전 호환성 검증
      if (data.world_metadata.version !== this.VERSION) {
        console.log(
          `Version mismatch (saved: ${data.world_metadata.version}, current: ${this.VERSION}), attempting migration...`,
        );
        data = this._migrateData(data);
      }

      const originalEntityCount = data.entities.length;
      data.entities = this._sanitizeSavedEntities(data.entities);

      if (data.entities.length !== originalEntityCount) {
        console.warn(
          `[MainSceneWorld] Recovered saved data by dropping ${
            originalEntityCount - data.entities.length
          } corrupted entities`,
        );
      }

      console.log(
        `Data validation completed, ${data.entities.length} valid entities found`,
      );
      return data;
    } finally {
      console.groupEnd();
    }
  }

  /**
   * 이전 버전 데이터를 현재 버전으로 마이그레이션
   */
  private _migrateData(data: MainSceneWorldData): MainSceneWorldData {
    console.groupCollapsed("🔄 Migrating data...");

    try {
      console.log(
        `Migrating data from version ${data.world_metadata.version} to ${this.VERSION}`,
      );

      // TODO: 버전별 마이그레이션 로직
      // 예: 1.0.0 이전 버전에서 특정 필드가 추가되었다면 여기서 처리

      // 마이그레이션 완료 후 버전 업데이트
      data.world_metadata.version = this.VERSION;
      data.world_metadata.last_ecs_saved = Date.now();

      console.log("Data migration completed");
      return data;
    } finally {
      console.groupEnd();
    }
  }

  /**
   * 화면 크기 변경 시 호출되는 메서드
   */
  resize(width: number, height: number): void {
    // 위치 경계 업데이트
    this._positionBoundary = {
      x: this._positionBoundaryInsets.left,
      y: this._positionBoundaryInsets.top,
      width:
        width -
        this._positionBoundaryInsets.left -
        this._positionBoundaryInsets.right,
      height:
        height -
        this._positionBoundaryInsets.top -
        this._positionBoundaryInsets.bottom,
    };

    // 배경 크기 조정
    if (this._background) {
      this._background.resize(width, height);
      this._applyCurrentSkyState();
    }

    this._resizeSceneDarknessOverlay(width, height);
  }

  public getTimeOfDay(): TimeOfDay {
    return this._timeOfDay;
  }

  public setTimeOfDay(timeOfDay: TimeOfDay): void {
    if (
      this._timeOfDayMode === TimeOfDayMode.Manual &&
      this._timeOfDay === timeOfDay
    ) {
      return;
    }

    this._timeOfDayMode = TimeOfDayMode.Manual;
    this._setUseLocalTimeEnabled(false);
    this._autoTimeOfDayState = null;
    this._autoTimeOfDayMinuteKey = null;
    this._timeOfDay = timeOfDay;
    this._applyCurrentSkyState();

    console.log(
      `[MainSceneWorld] Time of day changed to ${getTimeOfDayLabel(timeOfDay)} (manual)`,
    );
  }

  public enableAutoTimeOfDay(): void {
    this._setUseLocalTimeEnabled(true);

    if (!this._sunTimes) {
      void this._initializeSunTimes();
      return;
    }

    this._timeOfDayMode = TimeOfDayMode.Auto;
    this._autoTimeOfDayMinuteKey = null;
    this._updateAutoTimeOfDayIfNeeded(true);
  }

  public getTimeOfDayMode(): TimeOfDayMode {
    return this._timeOfDayMode;
  }

  public getTimeOfDayDebugState(): {
    mode: TimeOfDayMode;
    label: string;
    progress: number | null;
    hasLocationPermission: boolean;
    locationSource: SunLocationSource | null;
    sunriseAt: string | null;
    sunsetAt: string | null;
  } {
    return {
      mode: this._timeOfDayMode,
      label: getTimeOfDayLabel(this._timeOfDay),
      progress: this._autoTimeOfDayState?.progress ?? null,
      hasLocationPermission: this._hasLocationPermission,
      locationSource: this._sunLocationSource,
      sunriseAt: this._sunTimes?.sunriseAt ?? null,
      sunsetAt: this._sunTimes?.sunsetAt ?? null,
    };
  }

  private async _initializeSunTimes(): Promise<void> {
    await this._refreshSunTimes(true);
  }

  private async _refreshSunTimes(promptForPermission: boolean): Promise<void> {
    if (this._sunTimesRefreshPromise) {
      await this._sunTimesRefreshPromise;
      return;
    }

    this._sunTimesRefreshPromise = (async () => {
      const sunTimes = await getNativeSunTimes(promptForPermission);
      if (!sunTimes) {
        console.warn("[MainSceneWorld] Native sun times are unavailable, staying in manual mode");
        return;
      }

      this._sunTimes = sunTimes;
      this._hasLocationPermission = sunTimes.hasLocationPermission;
      this._sunLocationSource = sunTimes.locationSource;
      this._setCachedSunTimes(sunTimes);

      if (!this._isLocalTimeEnabled()) {
        console.log(
          "[MainSceneWorld] Sun times loaded but local time is disabled, staying in manual mode",
        );
        return;
      }

      if (this._timeOfDayMode === TimeOfDayMode.Manual) {
        this._timeOfDayMode = TimeOfDayMode.Auto;
      }

      this._autoTimeOfDayMinuteKey = null;
      this._updateAutoTimeOfDayIfNeeded(true);

      console.log(
        `[MainSceneWorld] Sun times loaded (${sunTimes.locationSource}, permission=${sunTimes.hasLocationPermission})`,
      );
    })();

    try {
      await this._sunTimesRefreshPromise;
    } finally {
      this._sunTimesRefreshPromise = null;
    }
  }

  private _updateAutoTimeOfDayIfNeeded(force = false): void {
    if (this._timeOfDayMode !== TimeOfDayMode.Auto || !this._sunTimes) {
      return;
    }

    const now = new Date(this.currentTime);

    if (
      !this.isSimulationMode &&
      hasSunTimesDateRolledOver(now, this._sunTimes)
    ) {
      void this._refreshSunTimes(false);
      return;
    }

    const currentMinuteKey = Math.floor(this.currentTime / 60000);
    if (!force && this._autoTimeOfDayMinuteKey === currentMinuteKey) {
      return;
    }

    this._autoTimeOfDayMinuteKey = currentMinuteKey;
    const nextState = resolveAutoTimeOfDayState(now, this._sunTimes);
    const hasChanged =
      !this._autoTimeOfDayState ||
      this._autoTimeOfDayState.timeOfDay !== nextState.timeOfDay ||
      this._autoTimeOfDayState.progress !== nextState.progress;

    this._autoTimeOfDayState = nextState;
    this._timeOfDay = nextState.timeOfDay;

    if (hasChanged) {
      this._applyCurrentSkyState();
    }
  }

  private _applyCurrentSkyState(): void {
    if (!this._background) {
      return;
    }

    const state =
      this._timeOfDayMode === TimeOfDayMode.Auto && this._autoTimeOfDayState
        ? this._autoTimeOfDayState
        : getManualSkyVisualState(this._timeOfDay);

    this._background.applySkyState(state);
    this._applySceneDarknessOverlay(state);
  }

  private _createSceneDarknessOverlay(): PIXI.Graphics {
    const overlay = new PIXI.Graphics();
    overlay.zIndex = MainSceneWorld.SCENE_DARKNESS_OVERLAY_Z_INDEX;
    overlay.eventMode = "none";
    overlay.visible = false;
    return overlay;
  }

  private _resizeSceneDarknessOverlay(width: number, height: number): void {
    if (!this._sceneDarknessOverlay) {
      return;
    }

    this._sceneDarknessOverlay.clear();
    this._sceneDarknessOverlay.beginFill(0x07101f, 1);
    this._sceneDarknessOverlay.drawRect(0, 0, width, height);
    this._sceneDarknessOverlay.endFill();
  }

  private _applySceneDarknessOverlay(state: {
    timeOfDay: TimeOfDay;
    progress: number;
  }): void {
    if (!this._sceneDarknessOverlay) {
      return;
    }

    const alpha = this._getSceneDarknessAlpha(state);
    this._sceneDarknessOverlay.alpha = alpha;
    this._sceneDarknessOverlay.visible = alpha > 0.001;
  }

  private _getSceneDarknessAlpha(state: {
    timeOfDay: TimeOfDay;
    progress: number;
  }): number {
    const progress = Math.max(0, Math.min(1, state.progress));

    switch (state.timeOfDay) {
      case TimeOfDay.Sunrise:
        return this._lerpDarknessAlpha(0.26, 0.02, progress);
      case TimeOfDay.Sunset:
        return this._lerpDarknessAlpha(0.02, 0.22, progress);
      case TimeOfDay.Night:
        return 0.28;
      case TimeOfDay.Day:
      default:
        return 0;
    }
  }

  private _getSceneSize(): { width: number; height: number } {
    return {
      width:
        this._positionBoundary.width +
        this._positionBoundaryInsets.left +
        this._positionBoundaryInsets.right,
      height:
        this._positionBoundary.height +
        this._positionBoundaryInsets.top +
        this._positionBoundaryInsets.bottom,
    };
  }

  private _lerpDarknessAlpha(from: number, to: number, progress: number): number {
    return from + (to - from) * progress;
  }

  private _setRandomManualTimeOfDay(): void {
    this._timeOfDayMode = TimeOfDayMode.Manual;
    this._autoTimeOfDayState = null;
    this._autoTimeOfDayMinuteKey = null;
    this._timeOfDay = Math.random() < 0.5 ? TimeOfDay.Day : TimeOfDay.Night;
    this._applyCurrentSkyState();

    console.log(
      `[MainSceneWorld] Local time disabled, randomly selected ${getTimeOfDayLabel(
        this._timeOfDay,
      )}`,
    );
  }

  private _isLocalTimeEnabled(): boolean {
    return this._persistentData?.world_metadata.app_state?.use_local_time ?? true;
  }

  private _applyCachedAutoTimeOfDay(): boolean {
    const cachedSunTimes = this._getCachedSunTimes();
    if (!cachedSunTimes) {
      return false;
    }

    this._sunTimes = cachedSunTimes;
    this._hasLocationPermission = cachedSunTimes.hasLocationPermission;
    this._sunLocationSource = cachedSunTimes.locationSource;
    this._timeOfDayMode = TimeOfDayMode.Auto;
    this._autoTimeOfDayMinuteKey = null;
    this._autoTimeOfDayState = resolveAutoTimeOfDayState(
      new Date(this.currentTime),
      cachedSunTimes,
    );
    this._timeOfDay = this._autoTimeOfDayState.timeOfDay;
    this._applyCurrentSkyState();
    return true;
  }

  private _getCachedSunTimes(): SunTimesPayload | null {
    const cachedSunTimes =
      this._persistentData?.world_metadata.app_state?.cached_sun_times;

    return this._isValidSunTimesPayload(cachedSunTimes) ? cachedSunTimes : null;
  }

  private _setCachedSunTimes(sunTimes: SunTimesPayload): void {
    if (!this._persistentData) {
      return;
    }

    if (!this._persistentData.world_metadata.app_state) {
      this._persistentData.world_metadata.app_state = {
        last_active_time: 0,
        is_first_load: false,
        use_local_time: this._isLocalTimeEnabled(),
        main_scene_ad: {
          menu_use_count: 0,
        },
      };
    }

    this._persistentData.world_metadata.app_state.cached_sun_times = sunTimes;
  }

  private _isValidSunTimesPayload(value: unknown): value is SunTimesPayload {
    if (!value || typeof value !== "object") {
      return false;
    }

    const candidate = value as Partial<SunTimesPayload>;
    return (
      typeof candidate.sunriseAt === "string" &&
      typeof candidate.sunsetAt === "string" &&
      typeof candidate.date === "string" &&
      typeof candidate.timezone === "string" &&
      typeof candidate.timezoneOffsetMinutes === "number" &&
      typeof candidate.fetchedAt === "string" &&
      (candidate.locationSource === "device" ||
        candidate.locationSource === "fallback") &&
      typeof candidate.hasLocationPermission === "boolean"
    );
  }

  private _setUseLocalTimeEnabled(enabled: boolean): void {
    if (!this._persistentData) {
      return;
    }

    if (!this._persistentData.world_metadata.app_state) {
      this._persistentData.world_metadata.app_state = {
        last_active_time: 0,
        is_first_load: false,
        use_local_time: enabled,
        main_scene_ad: {
          menu_use_count: 0,
        },
      };
      return;
    }

    this._persistentData.world_metadata.app_state.use_local_time = enabled;
  }

  private _requestLocationPermissionOnCharacterCreation(): void {
    if (!this._sunTimes || this._hasLocationPermission) {
      return;
    }

    void (async () => {
      const granted = await requestNativeLocationPermission();
      if (!granted) {
        return;
      }

      await this._refreshSunTimes(false);
    })();
  }

  /**
   * Scene 인터페이스 구현: 컨트롤 버튼 클릭 처리
   */
  public handleControlButtonClick(buttonType: ControlButtonType): void {
    console.log(`[MainSceneWorld] Control button clicked: ${buttonType}`);

    // 청소 모드에서의 버튼 처리
    if (this._isCleaningMode) {
      if (buttonType === ControlButtonType.Cancel) {
        this._exitCleaningMode({ restoreFocusedTargetProgress: true });
        return;
      }
      if (buttonType === ControlButtonType.Clean) {
        // Clean 버튼은 슬라이더로 처리됨
        return;
      }
    }

    // Settings 버튼 클릭 시 메뉴 활성화 (첫 번째 메뉴 항목에 포커스)
    if (buttonType === ControlButtonType.Settings && this._gameMenu) {
      const navigationAction: NavigationActionPayload = {
        type: NavigationAction.SETTING,
        index: ++this._navigationActionIndex,
      };
      this._gameMenu.processNavigationAction(navigationAction);
      return;
    }

    const navigationAction = this._createNavigationActionFromButton(buttonType);
    if (navigationAction && this._gameMenu) {
      this._gameMenu.processNavigationAction(navigationAction);
    }
  }

  /**
   * Scene 인터페이스 구현: 슬라이더 값 변경 처리
   */
  public handleSliderValueChange(value: number): void {
    const nextSliderValue = Math.max(0, Math.min(1, value));
    const previousSliderValue = this._currentSliderValue;

    // 슬라이더 값 저장
    this._currentSliderValue = nextSliderValue;

    // 청소 모드에서는 슬라이더 값을 청소 시스템에 전달
    if (this._isCleaningMode) {
      this._pendingCleaningSliderDelta += Math.abs(
        nextSliderValue - previousSliderValue,
      );
    }
  }

  /**
   * Scene 인터페이스 구현: 슬라이더 종료 처리
   */
  public handleSliderEnd(): void {
    // 청소 모드에서 슬라이더가 종료되었을 때 청소 완료 상태 확인
    if (this._isCleaningMode) {
      this._checkAndExitCleaningModeIfComplete();
    }
  }

  /**
   * 컨트롤 버튼을 네비게이션 액션으로 변환
   */
  private _createNavigationActionFromButton(
    buttonType: ControlButtonType,
  ): NavigationActionPayload | null {
    switch (buttonType) {
      case ControlButtonType.Next:
        return {
          type: NavigationAction.NEXT,
          index: ++this._navigationActionIndex,
        };
      case ControlButtonType.Confirm:
        return {
          type: NavigationAction.SELECT,
          index: ++this._navigationActionIndex,
        };
      case ControlButtonType.Cancel:
        return {
          type: NavigationAction.CANCEL,
          index: ++this._navigationActionIndex,
        };
      default:
        return null;
    }
  }

  /**
   * 메뉴 포커스 상태에 따라 컨트롤 버튼을 업데이트
   */
  private _updateControlButtonsForMenuState(menuHasFocus: boolean): void {
    if (!this._changeControlButtons) return;

    if (menuHasFocus) {
      // 메뉴에 포커스가 있을 때: Next, Confirm, Cancel
      this._changeControlButtons([
        { type: ControlButtonType.Cancel },
        { type: ControlButtonType.Confirm },
        { type: ControlButtonType.Next },
      ]);
    } else {
      // 메뉴에 포커스가 없을 때: Cancel, Settings, Next
      this._changeControlButtons([
        { type: ControlButtonType.Cancel },
        { type: ControlButtonType.Settings },
        { type: ControlButtonType.Next },
      ]);
    }
  }

  /**
   * 음식을 던지는 메서드
   */
  private _throwFood(): number | null {
    const boundary = this._positionBoundary;

    // 초기 위치 - 왼쪽 또는 오른쪽 구석에서 시작
    const isFromLeft = Math.random() < 0.5; // 50% 확률로 왼쪽/오른쪽 선택
    const initialPosition = {
      x: isFromLeft ? boundary.x - 100 : boundary.x + boundary.width + 100, // 화면 밖 구석
      y: boundary.y + boundary.height + 100, // 화면 완전 아래쪽
    };

    // 최종 위치 - 여유분을 두고 설정 (위아래 40px, 좌우 20px 여유)
    const finalPosition = {
      x: boundary.x + 20 + Math.random() * (boundary.width - 40), // 좌우 20px 여유
      y: boundary.y + 40 + Math.random() * (boundary.height - 80), // 위아래 40px 여유
    };

    // 음식 엔티티 생성 (64가지 음식 중 랜덤 선택)
    const foodEid = createThrowingFoodEntity(this, {
      initialPosition,
      finalPosition,
    });

    console.log(
      `[MainSceneWorld] Food thrown from ${
        isFromLeft ? "left" : "right"
      } corner (${initialPosition.x}, ${initialPosition.y}) to (${
        finalPosition.x
      }, ${finalPosition.y})`,
    );
    console.log(
      `[MainSceneWorld] Position boundary: x=${boundary.x}, y=${boundary.y}, w=${boundary.width}, h=${boundary.height}`,
    );

    return foodEid;
  }

  /**
   * 앱 상태 관리자의 현재 상태 반환 (디버그용)
   */
  public getAppState() {
    return {
      isActive:
        typeof document !== "undefined" ? !document.hidden : !this._isPaused,
      isPaused: this._isPaused,
      isSimulationMode: this.isSimulationMode,
      currentTime: this.currentTime,
    };
  }

  public getMainSceneAdDebugState(): {
    menuUseCount: number;
    threshold: number;
    cooldownMs: number;
    deepNight: boolean;
    pending: {
      menu: MainSceneAdMenu;
      queuedAt: number;
      cooldownMs: number;
      threshold: number;
      deepNight: boolean;
    } | null;
  } {
    const adState = this._getMainSceneAdState();
    const currentConfig = this._getMainSceneAdConfig();
    const pending = adState?.pending;

    return {
      menuUseCount: adState?.menu_use_count ?? 0,
      threshold: pending?.threshold ?? currentConfig.threshold,
      cooldownMs: pending?.cooldown_ms ?? currentConfig.cooldownMs,
      deepNight: pending?.deep_night ?? currentConfig.deepNight,
      pending: pending
        ? {
            menu: pending.menu,
            queuedAt: pending.queued_at,
            cooldownMs: pending.cooldown_ms,
            threshold: pending.threshold,
            deepNight: pending.deep_night,
          }
        : null,
    };
  }

  /**
   * 병원 메뉴 선택 처리 - sick 상태일 때만 회복 주사기 연출 시작
   */
  private _handleHospitalSelection(): boolean {
    const characterEid = this._findMainCharacterEntity();

    if (characterEid === -1) {
      console.warn(
        "[MainSceneWorld] No character entity found for hospital recovery",
      );
      return false;
    }

    if (
      hasComponent(this, EffectAnimationComp, characterEid) &&
      EffectAnimationComp.isActive[characterEid]
    ) {
      console.log(
        `[MainSceneWorld] Recovery animation already active for character ${characterEid}`,
      );
      return false;
    }

    const isSick = this._isCharacterSick(characterEid);

    if (isSick) {
      this._pendingRecoveryCureEids.add(characterEid);
    } else {
      console.log(
        `[MainSceneWorld] Character ${characterEid} is not sick, starting hospital animation only`,
      );
    }

    startRecoveryAnimation(this, characterEid, this._stage, this.currentTime);

    console.log(
      `[MainSceneWorld] Started hospital recovery animation for character ${characterEid} (pendingCure=${isSick})`,
    );
    return true;
  }

  private _handleDrugSelection(): void {
    if (this._handleHospitalSelection()) {
      this._recordMainSceneMenuUse("hospital");
    }
  }

  private _isCharacterSick(characterEid: number): boolean {
    if (ObjectComp.state[characterEid] === CharacterState.SICK) {
      return true;
    }

    const statuses = CharacterStatusComp.statuses[characterEid];

    if (!statuses) {
      return false;
    }

    for (let i = 0; i < statuses.length; i++) {
      if (statuses[i] === CharacterStatus.SICK) {
        return true;
      }
    }

    return false;
  }

  public applyPendingRecoverySyringeImpact(characterEid: number): void {
    if (!this._pendingRecoveryCureEids.has(characterEid)) {
      return;
    }

    this._pendingRecoveryCureEids.delete(characterEid);

    const statuses = CharacterStatusComp.statuses[characterEid];
    let removed = false;
    if (statuses) {
      for (let i = 0; i < statuses.length; i++) {
        if (statuses[i] === CharacterStatus.SICK) {
          statuses[i] = ECS_NULL_VALUE;
          removed = true;
          break;
        }
      }
    }

    if (hasComponent(this, DiseaseSystemComp, characterEid)) {
      DiseaseSystemComp.sickStartTime[characterEid] = 0;
    }

    if (ObjectComp.state[characterEid] === CharacterState.SICK) {
      ObjectComp.state[characterEid] = CharacterState.IDLE;
    }

    console.log(
      `[MainSceneWorld] Applied hospital recovery impact for character ${characterEid} (removedStatus=${removed})`,
    );
  }

  /**
   * 메인 캐릭터 엔티티 찾기
   */
  private _findMainCharacterEntity(): number {
    const characterEntities = liveCharacterEntitiesQuery(this);

    for (let i = 0; i < characterEntities.length; i++) {
      const eid = characterEntities[i];

      if (ObjectComp.type[eid] === ObjectType.CHARACTER) {
        return eid;
      }
    }

    return -1; // 캐릭터를 찾지 못함
  }

  /**
   * 청소 모드 상태를 업데이트하는 메서드들
   */
  public setFocusedTargetEid(eid: number): void {
    this._focusedTargetEid = eid;
  }

  public setBroomProgress(progress: number): void {
    this._broomProgress = Math.max(0, Math.min(1, progress));
  }

  public consumePendingCleaningSliderDelta(): number {
    const pendingDelta = this._pendingCleaningSliderDelta;
    this._pendingCleaningSliderDelta = 0;
    return pendingDelta;
  }

  /**
   * 청소 모드 진입 (외부에서 호출 가능)
   */
  enterCleaningMode(): void {
    this._enterCleaningMode();
  }

  /**
   * 청소 모드 종료 (외부에서 호출 가능)
   */
  exitCleaningMode(): void {
    this._exitCleaningMode();
  }

  /**
   * 청소 모드 진입
   */
  private _enterCleaningMode(): boolean {
    console.log("[MainSceneWorld] Entering cleaning mode");

    // 이미 청소 모드라면 무시
    if (this._isCleaningMode) {
      return false;
    }

    const initialCleaningSliderValue = 0.5;

    this._isCleaningMode = true;
    this._cleaningSliderSessionKey += 1;
    this._focusedTargetEid = -1;
    this._currentSliderValue = initialCleaningSliderValue;
    this._broomProgress = initialCleaningSliderValue;
    this._pendingCleaningSliderDelta = 0;

    // 컨트롤 버튼을 청소 모드 세트로 변경
    this._updateControlButtonsForCleaningMode(true);
    return true;
  }

  /**
   * 청소 완료 상태를 확인하고 모든 작업이 완료되면 청소 모드 종료
   */
  private _checkAndExitCleaningModeIfComplete(): void {
    // 청소 시스템에서 사용하는 것과 동일한 쿼리 생성
    const cleanableEntitiesQuery = defineQuery([
      ObjectComp,
      PositionComp,
      CleanableComp,
    ]);

    const cleanableEntities = cleanableEntitiesQuery(this);
    let hasIncompleteEntities = false;

    for (const eid of cleanableEntities) {
      if (CleanableComp.cleaningProgress[eid] < 1.0) {
        hasIncompleteEntities = true;
        break;
      }
    }

    // 모든 청소 가능한 엔티티가 완료되었으면 청소 모드 종료
    if (!hasIncompleteEntities) {
      console.log(
        "[MainSceneWorld] All cleaning completed, exiting cleaning mode",
      );
      this._exitCleaningMode({ completed: true });
    }
  }

  /**
   * 청소 모드 종료
   */
  private _exitCleaningMode(
    options: {
      restoreFocusedTargetProgress?: boolean;
      completed?: boolean;
    } = {},
  ): void {
    console.log("[MainSceneWorld] Exiting cleaning mode");

    if (!this._isCleaningMode) {
      return;
    }

    if (
      options.restoreFocusedTargetProgress &&
      this._focusedTargetEid !== -1 &&
      hasComponent(this, CleanableComp, this._focusedTargetEid)
    ) {
      CleanableComp.cleaningProgress[this._focusedTargetEid] = 0;
    }

    this._isCleaningMode = false;
    this._focusedTargetEid = -1;
    this._broomProgress = this._currentSliderValue;
    this._pendingCleaningSliderDelta = 0;
    clearCleaningTargets(this);

    // 현재 메뉴의 포커스 상태에 따라 컨트롤 버튼 복원
    const menuHasFocus = this._gameMenu?.hasFocus() ?? false;
    this._updateControlButtonsForMenuState(menuHasFocus);

    if (options.completed) {
      this._schedulePendingMainSceneAdForMenu(
        "clean",
        MAIN_SCENE_AD_POST_ACTION_DELAY_MS,
      );
    }
  }

  /**
   * 청소 모드 상태에 따라 컨트롤 버튼 업데이트
   */
  private _updateControlButtonsForCleaningMode(isCleaningMode: boolean): void {
    if (!this._changeControlButtons) return;

    if (isCleaningMode) {
      // 청소 모드: Cancel, Clean, Clean
      this._changeControlButtons([
        { type: ControlButtonType.Cancel },
        {
          type: ControlButtonType.Clean,
          initialSliderValue: this._currentSliderValue,
          sliderSessionKey: this._cleaningSliderSessionKey,
        },
        {
          type: ControlButtonType.Clean,
          initialSliderValue: this._currentSliderValue,
          sliderSessionKey: this._cleaningSliderSessionKey,
        },
      ]);
    } else {
      // 기본 모드로 복원 (메뉴 포커스 상태에 따라)
      this._updateControlButtonsForMenuState(false);
    }
  }

  /**
   * 시뮬레이션 전용 시스템 파이프라인 생성
   * 렌더링 관련 시스템들을 제외한 로직 시스템들만 포함
   * @param getCurrentTime 현재 시뮬레이션 시간을 반환하는 함수
   */
  private _createSimulationPipeline(getCurrentTime: () => number) {
    return pipe(
      // 시간 기반 시스템들 (상태 관리 시스템 토글 적용)
      (params: any) =>
        this._statusSystemsEnabled
          ? freshnessSystem({ ...params, currentTime: getCurrentTime() })
          : params,
      (params: any) =>
        this._statusSystemsEnabled
          ? digestiveSystem({ ...params, currentTime: getCurrentTime() })
          : params,
      (params: any) =>
        this._statusSystemsEnabled
          ? sleepScheduleSystem({
              ...params,
              currentTime: getCurrentTime(),
            })
          : params,
      (params: any) =>
        this._statusSystemsEnabled
          ? diseaseSystem({ ...params, currentTime: getCurrentTime() })
          : params,
      (params: any) =>
        eggHatchSystem({ ...params, currentTime: getCurrentTime() }),
      (params: any) =>
        this._statusSystemsEnabled ? characterManagerSystem(params) : params,
      (params: any) =>
        this._statusSystemsEnabled
          ? characterStatusSystem({ ...params, currentTime: getCurrentTime() })
          : params,
      // 범용 effect 애니메이션 시스템 (시뮬레이션에서는 상태만 업데이트, stage는 null)
      (params: any) =>
        effectAnimationSystem({
          ...params,
          currentTime: getCurrentTime(),
          stage: null, // 시뮬레이션에서는 렌더링 스킵
        }),
      // 렌더링 관련 시스템들은 시뮬레이션에서 제외
      // - cleaningSystem (스킵)
      // 이동 및 게임플레이 시스템들
      randomMovementSystem,
      commonMovementSystem,
      // 착지 상태를 먼저 반영해 같은 프레임에 음식 탐색이 가능하도록 한다.
      throwAnimationSystem,
      (params: any) =>
        foodEatingSystem({ ...params, currentTime: getCurrentTime() }),
      // 애니메이션 상태 시스템들 (시뮬레이션에서도 실행)
      animationStateSystem,
    );
  }

  /**
   * 재진입 시뮬레이션 처리
   * 앱을 다시 켤 때 경과된 시간을 계산하고 해당 시간만큼 시뮬레이션 실행
   */
  private async _processReentrySimulation(): Promise<void> {
    if (!this._persistentData?.world_metadata.app_state) {
      // 첫 실행이거나 앱 상태가 없으면 그냥 리턴
      console.log(
        "[MainSceneWorld] No app state found, skipping reentry simulation",
      );
      return;
    }

    const lastActiveTime =
      this._persistentData.world_metadata.app_state.last_active_time;

    if (!lastActiveTime || lastActiveTime <= 0) {
      console.log(
        "[MainSceneWorld] Reentry simulation skipped because last active time is missing",
      );
      await this._saveCurrentState();
      return;
    }

    const currentTime = Date.now();
    const elapsedTime = currentTime - lastActiveTime;

    if (elapsedTime <= 0) {
      console.log(
        "[MainSceneWorld] Reentry simulation skipped because elapsed time is not positive",
      );
      return;
    }

    console.log(
      `[MainSceneWorld] Starting reentry simulation for ${this._formatPauseDuration(
        elapsedTime,
      )} elapsed time`,
    );

    // 일회성 ReentrySimulator 인스턴스 생성
    const reentrySimulator = new ReentrySimulator();

    // 시뮬레이션 전용 파이프라인을 생성하여 시뮬레이션 실행
    const simulationPipeline = this._createSimulationPipeline(() =>
      reentrySimulator.getCurrentSimulationTime(),
    );

    try {
      this._isRunningReentrySimulation = true;
      this._simulationTime = lastActiveTime;

      await reentrySimulator.simulate(
        lastActiveTime,
        (params: any) => {
          this._simulationTime = reentrySimulator.getCurrentSimulationTime();
          this._updateAutoTimeOfDayIfNeeded();
          return simulationPipeline(params);
        },
        this,
      );

      this._simulationTime = currentTime;
      await this._saveCurrentState();

      console.log("[MainSceneWorld] Reentry simulation completed successfully");
    } catch (error) {
      console.error("[MainSceneWorld] Reentry simulation failed:", error);
    } finally {
      this._isRunningReentrySimulation = false;
      this._simulationTime = null;
    }
  }

  /**
   * 현재 시뮬레이션 모드인지 확인
   * 재진입 시뮬레이션이 실행 중이 아닌 상태에서는 항상 false
   */
  public get isSimulationMode(): boolean {
    return this._simulationTime !== null;
  }

  /**
   * 현재 시뮬레이션 시간 또는 실시간 반환
   * 재진입 시뮬레이션이 실행 중이 아닌 상태에서는 항상 실시간
   */
  public get currentTime(): number {
    return this._simulationTime ?? Date.now();
  }

  /**
   * 모든 렌더링 시스템들을 한 번에 실행하는 통합 메서드
   */
  private _renderAllSystems(params: any): typeof params {
    // 1. 애니메이션 렌더링 (캐릭터 애니메이션)
    animationRenderSystem(params);

    // 2. 상태 아이콘 렌더링
    statusIconRenderSystem(params);

    // 3. 정적 스프라이트 렌더링
    renderSystem(params);

    // 4. 캐릭터 이름표 렌더링
    characterNameLabelSystem(params);

    // 5. dev 빌드 전용 캐릭터 레이아웃 디버그 렌더링
    characterLayoutDebugSystem({ ...params, stage: this._stage });

    // 6. 청소 대상 렌더링
    cleanableRenderSystem({ ...params, stage: this._stage });

    // 7. 수면 효과 렌더링
    sleepEffectSystem({ ...params, stage: this._stage });

    return params;
  }

  /**
   * Page Visibility API 이벤트 핸들러 설정
   */
  private _setupVisibilityChangeHandler(): void {
    // Page Visibility API 지원 여부 확인
    if (typeof document === "undefined" || !("visibilityState" in document)) {
      console.warn("[MainSceneWorld] Page Visibility API not supported");
      return;
    }

    this._visibilityChangeHandler = () => {
      if (document.hidden) {
        // 앱이 백그라운드로 갔을 때 (홈으로 나가거나 다른 앱으로 전환)
        void this._handleAppPause();
      } else {
        // 앱이 포그라운드로 돌아왔을 때
        void this._handleAppResume();
      }
    };

    // 이벤트 리스너 등록
    document.addEventListener(
      "visibilitychange",
      this._visibilityChangeHandler,
    );

    console.log("[MainSceneWorld] Page Visibility API handler registered");
  }

  /**
   * Page Visibility API 이벤트 핸들러 정리
   */
  private _cleanupVisibilityChangeHandler(): void {
    if (this._visibilityChangeHandler && typeof document !== "undefined") {
      document.removeEventListener(
        "visibilitychange",
        this._visibilityChangeHandler,
      );
      this._visibilityChangeHandler = undefined;
      console.log("[MainSceneWorld] Page Visibility API handler cleaned up");
    }
  }

  /**
   * 앱 일시정지 처리 (백그라운드로 갔을 때)
   */
  private async _handleAppPause(): Promise<void> {
    if (this._isPaused) {
      console.warn(
        "[MainSceneWorld] App pause event received but app is already paused",
      );
      return; // 이미 일시정지 상태
    }

    console.log("[MainSceneWorld] 📱 App paused (went to background)");

    this._isPaused = true;
    this._pauseStartTime = Date.now();

    // 현재 게임 상태 저장 (ECS 엔티티 상태 포함)
    await this._saveCurrentState();

    // 추가적인 일시정지 처리가 필요하다면 여기에 구현
    // 예: 오디오 일시정지, 애니메이션 중단 등
  }

  /**
   * 앱 재개 처리 (포그라운드로 돌아왔을 때)
   */
  private async _handleAppResume(): Promise<void> {
    if (!this._isPaused) {
      console.warn(
        "[MainSceneWorld] App resume event received but app is not paused",
      );
      return; // 이미 활성 상태
    }

    const pauseDuration = Date.now() - this._pauseStartTime;
    console.log(
      `[MainSceneWorld] 📱 App resumed (returned to foreground) after ${this._formatPauseDuration(
        pauseDuration,
      )}`,
    );

    // 재진입 시뮬레이션 무조건 실행
    console.log(
      `[MainSceneWorld] Running reentry simulation for pause duration of ${this._formatPauseDuration(
        pauseDuration,
      )}...`,
    );

    // 재진입 시뮬레이션 실행
    await this._processReentrySimulation();

    this._isPaused = false;
    this._pauseStartTime = 0;
    this._updateAutoTimeOfDayIfNeeded(true);

    // 추가적인 재개 처리가 필요하다면 여기에 구현
    // 예: 오디오 재개, 애니메이션 재시작 등
  }

  /**
   * 일시정지 시간을 읽기 쉬운 형태로 포맷팅
   */
  private _formatPauseDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    }

    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return remainingSeconds > 0
        ? `${minutes}m ${remainingSeconds}s`
        : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  }

  /**
   * 현재 게임 상태를 저장 (scene 변경 시 호출)
   */
  private async _saveCurrentState(): Promise<void> {
    try {
      if (this._isPersistenceDisabled) {
        return;
      }

      // ECS 엔티티들의 현재 상태를 persistent data에 동기화
      this._syncEcsToPersisentData();

      // 마지막 활성 시간 저장
      this._saveLastActiveTime();

      if (this._persistentData) {
        await this.setData(this._persistentData);
      }

      console.log("[MainSceneWorld] Current game state saved successfully");
    } catch (error) {
      console.error("[MainSceneWorld] Failed to save current state:", error);
    }
  }

  /**
   * ECS 엔티티들의 현재 상태를 persistent data에 동기화
   */
  private _syncEcsToPersisentData(): void {
    if (!this._persistentData) {
      console.warn("[MainSceneWorld] No persistent data to sync to");
      return;
    }

    // 현재 ECS 월드의 모든 엔티티를 순회하여 persistent data 업데이트
    const updatedEntities: SavedEntity[] = [];

    const objectEntitiesQuery = defineQuery([ObjectComp]);
    const objectEntityIds = objectEntitiesQuery(this);
    const seenObjectIds = new Set<number>();

    for (const eid of objectEntityIds) {
      try {
        const savedEntity = convertECSEntityToSavedEntity(this, eid);
        const objectId = savedEntity.components.object?.id;

        if (
          typeof objectId !== "number" ||
          !Number.isFinite(objectId) ||
          objectId <= 0
        ) {
          console.warn(
            `[MainSceneWorld] Skipping entity ${eid} during sync: invalid Object ID ${objectId}`,
          );
          continue;
        }

        if (seenObjectIds.has(objectId)) {
          console.warn(
            `[MainSceneWorld] Skipping entity ${eid} during sync: duplicate Object ID ${objectId}`,
          );
          continue;
        }

        seenObjectIds.add(objectId);
        updatedEntities.push(savedEntity);
      } catch (error) {
        console.warn(
          `[MainSceneWorld] Failed to convert entity ${eid} to saved entity:`,
          error,
        );
      }
    }

    // persistent data 업데이트
    this._persistentData.entities = updatedEntities;
    this._persistentData.world_metadata.last_ecs_saved = Date.now();

    console.log(
      `[MainSceneWorld] Synced ${updatedEntities.length} entities to persistent data`,
    );
  }

  /**
   * 마지막 활성 시간 저장
   */
  private _saveLastActiveTime(): void {
    if (this._persistentData) {
      if (!this._persistentData.world_metadata.app_state) {
        this._persistentData.world_metadata.app_state = {
          last_active_time: 0,
          is_first_load: false,
          use_local_time: this._isLocalTimeEnabled(),
          main_scene_ad: {
            menu_use_count: 0,
          },
        };
      }

      this._persistentData.world_metadata.app_state.last_active_time =
        Date.now();

      console.log(
        `[MainSceneWorld] Saved last active time: ${new Date().toLocaleString(
          "ko-KR",
        )}`,
      );
    }
  }

  /**
   * 상태 관리 시스템들 토글 (디버그용)
   * @returns 토글 후 활성화 상태
   */
  public toggleStatusSystems(): boolean {
    this._statusSystemsEnabled = !this._statusSystemsEnabled;
    console.log(
      `[MainSceneWorld] Status systems ${
        this._statusSystemsEnabled ? "enabled" : "disabled"
      }`,
    );
    return this._statusSystemsEnabled;
  }

  public toggleSleepDebugEffect(): boolean {
    this._sleepDebugEffectEnabled = !this._sleepDebugEffectEnabled;

    if (!this._sleepDebugEffectEnabled) {
      cleanupSleepEffects(this._stage);
    }

    console.log(
      `[MainSceneWorld] Sleep debug effect ${
        this._sleepDebugEffectEnabled ? "enabled" : "disabled"
      }`,
    );

    return this._sleepDebugEffectEnabled;
  }

  public isSleepDebugEffectEnabled(): boolean {
    return this._sleepDebugEffectEnabled;
  }

  public setRandomMovementDebugEnabled(enabled: boolean): void {
    this._randomMovementDebugEnabled = enabled;
  }

  public isRandomMovementDebugEnabled(): boolean {
    return this._randomMovementDebugEnabled;
  }
}
