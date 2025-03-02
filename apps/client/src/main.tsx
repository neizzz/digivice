import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import PrototypeApp from "./PrototypeApp.tsx";
import { MiniViewControlAdapter } from "./adapter/MiniViewControlAdapter";
import { StreamingChannelAdapter } from "./adapter/StreamingChannelAdapter";
import { MiniViewService } from "./services/MiniViewService";
import { StreamingService } from "./services/StreamingService";

// 서비스 접근 함수들
export function getMiniViewService(): MiniViewService {
  if (!miniViewService) {
    throw new Error("MiniViewService가 초기화되지 않았습니다.");
  }
  return miniViewService;
}

export function getStreamingService(): StreamingService {
  if (!streamingService) {
    throw new Error("StreamingService가 초기화되지 않았습니다.");
  }
  return streamingService;
}

// 어댑터 초기화
const miniViewControlAdapter = new MiniViewControlAdapter();
const streamingChannelAdapter = new StreamingChannelAdapter();

// 서비스 초기화
const streamingService = new StreamingService(
  miniViewControlAdapter,
  streamingChannelAdapter
);
const miniViewService = new MiniViewService(
  miniViewControlAdapter,
  streamingService
);

console.log("서비스 초기화 완료");

document.addEventListener("DOMContentLoaded", () => {
  // NOTE: flutter의 javascript interface 초기화.
  // 페이지 로드 후에 실행되는것이 보장되도록 하기 위해 여기서 초기화 함수 호출.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.__initJavascriptInterfaces.postMessage("");
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PrototypeApp />
  </StrictMode>
);
