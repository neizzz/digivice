import { StorageManager } from "../../../managers/StorageManager";
import type {
  PipePoolStats,
  PipeUpdatePhaseCosts,
} from "../gameLogic";

export const FLAPPY_BIRD_PERF_DIAGNOSTICS_STORAGE_KEY =
  "FlappyBirdPerfDiagnosticsV1";

const FLAPPY_BIRD_PERF_HISTORY_VERSION = 1;
const FLAPPY_BIRD_PERF_MAX_RETAINED_SESSIONS = 3;
const FLAPPY_BIRD_PERF_MAX_SECOND_BUCKETS = 60;
const FLAPPY_BIRD_PERF_MAX_SLOW_FRAME_EVENTS = 20;
const FLAPPY_BIRD_PERF_MAX_BGM_SPIKE_EVENTS = 10;
const FLAPPY_BIRD_PERF_MAX_TOP_SPIKE_EVENTS = 10;
const FLAPPY_BIRD_PERF_AUTO_FLUSH_INTERVAL_MS = 15_000;
const FLAPPY_BIRD_FRAME_BUDGET_MS = 16.7;
const FLAPPY_BIRD_SLOW_FRAME_DELTA_THRESHOLD_MS = 20;
const FLAPPY_BIRD_SLOW_FRAME_UPDATE_COST_THRESHOLD_MS = 8;
const FLAPPY_BIRD_BGM_SCHEDULER_SPIKE_THRESHOLD_MS = 4;

export type FlappyBirdPerfPersistTrigger =
  | "periodic"
  | "app_hidden"
  | "game_over"
  | "return_to_main"
  | "scene_destroy";

export type FlappyBirdFramePhaseCostKey =
  | "syncSkyState"
  | "nearMissUI"
  | "playerUpdate"
  | "countdownUpdate"
  | "cloudUpdate"
  | "collisionCheck"
  | "pipeUpdate"
  | "groundUpdate";

export type FlappyBirdFramePhaseCosts = Partial<
  Record<FlappyBirdFramePhaseCostKey, number>
>;

export type FlappyBirdFrameDelayCause =
  | "ticker_gap"
  | "render"
  | "update"
  | "mixed"
  | "unknown";

export type FlappyBirdPerfSpikeMetric =
  | "tickerGapMs"
  | "renderCostMs"
  | "frameEndToEndCostMs";

export type FlappyBirdFramePerfSample = {
  timestampMs: number;
  deltaTimeMs: number;
  updateCostMs: number;
  tickerGapMs?: number | null;
  updateToRenderStartMs?: number;
  renderCostMs?: number;
  frameEndToEndCostMs?: number;
  gameState: string;
  score: number;
  activePipePairs: number;
  cloudCount: number;
  groundTileCount: number;
  trackedPhysicsObjects: number;
  syncedDisplayObjects: number;
  spawnedPipes: number;
  removedPipes: number;
  isAppSuspended: boolean;
  documentHidden: boolean;
  phaseCosts: FlappyBirdFramePhaseCosts;
  pipePhaseCosts: PipeUpdatePhaseCosts;
  pipePoolStats: PipePoolStats;
};

export type FlappyBirdPhysicsPerfSample = {
  timestampMs: number;
  deltaMs: number;
  engineUpdateCostMs: number;
  syncDisplayCostMs: number;
  totalCostMs: number;
  trackedPhysicsObjects: number;
  syncedDisplayObjects: number;
};

export type FlappyBirdBgmSchedulePerfSample = {
  timestampMs: number;
  durationMs: number;
  scheduledSteps: number;
  scheduledVoices: number;
};

export type FlappyBirdPerfSecondBucket = {
  secondOffset: number;
  frameCount: number;
  renderTimingSampleCount: number;
  avgDeltaTimeMs: number;
  maxDeltaTimeMs: number;
  avgUpdateCostMs: number;
  maxUpdateCostMs: number;
  avgTickerGapMs: number;
  maxTickerGapMs: number;
  avgUpdateToRenderStartMs: number;
  maxUpdateToRenderStartMs: number;
  avgRenderCostMs: number;
  maxRenderCostMs: number;
  avgFrameEndToEndCostMs: number;
  maxFrameEndToEndCostMs: number;
  slowFrameCount: number;
  avgActivePipePairs: number;
  maxActivePipePairs: number;
  avgCloudCount: number;
  maxCloudCount: number;
  avgGroundTileCount: number;
  maxGroundTileCount: number;
  totalSpawnedPipes: number;
  totalRemovedPipes: number;
  physicsStepCount: number;
  avgPhysicsUpdateCostMs: number;
  maxPhysicsUpdateCostMs: number;
  avgSyncDisplayCostMs: number;
  maxSyncDisplayCostMs: number;
  bgmTickCount: number;
  avgBgmScheduleCostMs: number;
  maxBgmScheduleCostMs: number;
  maxBgmScheduledVoices: number;
  totalPipePairsCreated: number;
  totalPipePairsReused: number;
  totalPipeBodiesCreated: number;
  totalPipeBodiesReused: number;
  totalPipePoolMissCount: number;
  statesSeen: string[];
};

export type FlappyBirdSlowFrameEvent = {
  secondOffset: number;
  timestamp: string;
  deltaTimeMs: number;
  updateCostMs: number;
  tickerGapMs?: number | null;
  updateToRenderStartMs?: number;
  renderCostMs?: number;
  frameEndToEndCostMs?: number;
  delayCause?: FlappyBirdFrameDelayCause;
  gameState: string;
  score: number;
  activePipePairs: number;
  cloudCount: number;
  groundTileCount: number;
  trackedPhysicsObjects: number;
  syncedDisplayObjects: number;
  spawnedPipes: number;
  removedPipes: number;
  isAppSuspended: boolean;
  documentHidden: boolean;
  phaseCosts: FlappyBirdFramePhaseCosts;
  pipePhaseCosts: PipeUpdatePhaseCosts;
  pipePoolStats: PipePoolStats;
};

export type FlappyBirdPerfSpikeEvent = FlappyBirdSlowFrameEvent & {
  metric: FlappyBirdPerfSpikeMetric;
  metricValueMs: number;
  frameBudgetMs: number;
};

export type FlappyBirdBgmSpikeEvent = {
  secondOffset: number;
  timestamp: string;
  durationMs: number;
  scheduledSteps: number;
  scheduledVoices: number;
};

export type FlappyBirdPerfSessionSnapshot = {
  version: number;
  sessionId: string;
  startedAt: string;
  startedAtMs: number;
  lastUpdatedAt: string;
  lastUpdatedAtMs: number;
  endedAt: string | null;
  endedAtMs: number | null;
  isCompleted: boolean;
  completionReason: FlappyBirdPerfPersistTrigger | null;
  lastPersistTrigger: FlappyBirdPerfPersistTrigger | null;
  screen: {
    width: number;
    height: number;
  };
  scoreSummary: {
    lastScore: number;
    maxScore: number;
  };
  summary: {
    frameCount: number;
    renderTimingSampleCount: number;
    slowFrameCount: number;
    tickerGapDominantSlowFrameCount: number;
    renderDominantSlowFrameCount: number;
    updateDominantSlowFrameCount: number;
    mixedDominantSlowFrameCount: number;
    unknownDominantSlowFrameCount: number;
    physicsStepCount: number;
    bgmTickCount: number;
    bgmSpikeCount: number;
    maxDeltaTimeMs: number;
    maxUpdateCostMs: number;
    maxTickerGapMs: number;
    maxUpdateToRenderStartMs: number;
    maxRenderCostMs: number;
    maxFrameEndToEndCostMs: number;
    maxMatterUpdateCostMs: number;
    maxSyncDisplayCostMs: number;
    maxBgmScheduleCostMs: number;
    maxActivePipePairs: number;
    pipePairsCreated: number;
    pipePairsReused: number;
    pipeBodiesCreated: number;
    pipeBodiesReused: number;
    pipePoolMissCount: number;
  };
  secondBuckets: FlappyBirdPerfSecondBucket[];
  slowFrames: FlappyBirdSlowFrameEvent[];
  topTickerGapFrames: FlappyBirdPerfSpikeEvent[];
  topRenderFrames: FlappyBirdPerfSpikeEvent[];
  topFrameEndToEndFrames: FlappyBirdPerfSpikeEvent[];
  bgmSpikes: FlappyBirdBgmSpikeEvent[];
};

export type FlappyBirdPerfHistory = {
  version: number;
  sessions: FlappyBirdPerfSessionSnapshot[];
};

export type FlappyBirdPerfSnapshot = {
  storageKey: string;
  maxRetainedSessions: number;
  activeSession: FlappyBirdPerfSessionSnapshot | null;
  lastCompletedSession: FlappyBirdPerfSessionSnapshot | null;
};

type MutableSecondBucket = {
  secondOffset: number;
  frameCount: number;
  renderTimingSampleCount: number;
  totalDeltaTimeMs: number;
  maxDeltaTimeMs: number;
  totalUpdateCostMs: number;
  maxUpdateCostMs: number;
  tickerGapSampleCount: number;
  totalTickerGapMs: number;
  maxTickerGapMs: number;
  totalUpdateToRenderStartMs: number;
  maxUpdateToRenderStartMs: number;
  totalRenderCostMs: number;
  maxRenderCostMs: number;
  totalFrameEndToEndCostMs: number;
  maxFrameEndToEndCostMs: number;
  slowFrameCount: number;
  totalActivePipePairs: number;
  maxActivePipePairs: number;
  totalCloudCount: number;
  maxCloudCount: number;
  totalGroundTileCount: number;
  maxGroundTileCount: number;
  totalSpawnedPipes: number;
  totalRemovedPipes: number;
  physicsStepCount: number;
  totalPhysicsUpdateCostMs: number;
  maxPhysicsUpdateCostMs: number;
  totalSyncDisplayCostMs: number;
  maxSyncDisplayCostMs: number;
  bgmTickCount: number;
  totalBgmScheduleCostMs: number;
  maxBgmScheduleCostMs: number;
  maxBgmScheduledVoices: number;
  totalPipePairsCreated: number;
  totalPipePairsReused: number;
  totalPipeBodiesCreated: number;
  totalPipeBodiesReused: number;
  totalPipePoolMissCount: number;
  statesSeen: Set<string>;
};

type MutableSession = {
  sessionId: string;
  startedAtMs: number;
  lastUpdatedAtMs: number;
  screen: {
    width: number;
    height: number;
  };
  scoreSummary: {
    lastScore: number;
    maxScore: number;
  };
  summary: FlappyBirdPerfSessionSnapshot["summary"];
  secondBuckets: Map<number, MutableSecondBucket>;
  slowFrames: FlappyBirdSlowFrameEvent[];
  topTickerGapFrames: FlappyBirdPerfSpikeEvent[];
  topRenderFrames: FlappyBirdPerfSpikeEvent[];
  topFrameEndToEndFrames: FlappyBirdPerfSpikeEvent[];
  bgmSpikes: FlappyBirdBgmSpikeEvent[];
  completionReason: FlappyBirdPerfPersistTrigger | null;
  lastPersistTrigger: FlappyBirdPerfPersistTrigger | null;
  endedAtMs: number | null;
};

function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `flappy-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function toIsoString(timestampMs: number): string {
  return new Date(timestampMs).toISOString();
}

function isObjectRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeHistory(value: unknown): FlappyBirdPerfHistory {
  if (!isObjectRecord(value) || !Array.isArray(value.sessions)) {
    return {
      version: FLAPPY_BIRD_PERF_HISTORY_VERSION,
      sessions: [],
    };
  }

  return {
    version:
      typeof value.version === "number"
        ? value.version
        : FLAPPY_BIRD_PERF_HISTORY_VERSION,
    sessions: value.sessions.filter(isObjectRecord) as FlappyBirdPerfSessionSnapshot[],
  };
}

function createSecondBucket(secondOffset: number): MutableSecondBucket {
  return {
    secondOffset,
    frameCount: 0,
    renderTimingSampleCount: 0,
    totalDeltaTimeMs: 0,
    maxDeltaTimeMs: 0,
    totalUpdateCostMs: 0,
    maxUpdateCostMs: 0,
    tickerGapSampleCount: 0,
    totalTickerGapMs: 0,
    maxTickerGapMs: 0,
    totalUpdateToRenderStartMs: 0,
    maxUpdateToRenderStartMs: 0,
    totalRenderCostMs: 0,
    maxRenderCostMs: 0,
    totalFrameEndToEndCostMs: 0,
    maxFrameEndToEndCostMs: 0,
    slowFrameCount: 0,
    totalActivePipePairs: 0,
    maxActivePipePairs: 0,
    totalCloudCount: 0,
    maxCloudCount: 0,
    totalGroundTileCount: 0,
    maxGroundTileCount: 0,
    totalSpawnedPipes: 0,
    totalRemovedPipes: 0,
    physicsStepCount: 0,
    totalPhysicsUpdateCostMs: 0,
    maxPhysicsUpdateCostMs: 0,
    totalSyncDisplayCostMs: 0,
    maxSyncDisplayCostMs: 0,
    bgmTickCount: 0,
    totalBgmScheduleCostMs: 0,
    maxBgmScheduleCostMs: 0,
    maxBgmScheduledVoices: 0,
    totalPipePairsCreated: 0,
    totalPipePairsReused: 0,
    totalPipeBodiesCreated: 0,
    totalPipeBodiesReused: 0,
    totalPipePoolMissCount: 0,
    statesSeen: new Set<string>(),
  };
}

function toSnapshotBucket(bucket: MutableSecondBucket): FlappyBirdPerfSecondBucket {
  return {
    secondOffset: bucket.secondOffset,
    frameCount: bucket.frameCount,
    renderTimingSampleCount: bucket.renderTimingSampleCount,
    avgDeltaTimeMs:
      bucket.frameCount > 0
        ? roundToTenth(bucket.totalDeltaTimeMs / bucket.frameCount)
        : 0,
    maxDeltaTimeMs: roundToTenth(bucket.maxDeltaTimeMs),
    avgUpdateCostMs:
      bucket.frameCount > 0
        ? roundToTenth(bucket.totalUpdateCostMs / bucket.frameCount)
        : 0,
    maxUpdateCostMs: roundToTenth(bucket.maxUpdateCostMs),
    avgTickerGapMs:
      bucket.tickerGapSampleCount > 0
        ? roundToTenth(bucket.totalTickerGapMs / bucket.tickerGapSampleCount)
        : 0,
    maxTickerGapMs: roundToTenth(bucket.maxTickerGapMs),
    avgUpdateToRenderStartMs:
      bucket.renderTimingSampleCount > 0
        ? roundToTenth(
            bucket.totalUpdateToRenderStartMs / bucket.renderTimingSampleCount,
          )
        : 0,
    maxUpdateToRenderStartMs: roundToTenth(bucket.maxUpdateToRenderStartMs),
    avgRenderCostMs:
      bucket.renderTimingSampleCount > 0
        ? roundToTenth(bucket.totalRenderCostMs / bucket.renderTimingSampleCount)
        : 0,
    maxRenderCostMs: roundToTenth(bucket.maxRenderCostMs),
    avgFrameEndToEndCostMs:
      bucket.renderTimingSampleCount > 0
        ? roundToTenth(
            bucket.totalFrameEndToEndCostMs / bucket.renderTimingSampleCount,
          )
        : 0,
    maxFrameEndToEndCostMs: roundToTenth(bucket.maxFrameEndToEndCostMs),
    slowFrameCount: bucket.slowFrameCount,
    avgActivePipePairs:
      bucket.frameCount > 0
        ? roundToTenth(bucket.totalActivePipePairs / bucket.frameCount)
        : 0,
    maxActivePipePairs: bucket.maxActivePipePairs,
    avgCloudCount:
      bucket.frameCount > 0
        ? roundToTenth(bucket.totalCloudCount / bucket.frameCount)
        : 0,
    maxCloudCount: bucket.maxCloudCount,
    avgGroundTileCount:
      bucket.frameCount > 0
        ? roundToTenth(bucket.totalGroundTileCount / bucket.frameCount)
        : 0,
    maxGroundTileCount: bucket.maxGroundTileCount,
    totalSpawnedPipes: bucket.totalSpawnedPipes,
    totalRemovedPipes: bucket.totalRemovedPipes,
    physicsStepCount: bucket.physicsStepCount,
    avgPhysicsUpdateCostMs:
      bucket.physicsStepCount > 0
        ? roundToTenth(
            bucket.totalPhysicsUpdateCostMs / bucket.physicsStepCount,
          )
        : 0,
    maxPhysicsUpdateCostMs: roundToTenth(bucket.maxPhysicsUpdateCostMs),
    avgSyncDisplayCostMs:
      bucket.physicsStepCount > 0
        ? roundToTenth(bucket.totalSyncDisplayCostMs / bucket.physicsStepCount)
        : 0,
    maxSyncDisplayCostMs: roundToTenth(bucket.maxSyncDisplayCostMs),
    bgmTickCount: bucket.bgmTickCount,
    avgBgmScheduleCostMs:
      bucket.bgmTickCount > 0
        ? roundToTenth(bucket.totalBgmScheduleCostMs / bucket.bgmTickCount)
        : 0,
    maxBgmScheduleCostMs: roundToTenth(bucket.maxBgmScheduleCostMs),
    maxBgmScheduledVoices: bucket.maxBgmScheduledVoices,
    totalPipePairsCreated: bucket.totalPipePairsCreated,
    totalPipePairsReused: bucket.totalPipePairsReused,
    totalPipeBodiesCreated: bucket.totalPipeBodiesCreated,
    totalPipeBodiesReused: bucket.totalPipeBodiesReused,
    totalPipePoolMissCount: bucket.totalPipePoolMissCount,
    statesSeen: [...bucket.statesSeen],
  };
}

function clampSessions(
  sessions: FlappyBirdPerfSessionSnapshot[],
): FlappyBirdPerfSessionSnapshot[] {
  return sessions
    .sort((a, b) => a.startedAtMs - b.startedAtMs)
    .slice(-FLAPPY_BIRD_PERF_MAX_RETAINED_SESSIONS);
}

function resolveFrameDelayCause(
  sample: FlappyBirdFramePerfSample,
): FlappyBirdFrameDelayCause {
  const tickerGapCost =
    typeof sample.tickerGapMs === "number"
      ? Math.max(0, sample.tickerGapMs - FLAPPY_BIRD_FRAME_BUDGET_MS)
      : 0;
  const renderCost =
    typeof sample.renderCostMs === "number" ? sample.renderCostMs : 0;
  const updateCost = sample.updateCostMs;
  const rankedCosts = [
    { cause: "ticker_gap" as const, value: tickerGapCost },
    { cause: "render" as const, value: renderCost },
    { cause: "update" as const, value: updateCost },
  ].sort((left, right) => right.value - left.value);

  const dominantCost = rankedCosts[0];
  const secondaryCost = rankedCosts[1];

  if (!dominantCost || dominantCost.value <= 0.5) {
    return "unknown";
  }

  if (dominantCost.value - (secondaryCost?.value ?? 0) <= 1) {
    return "mixed";
  }

  return dominantCost.cause;
}

function pushTopSpikeEvent(
  events: FlappyBirdPerfSpikeEvent[],
  event: FlappyBirdPerfSpikeEvent,
): FlappyBirdPerfSpikeEvent[] {
  return [...events, event]
    .sort((left, right) => {
      if (right.metricValueMs !== left.metricValueMs) {
        return right.metricValueMs - left.metricValueMs;
      }

      return left.timestamp.localeCompare(right.timestamp);
    })
    .slice(0, FLAPPY_BIRD_PERF_MAX_TOP_SPIKE_EVENTS);
}

function createPerfSpikeEvent(params: {
  metric: FlappyBirdPerfSpikeMetric;
  metricValueMs: number;
  delayCause: FlappyBirdFrameDelayCause;
  bucket: MutableSecondBucket;
  sample: FlappyBirdFramePerfSample;
}): FlappyBirdPerfSpikeEvent {
  return {
    secondOffset: params.bucket.secondOffset,
    timestamp: toIsoString(params.sample.timestampMs),
    deltaTimeMs: roundToTenth(params.sample.deltaTimeMs),
    updateCostMs: roundToTenth(params.sample.updateCostMs),
    ...(params.sample.tickerGapMs !== undefined
      ? {
          tickerGapMs:
            params.sample.tickerGapMs === null
              ? null
              : roundToTenth(params.sample.tickerGapMs),
        }
      : {}),
    ...(typeof params.sample.updateToRenderStartMs === "number"
      ? {
          updateToRenderStartMs: roundToTenth(
            params.sample.updateToRenderStartMs,
          ),
        }
      : {}),
    ...(typeof params.sample.renderCostMs === "number"
      ? {
          renderCostMs: roundToTenth(params.sample.renderCostMs),
        }
      : {}),
    ...(typeof params.sample.frameEndToEndCostMs === "number"
      ? {
          frameEndToEndCostMs: roundToTenth(params.sample.frameEndToEndCostMs),
        }
      : {}),
    delayCause: params.delayCause,
    gameState: params.sample.gameState,
    score: params.sample.score,
    activePipePairs: params.sample.activePipePairs,
    cloudCount: params.sample.cloudCount,
    groundTileCount: params.sample.groundTileCount,
    trackedPhysicsObjects: params.sample.trackedPhysicsObjects,
    syncedDisplayObjects: params.sample.syncedDisplayObjects,
    spawnedPipes: params.sample.spawnedPipes,
    removedPipes: params.sample.removedPipes,
    isAppSuspended: params.sample.isAppSuspended,
    documentHidden: params.sample.documentHidden,
    phaseCosts: Object.fromEntries(
      Object.entries(params.sample.phaseCosts).map(([key, value]) => [
        key,
        roundToTenth(value),
      ]),
    ) as FlappyBirdFramePhaseCosts,
    pipePhaseCosts: Object.fromEntries(
      Object.entries(params.sample.pipePhaseCosts).map(([key, value]) => [
        key,
        roundToTenth(value),
      ]),
    ) as PipeUpdatePhaseCosts,
    pipePoolStats: {
      ...params.sample.pipePoolStats,
    },
    metric: params.metric,
    metricValueMs: roundToTenth(params.metricValueMs),
    frameBudgetMs: FLAPPY_BIRD_FRAME_BUDGET_MS,
  };
}

export class FlappyBirdPerfDiagnostics {
  private readonly _enableAutoFlush: boolean;
  private _historyLoaded = false;
  private _historyLoadPromise: Promise<void> | null = null;
  private _history: FlappyBirdPerfHistory = {
    version: FLAPPY_BIRD_PERF_HISTORY_VERSION,
    sessions: [],
  };
  private _currentSession: MutableSession | null = null;
  private _lastCompletedSession: FlappyBirdPerfSessionSnapshot | null = null;
  private _pendingWrite: Promise<void> = Promise.resolve();
  private _autoFlushTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private _lastPersistedAtMs = 0;

  constructor(options: { enableAutoFlush?: boolean } = {}) {
    this._enableAutoFlush = options.enableAutoFlush ?? true;
  }

  public startSession(params: {
    screenWidth: number;
    screenHeight: number;
    startedAtMs?: number;
  }): void {
    if (this._currentSession) {
      return;
    }

    const startedAtMs = params.startedAtMs ?? Date.now();
    this._currentSession = {
      sessionId: createSessionId(),
      startedAtMs,
      lastUpdatedAtMs: startedAtMs,
      screen: {
        width: params.screenWidth,
        height: params.screenHeight,
      },
      scoreSummary: {
        lastScore: 0,
        maxScore: 0,
      },
      summary: {
        frameCount: 0,
        renderTimingSampleCount: 0,
        slowFrameCount: 0,
        tickerGapDominantSlowFrameCount: 0,
        renderDominantSlowFrameCount: 0,
        updateDominantSlowFrameCount: 0,
        mixedDominantSlowFrameCount: 0,
        unknownDominantSlowFrameCount: 0,
        physicsStepCount: 0,
        bgmTickCount: 0,
        bgmSpikeCount: 0,
        maxDeltaTimeMs: 0,
        maxUpdateCostMs: 0,
        maxTickerGapMs: 0,
        maxUpdateToRenderStartMs: 0,
        maxRenderCostMs: 0,
        maxFrameEndToEndCostMs: 0,
        maxMatterUpdateCostMs: 0,
        maxSyncDisplayCostMs: 0,
        maxBgmScheduleCostMs: 0,
        maxActivePipePairs: 0,
        pipePairsCreated: 0,
        pipePairsReused: 0,
        pipeBodiesCreated: 0,
        pipeBodiesReused: 0,
        pipePoolMissCount: 0,
      },
      secondBuckets: new Map<number, MutableSecondBucket>(),
      slowFrames: [],
      topTickerGapFrames: [],
      topRenderFrames: [],
      topFrameEndToEndFrames: [],
      bgmSpikes: [],
      completionReason: null,
      lastPersistTrigger: null,
      endedAtMs: null,
    };
    this._lastPersistedAtMs = Date.now();
    this._scheduleAutoFlush();
  }

  public recordFrame(sample: FlappyBirdFramePerfSample): void {
    const session = this._currentSession;
    if (!session) {
      return;
    }

    session.lastUpdatedAtMs = sample.timestampMs;
    session.scoreSummary.lastScore = sample.score;
    session.scoreSummary.maxScore = Math.max(
      session.scoreSummary.maxScore,
      sample.score,
    );
    session.summary.frameCount += 1;
    session.summary.maxDeltaTimeMs = Math.max(
      session.summary.maxDeltaTimeMs,
      sample.deltaTimeMs,
    );
    session.summary.maxUpdateCostMs = Math.max(
      session.summary.maxUpdateCostMs,
      sample.updateCostMs,
    );
    const bucket = this._getOrCreateBucket(sample.timestampMs);
    const hasRenderTimingSample =
      typeof sample.updateToRenderStartMs === "number" ||
      typeof sample.renderCostMs === "number" ||
      typeof sample.frameEndToEndCostMs === "number" ||
      typeof sample.tickerGapMs === "number";
    if (hasRenderTimingSample) {
      session.summary.renderTimingSampleCount += 1;
      bucket.renderTimingSampleCount += 1;
    }
    if (typeof sample.tickerGapMs === "number") {
      session.summary.maxTickerGapMs = Math.max(
        session.summary.maxTickerGapMs,
        sample.tickerGapMs,
      );
      bucket.tickerGapSampleCount += 1;
      bucket.totalTickerGapMs += sample.tickerGapMs;
      bucket.maxTickerGapMs = Math.max(
        bucket.maxTickerGapMs,
        sample.tickerGapMs,
      );
    }
    if (typeof sample.updateToRenderStartMs === "number") {
      session.summary.maxUpdateToRenderStartMs = Math.max(
        session.summary.maxUpdateToRenderStartMs,
        sample.updateToRenderStartMs,
      );
      bucket.totalUpdateToRenderStartMs += sample.updateToRenderStartMs;
      bucket.maxUpdateToRenderStartMs = Math.max(
        bucket.maxUpdateToRenderStartMs,
        sample.updateToRenderStartMs,
      );
    }
    if (typeof sample.renderCostMs === "number") {
      session.summary.maxRenderCostMs = Math.max(
        session.summary.maxRenderCostMs,
        sample.renderCostMs,
      );
      bucket.totalRenderCostMs += sample.renderCostMs;
      bucket.maxRenderCostMs = Math.max(
        bucket.maxRenderCostMs,
        sample.renderCostMs,
      );
    }
    if (typeof sample.frameEndToEndCostMs === "number") {
      session.summary.maxFrameEndToEndCostMs = Math.max(
        session.summary.maxFrameEndToEndCostMs,
        sample.frameEndToEndCostMs,
      );
      bucket.totalFrameEndToEndCostMs += sample.frameEndToEndCostMs;
      bucket.maxFrameEndToEndCostMs = Math.max(
        bucket.maxFrameEndToEndCostMs,
        sample.frameEndToEndCostMs,
      );
    }
    session.summary.maxActivePipePairs = Math.max(
      session.summary.maxActivePipePairs,
      sample.activePipePairs,
    );
    session.summary.pipePairsCreated += sample.pipePoolStats.pairCreated;
    session.summary.pipePairsReused += sample.pipePoolStats.pairReused;
    session.summary.pipeBodiesCreated += sample.pipePoolStats.bodyCreated;
    session.summary.pipeBodiesReused += sample.pipePoolStats.bodyReused;
    session.summary.pipePoolMissCount += sample.pipePoolStats.poolMissCount;
    bucket.frameCount += 1;
    bucket.totalDeltaTimeMs += sample.deltaTimeMs;
    bucket.maxDeltaTimeMs = Math.max(bucket.maxDeltaTimeMs, sample.deltaTimeMs);
    bucket.totalUpdateCostMs += sample.updateCostMs;
    bucket.maxUpdateCostMs = Math.max(
      bucket.maxUpdateCostMs,
      sample.updateCostMs,
    );
    bucket.totalActivePipePairs += sample.activePipePairs;
    bucket.maxActivePipePairs = Math.max(
      bucket.maxActivePipePairs,
      sample.activePipePairs,
    );
    bucket.totalCloudCount += sample.cloudCount;
    bucket.maxCloudCount = Math.max(bucket.maxCloudCount, sample.cloudCount);
    bucket.totalGroundTileCount += sample.groundTileCount;
    bucket.maxGroundTileCount = Math.max(
      bucket.maxGroundTileCount,
      sample.groundTileCount,
    );
    bucket.totalSpawnedPipes += sample.spawnedPipes;
    bucket.totalRemovedPipes += sample.removedPipes;
    bucket.totalPipePairsCreated += sample.pipePoolStats.pairCreated;
    bucket.totalPipePairsReused += sample.pipePoolStats.pairReused;
    bucket.totalPipeBodiesCreated += sample.pipePoolStats.bodyCreated;
    bucket.totalPipeBodiesReused += sample.pipePoolStats.bodyReused;
    bucket.totalPipePoolMissCount += sample.pipePoolStats.poolMissCount;
    bucket.statesSeen.add(sample.gameState);
    const delayCause = resolveFrameDelayCause(sample);
    if (typeof sample.tickerGapMs === "number") {
      session.topTickerGapFrames = pushTopSpikeEvent(
        session.topTickerGapFrames,
        createPerfSpikeEvent({
          metric: "tickerGapMs",
          metricValueMs: sample.tickerGapMs,
          delayCause,
          bucket,
          sample,
        }),
      );
    }
    if (typeof sample.renderCostMs === "number") {
      session.topRenderFrames = pushTopSpikeEvent(
        session.topRenderFrames,
        createPerfSpikeEvent({
          metric: "renderCostMs",
          metricValueMs: sample.renderCostMs,
          delayCause,
          bucket,
          sample,
        }),
      );
    }
    if (typeof sample.frameEndToEndCostMs === "number") {
      session.topFrameEndToEndFrames = pushTopSpikeEvent(
        session.topFrameEndToEndFrames,
        createPerfSpikeEvent({
          metric: "frameEndToEndCostMs",
          metricValueMs: sample.frameEndToEndCostMs,
          delayCause,
          bucket,
          sample,
        }),
      );
    }

    if (this._isSlowFrame(sample)) {
      bucket.slowFrameCount += 1;
      session.summary.slowFrameCount += 1;
      switch (delayCause) {
        case "ticker_gap":
          session.summary.tickerGapDominantSlowFrameCount += 1;
          break;
        case "render":
          session.summary.renderDominantSlowFrameCount += 1;
          break;
        case "update":
          session.summary.updateDominantSlowFrameCount += 1;
          break;
        case "mixed":
          session.summary.mixedDominantSlowFrameCount += 1;
          break;
        default:
          session.summary.unknownDominantSlowFrameCount += 1;
          break;
      }
      session.slowFrames.push({
        secondOffset: bucket.secondOffset,
        timestamp: toIsoString(sample.timestampMs),
        deltaTimeMs: roundToTenth(sample.deltaTimeMs),
        updateCostMs: roundToTenth(sample.updateCostMs),
        ...(sample.tickerGapMs !== undefined
          ? {
              tickerGapMs:
                sample.tickerGapMs === null
                  ? null
                  : roundToTenth(sample.tickerGapMs),
            }
          : {}),
        ...(typeof sample.updateToRenderStartMs === "number"
          ? {
              updateToRenderStartMs: roundToTenth(
                sample.updateToRenderStartMs,
              ),
            }
          : {}),
        ...(typeof sample.renderCostMs === "number"
          ? {
              renderCostMs: roundToTenth(sample.renderCostMs),
            }
          : {}),
        ...(typeof sample.frameEndToEndCostMs === "number"
          ? {
              frameEndToEndCostMs: roundToTenth(
                sample.frameEndToEndCostMs,
              ),
            }
          : {}),
        delayCause,
        gameState: sample.gameState,
        score: sample.score,
        activePipePairs: sample.activePipePairs,
        cloudCount: sample.cloudCount,
        groundTileCount: sample.groundTileCount,
        trackedPhysicsObjects: sample.trackedPhysicsObjects,
        syncedDisplayObjects: sample.syncedDisplayObjects,
        spawnedPipes: sample.spawnedPipes,
        removedPipes: sample.removedPipes,
        isAppSuspended: sample.isAppSuspended,
        documentHidden: sample.documentHidden,
        phaseCosts: Object.fromEntries(
          Object.entries(sample.phaseCosts).map(([key, value]) => [
            key,
            roundToTenth(value),
          ]),
        ) as FlappyBirdFramePhaseCosts,
        pipePhaseCosts: Object.fromEntries(
          Object.entries(sample.pipePhaseCosts).map(([key, value]) => [
            key,
            roundToTenth(value),
          ]),
        ) as PipeUpdatePhaseCosts,
        pipePoolStats: {
          ...sample.pipePoolStats,
        },
      });
      session.slowFrames = session.slowFrames.slice(
        -FLAPPY_BIRD_PERF_MAX_SLOW_FRAME_EVENTS,
      );
    }

    this._scheduleAutoFlush();
  }

  public recordPhysicsStep(sample: FlappyBirdPhysicsPerfSample): void {
    const session = this._currentSession;
    if (!session) {
      return;
    }

    session.lastUpdatedAtMs = sample.timestampMs;
    session.summary.physicsStepCount += 1;
    session.summary.maxMatterUpdateCostMs = Math.max(
      session.summary.maxMatterUpdateCostMs,
      sample.engineUpdateCostMs,
    );
    session.summary.maxSyncDisplayCostMs = Math.max(
      session.summary.maxSyncDisplayCostMs,
      sample.syncDisplayCostMs,
    );

    const bucket = this._getOrCreateBucket(sample.timestampMs);
    bucket.physicsStepCount += 1;
    bucket.totalPhysicsUpdateCostMs += sample.engineUpdateCostMs;
    bucket.maxPhysicsUpdateCostMs = Math.max(
      bucket.maxPhysicsUpdateCostMs,
      sample.engineUpdateCostMs,
    );
    bucket.totalSyncDisplayCostMs += sample.syncDisplayCostMs;
    bucket.maxSyncDisplayCostMs = Math.max(
      bucket.maxSyncDisplayCostMs,
      sample.syncDisplayCostMs,
    );
    this._scheduleAutoFlush();
  }

  public recordBgmScheduleTick(sample: FlappyBirdBgmSchedulePerfSample): void {
    const session = this._currentSession;
    if (!session) {
      return;
    }

    session.lastUpdatedAtMs = sample.timestampMs;
    session.summary.bgmTickCount += 1;
    session.summary.maxBgmScheduleCostMs = Math.max(
      session.summary.maxBgmScheduleCostMs,
      sample.durationMs,
    );

    const bucket = this._getOrCreateBucket(sample.timestampMs);
    bucket.bgmTickCount += 1;
    bucket.totalBgmScheduleCostMs += sample.durationMs;
    bucket.maxBgmScheduleCostMs = Math.max(
      bucket.maxBgmScheduleCostMs,
      sample.durationMs,
    );
    bucket.maxBgmScheduledVoices = Math.max(
      bucket.maxBgmScheduledVoices,
      sample.scheduledVoices,
    );

    if (sample.durationMs >= FLAPPY_BIRD_BGM_SCHEDULER_SPIKE_THRESHOLD_MS) {
      session.summary.bgmSpikeCount += 1;
      session.bgmSpikes.push({
        secondOffset: bucket.secondOffset,
        timestamp: toIsoString(sample.timestampMs),
        durationMs: roundToTenth(sample.durationMs),
        scheduledSteps: sample.scheduledSteps,
        scheduledVoices: sample.scheduledVoices,
      });
      session.bgmSpikes = session.bgmSpikes.slice(
        -FLAPPY_BIRD_PERF_MAX_BGM_SPIKE_EVENTS,
      );
    }

    this._scheduleAutoFlush();
  }

  public flushPartial(trigger: Extract<
    FlappyBirdPerfPersistTrigger,
    "periodic" | "app_hidden"
  >): Promise<void> {
    return this._persistCurrentSession(trigger, false);
  }

  public finalizeSession(
    trigger: Exclude<
      FlappyBirdPerfPersistTrigger,
      "periodic" | "app_hidden"
    >,
  ): Promise<void> {
    return this._persistCurrentSession(trigger, true);
  }

  public async shutdown(): Promise<void> {
    this._clearAutoFlushTimer();
    if (!this._currentSession) {
      return;
    }

    await this.finalizeSession("scene_destroy");
  }

  public getSnapshot(): FlappyBirdPerfSnapshot {
    return {
      storageKey: FLAPPY_BIRD_PERF_DIAGNOSTICS_STORAGE_KEY,
      maxRetainedSessions: FLAPPY_BIRD_PERF_MAX_RETAINED_SESSIONS,
      activeSession: this._currentSession
        ? this._createSessionSnapshot(this._currentSession)
        : null,
      lastCompletedSession: this._lastCompletedSession,
    };
  }

  private _isSlowFrame(sample: FlappyBirdFramePerfSample): boolean {
    return (
      sample.deltaTimeMs >= FLAPPY_BIRD_SLOW_FRAME_DELTA_THRESHOLD_MS ||
      sample.updateCostMs >= FLAPPY_BIRD_SLOW_FRAME_UPDATE_COST_THRESHOLD_MS
    );
  }

  private _getOrCreateBucket(timestampMs: number): MutableSecondBucket {
    const session = this._currentSession;
    if (!session) {
      throw new Error("FlappyBirdPerfDiagnostics session is not active");
    }

    const secondOffset = Math.max(
      0,
      Math.floor((timestampMs - session.startedAtMs) / 1000),
    );
    const existingBucket = session.secondBuckets.get(secondOffset);
    if (existingBucket) {
      return existingBucket;
    }

    const nextBucket = createSecondBucket(secondOffset);
    session.secondBuckets.set(secondOffset, nextBucket);

    while (session.secondBuckets.size > FLAPPY_BIRD_PERF_MAX_SECOND_BUCKETS) {
      const oldestKey = session.secondBuckets.keys().next().value;
      if (typeof oldestKey !== "number") {
        break;
      }
      session.secondBuckets.delete(oldestKey);
    }

    return nextBucket;
  }

  private _createSessionSnapshot(
    session: MutableSession,
  ): FlappyBirdPerfSessionSnapshot {
    const secondBuckets = [...session.secondBuckets.values()]
      .sort((a, b) => a.secondOffset - b.secondOffset)
      .map(toSnapshotBucket);

    return {
      version: FLAPPY_BIRD_PERF_HISTORY_VERSION,
      sessionId: session.sessionId,
      startedAt: toIsoString(session.startedAtMs),
      startedAtMs: session.startedAtMs,
      lastUpdatedAt: toIsoString(session.lastUpdatedAtMs),
      lastUpdatedAtMs: session.lastUpdatedAtMs,
      endedAt:
        session.endedAtMs === null ? null : toIsoString(session.endedAtMs),
      endedAtMs: session.endedAtMs,
      isCompleted: session.endedAtMs !== null,
      completionReason: session.completionReason,
      lastPersistTrigger: session.lastPersistTrigger,
      screen: { ...session.screen },
      scoreSummary: { ...session.scoreSummary },
      summary: {
        frameCount: session.summary.frameCount,
        renderTimingSampleCount: session.summary.renderTimingSampleCount,
        slowFrameCount: session.summary.slowFrameCount,
        tickerGapDominantSlowFrameCount:
          session.summary.tickerGapDominantSlowFrameCount,
        renderDominantSlowFrameCount:
          session.summary.renderDominantSlowFrameCount,
        updateDominantSlowFrameCount:
          session.summary.updateDominantSlowFrameCount,
        mixedDominantSlowFrameCount:
          session.summary.mixedDominantSlowFrameCount,
        unknownDominantSlowFrameCount:
          session.summary.unknownDominantSlowFrameCount,
        physicsStepCount: session.summary.physicsStepCount,
        bgmTickCount: session.summary.bgmTickCount,
        bgmSpikeCount: session.summary.bgmSpikeCount,
        maxDeltaTimeMs: roundToTenth(session.summary.maxDeltaTimeMs),
        maxUpdateCostMs: roundToTenth(session.summary.maxUpdateCostMs),
        maxTickerGapMs: roundToTenth(session.summary.maxTickerGapMs),
        maxUpdateToRenderStartMs: roundToTenth(
          session.summary.maxUpdateToRenderStartMs,
        ),
        maxRenderCostMs: roundToTenth(session.summary.maxRenderCostMs),
        maxFrameEndToEndCostMs: roundToTenth(
          session.summary.maxFrameEndToEndCostMs,
        ),
        maxMatterUpdateCostMs: roundToTenth(
          session.summary.maxMatterUpdateCostMs,
        ),
        maxSyncDisplayCostMs: roundToTenth(
          session.summary.maxSyncDisplayCostMs,
        ),
        maxBgmScheduleCostMs: roundToTenth(
          session.summary.maxBgmScheduleCostMs,
        ),
        maxActivePipePairs: session.summary.maxActivePipePairs,
        pipePairsCreated: session.summary.pipePairsCreated,
        pipePairsReused: session.summary.pipePairsReused,
        pipeBodiesCreated: session.summary.pipeBodiesCreated,
        pipeBodiesReused: session.summary.pipeBodiesReused,
        pipePoolMissCount: session.summary.pipePoolMissCount,
      },
      secondBuckets,
      slowFrames: [...session.slowFrames],
      topTickerGapFrames: [...session.topTickerGapFrames],
      topRenderFrames: [...session.topRenderFrames],
      topFrameEndToEndFrames: [...session.topFrameEndToEndFrames],
      bgmSpikes: [...session.bgmSpikes],
    };
  }

  private _scheduleAutoFlush(): void {
    if (
      !this._enableAutoFlush ||
      !this._currentSession ||
      this._autoFlushTimeoutId !== null
    ) {
      return;
    }

    const elapsedSinceLastPersist = Date.now() - this._lastPersistedAtMs;
    if (elapsedSinceLastPersist < FLAPPY_BIRD_PERF_AUTO_FLUSH_INTERVAL_MS) {
      return;
    }

    this._autoFlushTimeoutId = setTimeout(() => {
      this._autoFlushTimeoutId = null;
      void this.flushPartial("periodic");
    }, 0);
  }

  private _clearAutoFlushTimer(): void {
    if (this._autoFlushTimeoutId === null) {
      return;
    }

    clearTimeout(this._autoFlushTimeoutId);
    this._autoFlushTimeoutId = null;
  }

  private async _persistCurrentSession(
    trigger: FlappyBirdPerfPersistTrigger,
    finalize: boolean,
  ): Promise<void> {
    const session = this._currentSession;
    if (!session) {
      return;
    }

    this._clearAutoFlushTimer();
    session.lastPersistTrigger = trigger;

    if (finalize) {
      const endedAtMs = Date.now();
      session.lastUpdatedAtMs = Math.max(session.lastUpdatedAtMs, endedAtMs);
      session.endedAtMs = endedAtMs;
      session.completionReason = trigger;
    }

    const snapshot = this._createSessionSnapshot(session);
    await this._enqueueWrite(async () => {
      await this._ensureHistoryLoaded();

      const sessions = this._history.sessions.filter(
        (candidate) => candidate.sessionId !== snapshot.sessionId,
      );
      sessions.push(snapshot);
      this._history = {
        version: FLAPPY_BIRD_PERF_HISTORY_VERSION,
        sessions: clampSessions(sessions),
      };
      await StorageManager.setData(
        FLAPPY_BIRD_PERF_DIAGNOSTICS_STORAGE_KEY,
        this._history,
      );
      this._lastPersistedAtMs = Date.now();
    });

    if (finalize) {
      this._lastCompletedSession = snapshot;
      this._currentSession = null;
    }
  }

  private _enqueueWrite(operation: () => Promise<void>): Promise<void> {
    const nextWrite = this._pendingWrite
      .catch(() => undefined)
      .then(operation);
    this._pendingWrite = nextWrite.catch(() => undefined);
    return nextWrite;
  }

  private async _ensureHistoryLoaded(): Promise<void> {
    if (this._historyLoaded) {
      return;
    }

    if (this._historyLoadPromise) {
      await this._historyLoadPromise;
      return;
    }

    this._historyLoadPromise = (async () => {
      try {
        const storedHistory = await StorageManager.getData(
          FLAPPY_BIRD_PERF_DIAGNOSTICS_STORAGE_KEY,
        );
        this._history = normalizeHistory(storedHistory);
      } catch {
        this._history = {
          version: FLAPPY_BIRD_PERF_HISTORY_VERSION,
          sessions: [],
        };
      } finally {
        this._historyLoaded = true;
        this._historyLoadPromise = null;
      }
    })();

    await this._historyLoadPromise;
  }
}
