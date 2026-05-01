import {
  type ControlButtonParams,
  ControlButtonType,
  Game,
  type GameDiagnosticsSnapshot,
  getNativeSunTimes,
  MissingInitialGameDataError,
  SceneKey,
} from "@digivice/game";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ControlButtons from "./components/ControlButtons";
import PopupLayer from "./components/PopupLayer";
import { type SetupFormData, SetupLayer } from "./layers/SetupLayer";
import AlertLayer from "./layers/AlertLayer";
import SettingMenuLayer from "./layers/SettingMenuLayer";
import useAlert from "./hooks/useAlert";
import { getGameSettings, updateGameSettings } from "./settings/gameSettings";
import { sanitizeStoredWorldData } from "./utils/sanitizeStoredWorldData";
import { VibrationAdapter } from "./adapter/VibrationAdapter";
import {
  getDiagnosticsLoggerInfo,
  getDiagnosticsLogs,
  getImportantDiagnosticsLogs,
  logImportantDiagnostics,
  setDiagnosticsContextProvider,
} from "./diagnostics/diagnosticLogger";
import {
  createClientStorage,
  getClientStorageKind,
} from "./utils/clientStorage";
import type { SanitizeStoredWorldDataResult } from "./utils/sanitizeStoredWorldData";

const WORLD_DATA_STORAGE_KEY = "MainSceneWorldData";
const biteVibrationAdapter = new VibrationAdapter();
const RECOVERY_VIBRATION_INTERVAL_MS = 180;
const RECOVERY_VIBRATION_DURATION_MS = 14;
const RECOVERY_VIBRATION_STRENGTH = 28;
const isNativeFeatureDebugMode =
  import.meta.env.NATIVE_FEATURE_DEBUG_MODE === "true";
const isAndroidUserAgent =
  typeof navigator !== "undefined" &&
  /DigiviceApp-Android|Android/i.test(navigator.userAgent);
const MINI_GAME_UNAVAILABLE_VERSION = "0.1.0";
const KEYBOARD_VIEWPORT_HEIGHT_DELTA_THRESHOLD = 80;
const UNSUPPORTED_SQUARE_VIEWPORT_RATIO = 0.8;

type UnsupportedViewportReason = "landscape" | "square" | null;

type UnsupportedViewportCheckOptions = {
  nativeKeyboardInset?: number;
};
function isMissingInitialGameDataError(
  error: unknown,
): error is MissingInitialGameDataError {
  return (
    error instanceof MissingInitialGameDataError ||
    (error instanceof Error &&
      error.name === MissingInitialGameDataError.name)
  );
}


type NativeViewportSyncDetail = {
  bottomInset?: number | null;
};

type GameDataSummary = {
  monsterName?: string;
  entityCount: number | "n/a";
  worldVersion?: string;
  useLocalTime?: boolean;
};

type DiagnosticsPayload = {
  generatedAt: string;
  appInfo: {
    project: "MonTTo";
    clientAppVersion: string;
    clientBuildNumber: number;
    appMode: string;
    debugEnabled: boolean;
    storageKind: "native" | "web";
    userAgent: string;
    language: string;
    timezone: string;
    currentSceneKey: string;
    logger: ReturnType<typeof getDiagnosticsLoggerInfo>;
    gameSettings: ReturnType<typeof getGameSettings>;
  };
  summary: GameDataSummary;
  logs: ReturnType<typeof getDiagnosticsLogs>;
  importantLogs: ReturnType<typeof getImportantDiagnosticsLogs>;
  currentGameData: GameDiagnosticsSnapshot["mainSceneData"];
  storedGameData: unknown | null;
  latestGameData: unknown | null;
  latestGameDataSource: "current_game" | "stored_game" | "none";
  lastValidation: SanitizeStoredWorldDataResult["diagnostics"] | null;
  lastValidationAction: SanitizeStoredWorldDataResult["action"] | null;
  lastValidationResetReason: string | null;
};

type DiagnosticsAttachment = {
  fileName: string;
  text: string;
  mimeType: string;
};

type PendingDiagnosticsDraft = {
  subject: string;
  body: string;
  attachments: DiagnosticsAttachment[];
};

type LoadingFailureAlertState = {
  title: string;
  message: string;
};

type SceneTransitionLoadState = {
  requestId: number;
  phase: "idle" | "loading" | "core_ready";
  from?: SceneKey;
  to?: SceneKey;
};

type FullscreenAdEventDetail = {
  state?: "showing" | "dismissed" | "failed";
};

const BACK_NAVIGATION_ALERT_ENTRY = "layer:alert";
const BACK_NAVIGATION_LOADING_FAILURE_ENTRY = "layer:loading-failure";
const BACK_NAVIGATION_DIAGNOSTICS_ENTRY = "layer:diagnostics-draft";
const BACK_NAVIGATION_SETTING_MENU_ENTRY = "layer:setting-menu";
const BACK_NAVIGATION_SETTING_RESET_CONFIRM_ENTRY =
  "layer:setting-reset-confirm";
const BACK_NAVIGATION_SCENE_ENTRY_PREFIX = "scene:";
const ROOT_SCENE_HISTORY_STACK = [SceneKey.MAIN] as const;

type BackNavigationEntry =
  | typeof BACK_NAVIGATION_ALERT_ENTRY
  | typeof BACK_NAVIGATION_LOADING_FAILURE_ENTRY
  | typeof BACK_NAVIGATION_DIAGNOSTICS_ENTRY
  | typeof BACK_NAVIGATION_SETTING_MENU_ENTRY
  | typeof BACK_NAVIGATION_SETTING_RESET_CONFIRM_ENTRY
  | `${typeof BACK_NAVIGATION_SCENE_ENTRY_PREFIX}${SceneKey}`;

type BackNavigationHistoryState = {
  __digiviceBackEntries?: BackNavigationEntry[];
};

function createSceneBackNavigationEntry(
  sceneKey: SceneKey,
): BackNavigationEntry {
  return `${BACK_NAVIGATION_SCENE_ENTRY_PREFIX}${sceneKey}`;
}

function parseSceneBackNavigationEntry(
  entry: BackNavigationEntry,
): SceneKey | null {
  if (!entry.startsWith(BACK_NAVIGATION_SCENE_ENTRY_PREFIX)) {
    return null;
  }

  return entry.slice(BACK_NAVIGATION_SCENE_ENTRY_PREFIX.length) as SceneKey;
}

function getTargetSceneKeyFromBackNavigationEntries(
  entries: BackNavigationEntry[],
): SceneKey {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const sceneKey = parseSceneBackNavigationEntry(entries[index]);

    if (sceneKey) {
      return sceneKey;
    }
  }

  return SceneKey.MAIN;
}

function readBackNavigationEntriesFromHistoryState(
  state: unknown,
): BackNavigationEntry[] {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return [];
  }

  const entries = (state as BackNavigationHistoryState).__digiviceBackEntries;

  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.filter(
    (entry): entry is BackNavigationEntry => typeof entry === "string",
  );
}

function createBackNavigationHistoryState(
  state: unknown,
  entries: BackNavigationEntry[],
): Record<string, unknown> {
  const nextState =
    state && typeof state === "object" && !Array.isArray(state)
      ? { ...(state as Record<string, unknown>) }
      : {};

  nextState.__digiviceBackEntries = [...entries];

  return nextState;
}

function areBackNavigationEntriesEqual(
  left: BackNavigationEntry[],
  right: BackNavigationEntry[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function getSharedBackNavigationPrefixLength(
  left: BackNavigationEntry[],
  right: BackNavigationEntry[],
): number {
  const maxLength = Math.min(left.length, right.length);
  let prefixLength = 0;

  while (
    prefixLength < maxLength &&
    left[prefixLength] === right[prefixLength]
  ) {
    prefixLength += 1;
  }

  return prefixLength;
}

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

async function waitForLayoutStabilization(): Promise<void> {
  await waitForAnimationFrame();
  await waitForAnimationFrame();
  await new Promise((resolve) => window.setTimeout(resolve, 250));
  await waitForAnimationFrame();
}

function getCurrentViewportHeight(): number {
  if (typeof window === "undefined") {
    return 0;
  }

  return Math.max(
    0,
    Math.round(window.visualViewport?.height ?? window.innerHeight),
  );
}

function setFrozenAppShellHeight(height: number | null): void {
  if (typeof document === "undefined") {
    return;
  }

  if (height && height > 0) {
    document.documentElement.style.setProperty(
      "--digivice-app-shell-height",
      `${height}px`,
    );
    return;
  }

  document.documentElement.style.removeProperty("--digivice-app-shell-height");
}

function getBaseAppVersion(version: string): string {
  return version.replace(/-.+$/, "");
}

function isMiniGameUnavailableForCurrentVersion(): boolean {
  return getBaseAppVersion(__APP_VERSION__) === MINI_GAME_UNAVAILABLE_VERSION;
}

function isTextInputElement(element: Element | null): element is HTMLElement {
  return (
    element instanceof HTMLElement &&
    (element.tagName === "INPUT" ||
      element.tagName === "TEXTAREA" ||
      element.isContentEditable)
  );
}

function isKeyboardOpenForUnsupportedViewportCheck(
  options: UnsupportedViewportCheckOptions = {},
): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const { nativeKeyboardInset = 0 } = options;
  const activeElement = document.activeElement;

  if (!isTextInputElement(activeElement)) {
    return false;
  }

  if (nativeKeyboardInset > 0) {
    return true;
  }

  const visualViewport = window.visualViewport;

  if (!visualViewport) {
    return false;
  }

  const baseViewportHeight = Math.max(
    window.innerHeight,
    document.documentElement.clientHeight || 0,
  );
  const viewportHeightDelta = baseViewportHeight - visualViewport.height;

  return viewportHeightDelta >= KEYBOARD_VIEWPORT_HEIGHT_DELTA_THRESHOLD;
}

function getUnsupportedViewportReason(
  options: UnsupportedViewportCheckOptions = {},
): UnsupportedViewportReason {
  if (typeof window === "undefined") {
    return null;
  }

  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return null;
  }

  if (isKeyboardOpenForUnsupportedViewportCheck(options)) {
    return null;
  }

  if (viewportWidth > viewportHeight) {
    return "landscape";
  }

  if (viewportWidth / viewportHeight >= UNSUPPORTED_SQUARE_VIEWPORT_RATIO) {
    return "square";
  }

  return null;
}

function summarizeSavedData(savedData: unknown): Record<string, unknown> {
  if (!savedData || typeof savedData !== "object") {
    return {
      valueType: typeof savedData,
      isNull: savedData === null,
    };
  }

  const savedDataRecord = savedData as {
    world_metadata?: { monster_name?: string };
    entities?: unknown[];
  };

  return {
    valueType: typeof savedData,
    monsterName: savedDataRecord.world_metadata?.monster_name,
    entityCount: Array.isArray(savedDataRecord.entities)
      ? savedDataRecord.entities.length
      : "n/a",
  };
}

function summarizeGameData(data: unknown): GameDataSummary {
  if (!data || typeof data !== "object") {
    return {
      entityCount: "n/a",
    };
  }

  const record = data as {
    world_metadata?: {
      monster_name?: string;
      version?: string;
      app_state?: {
        use_local_time?: boolean;
      };
    };
    entities?: unknown[];
  };

  return {
    monsterName: record.world_metadata?.monster_name,
    entityCount: Array.isArray(record.entities)
      ? record.entities.length
      : "n/a",
    worldVersion: record.world_metadata?.version,
    useLocalTime: record.world_metadata?.app_state?.use_local_time,
  };
}

function createDiagnosticsSubject(timestamp: string): string {
  return `[MonTTo][${getClientReleaseLabel()}] Diagnostics Report ${timestamp}`;
}

function createDiagnosticsBody(): string {
  return [
    `App version: ${getClientReleaseLabel()}`,
    "",
    "Please describe the issue or symptoms you observed.",
    "",
    "- What happened?",
    "- When did it happen?",
    "- What did you expect to happen?",
    "- How can it be reproduced?",
  ].join("\n");
}

function getClientReleaseLabel(): string {
  return `${__APP_VERSION__}+${__APP_BUILD_NUMBER__}`;
}

function getClientReleaseFileLabel(): string {
  const sanitizedVersion = __APP_VERSION__.replace(/[^a-zA-Z0-9.-]+/g, "_");
  return `${sanitizedVersion}-build-${__APP_BUILD_NUMBER__}`;
}

function buildGmailComposeHref(subject: string, body: string): string {
  const gmailComposeUrl = new URL("https://mail.google.com/mail/");
  gmailComposeUrl.searchParams.set("view", "cm");
  gmailComposeUrl.searchParams.set("fs", "1");
  gmailComposeUrl.searchParams.set("to", "ch.neizzz@gmail.com");
  gmailComposeUrl.searchParams.set("su", subject);
  gmailComposeUrl.searchParams.set("body", body);
  return gmailComposeUrl.toString();
}

async function openMailDraft(
  subject: string,
  body: string,
  attachments?: DiagnosticsAttachment[],
): Promise<
  "gmail_app" | "external_browser" | "browser_window" | "same_window"
> {
  const composeUrl = buildGmailComposeHref(subject, body);
  const recipient = "ch.neizzz@gmail.com";

  if (
    typeof window !== "undefined" &&
    window.browserController &&
    typeof window.browserController.openGmailDraft === "function"
  ) {
    try {
      await window.browserController.openGmailDraft(
        recipient,
        subject,
        body,
        attachments,
      );
      return "gmail_app";
    } catch (gmailError) {
      console.warn(
        "[GameContainer] Falling back to browser compose because Gmail app launch failed",
        gmailError,
      );
    }
  }

  if (
    typeof window !== "undefined" &&
    window.browserController &&
    typeof window.browserController.openExternalUrl === "function"
  ) {
    await window.browserController.openExternalUrl(composeUrl);
    return "external_browser";
  }

  const openedWindow = window.open(composeUrl, "_blank", "noopener,noreferrer");
  if (openedWindow) {
    return "browser_window";
  }

  window.location.assign(composeUrl);
  return "same_window";
}

const GameContainer: React.FC = () => {
  const gameViewportRef = useRef<HTMLDivElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const controlButtonsWrapperRef = useRef<HTMLDivElement>(null);
  const [gameInstance, setGameInstance] = useState<Game | null>(null);
  const [gameContainerSize, setGameContainerSize] = useState<number | null>(
    null,
  );
  const [unsupportedViewportReason, setUnsupportedViewportReason] =
    useState<UnsupportedViewportReason>(() =>
      isAndroidUserAgent ? getUnsupportedViewportReason() : null,
    );
  const [showSetupLayer, setShowSetupLayer] = useState<boolean>(false);
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(true);
  const { alertState, showAlert, hideAlert } = useAlert();
  const [loadingFailureAlert, setLoadingFailureAlert] =
    useState<LoadingFailureAlertState | null>(null);
  const [sanitizeResetAlert, setSanitizeResetAlert] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  const initialSetupDataRef = useRef<SetupFormData | null>(null);
  const pendingSetupResolverRef = useRef<
    ((formData: SetupFormData) => void) | null
  >(null);
  const shouldRestartFromSetupRef = useRef(false);
  const [sceneHistoryStack, setSceneHistoryStack] = useState<SceneKey[]>(() => [
    ...ROOT_SCENE_HISTORY_STACK,
  ]);
  const [showSettingMenu, setShowSettingMenu] = useState(false);
  const [showFinalResetConfirm, setShowFinalResetConfirm] = useState(false);
  const [gameSettings, setGameSettings] = useState(getGameSettings);
  const [gameSessionKey, setGameSessionKey] = useState(0);
  const [isSendingDiagnostics, setIsSendingDiagnostics] = useState(false);
  const [pendingDiagnosticsDraft, setPendingDiagnosticsDraft] =
    useState<PendingDiagnosticsDraft | null>(null);
  const [buttonParams, setButtonParams] = useState<
    [ControlButtonParams, ControlButtonParams, ControlButtonParams] | null
  >(null);
  const [sceneTransitionLoadState, setSceneTransitionLoadState] =
    useState<SceneTransitionLoadState>({
      requestId: 0,
      phase: "idle",
    });
  const pendingSettingMenuOpenTimeoutRef = useRef<number | null>(null);
  const sceneTransitionRequestIdRef = useRef(0);
  const recoveryVibrationIntervalRef = useRef<number | null>(null);
  const nativeKeyboardInsetRef = useRef(0);
  const lastValidationResultRef = useRef<SanitizeStoredWorldDataResult | null>(
    null,
  );
  const isFullscreenAdLayoutFrozenRef = useRef(false);
  const fullscreenAdLayoutReleaseTimeoutRef = useRef<number | null>(null);
  const fullscreenAdLayoutReleaseRafRef = useRef<number | null>(null);
  const activeBackNavigationEntriesRef = useRef<BackNavigationEntry[]>([]);
  const currentBackNavigationEntriesRef = useRef<BackNavigationEntry[]>([]);
  const pendingPopstateTargetEntriesRef = useRef<BackNavigationEntry[] | null>(
    null,
  );
  const pendingBrowserHistoryTargetEntriesRef = useRef<
    BackNavigationEntry[] | null
  >(null);
  const hasInitializedBackNavigationHistoryRef = useRef(false);

  const clearPendingSettingMenuOpen = useCallback(() => {
    if (pendingSettingMenuOpenTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(pendingSettingMenuOpenTimeoutRef.current);
    pendingSettingMenuOpenTimeoutRef.current = null;
  }, []);

  const openSettingMenu = useCallback(() => {
    if (showSettingMenu || pendingSettingMenuOpenTimeoutRef.current !== null) {
      return;
    }

    pendingSettingMenuOpenTimeoutRef.current = window.setTimeout(() => {
      pendingSettingMenuOpenTimeoutRef.current = null;
      setShowSettingMenu(true);
    }, 0);
  }, [showSettingMenu]);

  const closeSettingMenu = useCallback(() => {
    clearPendingSettingMenuOpen();
    setShowFinalResetConfirm(false);
    setShowSettingMenu(false);
  }, [clearPendingSettingMenuOpen]);

  const closeResetConfirm = useCallback(() => {
    setShowFinalResetConfirm(false);
  }, []);

  const backNavigationEntries = useMemo(() => {
    const entries = sceneHistoryStack
      .slice(1)
      .map((sceneKey) => createSceneBackNavigationEntry(sceneKey));

    if (showSettingMenu) {
      entries.push(BACK_NAVIGATION_SETTING_MENU_ENTRY);
    }

    if (showFinalResetConfirm) {
      entries.push(BACK_NAVIGATION_SETTING_RESET_CONFIRM_ENTRY);
    }

    if (alertState) {
      entries.push(BACK_NAVIGATION_ALERT_ENTRY);
    }

    if (loadingFailureAlert) {
      entries.push(BACK_NAVIGATION_LOADING_FAILURE_ENTRY);
    }

    if (pendingDiagnosticsDraft) {
      entries.push(BACK_NAVIGATION_DIAGNOSTICS_ENTRY);
    }

    return entries;
  }, [
    alertState,
    loadingFailureAlert,
    pendingDiagnosticsDraft,
    sceneHistoryStack,
  const pendingInitialSetupPromiseRef = useRef<Promise<SetupFormData> | null>(
    null,
  );
    showFinalResetConfirm,
    showSettingMenu,
  ]);

  const requestHistoryBackForEntry = useCallback(
    (entry: BackNavigationEntry, fallback: () => void) => {
      if (typeof window === "undefined") {
        fallback();
        return;
      }

      const currentEntries = activeBackNavigationEntriesRef.current;

      if (currentEntries[currentEntries.length - 1] !== entry) {
        fallback();
        return;
      }

      window.history.back();
    },
    [],
  );

  const dismissAlert = useCallback(() => {
    requestHistoryBackForEntry(BACK_NAVIGATION_ALERT_ENTRY, hideAlert);
  }, [hideAlert, requestHistoryBackForEntry]);

  const dismissLoadingFailureAlert = useCallback(() => {
    requestHistoryBackForEntry(BACK_NAVIGATION_LOADING_FAILURE_ENTRY, () => {
      setLoadingFailureAlert(null);
    });
  }, [requestHistoryBackForEntry]);

  const dismissDiagnosticsDraft = useCallback(() => {
    requestHistoryBackForEntry(BACK_NAVIGATION_DIAGNOSTICS_ENTRY, () => {
      setPendingDiagnosticsDraft(null);
    });
  }, [requestHistoryBackForEntry]);

  const dismissResetConfirm = useCallback(() => {
    requestHistoryBackForEntry(
      BACK_NAVIGATION_SETTING_RESET_CONFIRM_ENTRY,
      closeResetConfirm,
    );
  }, [closeResetConfirm, requestHistoryBackForEntry]);

  const dismissSettingMenu = useCallback(() => {
    requestHistoryBackForEntry(
      BACK_NAVIGATION_SETTING_MENU_ENTRY,
      closeSettingMenu,
    );
  }, [closeSettingMenu, requestHistoryBackForEntry]);

  const applyBackNavigationTarget = useCallback(
    async (targetEntries: BackNavigationEntry[]) => {
      const targetEntrySet = new Set(targetEntries);

      if (!targetEntrySet.has(BACK_NAVIGATION_DIAGNOSTICS_ENTRY)) {
        setPendingDiagnosticsDraft(null);
      }

      if (!targetEntrySet.has(BACK_NAVIGATION_ALERT_ENTRY)) {
        hideAlert();
      }

      if (!targetEntrySet.has(BACK_NAVIGATION_LOADING_FAILURE_ENTRY)) {
        setLoadingFailureAlert(null);
      }

      if (!targetEntrySet.has(BACK_NAVIGATION_SETTING_MENU_ENTRY)) {
        closeSettingMenu();
      } else if (
        !targetEntrySet.has(BACK_NAVIGATION_SETTING_RESET_CONFIRM_ENTRY)
      ) {
        setShowFinalResetConfirm(false);
      }

      if (!gameInstance || sceneTransitionLoadState.phase !== "idle") {
        return;
      }

      const targetSceneKey =
        getTargetSceneKeyFromBackNavigationEntries(targetEntries);

      if (gameInstance.getCurrentSceneKey() === targetSceneKey) {
        return;
      }

      await gameInstance.changeScene(targetSceneKey);
    },
    [closeSettingMenu, gameInstance, hideAlert, sceneTransitionLoadState.phase],
  );

  const stopLoadingWithFailure = useCallback(
    ({
      message,
      title = "Loading Error",
      error,
      context,
    }: {
      message: string;
      title?: string;
      error?: unknown;
      context?: Record<string, unknown>;
    }) => {
      sceneTransitionRequestIdRef.current = 0;
      setSceneTransitionLoadState({ requestId: 0, phase: "idle" });
      setIsBootstrapping(false);

      const diagnosticsContext = {
        release: getClientReleaseLabel(),
        storageKind: getClientStorageKind(),
        sceneTransitionPhase: sceneTransitionLoadState.phase,
        currentSceneKey: gameInstance?.getCurrentSceneKey() ?? null,
        ...context,
        error: error ?? null,
      };

      logImportantDiagnostics(
        "error",
        "[ImportantDiagnostics][GameContainer] Loading flow failed.",
        diagnosticsContext,
      );
      console.error("[GameContainer] Loading flow failed.", {
        message,
        ...diagnosticsContext,
      });
      setLoadingFailureAlert({ title, message });
    },
    [gameInstance, sceneTransitionLoadState.phase],
  );

  useEffect(() => {
    return () => {
      clearPendingSettingMenuOpen();
    };
  }, [clearPendingSettingMenuOpen]);

  useEffect(() => {
    activeBackNavigationEntriesRef.current = backNavigationEntries;
  }, [backNavigationEntries]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!hasInitializedBackNavigationHistoryRef.current) {
      window.history.replaceState(
        createBackNavigationHistoryState(
          window.history.state,
          backNavigationEntries,
        ),
        document.title,
      );
      currentBackNavigationEntriesRef.current = backNavigationEntries;
      hasInitializedBackNavigationHistoryRef.current = true;
      return;
    }

    if (pendingBrowserHistoryTargetEntriesRef.current) {
      return;
    }

    if (pendingPopstateTargetEntriesRef.current) {
      if (
        areBackNavigationEntriesEqual(
          pendingPopstateTargetEntriesRef.current,
          backNavigationEntries,
        )
      ) {
        currentBackNavigationEntriesRef.current = backNavigationEntries;
        pendingPopstateTargetEntriesRef.current = null;
      }
      return;
    }

    const currentEntries = currentBackNavigationEntriesRef.current;

    if (areBackNavigationEntriesEqual(currentEntries, backNavigationEntries)) {
      const browserEntries = readBackNavigationEntriesFromHistoryState(
        window.history.state,
      );

      if (
        !areBackNavigationEntriesEqual(browserEntries, backNavigationEntries)
      ) {
        window.history.replaceState(
          createBackNavigationHistoryState(
            window.history.state,
            backNavigationEntries,
          ),
          document.title,
        );
      }

      return;
    }

    const sharedPrefixLength = getSharedBackNavigationPrefixLength(
      currentEntries,
      backNavigationEntries,
    );

    if (
      sharedPrefixLength === currentEntries.length &&
      backNavigationEntries.length > currentEntries.length
    ) {
      for (
        let index = currentEntries.length + 1;
        index <= backNavigationEntries.length;
        index += 1
      ) {
        window.history.pushState(
          createBackNavigationHistoryState(
            window.history.state,
            backNavigationEntries.slice(0, index),
          ),
          document.title,
        );
      }

      currentBackNavigationEntriesRef.current = backNavigationEntries;
      return;
    }

    if (
      sharedPrefixLength === backNavigationEntries.length &&
      backNavigationEntries.length < currentEntries.length
    ) {
      pendingBrowserHistoryTargetEntriesRef.current = backNavigationEntries;
      window.history.go(backNavigationEntries.length - currentEntries.length);
      return;
    }

    window.history.replaceState(
      createBackNavigationHistoryState(
        window.history.state,
        backNavigationEntries,
      ),
      document.title,
    );
    currentBackNavigationEntriesRef.current = backNavigationEntries;
  }, [backNavigationEntries]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handlePopState = (event: PopStateEvent) => {
      const targetEntries = readBackNavigationEntriesFromHistoryState(
        event.state,
      );

      if (
        pendingBrowserHistoryTargetEntriesRef.current &&
        areBackNavigationEntriesEqual(
          pendingBrowserHistoryTargetEntriesRef.current,
          targetEntries,
        )
      ) {
        pendingBrowserHistoryTargetEntriesRef.current = null;
        currentBackNavigationEntriesRef.current = targetEntries;
        return;
      }

      pendingPopstateTargetEntriesRef.current = targetEntries;

      if (sceneTransitionLoadState.phase !== "idle") {
        return;
      }

      void applyBackNavigationTarget(targetEntries);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [applyBackNavigationTarget, sceneTransitionLoadState.phase]);

  useEffect(() => {
    if (sceneTransitionLoadState.phase !== "idle") {
      return;
    }

    const targetEntries = pendingPopstateTargetEntriesRef.current;

    if (!targetEntries) {
      return;
    }

    void applyBackNavigationTarget(targetEntries);
  }, [applyBackNavigationTarget, sceneTransitionLoadState.phase]);

  const handleVibrationSettingChange = useCallback((enabled: boolean) => {
    setGameSettings(updateGameSettings({ vibrationEnabled: enabled }));
  }, []);

  useEffect(() => {
    setDiagnosticsContextProvider(() => ({
      scene:
        gameInstance?.getCurrentSceneKey() !== undefined
          ? String(gameInstance.getCurrentSceneKey())
          : undefined,
      storageKind: getClientStorageKind(),
      appMode: import.meta.env.MODE,
      appVersion: __APP_VERSION__,
      buildNumber: __APP_BUILD_NUMBER__,
      debugEnabled: isNativeFeatureDebugMode,
    }));

    return () => {
      setDiagnosticsContextProvider(null);
    };
  }, [gameInstance]);

  const handleSceneTransitionStateChange = useCallback(
    (params: {
      requestId: number;
      from?: SceneKey;
      to: SceneKey;
      state: "loading" | "core_ready" | "failed";
    }) => {
      if (params.state === "loading") {
        sceneTransitionRequestIdRef.current = params.requestId;
        setSceneTransitionLoadState({
          requestId: params.requestId,
          phase: "loading",
          from: params.from,
          to: params.to,
        });
        setButtonParams(null);
        return;
      }

      if (sceneTransitionRequestIdRef.current !== params.requestId) {
        return;
      }

      if (params.state === "failed") {
        stopLoadingWithFailure({
          message:
            "A scene failed to load. Tap Okay to dismiss this popup or Send Log to share diagnostics.",
          context: {
            phase: "scene_transition",
            requestId: params.requestId,
            from: params.from ?? null,
            to: params.to,
          },
        });
        return;
      }

      setSceneTransitionLoadState((previous) =>
        previous.requestId === params.requestId
          ? { ...previous, phase: "core_ready" }
          : previous,
      );
      setSceneHistoryStack((previous) => {
        if (previous[previous.length - 1] === params.to) {
          return previous;
        }

        const existingSceneIndex = previous.lastIndexOf(params.to);

        if (existingSceneIndex >= 0) {
          return previous.slice(0, existingSceneIndex + 1);
        }

        return [...previous, params.to];
      });
    },
    [stopLoadingWithFailure],
  );

  const completeSceneTransitionLoading = useCallback((requestId: number) => {
    if (sceneTransitionRequestIdRef.current !== requestId) {
      return;
    }

    sceneTransitionRequestIdRef.current = 0;
    setSceneTransitionLoadState({ requestId: 0, phase: "idle" });
    setIsBootstrapping(false);
  }, []);

  const updateGameContainerSize = useCallback((force = false) => {
    const viewportElement = gameViewportRef.current;

    if (!viewportElement) {
      return;
    }

    if (!force && isFullscreenAdLayoutFrozenRef.current) {
      return;
    }

    const controlButtonsHeight =
      controlButtonsWrapperRef.current?.getBoundingClientRect().height ?? 0;
    const availableHeight = Math.max(
      0,
      viewportElement.clientHeight - controlButtonsHeight,
    );
    const nextSize = Math.max(
      0,
      Math.floor(Math.min(viewportElement.clientWidth, availableHeight)),
    );

    setGameContainerSize((previous) =>
      previous === nextSize ? previous : nextSize,
    );
  }, []);

  const clearFullscreenAdLayoutRelease = useCallback(() => {
    if (fullscreenAdLayoutReleaseTimeoutRef.current !== null) {
      window.clearTimeout(fullscreenAdLayoutReleaseTimeoutRef.current);
      fullscreenAdLayoutReleaseTimeoutRef.current = null;
    }

    if (fullscreenAdLayoutReleaseRafRef.current !== null) {
      window.cancelAnimationFrame(fullscreenAdLayoutReleaseRafRef.current);
      fullscreenAdLayoutReleaseRafRef.current = null;
    }
  }, []);

  const updateUnsupportedViewportOverlay = useCallback(() => {
    setUnsupportedViewportReason(
      getUnsupportedViewportReason({
        nativeKeyboardInset: nativeKeyboardInsetRef.current,
      }),
    );
  }, []);

  const freezeLayoutForFullscreenAd = useCallback(() => {
    clearFullscreenAdLayoutRelease();
    isFullscreenAdLayoutFrozenRef.current = true;
    setFrozenAppShellHeight(getCurrentViewportHeight());
  }, [clearFullscreenAdLayoutRelease]);

  const releaseLayoutAfterFullscreenAd = useCallback(() => {
    clearFullscreenAdLayoutRelease();

    fullscreenAdLayoutReleaseTimeoutRef.current = window.setTimeout(() => {
      fullscreenAdLayoutReleaseRafRef.current = window.requestAnimationFrame(
        () => {
          fullscreenAdLayoutReleaseRafRef.current =
            window.requestAnimationFrame(() => {
              isFullscreenAdLayoutFrozenRef.current = false;
              setFrozenAppShellHeight(null);
              updateGameContainerSize(true);
            });
        },
      );
    }, 260);
  }, [clearFullscreenAdLayoutRelease, updateGameContainerSize]);

  const stopRecoveryVibration = useCallback(() => {
    if (recoveryVibrationIntervalRef.current !== null) {
      window.clearInterval(recoveryVibrationIntervalRef.current);
      recoveryVibrationIntervalRef.current = null;
    }
  }, []);

  const startRecoveryVibration = useCallback(() => {
    if (recoveryVibrationIntervalRef.current !== null) {
      return;
    }

    void biteVibrationAdapter.vibrate(
      RECOVERY_VIBRATION_DURATION_MS,
      RECOVERY_VIBRATION_STRENGTH,
    );

    recoveryVibrationIntervalRef.current = window.setInterval(() => {
      void biteVibrationAdapter.vibrate(
        RECOVERY_VIBRATION_DURATION_MS,
        RECOVERY_VIBRATION_STRENGTH,
      );
    }, RECOVERY_VIBRATION_INTERVAL_MS);
  }, []);

  useEffect(() => {
    if (sceneTransitionLoadState.phase !== "core_ready" || !gameInstance) {
      return;
    }

    const requestId = sceneTransitionLoadState.requestId;
    let cancelled = false;

    const finalizeSceneTransitionLoading = async () => {
      await waitForLayoutStabilization();

      if (cancelled) {
        return;
      }

      completeSceneTransitionLoading(requestId);
    };

    void finalizeSceneTransitionLoading();

    return () => {
      cancelled = true;
    };
  }, [completeSceneTransitionLoading, gameInstance, sceneTransitionLoadState]);

  const handleSendDiagnostics = useCallback(async () => {
    if (isSendingDiagnostics || pendingDiagnosticsDraft) {
      return;
    }

    setIsSendingDiagnostics(true);

    try {
      const storage = createClientStorage();
      const storedGameData = await storage.getData(WORLD_DATA_STORAGE_KEY);
      const snapshot = gameInstance?.getDiagnosticsSnapshot();
      const currentGameData = snapshot?.mainSceneData ?? null;
      const latestGameData = currentGameData ?? storedGameData ?? null;
      const latestGameDataSource = currentGameData
        ? "current_game"
        : storedGameData
          ? "stored_game"
          : "none";
      const currentSceneKey = String(snapshot?.currentSceneKey ?? "unknown");
      const payload: DiagnosticsPayload = {
        generatedAt: new Date().toISOString(),
        appInfo: {
          project: "MonTTo",
          clientAppVersion: __APP_VERSION__,
          clientBuildNumber: __APP_BUILD_NUMBER__,
          appMode: import.meta.env.MODE,
          debugEnabled: isNativeFeatureDebugMode,
          storageKind: getClientStorageKind(),
          userAgent: navigator.userAgent,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          currentSceneKey,
          logger: getDiagnosticsLoggerInfo(),
          gameSettings,
        },
        summary: summarizeGameData(currentGameData ?? storedGameData),
        logs: getDiagnosticsLogs(),
        importantLogs: getImportantDiagnosticsLogs(),
        currentGameData,
        storedGameData,
        latestGameData,
        latestGameDataSource,
        lastValidation: lastValidationResultRef.current?.diagnostics ?? null,
        lastValidationAction: lastValidationResultRef.current?.action ?? null,
        lastValidationResetReason:
          lastValidationResultRef.current?.resetReason ?? null,
      };

      const payloadText = JSON.stringify(payload, null, 2);
      const subject = createDiagnosticsSubject(payload.generatedAt);
      const body = createDiagnosticsBody();
      const releaseFileLabel = getClientReleaseFileLabel();
      const timestampSuffix = payload.generatedAt
        .replace(/\.\d{3}Z$/, "Z")
        .replace(/[:]/g, "-");
      setPendingDiagnosticsDraft({
        subject,
        body,
        attachments: [
          {
            fileName: `montto-diagnostics-${releaseFileLabel}-${timestampSuffix}.json`,
            text: payloadText,
            mimeType: "application/json",
          },
          {
            fileName: `montto-latest-game-data-${releaseFileLabel}-${timestampSuffix}.json`,
            text: JSON.stringify(latestGameData, null, 2),
            mimeType: "application/json",
          },
          {
            fileName: `montto-important-logs-${releaseFileLabel}-${timestampSuffix}.json`,
            text: JSON.stringify(payload.importantLogs, null, 2),
            mimeType: "application/json",
          },
        ],
      });
    } catch (error) {
      logImportantDiagnostics(
        "error",
        "[ImportantDiagnostics][GameContainer] Failed to prepare diagnostics payload",
        error,
      );
      console.error(
        "[GameContainer] Failed to prepare diagnostics payload",
        error,
      );
      showAlert("Failed to prepare diagnostics payload.", "Error");
    } finally {
      setIsSendingDiagnostics(false);
    }
  }, [
    gameInstance,
    gameSettings,
    isSendingDiagnostics,
    pendingDiagnosticsDraft,
    showAlert,
  ]);

  const handleCancelDiagnosticsDraft = useCallback(() => {
    dismissDiagnosticsDraft();
  }, [dismissDiagnosticsDraft]);

  const handleConfirmDiagnosticsDraft = useCallback(async () => {
    if (!pendingDiagnosticsDraft) {
      return;
    }

    let followUpAlert: {
      title: string;
      message: string;
    } | null = null;

    try {
      const openRoute = await openMailDraft(
        pendingDiagnosticsDraft.subject,
        pendingDiagnosticsDraft.body,
        pendingDiagnosticsDraft.attachments,
      );

      if (openRoute !== "gmail_app") {
        followUpAlert = {
          title: "Notice",
          message:
            "The mail compose screen was opened outside the app. File attachment support is only guaranteed when the Gmail app opens directly.",
        };
      }
    } catch (error) {
      console.error("[GameContainer] Failed to open diagnostics draft", error);
      followUpAlert = {
        title: "Error",
        message:
          "Failed to open the Gmail draft. Please make sure Gmail is installed.",
      };
    } finally {
      setPendingDiagnosticsDraft(null);

      if (followUpAlert) {
        const alertToShow = followUpAlert;

        window.setTimeout(() => {
          showAlert(alertToShow.message, alertToShow.title);
        }, 0);
      }
    }
  }, [pendingDiagnosticsDraft, showAlert]);

  const resetGameData = useCallback(
    async (reason: "user_reset" | "sanitize_reset") => {
      console.warn("[GameContainer] resetGameData:start", {
        reason,
        hasGameInstance: !!gameInstance,
        storageKind: getClientStorageKind(),
      });

      try {
        if (gameInstance) {
          await gameInstance.destroyForReset();
        } else {
          const storage = createClientStorage();
          await storage.removeData(WORLD_DATA_STORAGE_KEY);
        }

        if (gameContainerRef.current) {
          gameContainerRef.current.innerHTML = "";
        }

        initialSetupDataRef.current = null;
        pendingSetupResolverRef.current = null;
        shouldRestartFromSetupRef.current = true;
        isInitializedRef.current = false;
        setSceneHistoryStack([...ROOT_SCENE_HISTORY_STACK]);
        setLoadingFailureAlert(null);
        setShowSettingMenu(false);
        setShowFinalResetConfirm(false);
        setButtonParams(null);
        setShowSetupLayer(true);
        setIsBootstrapping(false);
        sceneTransitionRequestIdRef.current = 0;
        setSceneTransitionLoadState({ requestId: 0, phase: "idle" });
        setGameInstance(null);
        setSanitizeResetAlert(null);
        console.warn("[GameContainer] resetGameData:success", {
          reason,
          storageKind: getClientStorageKind(),
        });
      } catch (error) {
        console.error("[GameContainer] Failed to reset game data:", error);
        showAlert("Failed to reset game data.", "Error");
      }
    },
    [gameInstance, showAlert],
  );

  const handleResetGameData = useCallback(async () => {
    await resetGameData("user_reset");
  }, [resetGameData]);

  const handleSanitizeResetConfirm = useCallback(async () => {
    await resetGameData("sanitize_reset");
  }, [resetGameData]);

  const prepareSavedGameData = useCallback(async (): Promise<
    "playable" | "setup_required" | "reset_required"
  > => {
    try {
      const storage = createClientStorage();
      const storageKind = getClientStorageKind();
      const savedData = await storage.getData(WORLD_DATA_STORAGE_KEY);
      const result = sanitizeStoredWorldData(savedData);
      lastValidationResultRef.current = result;

      if (result.changed || result.action !== "playable") {
        logImportantDiagnostics(
          result.action === "reset_required" ? "error" : "warn",
          "[ImportantDiagnostics][GameDataValidation]",
          {
            key: WORLD_DATA_STORAGE_KEY,
            storageKind,
            action: result.action,
            changed: result.changed,
            resetReason: result.resetReason ?? null,
            diagnostics: result.diagnostics,
            savedDataSummary: summarizeSavedData(savedData),
          },
        );
      }

      if (
        result.changed &&
        result.sanitizedData &&
        result.action !== "reset_required"
      ) {
        await storage.setData(WORLD_DATA_STORAGE_KEY, result.sanitizedData);
        logImportantDiagnostics(
          "warn",
          "[ImportantDiagnostics][GameDataRepair] Saved data was repaired and written back.",
          {
            action: result.action,
            diagnostics: result.diagnostics,
          },
        );
      }

      if (result.action === "reset_required") {
        logImportantDiagnostics(
          "error",
          "[ImportantDiagnostics][GameDataRepair] Saved data is corrupted and requires reset.",
          {
            resetReason: result.resetReason ?? null,
            diagnostics: result.diagnostics,
          },
        );
        setSanitizeResetAlert({
          title: "Data Recovery",
          message:
            result.resetReason ??
            "Existing game data is corrupted and cannot be recovered. Press Confirm to reset the data and return to the initial setup screen.",
        });
        setIsBootstrapping(false);
      }

      return result.action;
    } catch (error) {
      logImportantDiagnostics(
        "error",
        "[ImportantDiagnostics][GameDataValidation] Failed to inspect saved game data.",
        {
          key: WORLD_DATA_STORAGE_KEY,
          storageKind: getClientStorageKind(),
          error,
        },
      );
      console.error("[GameContainer] Failed to inspect saved game data:", {
        key: WORLD_DATA_STORAGE_KEY,
        storageKind: getClientStorageKind(),
        error,
      });
      setSanitizeResetAlert({
        title: "Data Recovery",
        message:
          "There was a problem reading the existing game data. Press Confirm to reset the data and return to the initial setup screen.",
      });
      setIsBootstrapping(false);
      return "reset_required";
    }
  }, []);

  const hydrateInitialSetupData = useCallback(
    async (formData: SetupFormData): Promise<SetupFormData> => {
      if (!formData.useLocalTime || formData.cachedSunTimes) {
        return formData;
      }

      try {
        const sunTimes = await getNativeSunTimes(true);

        if (!sunTimes) {
          console.warn(
            "[GameContainer] Initial sun times were unavailable during setup loading. Continuing without cached sun times.",
          );
          return {
            ...formData,
            cachedSunTimes: null,
          };
        }

        console.log(
          "[GameContainer] Initial sun times prepared during setup loading.",
          {
            date: sunTimes.date,
            locationSource: sunTimes.locationSource,
            hasLocationPermission: sunTimes.hasLocationPermission,
            sunriseAt: sunTimes.sunriseAt,
            sunsetAt: sunTimes.sunsetAt,
          },
        );

        return {
          ...formData,
          cachedSunTimes: sunTimes,
        };
      } catch (error) {
        console.warn(
          "[GameContainer] Failed to prepare initial sun times during setup loading. Continuing without cached sun times.",
          error,
        );
        return {
          ...formData,
          cachedSunTimes: null,
        };
      }
    },
    [],
  );

  const requestInitialGameData =
    useCallback(async (): Promise<SetupFormData> => {
      if (initialSetupDataRef.current) {
        return initialSetupDataRef.current;
      }

      setLoadingFailureAlert(null);
      setIsBootstrapping(false);
      setShowSetupLayer(true);

      const setupPromise = new Promise<SetupFormData>((resolve) => {
        pendingSetupResolverRef.current = (formData: SetupFormData) => {
          setShowSetupLayer(false);
          setIsBootstrapping(true);
          pendingSetupResolverRef.current = null;

          void (async () => {
            const hydratedFormData = await hydrateInitialSetupData(formData);
            initialSetupDataRef.current = hydratedFormData;
            resolve(hydratedFormData);
          })();
        };
      });
    }, [hydrateInitialSetupData]);

  const initializeGame = useCallback(() => {
    if (!gameContainerRef.current) return;
    if (!gameContainerSize || gameContainerSize <= 0) return;
    if (isInitializedRef.current) return;

    setLoadingFailureAlert(null);
    setIsBootstrapping(true);
    const debugParentElement =
      gameContainerRef.current.closest("#app-container") ??
      gameContainerRef.current;

    const game = new Game({
      parentElement: gameContainerRef.current as HTMLDivElement,
      debugParentElement: debugParentElement as HTMLDivElement,
      onCreateInitialGameData: async () => {
        return initialSetupDataRef.current ?? (await requestInitialGameData());
      },
      showAlert: (message: string, title?: string) => {
        showAlert(message, title);
      },
      startMiniGame: isMiniGameUnavailableForCurrentVersion()
        ? () => {
            showAlert("개발중", "Notice");
          }
        : undefined,
      showSettings: () => {
        openSettingMenu();
      },
      triggerBiteVibration: () => {
        void biteVibrationAdapter.vibrate();
      },
      startRecoveryVibration,
      stopRecoveryVibration,
      onSceneTransitionStateChange: handleSceneTransitionStateChange,
      changeControlButtons: (controlButtonParams) => {
        setButtonParams((previous) => {
          if (
            previous &&
            previous.every(
              (buttonParam, index) =>
                buttonParam.type === controlButtonParams[index].type &&
                buttonParam.initialSliderValue ===
                  controlButtonParams[index].initialSliderValue &&
                buttonParam.sliderSessionKey ===
                  controlButtonParams[index].sliderSessionKey &&
                buttonParam.hasCleaningTarget ===
                  controlButtonParams[index].hasCleaningTarget,
            )
          ) {
            return previous;
          }

          return controlButtonParams;
        });
      },
    });

    window.setTimeout(() => {
      void game
        .initialize()
        .then(() => {
          isInitializedRef.current = true;
          setGameInstance(game);
        })
        .catch((error) => {
          setGameInstance(null);

          try {
            game.destroy();
          } catch (destroyError) {
            console.warn(
              "[GameContainer] Failed to clean up a partially initialized game instance.",
              destroyError,
            );
          }

          stopLoadingWithFailure({
            message:
              "The game could not finish loading. Tap Okay to dismiss this popup or Send Log to share diagnostics.",
            error,
            context: {
              phase: "game_initialize",
            },
          });
        });
    });
  }, [
    gameContainerSize,
    handleSceneTransitionStateChange,
    openSettingMenu,
    requestInitialGameData,
    startRecoveryVibration,
    stopLoadingWithFailure,
    stopRecoveryVibration,
    showAlert,
  ]);

  // Game 인스턴스 생성은 한 번만 실행되도록 보장
  useEffect(() => {
    const viewportElement = gameViewportRef.current;

    if (!viewportElement) {
      return;
    }

    updateGameContainerSize();

    if (typeof ResizeObserver === "undefined") {
      const handleWindowResize = () => {
        updateGameContainerSize();
      };

      window.addEventListener("resize", handleWindowResize);
      return () => {
        window.removeEventListener("resize", handleWindowResize);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      updateGameContainerSize();
    });
    resizeObserver.observe(viewportElement);
    if (controlButtonsWrapperRef.current) {
      resizeObserver.observe(controlButtonsWrapperRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [buttonParams, updateGameContainerSize]);

  useEffect(() => {
    if (!isAndroidUserAgent) {
      return;
    }

    const handleNativeViewportSync = (event: Event) => {
      const detail = (event as CustomEvent<NativeViewportSyncDetail>).detail;

      nativeKeyboardInsetRef.current = Math.max(0, detail?.bottomInset ?? 0);
      updateUnsupportedViewportOverlay();
    };

    updateUnsupportedViewportOverlay();

        pendingInitialSetupPromiseRef.current = null;
    window.addEventListener("resize", updateUnsupportedViewportOverlay);
    window.addEventListener(
      "orientationchange",
      updateUnsupportedViewportOverlay,
    );
    window.visualViewport?.addEventListener(
      "resize",
      updateUnsupportedViewportOverlay,
    );
    window.addEventListener(
      "digivice:native-viewport-sync",
      handleNativeViewportSync as EventListener,
    );

    return () => {
      window.removeEventListener("resize", updateUnsupportedViewportOverlay);
      window.removeEventListener(
        "orientationchange",
        updateUnsupportedViewportOverlay,
      );
      window.visualViewport?.removeEventListener(
        "resize",
        updateUnsupportedViewportOverlay,
      );
      window.removeEventListener(
        "digivice:native-viewport-sync",
        handleNativeViewportSync as EventListener,
      );
    };
  }, [updateUnsupportedViewportOverlay]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleFullscreenAdState = (event: Event) => {
      const detail = (event as CustomEvent<FullscreenAdEventDetail>).detail;
      const state = detail?.state;

      if (state === "showing") {
        freezeLayoutForFullscreenAd();
        return;
      }

      if (state === "dismissed" || state === "failed") {
        releaseLayoutAfterFullscreenAd();
      }
    };

    window.addEventListener(
      "digivice:fullscreen-ad",
      handleFullscreenAdState as EventListener,
    );

    return () => {
      window.removeEventListener(
        "digivice:fullscreen-ad",
        handleFullscreenAdState as EventListener,
      );
      clearFullscreenAdLayoutRelease();
      isFullscreenAdLayoutFrozenRef.current = false;
      setFrozenAppShellHeight(null);
    };
  }, [
    clearFullscreenAdLayoutRelease,
    freezeLayoutForFullscreenAd,
    releaseLayoutAfterFullscreenAd,
  ]);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      if (!gameContainerRef.current) return;
      if (!gameContainerSize || gameContainerSize <= 0) return;
      if (isInitializedRef.current) return;

      const savedGameDataState = await prepareSavedGameData();
      if (!isMounted) return;

      if (savedGameDataState === "reset_required") {
        return;
      }

      if (savedGameDataState === "setup_required") {
        await requestInitialGameData();
        if (!isMounted) return;
        await waitForLayoutStabilization();
        if (!isMounted) return;
      }

      initializeGame();
    };

    void bootstrap();

    return () => {
      isMounted = false;
      pendingSetupResolverRef.current = null;
      stopRecoveryVibration();
    };
  }, [
    gameContainerSize,
    gameSessionKey,
    initializeGame,
    prepareSavedGameData,
    requestInitialGameData,
    stopRecoveryVibration,
  ]);

  useEffect(() => {
    return () => {
      stopRecoveryVibration();
    };
  }, [stopRecoveryVibration]);

  useEffect(() => {
    if (!gameInstance) {
      return;
    }

    if (sceneTransitionLoadState.phase !== "idle") {
      return;
    }

    if (gameInstance.getCurrentSceneKey() !== SceneKey.MAIN) {
      return;
    }

    let cancelled = false;

    const preloadMiniGameAssets = async () => {
      try {
        await gameInstance.preloadSceneAssets(SceneKey.FLAPPY_BIRD_GAME);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.warn(
          "[GameContainer] Failed to preload mini game assets",
          error,
        );
      }
    };

    void preloadMiniGameAssets();

    return () => {
      cancelled = true;
    };
  }, [gameInstance, sceneTransitionLoadState.phase]);

  // 버튼 클릭 핸들러 - Game 인스턴스에 버튼 타입만 전달
  const handleButtonPress = useCallback(
    (buttonType: ControlButtonType) => {
      if (buttonType === ControlButtonType.Settings) {
        openSettingMenu();
        return;
      }

      if (gameInstance) {
        gameInstance.handleControlButtonClick(buttonType);
      }
    },
    [gameInstance, openSettingMenu],
  );

  // 슬라이더 값 변경 핸들러 추가
  const handleSliderChange = useCallback(
    (value: number) => {
      if (gameInstance?.handleSliderValueChange) {
        // 게임 인스턴스에 슬라이더 값 전달
        gameInstance.handleSliderValueChange(value);
      }
    },
    [gameInstance],
  );

  // 슬라이더 종료 핸들러 추가
  const handleSliderEnd = useCallback(() => {
    if (gameInstance?.handleSliderEnd) {
      // 게임 인스턴스에 슬라이더 종료 이벤트 전달
      gameInstance.handleSliderEnd();
    }
  }, [gameInstance]);

  // SetupLayer 완료 핸들러
  const handleSetupComplete = useCallback(
    (formData: SetupFormData) => {
      if (pendingInitialSetupPromiseRef.current) {
        return pendingInitialSetupPromiseRef.current;
      }

      const pendingResolver = pendingSetupResolverRef.current;

      if (pendingResolver) {
        pendingResolver(formData);
        return;
      }

      setShowSetupLayer(false);
      setLoadingFailureAlert(null);
      setIsBootstrapping(true);

      void (async () => {
        const hydratedFormData = await hydrateInitialSetupData(formData);
            pendingInitialSetupPromiseRef.current = null;
        initialSetupDataRef.current = hydratedFormData;

        if (shouldRestartFromSetupRef.current) {
          shouldRestartFromSetupRef.current = false;
      pendingInitialSetupPromiseRef.current = setupPromise;
      return setupPromise;

          setGameSessionKey((previous) => previous + 1);
          return;
        }

        setIsBootstrapping(false);
      })();
    },
    [hydrateInitialSetupData],
  );

  const handleSendLoadingFailureLogs = useCallback(() => {
    setLoadingFailureAlert(null);
    window.setTimeout(() => {
      void handleSendDiagnostics();
    }, 0);
  }, [handleSendDiagnostics]);

  const isLoading =
    isBootstrapping ||
    sceneTransitionLoadState.phase === "loading" ||
    sceneTransitionLoadState.phase === "core_ready";

  return (
    <div
      className={"relative flex h-full min-h-0 w-full flex-col overflow-hidden"}
    >
      <div
        ref={gameViewportRef}
        className={"grid min-h-0 min-w-0 flex-1 overflow-hidden"}
        style={{
          gridTemplateRows: buttonParams
            ? "minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr)"
            : "minmax(0, 1fr) auto minmax(0, 1fr)",
        }}
      >
        <div aria-hidden="true" className="min-h-0" />
        <div className={"flex min-h-0 min-w-0 justify-center overflow-hidden"}>
          <div
            id="game-container"
            ref={gameContainerRef}
            className={"relative m-0 shrink-0 p-0"}
            style={
              gameContainerSize
                ? {
                    width: `${gameContainerSize}px`,
                    height: `${gameContainerSize}px`,
                  }
                : undefined
            }
          >
            {/* 게임 캔버스가 여기에 렌더링됨 */}
          </div>
        </div>
        <div aria-hidden="true" className="min-h-0" />

        {buttonParams && (
          <div ref={controlButtonsWrapperRef} className={"z-10 w-full"}>
            <ControlButtons
              buttonParams={buttonParams}
              onButtonPress={handleButtonPress}
              onSliderChange={handleSliderChange}
              onSliderEnd={handleSliderEnd}
            />
          </div>
        )}
        {buttonParams && <div aria-hidden="true" className="min-h-0" />}
      </div>
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black text-white">
          <div className="text-center text-lg tracking-[0.12em]">
            Loading...
          </div>
        </div>
      )}
      {unsupportedViewportReason && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black text-white">
          <div className="px-6 text-center">
            <div className="text-lg tracking-[0.12em]">Portrait Only</div>
            <div className="mt-6 text-[10px] leading-6 tracking-[0.12em]">
              {unsupportedViewportReason === "landscape" ? (
                <>
                  Please rotate your device
                  <br />
                  back to portrait mode.
                </>
              ) : (
                <>
                  This screen ratio is not supported.
                  <br />
                  Please use a taller portrait screen.
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {showSetupLayer && <SetupLayer onComplete={handleSetupComplete} />}
      {showSettingMenu && (
        <SettingMenuLayer
          vibrationEnabled={gameSettings.vibrationEnabled}
          onChangeVibration={handleVibrationSettingChange}
          onSendDiagnostics={handleSendDiagnostics}
          isSendingDiagnostics={isSendingDiagnostics}
          showFinalResetConfirm={showFinalResetConfirm}
          onOpenResetConfirm={() => setShowFinalResetConfirm(true)}
          onCloseResetConfirm={dismissResetConfirm}
          onResetGameData={handleResetGameData}
          onClose={dismissSettingMenu}
        />
      )}
      {alertState && (
        <AlertLayer
          title={alertState.title}
          message={alertState.message}
          onClose={dismissAlert}
        />
      )}
      {loadingFailureAlert && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <PopupLayer
            title={loadingFailureAlert.title}
            content={
              <div className="text-left text-sm leading-6">
                {loadingFailureAlert.message}
              </div>
            }
            onConfirm={dismissLoadingFailureAlert}
            onCancel={handleSendLoadingFailureLogs}
            confirmText="Okay"
            cancelText="Send Log"
          />
        </div>
      )}
      {sanitizeResetAlert && (
        <AlertLayer
          if (isMissingInitialGameDataError(error)) {
            console.warn(
              "[GameContainer] Initial setup data is missing. Returning to setup flow.",
              {
                error,
                storageKind: getClientStorageKind(),
              },
            );
            sceneTransitionRequestIdRef.current = 0;
            setSceneTransitionLoadState({ requestId: 0, phase: "idle" });
            initialSetupDataRef.current = null;
            pendingInitialSetupPromiseRef.current = null;
            pendingSetupResolverRef.current = null;
            shouldRestartFromSetupRef.current = true;
            setLoadingFailureAlert(null);
            setShowSetupLayer(true);
            setIsBootstrapping(false);
            return;
          }

          title={sanitizeResetAlert.title}
          message={sanitizeResetAlert.message}
          onClose={handleSanitizeResetConfirm}
        />
      )}
      {pendingDiagnosticsDraft && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <PopupLayer
            title="Open Gmail"
            content={
              <div className="text-left text-sm leading-6">
                <div>The Gmail app will open next.</div>
                <div className="mt-2">
                  The diagnostics files will be attached to the draft email.
                </div>
                <div className="mt-2 font-mono text-xs leading-5 text-white/70">
                  Release: {getClientReleaseLabel()}
                </div>
              </div>
            }
            onConfirm={handleConfirmDiagnosticsDraft}
            onCancel={handleCancelDiagnosticsDraft}
            confirmText="CONFIRM"
            cancelText="Cancel"
          />
        </div>
      )}
    </div>
  );
};

export default GameContainer;
          onCancel={() => {
            void handleSendDiagnostics();
          }}
          cancelText={isSendingDiagnostics ? "Sending..." : "Send Logs"}
