import type { NativeSunTimesTraceContext } from "../sunTimes";

export type MainSceneLoadingTraceContext = {
  initializationAttemptId: number;
  setupFlowId?: string | null;
  bootstrapState?: "playable" | "setup_required" | "reset_required" | null;
};

function getTimingNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
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

export class MainSceneInitDiagnostics {
  private readonly _loadingTraceContext: MainSceneLoadingTraceContext | null;
  private _isInitTimingActive = false;
  private _loadingTraceInitStartedAt: number | null = null;
  private _loadingTraceInitCompletedAt: number | null = null;
  private _hasPendingFirstSpriteTimingLog = false;

  constructor(loadingTraceContext?: MainSceneLoadingTraceContext | null) {
    this._loadingTraceContext = loadingTraceContext ?? null;
  }

  public get isInitTimingActive(): boolean {
    return this._isInitTimingActive;
  }

  public beginInit(): void {
    this._isInitTimingActive = true;
    this._loadingTraceInitStartedAt = getTimingNow();
    this._loadingTraceInitCompletedAt = null;
    this._hasPendingFirstSpriteTimingLog = this._loadingTraceContext !== null;
    this.logPhase("init_total", {
      status: "start",
    });
  }

  public completeInit(): void {
    this._loadingTraceInitCompletedAt = getTimingNow();
    this.logPhase("init_total", {
      status: "end",
      durationMs:
        this._loadingTraceInitStartedAt === null
          ? null
          : Math.round(
              this._loadingTraceInitCompletedAt - this._loadingTraceInitStartedAt,
            ),
    });
    this._isInitTimingActive = false;
  }

  public failInit(error: unknown): void {
    this.logPhase("init_total", {
      status: "error",
      durationMs:
        this._loadingTraceInitStartedAt === null
          ? null
          : Math.round(getTimingNow() - this._loadingTraceInitStartedAt),
      error: summarizeTimingError(error),
    });
    this._isInitTimingActive = false;
  }

  public logPhase(
    phase: string,
    payload: Record<string, unknown> = {},
  ): void {
    console.log("[ImportantDiagnostics][MainSceneInitTiming]", {
      phase,
      initializationAttemptId:
        this._loadingTraceContext?.initializationAttemptId ?? null,
      setupFlowId: this._loadingTraceContext?.setupFlowId ?? null,
      bootstrapState: this._loadingTraceContext?.bootstrapState ?? null,
      ...payload,
    });
  }

  public async measurePhase<T>(
    phase: string,
    work: () => Promise<T>,
    payload: Record<string, unknown> = {},
  ): Promise<T> {
    const startedAt = getTimingNow();
    this.logPhase(phase, {
      status: "start",
      ...payload,
    });

    try {
      const result = await work();
      this.logPhase(phase, {
        status: "end",
        durationMs: Math.round(getTimingNow() - startedAt),
        ...payload,
      });
      return result;
    } catch (error) {
      this.logPhase(phase, {
        status: "error",
        durationMs: Math.round(getTimingNow() - startedAt),
        error: summarizeTimingError(error),
        ...payload,
      });
      throw error;
    }
  }

  public createSunTimesTraceContext(params: {
    source: string;
    phase: string;
  }): NativeSunTimesTraceContext {
    return {
      source: params.source,
      phase: params.phase,
      setupFlowId: this._loadingTraceContext?.setupFlowId ?? null,
      initializationAttemptId:
        this._loadingTraceContext?.initializationAttemptId ?? null,
    };
  }

  public consumePendingFirstSpriteTimingLog(
    eid: number,
    spriteType: "static" | "animated",
  ): Record<string, unknown> | null {
    if (!this._hasPendingFirstSpriteTimingLog) {
      return null;
    }

    this._hasPendingFirstSpriteTimingLog = false;
    const now = getTimingNow();

    return {
      eid,
      spriteType,
      initializationAttemptId:
        this._loadingTraceContext?.initializationAttemptId ?? null,
      setupFlowId: this._loadingTraceContext?.setupFlowId ?? null,
      bootstrapState: this._loadingTraceContext?.bootstrapState ?? null,
      sinceInitStartMs:
        this._loadingTraceInitStartedAt === null
          ? null
          : Math.round(now - this._loadingTraceInitStartedAt),
      sinceInitCompletedMs:
        this._loadingTraceInitCompletedAt === null
          ? null
          : Math.round(now - this._loadingTraceInitCompletedAt),
    };
  }
}
