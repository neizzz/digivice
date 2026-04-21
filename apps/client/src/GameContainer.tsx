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
  setDiagnosticsContextProvider,
} from "./diagnostics/diagnosticLogger";
import {
  createClientStorage,
  getClientStorageKind,
} from "./utils/clientStorage";

const WORLD_DATA_STORAGE_KEY = "MainSceneWorldData";
const biteVibrationAdapter = new VibrationAdapter();
const RECOVERY_VIBRATION_INTERVAL_MS = 180;
const RECOVERY_VIBRATION_DURATION_MS = 14;
const RECOVERY_VIBRATION_STRENGTH = 28;
const isNativeFeatureDebugMode =
  import.meta.env.NATIVE_FEATURE_DEBUG_MODE === "true";

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
  currentGameData: GameDiagnosticsSnapshot["mainSceneData"];
  storedGameData: unknown | null;
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

type MainSceneLoadState = {
  requestId: number;
  phase: "idle" | "loading" | "core_ready";
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

function createDiagnosticsSummaryText(
  payload: DiagnosticsPayload,
): string {
  const lines = [
    "MonTTo diagnostics summary",
    "",
    `Generated at: ${payload.generatedAt}`,
    `App version: ${payload.appInfo.clientAppVersion}`,
    `World data version: ${payload.summary.worldVersion ?? "unknown"}`,
    `Scene: ${payload.appInfo.currentSceneKey}`,
    `Monster name: ${payload.summary.monsterName ?? "unknown"}`,
    `Entity count: ${payload.summary.entityCount}`,
    `Storage kind: ${payload.appInfo.storageKind}`,
    `Mode: ${payload.appInfo.appMode}`,
    `Debug enabled: ${payload.appInfo.debugEnabled ? "yes" : "no"}`,
    `Use local time: ${payload.summary.useLocalTime ? "yes" : "no"}`,
    `Diagnostics logs: ${payload.appInfo.logger.entryCount}`,
    `Diagnostics session: ${payload.appInfo.logger.sessionId}`,
  ];

  return lines.join("\n");
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
  const [mainSceneLoadState, setMainSceneLoadState] =
    useState<MainSceneLoadState>({
      requestId: 0,
      phase: "idle",
    });
  const mainSceneLoadRequestIdRef = useRef(0);
  const recoveryVibrationIntervalRef = useRef<number | null>(null);

  const openSettingMenu = useCallback(() => {
    setShowSettingMenu(true);
  }, []);

  const closeSettingMenu = useCallback(() => {
    setShowSettingMenu(false);
  }, []);

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

  const handleMainSceneLoadingStateChange = useCallback(
    (params: { key: SceneKey; state: "loading" | "core_ready" }) => {
      if (params.key !== SceneKey.MAIN) {
        return;
      }

      if (params.state === "loading") {
        const requestId = mainSceneLoadRequestIdRef.current + 1;
        mainSceneLoadRequestIdRef.current = requestId;
        setMainSceneLoadState({ requestId, phase: "loading" });
        setButtonParams(null);
        return;
      }

      const requestId = mainSceneLoadRequestIdRef.current;
      if (requestId <= 0) {
        return;
      }

      setMainSceneLoadState((previous) =>
        previous.requestId === requestId
          ? { ...previous, phase: "core_ready" }
          : previous,
      );
    },
    [],
  );

  const completeMainSceneLoading = useCallback((requestId: number) => {
    if (mainSceneLoadRequestIdRef.current !== requestId) {
      return;
    }

    mainSceneLoadRequestIdRef.current = 0;
    setMainSceneLoadState({ requestId: 0, phase: "idle" });
    setIsBootstrapping(false);
  }, []);

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
    if (mainSceneLoadState.phase !== "core_ready") {
      return;
    }

    if (!buttonParams || !gameInstance) {
      return;
    }

    const requestId = mainSceneLoadState.requestId;
    let cancelled = false;

    const finalizeMainSceneLoading = async () => {
      await waitForLayoutStabilization();

      if (cancelled) {
        return;
      }

      completeMainSceneLoading(requestId);
    };

    void finalizeMainSceneLoading();

    return () => {
      cancelled = true;
    };
  }, [buttonParams, completeMainSceneLoading, gameInstance, mainSceneLoadState]);

  useEffect(() => {
    if (mainSceneLoadState.phase !== "core_ready") {
      return;
    }

    if (buttonParams || !gameInstance) {
      return;
    }

    const requestId = mainSceneLoadState.requestId;
    let cancelled = false;

    const finalizeMainSceneLoadingWithFallback = async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 500));

      if (cancelled) {
        return;
      }

      await waitForLayoutStabilization();

      if (cancelled) {
        return;
      }

      completeMainSceneLoading(requestId);
    };

    void finalizeMainSceneLoadingWithFallback();

    return () => {
      cancelled = true;
    };
  }, [buttonParams, completeMainSceneLoading, gameInstance, mainSceneLoadState]);

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
        currentGameData,
        storedGameData,
      };

      const payloadText = JSON.stringify(payload, null, 2);
      const subject = createDiagnosticsSubject(payload.generatedAt);
      const body = createDiagnosticsBody();
      const timestampSuffix = payload.generatedAt
        .replace(/\.\d{3}Z$/, "Z")
        .replace(/[:]/g, "-");
      const summaryText = createDiagnosticsSummaryText(payload);
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
            fileName: `montto-diagnostics-summary-${timestampSuffix}.txt`,
            text: summaryText,
            mimeType: "text/plain",
          },
        ],
      });
    } catch (error) {
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
        mainSceneLoadRequestIdRef.current = 0;
        setMainSceneLoadState({ requestId: 0, phase: "idle" });
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
      console.debug("[GameContainer] prepareSavedGameData:start", {
        key: WORLD_DATA_STORAGE_KEY,
        storageKind,
      });
      const savedData = await storage.getData(WORLD_DATA_STORAGE_KEY);
      console.debug("[GameContainer] prepareSavedGameData:loaded", {
        key: WORLD_DATA_STORAGE_KEY,
        storageKind,
        ...summarizeSavedData(savedData),
      });
      const result = sanitizeStoredWorldData(savedData);
      console.debug("[GameContainer] prepareSavedGameData:sanitized", {
        key: WORLD_DATA_STORAGE_KEY,
        storageKind,
        action: result.action,
        changed: result.changed,
        hasSanitizedData: !!result.sanitizedData,
      });

      if (
        result.changed &&
        result.sanitizedData &&
        result.action !== "reset_required"
      ) {
        await storage.setData(WORLD_DATA_STORAGE_KEY, result.sanitizedData);
        console.warn(
          "[GameContainer] Saved data was repaired and written back.",
          result.sanitizedData,
        );
      }

      if (result.action === "reset_required") {
        console.warn(
          "[GameContainer] Saved data is corrupted and needs to be reset.",
          result.sanitizedData,
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
      showSettings: () => {
        openSettingMenu();
      },
      triggerBiteVibration: () => {
        void biteVibrationAdapter.vibrate();
      },
      startRecoveryVibration,
      stopRecoveryVibration,
      onSceneLoadingStateChange: handleMainSceneLoadingStateChange,
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
    handleMainSceneLoadingStateChange,
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

    const updateGameContainerSize = () => {
      const nextSize = Math.max(
        0,
        Math.floor(
          Math.min(viewportElement.clientWidth, viewportElement.clientHeight),
        ),
      );

      setGameContainerSize((previous) =>
        previous === nextSize ? previous : nextSize,
      );
    };

    updateGameContainerSize();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateGameContainerSize);
      return () => {
        window.removeEventListener("resize", updateGameContainerSize);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      updateGameContainerSize();
    });
    resizeObserver.observe(viewportElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

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
    isBootstrapping || mainSceneLoadState.phase === "loading" || mainSceneLoadState.phase === "core_ready";

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
