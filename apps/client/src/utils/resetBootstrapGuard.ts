import type { Storage } from "@shared/storage";
import type { StoredWorldData } from "./sanitizeStoredWorldData";

export const RESET_BOOTSTRAP_MARKER_STORAGE_KEY =
  "DigiviceResetBootstrapMarkerV1";
export const RESET_BOOTSTRAP_MARKER_FIELD_KEY = "reset_bootstrap_marker_id";

export type ResetBootstrapReason = "user_reset" | "sanitize_reset";

export type ResetBootstrapMarker = {
  version: 1;
  resetId: string;
  reason: ResetBootstrapReason;
  createdAt: number;
};

function createResetId(now: number): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `reset:${now}:${crypto.randomUUID()}`;
  }

  return `reset:${now}:${Math.random().toString(36).slice(2, 10)}`;
}

function isResetBootstrapMarker(value: unknown): value is ResetBootstrapMarker {
  if (!value || typeof value !== "object") {
    return false;
  }

  const marker = value as Partial<ResetBootstrapMarker>;
  return (
    marker.version === 1 &&
    typeof marker.resetId === "string" &&
    marker.resetId.length > 0 &&
    (marker.reason === "user_reset" || marker.reason === "sanitize_reset") &&
    typeof marker.createdAt === "number" &&
    Number.isFinite(marker.createdAt)
  );
}

export function createResetBootstrapMarker(
  reason: ResetBootstrapReason,
  now = Date.now(),
): ResetBootstrapMarker {
  return {
    version: 1,
    resetId: createResetId(now),
    reason,
    createdAt: now,
  };
}

export async function readResetBootstrapMarker(
  storage: Pick<Storage, "getData">,
): Promise<ResetBootstrapMarker | null> {
  const rawMarker = await storage.getData(RESET_BOOTSTRAP_MARKER_STORAGE_KEY);
  return isResetBootstrapMarker(rawMarker) ? rawMarker : null;
}

export async function writeResetBootstrapMarker(
  storage: Pick<Storage, "setData">,
  reason: ResetBootstrapReason,
  now = Date.now(),
): Promise<ResetBootstrapMarker> {
  const marker = createResetBootstrapMarker(reason, now);
  await storage.setData(RESET_BOOTSTRAP_MARKER_STORAGE_KEY, marker);
  return marker;
}

export async function clearResetBootstrapMarker(
  storage: Pick<Storage, "removeData">,
): Promise<void> {
  await storage.removeData(RESET_BOOTSTRAP_MARKER_STORAGE_KEY);
}

export function readWorldResetBootstrapMarkerId(
  worldData: StoredWorldData | null | undefined,
): string | null {
  const markerId =
    worldData?.world_metadata?.app_state?.[RESET_BOOTSTRAP_MARKER_FIELD_KEY];
  return typeof markerId === "string" && markerId.trim() ? markerId : null;
}

export function shouldForceFreshWorldAfterReset(
  marker: ResetBootstrapMarker | null,
  worldData: StoredWorldData | null | undefined,
): boolean {
  if (!marker) {
    return false;
  }

  return readWorldResetBootstrapMarkerId(worldData) !== marker.resetId;
}
