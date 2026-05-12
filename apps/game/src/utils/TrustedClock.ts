export type TrustedTimeSource = "ntp" | "cached-uptime" | "web-dev-fallback";

export type TrustedTimeSnapshot = {
  trustedUtcMs: number;
  osUptimeMs: number;
  source: TrustedTimeSource;
  uncertaintyMs: number;
  capturedWallMs: number;
};

export type TrustedElapsedResult = {
  elapsedMs: number;
  trusted: boolean;
  reason:
    | "uptime_delta"
    | "ntp_after_reboot"
    | "web_dev_fallback"
    | "missing_anchor"
    | "clock_unavailable"
    | "reboot_detected";
  currentSnapshot: TrustedTimeSnapshot | null;
};

type NativeTrustedTimeController = {
  getSnapshot: (options?: { forceRefresh?: boolean }) => Promise<TrustedTimeSnapshot | null>;
};

const MAX_REASONABLE_ELAPSED_MS = 14 * 24 * 60 * 60 * 1000;

function getPerfNow(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isTrustedTimeSnapshot(
  value: unknown,
): value is TrustedTimeSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const snapshot = value as Partial<TrustedTimeSnapshot>;
  return (
    isFiniteNumber(snapshot.trustedUtcMs) &&
    isFiniteNumber(snapshot.osUptimeMs) &&
    (snapshot.source === "ntp" ||
      snapshot.source === "cached-uptime" ||
      snapshot.source === "web-dev-fallback") &&
    isFiniteNumber(snapshot.uncertaintyMs) &&
    isFiniteNumber(snapshot.capturedWallMs)
  );
}

export function hasNativeTrustedTimeController(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.trustedTimeController?.getSnapshot === "function"
  );
}

function getNativeTrustedTimeController(): NativeTrustedTimeController | null {
  return hasNativeTrustedTimeController()
    ? (window.trustedTimeController as NativeTrustedTimeController)
    : null;
}

function createWebDevFallbackSnapshot(): TrustedTimeSnapshot {
  const now = Date.now();
  return {
    trustedUtcMs: now,
    osUptimeMs: getPerfNow(),
    source: "web-dev-fallback",
    uncertaintyMs: Number.POSITIVE_INFINITY,
    capturedWallMs: now,
  };
}

export class TrustedClock {
  private _snapshot: TrustedTimeSnapshot | null = null;
  private _perfAtSnapshotMs = 0;
  private _refreshPromise: Promise<TrustedTimeSnapshot | null> | null = null;

  constructor(initialSnapshot?: TrustedTimeSnapshot | null) {
    if (initialSnapshot) {
      this._setSnapshot(initialSnapshot);
    }
  }

  async initialize(): Promise<void> {
    await this.refresh({ forceRefresh: false });
  }

  async refresh(options: { forceRefresh?: boolean } = {}): Promise<TrustedTimeSnapshot | null> {
    if (this._refreshPromise) {
      return this._refreshPromise;
    }

    this._refreshPromise = this._refresh(options).finally(() => {
      this._refreshPromise = null;
    });

    return this._refreshPromise;
  }

  now(): number {
    if (!this._snapshot) {
      return Date.now();
    }

    const elapsedSinceSnapshot = Math.max(0, getPerfNow() - this._perfAtSnapshotMs);
    return this._snapshot.trustedUtcMs + elapsedSinceSnapshot;
  }

  captureAnchor(): TrustedTimeSnapshot {
    const elapsedSinceSnapshot = this._snapshot
      ? Math.max(0, getPerfNow() - this._perfAtSnapshotMs)
      : 0;

    if (this._snapshot) {
      return {
        ...this._snapshot,
        trustedUtcMs: this._snapshot.trustedUtcMs + elapsedSinceSnapshot,
        osUptimeMs: this._snapshot.osUptimeMs + elapsedSinceSnapshot,
        capturedWallMs: Date.now(),
      };
    }

    const fallback = createWebDevFallbackSnapshot();
    this._setSnapshot(fallback);
    return fallback;
  }

  elapsedSince(anchor: TrustedTimeSnapshot | null | undefined): TrustedElapsedResult {
    if (!anchor || !isTrustedTimeSnapshot(anchor)) {
      return {
        elapsedMs: 0,
        trusted: false,
        reason: "missing_anchor",
        currentSnapshot: this._snapshot,
      };
    }

    const current = this.captureAnchor();

    if (current.source === "web-dev-fallback" && anchor.source === "web-dev-fallback") {
      return {
        elapsedMs: Math.max(0, current.trustedUtcMs - anchor.trustedUtcMs),
        trusted: false,
        reason: "web_dev_fallback",
        currentSnapshot: current,
      };
    }

    if (!isFiniteNumber(current.osUptimeMs) || !isFiniteNumber(anchor.osUptimeMs)) {
      return {
        elapsedMs: 0,
        trusted: false,
        reason: "clock_unavailable",
        currentSnapshot: current,
      };
    }

    const elapsedMs = current.osUptimeMs - anchor.osUptimeMs;

    if (elapsedMs < 0) {
      const ntpElapsedMs = current.trustedUtcMs - anchor.trustedUtcMs;
      if (current.source === "ntp" && ntpElapsedMs >= 0) {
        return {
          elapsedMs: Math.min(ntpElapsedMs, MAX_REASONABLE_ELAPSED_MS),
          trusted: true,
          reason: "ntp_after_reboot",
          currentSnapshot: current,
        };
      }

      return {
        elapsedMs: 0,
        trusted: false,
        reason: "reboot_detected",
        currentSnapshot: current,
      };
    }

    return {
      elapsedMs: Math.min(elapsedMs, MAX_REASONABLE_ELAPSED_MS),
      trusted: true,
      reason: "uptime_delta",
      currentSnapshot: current,
    };
  }

  get lastSnapshot(): TrustedTimeSnapshot | null {
    return this._snapshot;
  }

  private async _refresh(options: { forceRefresh?: boolean }): Promise<TrustedTimeSnapshot | null> {
    const controller = getNativeTrustedTimeController();

    if (!controller) {
      const fallback = createWebDevFallbackSnapshot();
      this._setSnapshot(fallback);
      return fallback;
    }

    try {
      const snapshot = await controller.getSnapshot({
        forceRefresh: options.forceRefresh ?? false,
      });

      if (isTrustedTimeSnapshot(snapshot)) {
        this._setSnapshot(snapshot);
        return snapshot;
      }

      console.warn("[TrustedClock] Native trusted time returned an invalid snapshot", snapshot);
    } catch (error) {
      console.warn("[TrustedClock] Failed to refresh native trusted time", error);
    }

    if (this._snapshot) {
      return this.captureAnchor();
    }

    return null;
  }

  private _setSnapshot(snapshot: TrustedTimeSnapshot): void {
    this._snapshot = snapshot;
    this._perfAtSnapshotMs = getPerfNow();
  }
}

export const trustedClock = new TrustedClock();
