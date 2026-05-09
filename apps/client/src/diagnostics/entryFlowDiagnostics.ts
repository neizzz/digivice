import type { SunTimesPayload } from "@digivice/game";
import type { SetupFormData } from "../layers/SetupLayer";
import { logImportantDiagnostics } from "./diagnosticLogger";

export type BootstrapSavedGameDataState =
  | "playable"
  | "setup_required"
  | "reset_required";

export type SetupFlowLogSource =
  | "request_initial_game_data"
  | "handle_setup_complete";

type SetupFlowTrace = {
  setupFlowId: string;
  source: SetupFlowLogSource;
  createdAt: number;
};

type NativeSunTimesTraceContext = {
  source: string;
  phase: string;
  setupFlowId?: string | null;
  initializationAttemptId?: number | null;
};

type GameLoadingTraceContext = {
  initializationAttemptId: number;
  setupFlowId?: string | null;
  bootstrapState?: BootstrapSavedGameDataState | null;
};

type SetupFormSummary = {
  nameLength: number;
  useLocalTime: boolean;
  hadCachedSunTimes: boolean;
};

function getTimingNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function toDurationMs(startedAt: number): number {
  return Math.max(0, Math.round(getTimingNow() - startedAt));
}

function createTraceId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function summarizeTimingError(error: unknown): {
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

function summarizeSetupFormData(formData: SetupFormData): SetupFormSummary {
  return {
    nameLength: formData.name.length,
    useLocalTime: formData.useLocalTime,
    hadCachedSunTimes: !!formData.cachedSunTimes,
  };
}

export class EntryFlowDiagnostics {
  private _activeSetupFlowTrace: SetupFlowTrace | null = null;
  private _lastBootstrapState: BootstrapSavedGameDataState | null = null;

  public resetActiveSetupFlow(): void {
    this._activeSetupFlowTrace = null;
  }

  public beginBootstrap(gameContainerSize: number | null): void {
    this._logBootstrap("bootstrap", {
      status: "start",
      gameContainerSize,
    });
  }

  public beginPrepareSavedGameData(storageKind: "native" | "web"): number {
    this.resetActiveSetupFlow();
    this._logBootstrap("prepare_saved_game_data", {
      status: "start",
      storageKind,
    });
    return getTimingNow();
  }

  public completePrepareSavedGameData(params: {
    startedAt: number;
    storageKind: "native" | "web";
    resultAction: BootstrapSavedGameDataState;
    savedDataSummary: Record<string, unknown>;
  }): void {
    this._lastBootstrapState = params.resultAction;
    this._logBootstrap("prepare_saved_game_data", {
      status: "end",
      durationMs: toDurationMs(params.startedAt),
      storageKind: params.storageKind,
      resultAction: params.resultAction,
      savedDataSummary: params.savedDataSummary,
    });
  }

  public failPrepareSavedGameData(params: {
    startedAt: number;
    storageKind: "native" | "web";
    error: unknown;
  }): void {
    this._lastBootstrapState = "reset_required";
    this._logBootstrap("prepare_saved_game_data", {
      status: "error",
      durationMs: toDurationMs(params.startedAt),
      storageKind: params.storageKind,
      error: summarizeTimingError(params.error),
    });
  }

  public markWaitingForSetupInput(): void {
    this._logBootstrap("request_initial_game_data", {
      status: "waiting_for_input",
    });
  }

  public startSetupFlow(source: SetupFlowLogSource): SetupFlowTrace {
    const trace: SetupFlowTrace = {
      setupFlowId: createTraceId("setup"),
      source,
      createdAt: getTimingNow(),
    };
    this._activeSetupFlowTrace = trace;
    return trace;
  }

  public logSetupConfirmed(formData: SetupFormData): void {
    this._logSetup("setup_confirmed", summarizeSetupFormData(formData));
  }

  public logSetupDataReady(formData: SetupFormData): void {
    this._logSetup("setup_data_ready", {
      durationMs: this._activeSetupFlowTrace
        ? toDurationMs(this._activeSetupFlowTrace.createdAt)
        : null,
      ...summarizeSetupFormData(formData),
    });
  }

  public beginHydrateInitialSetupData(formData: SetupFormData): number {
    const startedAt = getTimingNow();
    this._logSetup("hydrate_initial_setup_data", {
      status: "start",
      ...summarizeSetupFormData(formData),
    });
    return startedAt;
  }

  public skipHydrateInitialSetupData(params: {
    startedAt: number;
    formData: SetupFormData;
    reason: "local_time_disabled" | "cached_sun_times_already_present";
  }): void {
    this._logSetup("hydrate_initial_setup_data", {
      status: "skip",
      durationMs: toDurationMs(params.startedAt),
      reason: params.reason,
      ...summarizeSetupFormData(params.formData),
    });
  }

  public beginNativeSunTimesRequest(): number {
    const startedAt = getTimingNow();
    this._logSetup("native_sun_times_request", {
      status: "start",
      promptForPermission: true,
    });
    return startedAt;
  }

  public completeNativeSunTimesRequest(
    startedAt: number,
    sunTimes: SunTimesPayload | null,
  ): void {
    this._logSetup("native_sun_times_request", {
      status: "end",
      durationMs: toDurationMs(startedAt),
      promptForPermission: true,
      receivedSunTimes: !!sunTimes,
      locationSource: sunTimes?.locationSource ?? null,
      hasLocationPermission: sunTimes?.hasLocationPermission ?? null,
    });
  }

  public failNativeSunTimesRequest(startedAt: number, error: unknown): void {
    this._logSetup("native_sun_times_request", {
      status: "error",
      durationMs: toDurationMs(startedAt),
      promptForPermission: true,
      error: summarizeTimingError(error),
    });
  }

  public completeHydrateInitialSetupData(params: {
    startedAt: number;
    sunTimes: SunTimesPayload | null;
  }): void {
    this._logSetup("hydrate_initial_setup_data", {
      status: "end",
      durationMs: toDurationMs(params.startedAt),
      resolvedWithCachedSunTimes: !!params.sunTimes,
      locationSource: params.sunTimes?.locationSource ?? null,
      hasLocationPermission: params.sunTimes?.hasLocationPermission ?? null,
    });
  }

  public failHydrateInitialSetupData(startedAt: number, error: unknown): void {
    this._logSetup("hydrate_initial_setup_data", {
      status: "error",
      durationMs: toDurationMs(startedAt),
      error: summarizeTimingError(error),
    });
  }

  public beginInitializeGame(
    initializationAttemptId: number,
    gameContainerSize: number | null,
  ): void {
    this._logBootstrap("initialize_game", {
      status: "start",
      initializationAttemptId,
      gameContainerSize,
    });
  }

  public completeInitializeGame(initializationAttemptId: number): void {
    this._logBootstrap("initialize_game", {
      status: "end",
      initializationAttemptId,
    });
  }

  public failInitializeGame(
    initializationAttemptId: number,
    error: unknown,
  ): void {
    this._logBootstrap("initialize_game", {
      status: "error",
      initializationAttemptId,
      error: summarizeTimingError(error),
    });
  }

  public beginRequestInitialGameData(): number {
    this._logBootstrap("request_initial_game_data", {
      status: "start",
    });
    return getTimingNow();
  }

  public completeRequestInitialGameData(
    startedAt: number,
    hasInitialSetupData: boolean,
  ): void {
    this._logBootstrap("request_initial_game_data", {
      status: "end",
      durationMs: toDurationMs(startedAt),
      hasInitialSetupData,
    });
  }

  public beginLayoutStabilization(): number {
    this._logBootstrap("wait_for_layout_stabilization", {
      status: "start",
    });
    return getTimingNow();
  }

  public completeLayoutStabilization(
    startedAt: number,
    viewportHeight: number,
  ): void {
    this._logBootstrap("wait_for_layout_stabilization", {
      status: "end",
      durationMs: toDurationMs(startedAt),
      viewportHeight,
    });
  }

  public createNativeSunTimesTraceContext(params: {
    source: string;
    phase: string;
    initializationAttemptId?: number | null;
  }): NativeSunTimesTraceContext {
    return {
      source: params.source,
      phase: params.phase,
      setupFlowId: this._activeSetupFlowTrace?.setupFlowId ?? null,
      initializationAttemptId: params.initializationAttemptId ?? null,
    };
  }

  public createGameLoadingTraceContext(
    initializationAttemptId: number,
  ): GameLoadingTraceContext {
    return {
      initializationAttemptId,
      setupFlowId: this._activeSetupFlowTrace?.setupFlowId ?? null,
      bootstrapState: this._lastBootstrapState,
    };
  }

  private _logSetup(
    phase: string,
    payload: Record<string, unknown> = {},
  ): void {
    const trace = this._activeSetupFlowTrace;
    logImportantDiagnostics("log", "[ImportantDiagnostics][SetupFlowTiming]", {
      phase,
      setupFlowId: trace?.setupFlowId ?? null,
      setupSource: trace?.source ?? null,
      flowAgeMs: trace ? toDurationMs(trace.createdAt) : null,
      ...payload,
    });
  }

  private _logBootstrap(
    phase: string,
    payload: Record<string, unknown> = {},
  ): void {
    logImportantDiagnostics("log", "[ImportantDiagnostics][BootstrapTiming]", {
      phase,
      setupFlowId: this._activeSetupFlowTrace?.setupFlowId ?? null,
      bootstrapState: this._lastBootstrapState,
      ...payload,
    });
  }
}
