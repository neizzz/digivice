import { useEffect, useRef } from "react";
import "./App.css";
import GameContainer from "./GameContainer";
import { DevEnvironmentBadge } from "./components/DevEnvironmentBadge";
import TopLeftBuildLogoText from "./components/TopLeftBuildLogoText";
import { AdManager } from "./ad/AdManager";
import { MainSceneMenuPolicy } from "./ad/policies/MainSceneMenuPolicy";
import SimpleLogViewer from "../components/SimpleLogViewer/SimpleLogViewer";

// AdManager 글로벌 인스턴스
let adManager: AdManager | null = null;

// 글로벌로 노출 (디버그용)
declare global {
  interface Window {
    adManager?: AdManager;
  }
}

const LAST_ACTIVE_KEY = "app_last_active_timestamp";
const FULLSCREEN_AD_REENTER_SUPPRESS_MS = 1200;

type FullscreenAdEventDetail = {
  state?: "showing" | "dismissed" | "failed";
};

const App = () => {
  const isInitialized = useRef(false);
  const isFullscreenAdActiveRef = useRef(false);
  const suppressAppReenterUntilRef = useRef(0);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    // AdManager 초기화
    adManager = new AdManager();
    adManager.addPolicy(new MainSceneMenuPolicy());
    window.adManager = adManager;
    window.digiviceAdBridge = {
      requestMainSceneMenuAd: (request) => {
        console.log("[App] MainScene menu ad requested", request);

        return (
          adManager?.requestAd("main_scene_menu", {
            isCharacterUrgent: false,
            metadata: {
              ...request,
              trigger: "main_scene_menu",
              timestamp: Date.now(),
            },
          }) ?? Promise.resolve(false)
        );
      },
    };

    // visibility 기반 활성 시간 동기화
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (
          isFullscreenAdActiveRef.current ||
          Date.now() < suppressAppReenterUntilRef.current
        ) {
          updateLastActiveTime();
          return;
        }

        updateLastActiveTime();
      } else if (document.visibilityState === "hidden") {
        updateLastActiveTime();
      }
    };

    const handleFullscreenAdState = (event: Event) => {
      const detail = (event as CustomEvent<FullscreenAdEventDetail>).detail;
      const state = detail?.state;

      if (state === "showing") {
        isFullscreenAdActiveRef.current = true;
        return;
      }

      if (state === "dismissed" || state === "failed") {
        isFullscreenAdActiveRef.current = false;
        suppressAppReenterUntilRef.current =
          Date.now() + FULLSCREEN_AD_REENTER_SUPPRESS_MS;
        updateLastActiveTime();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener(
      "digivice:fullscreen-ad",
      handleFullscreenAdState as EventListener,
    );

    // 초기 활성 시간 기록
    updateLastActiveTime();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener(
        "digivice:fullscreen-ad",
        handleFullscreenAdState as EventListener,
      );
      window.digiviceAdBridge = undefined;
    };
  }, []);

  const updateLastActiveTime = () => {
    const now = Date.now();
    localStorage.setItem(LAST_ACTIVE_KEY, now.toString());
  };

  return (
    <div id="app-shell">
      <TopLeftBuildLogoText />
      <DevEnvironmentBadge />
      <div id="app-container">
        <GameContainer />
        <SimpleLogViewer position="top-right" initialOpen={false} />
      </div>
    </div>
  );
};

export default App;
