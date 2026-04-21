import { useEffect, useRef } from "react";
import "./App.css";
import GameContainer from "./GameContainer";
import { DevEnvironmentBadge } from "./components/DevEnvironmentBadge";
import TopLeftBuildLogoText from "./components/TopLeftBuildLogoText";
import { AdManager } from "./ad/AdManager";
import { AppReenterPolicy } from "./ad/policies/AppReenterPolicy";
import { UrgentRecoveryPolicy } from "./ad/policies/UrgentRecoveryPolicy";
import SimpleLogViewer from "../components/SimpleLogViewer/SimpleLogViewer";

// AdManager 글로벌 인스턴스
let adManager: AdManager | null = null;

// 글로벌로 노출 (디버그용)
declare global {
  interface Window {
    adManager?: AdManager;
    onUrgentRecovery?: () => void;
  }
}

const LAST_ACTIVE_KEY = "app_last_active_timestamp";

const App = () => {
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    // AdManager 초기화
    adManager = new AdManager();
    adManager.addPolicy(new AppReenterPolicy());
    adManager.addPolicy(new UrgentRecoveryPolicy());
    window.adManager = adManager;

    console.log("[App] AdManager initialized with policies:", [
      "AppReenterPolicy",
      "UrgentRecoveryPolicy",
    ]);

    // 재진입 감지
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleAppReenter();
      } else if (document.visibilityState === "hidden") {
        updateLastActiveTime();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // URGENT 회복 이벤트 핸들러
    window.onUrgentRecovery = () => {
      console.log("[App] Character recovered from URGENT state");

      adManager?.requestAd("urgent_recovery", {
        isCharacterUrgent: false,
        metadata: {
          trigger: "urgent_recovery",
          timestamp: Date.now(),
        },
      });
    };

    // 초기 활성 시간 기록
    updateLastActiveTime();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.onUrgentRecovery = undefined;
    };
  }, []);

  const handleAppReenter = () => {
    console.log("[App] App reenter detected");

    // 게임에서 캐릭터 위급 상태 가져오기
    // TODO: GameStateProvider를 실제 게임 상태와 연결
    const isUrgent = false; // GameStateProvider.isCharacterUrgent();

    // 광고 요청
    if (adManager) {
      adManager.requestAd("app_reenter", {
        isCharacterUrgent: isUrgent,
        metadata: {
          timestamp: Date.now(),
        },
      });
    }
  };

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
