import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PrototypeApp from "./PrototypeApp";
import "./index.css";
import { AosMiniViewAdapter } from "./adapter/AosMiniViewAdapter.ts";
import { PlatformAdapter } from "./adapter/PlatformAdapter.ts";
import { MiniViewService } from "./application/service/MiniViewService.ts";
import SimpleLogViewer from "../components/SimpleLogViewer/SimpleLogViewer.tsx";
import { LocalStorageGameAdapter } from "./adapter/LocalStorageGameAdapter.ts";
import { GameStorageService } from "./application/service/GameStorageService.ts";

/**
 * Service Getters
 */
export const getMiniViewService = () => {
  if (!miniViewService) {
    throw new Error("MiniViewService가 초기화되지 않았습니다.");
  }
  return miniViewService;
};
export function getPlatformAdapter(): PlatformAdapter {
  return platformAdapter;
}
export function getGameStorageService(): GameStorageService {
  if (!gameStorageService) {
    throw new Error("GameStorageService가 초기화되지 않았습니다.");
  }
  return gameStorageService;
}

// 어댑터 초기화
const platformAdapter = new PlatformAdapter();
const miniViewControlAdapter = new AosMiniViewAdapter();
const localStorageGameAdapter = new LocalStorageGameAdapter();

// 서비스 초기화
const miniViewService = new MiniViewService(miniViewControlAdapter);
const gameStorageService = new GameStorageService(localStorageGameAdapter);

console.log("서비스 초기화 완료");

// 플랫폼 정보 로깅 (User Agent에서 즉시 파싱 가능)
const isAndroid = platformAdapter.isAndroid();
const isIOS = platformAdapter.isIOS();
console.log(
  `현재 플랫폼: ${isAndroid ? "Android" : isIOS ? "iOS" : "알 수 없음"}`
);
console.log(`User Agent: ${navigator.userAgent}`);

document.addEventListener("DOMContentLoaded", () => {
  // NOTE: flutter의 javascript interface 초기화.
  // 페이지 로드 후에 실행되는것이 보장되도록 하기 위해 여기서 초기화 함수 호출.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  // window.__initJavascriptInterfaces.postMessage("");
});

const isNativeFeatureTestMode =
  import.meta.env.NATIVE_FEATURE_TEST_MODE === "true";

console.log(
  `애플리케이션 모드: ${isNativeFeatureTestMode ? "TEST" : "NORMAL"}`
);

// biome-ignore lint/style/noNonNullAssertion: <explanation>
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isNativeFeatureTestMode ? <PrototypeApp /> : <App />}
    <SimpleLogViewer position="top-right" initialOpen={false} />
  </React.StrictMode>
);
