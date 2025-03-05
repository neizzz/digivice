import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PrototypeApp from "./PrototypeApp";
import "./index.css";
import { AosMiniViewAdapter } from "./adapter/AosMiniViewAdapter.ts";
import { PlatformAdapter } from "./adapter/PlatformAdapter.ts";
import { MiniViewService } from "./application/service/MiniViewService.ts";

// 미니뷰 서비스 등 기존 코드
export const getMiniViewService = () => {
  if (!miniViewService) {
    throw new Error("MiniViewService가 초기화되지 않았습니다.");
  }
  return miniViewService;
};

export function getPlatformAdapter(): PlatformAdapter {
  return platformAdapter;
}

// 어댑터 초기화
const platformAdapter = new PlatformAdapter();
const miniViewControlAdapter = new AosMiniViewAdapter();

const miniViewService = new MiniViewService(miniViewControlAdapter);

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

// 환경변수를 사용하여 테스트 모드 확인
const isTestMode = import.meta.env.NATIVE_FEATURE_TEST_MODE === "true";
console.log(`애플리케이션 모드: ${isTestMode ? "TEST" : "NORMAL"}`);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* 개발 모드에서는 테스트 모드면 PrototypeApp을, 아니면 App을 사용 */}
    {isTestMode ? <PrototypeApp /> : <App />}
  </React.StrictMode>
);
