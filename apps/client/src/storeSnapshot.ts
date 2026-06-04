import { SceneKey, TimeOfDay } from "@digivice/game";

export type StoreSnapshotOverlay = "monster-info" | null;
export type StoreSnapshotTimeOfDay = "day" | "night" | null;

export type StoreSnapshotConfig = {
  enabled: boolean;
  shot: string | null;
  scene: SceneKey;
  overlay: StoreSnapshotOverlay;
  timeOfDay: StoreSnapshotTimeOfDay;
};

export type StoreSnapshotBridgeState = {
  enabled: boolean;
  shot: string | null;
  targetScene: SceneKey | null;
  currentScene: SceneKey | null;
  overlay: StoreSnapshotOverlay;
  timeOfDay: StoreSnapshotTimeOfDay;
  isLoading: boolean;
  isBootstrapping: boolean;
  showSetupLayer: boolean;
  gameContainerSize: number | null;
  loadingFailureMessage: string | null;
  unsupportedViewportReason: string | null;
  ready: boolean;
  reason: string;
  monsterInfoOpen: boolean;
};

declare global {
  interface Window {
    __DIGIVICE_STORE_SNAPSHOT__?: {
      state: StoreSnapshotBridgeState;
    };
  }
}

function getStoreSnapshotSearchParams(): URLSearchParams | null {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search);
}

function parseStoreSnapshotScene(value: string | null): SceneKey | null {
  if (value === SceneKey.MAIN) {
    return SceneKey.MAIN;
  }

  if (value === SceneKey.FLAPPY_BIRD_GAME) {
    return SceneKey.FLAPPY_BIRD_GAME;
  }

  if (value === SceneKey.MONSTER_BOOK) {
    return SceneKey.MONSTER_BOOK;
  }

  return null;
}

function parseStoreSnapshotOverlay(
  value: string | null,
): StoreSnapshotOverlay {
  return value === "monster-info" ? value : null;
}

function parseStoreSnapshotTimeOfDay(
  value: string | null,
): StoreSnapshotTimeOfDay {
  if (value === "day" || value === "night") {
    return value;
  }

  return null;
}

export function getStoreSnapshotConfig(): StoreSnapshotConfig {
  const searchParams = getStoreSnapshotSearchParams();

  if (!searchParams) {
    return {
      enabled: false,
      shot: null,
      scene: SceneKey.MAIN,
      overlay: null,
      timeOfDay: null,
    };
  }

  const shot = searchParams.get("storeSnapshotShot");
  const scene =
    parseStoreSnapshotScene(searchParams.get("storeSnapshotScene")) ??
    SceneKey.MAIN;
  const overlay = parseStoreSnapshotOverlay(
    searchParams.get("storeSnapshotOverlay"),
  );
  const timeOfDay = parseStoreSnapshotTimeOfDay(
    searchParams.get("storeSnapshotTimeOfDay"),
  );
  const enabled =
    searchParams.get("storeSnapshot") === "1" ||
    shot !== null ||
    overlay !== null ||
    timeOfDay !== null ||
    scene !== SceneKey.MAIN;

  return {
    enabled,
    shot,
    scene,
    overlay,
    timeOfDay,
  };
}

export function resolveStoreSnapshotTimeOfDay(
  timeOfDay: StoreSnapshotTimeOfDay,
): TimeOfDay | null {
  if (timeOfDay === "day") {
    return TimeOfDay.Day;
  }

  if (timeOfDay === "night") {
    return TimeOfDay.Night;
  }

  return null;
}

export function setStoreSnapshotBridgeState(
  state: StoreSnapshotBridgeState,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.__DIGIVICE_STORE_SNAPSHOT__ = {
    state,
  };
}

export function clearStoreSnapshotBridgeState(): void {
  if (typeof window === "undefined") {
    return;
  }

  delete window.__DIGIVICE_STORE_SNAPSHOT__;
}
