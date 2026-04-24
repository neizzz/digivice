import {
  type ControlButtonParams,
  ControlButtonType,
  Game,
  type GameDiagnosticsSnapshot,
  SceneKey,
} from "@digivice/game";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
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

type SceneTransitionLoadState = {
  requestId: number;
  phase: "idle" | "loading" | "core_ready";
  from?: SceneKey;
  to?: SceneKey;
};

type FullscreenAdEventDetail = {
  state?: "showing" | "dismissed" | "failed";
};

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

function getIsLandscapeViewport(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

  return viewportWidth > viewportHeight;
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
    entityCount: Array.isArray(record.entities) ? record.entities.length : "n/a",
    worldVersion: record.world_metadata?.version,
    useLocalTime: record.world_metadata?.app_state?.use_local_time,
  };
}

function createDiagnosticsSubject(timestamp: string): string {
  return `[MonTTo] Diagnostics Report ${timestamp}`;
}

function createDiagnosticsBody(): string {
  return [
    "Please describe the issue or symptoms you observed.",
    "",
    "- What happened?",
    "- When did it happen?",
    "- What did you expect to happen?",
    "- How can it be reproduced?",
  ].join("\n");
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
): Promise<"gmail_app" | "external_browser" | "browser_window" | "same_window"> {
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
  const [gameInstance, setGameInstance] = useState<Game | null>(null);
  const [gameContainerSize, setGameContainerSize] = useState<number | null>(
    null,
  );
  const [showLandscapeOverlay, setShowLandscapeOverlay] = useState<boolean>(
    () => isAndroidUserAgent && getIsLandscapeViewport(),
  );
  const [showSetupLayer, setShowSetupLayer] = useState<boolean>(false);
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(true);
  const { alertState, showAlert, hideAlert } = useAlert();
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
  const [showSettingMenu, setShowSettingMenu] = useState(false);
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
  const lastValidationResultRef = useRef<SanitizeStoredWorldDataResult | null>(
    null,
  );
  const isFullscreenAdLayoutFrozenRef = useRef(false);
  const fullscreenAdLayoutReleaseTimeoutRef = useRef<number | null>(null);
  const fullscreenAdLayoutReleaseRafRef = useRef<number | null>(null);

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
    setShowSettingMenu(false);
  }, [clearPendingSettingMenuOpen]);

  useEffect(() => {
    return () => {
      clearPendingSettingMenuOpen();
    };
  }, [clearPendingSettingMenuOpen]);

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
        sceneTransitionRequestIdRef.current = 0;
        setSceneTransitionLoadState({
          requestId: 0,
          phase: "idle",
        });
        setIsBootstrapping(false);
        return;
      }

      setSceneTransitionLoadState((previous) =>
        previous.requestId === params.requestId
          ? { ...previous, phase: "core_ready" }
          : previous,
      );
    },
    [],
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

    const nextSize = Math.max(
      0,
      Math.floor(
        Math.min(viewportElement.clientWidth, viewportElement.clientHeight),
      ),
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
          fullscreenAdLayoutReleaseRafRef.current = window.requestAnimationFrame(
            () => {
              isFullscreenAdLayoutFrozenRef.current = false;
              setFrozenAppShellHeight(null);
              updateGameContainerSize(true);
            },
          );
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
      const timestampSuffix = payload.generatedAt
        .replace(/\.\d{3}Z$/, "Z")
        .replace(/[:]/g, "-");
      setPendingDiagnosticsDraft({
        subject,
        body,
        attachments: [
          {
            fileName: `montto-diagnostics-${timestampSuffix}.json`,
            text: payloadText,
            mimeType: "application/json",
          },
          {
            fileName: `montto-latest-game-data-${timestampSuffix}.json`,
            text: JSON.stringify(latestGameData, null, 2),
            mimeType: "application/json",
          },
          {
            fileName: `montto-important-logs-${timestampSuffix}.json`,
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
      console.error("[GameContainer] Failed to prepare diagnostics payload", error);
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
    setPendingDiagnosticsDraft(null);
  }, []);

  const handleConfirmDiagnosticsDraft = useCallback(async () => {
    if (!pendingDiagnosticsDraft) {
      return;
    }

    try {
      const openRoute = await openMailDraft(
        pendingDiagnosticsDraft.subject,
        pendingDiagnosticsDraft.body,
        pendingDiagnosticsDraft.attachments,
      );

      if (openRoute !== "gmail_app") {
        showAlert(
          "The mail compose screen was opened outside the app. File attachment support is only guaranteed when the Gmail app opens directly.",
          "Notice",
        );
      }
    } catch (error) {
      console.error("[GameContainer] Failed to open diagnostics draft", error);
      showAlert(
        "Failed to open the Gmail draft. Please make sure Gmail is installed.",
        "Error",
      );
    } finally {
      setPendingDiagnosticsDraft(null);
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
        setShowSettingMenu(false);
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

  const requestInitialGameData =
    useCallback(async (): Promise<SetupFormData> => {
      if (initialSetupDataRef.current) {
        return initialSetupDataRef.current;
      }

      setIsBootstrapping(false);
      setShowSetupLayer(true);

      return new Promise((resolve) => {
        pendingSetupResolverRef.current = (formData: SetupFormData) => {
          initialSetupDataRef.current = formData;
          setShowSetupLayer(false);
          pendingSetupResolverRef.current = null;
          resolve(formData);
        };
      });
    }, []);

  const initializeGame = useCallback(() => {
    if (!gameContainerRef.current) return;
    if (!gameContainerSize || gameContainerSize <= 0) return;
    if (isInitializedRef.current) return;

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
                  controlButtonParams[index].sliderSessionKey,
            )
          ) {
            return previous;
          }

          return controlButtonParams;
        });
      },
    });

    setTimeout(() => {
      game.initialize().then(() => {
        isInitializedRef.current = true;
        setGameInstance(game);
      });
    });
  }, [
    gameContainerSize,
    handleSceneTransitionStateChange,
    openSettingMenu,
    requestInitialGameData,
    startRecoveryVibration,
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

    return () => {
      resizeObserver.disconnect();
    };
  }, [updateGameContainerSize]);

  useEffect(() => {
    if (!isAndroidUserAgent) {
      return;
    }

    const updateLandscapeOverlay = () => {
      setShowLandscapeOverlay(getIsLandscapeViewport());
    };

    updateLandscapeOverlay();

    window.addEventListener("resize", updateLandscapeOverlay);
    window.addEventListener("orientationchange", updateLandscapeOverlay);
    window.visualViewport?.addEventListener("resize", updateLandscapeOverlay);

    return () => {
      window.removeEventListener("resize", updateLandscapeOverlay);
      window.removeEventListener(
        "orientationchange",
        updateLandscapeOverlay,
      );
      window.visualViewport?.removeEventListener(
        "resize",
        updateLandscapeOverlay,
      );
    };
  }, []);

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

        console.warn("[GameContainer] Failed to preload mini game assets", error);
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
  const handleSetupComplete = useCallback((formData: SetupFormData) => {
    const pendingResolver = pendingSetupResolverRef.current;

    if (pendingResolver) {
      pendingResolver(formData);
      return;
    }

    initialSetupDataRef.current = formData;
    setShowSetupLayer(false);

    if (shouldRestartFromSetupRef.current) {
      shouldRestartFromSetupRef.current = false;
      setGameSessionKey((previous) => previous + 1);
    }
  }, []);

  const isLoading =
    isBootstrapping ||
    sceneTransitionLoadState.phase === "loading" ||
    sceneTransitionLoadState.phase === "core_ready";

  return (
    <div className={"relative h-full w-full min-h-0"}>
      <>
        <div
          ref={gameViewportRef}
          className={"flex h-full min-h-0 min-w-0 items-center justify-center overflow-hidden"}
        >
          <div
            id="game-container"
            ref={gameContainerRef}
            className={"relative m-0 shrink-0 -translate-y-16 p-0"}
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

        {buttonParams && (
          <div className={"absolute inset-x-0 bottom-32 z-10 w-full"}>
            <ControlButtons
              buttonParams={buttonParams}
              onButtonPress={handleButtonPress}
              onSliderChange={handleSliderChange}
              onSliderEnd={handleSliderEnd}
            />
          </div>
        )}
      </>
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black text-white">
          <div className="text-center text-lg tracking-[0.12em]">Loading...</div>
        </div>
      )}
      {showLandscapeOverlay && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black text-white">
          <div className="px-6 text-center">
            <div className="text-lg tracking-[0.12em]">Portrait Only</div>
            <div className="mt-6 text-[10px] leading-6 tracking-[0.12em]">
              Please rotate your device
              <br />
              back to portrait mode.
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
          onResetGameData={handleResetGameData}
          onClose={closeSettingMenu}
        />
      )}
      {alertState && (
        <AlertLayer
          title={alertState.title}
          message={alertState.message}
          onClose={hideAlert}
        />
      )}
      {sanitizeResetAlert && (
        <AlertLayer
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
