import React from "react";
import ReactDOM from "react-dom/client";
import { hasNativeStorageController } from "@shared/storage";
import App from "./App";
import "./index.css";
import { PlatformAdapter } from "./adapter/PlatformAdapter.ts";
import {
  initializeDiagnosticsLogger,
  installDiagnosticsConsoleCapture,
  setDiagnosticsContextProvider,
} from "./diagnostics/diagnosticLogger";

export function getPlatformAdapter(): PlatformAdapter {
  return platformAdapter;
}

// 어댑터 초기화
const platformAdapter = new PlatformAdapter();
const isNativeFeatureDebugMode =
  import.meta.env.NATIVE_FEATURE_DEBUG_MODE === "true";

installDiagnosticsConsoleCapture();
setDiagnosticsContextProvider(() => ({
  appMode: import.meta.env.MODE,
  appVersion: __APP_VERSION__,
  buildNumber: __APP_BUILD_NUMBER__,
  debugEnabled: isNativeFeatureDebugMode,
}));

// 서비스 초기화

document.addEventListener("DOMContentLoaded", () => {
  // NOTE: flutter의 javascript interface 초기화.
  // 페이지 로드 후에 실행되는것이 보장되도록 하기 위해 여기서 초기화 함수 호출.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  // window.__initJavascriptInterfaces.postMessage("");
});

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

async function waitForNativeStorageController(
  timeoutMilliseconds = 4000,
): Promise<void> {
  if (!platformAdapter.isRunningInNativeApp()) {
    return;
  }

  const startedAt = Date.now();

  while (!hasNativeStorageController()) {
    if (Date.now() - startedAt >= timeoutMilliseconds) {
      console.warn(
        "[bootstrap] Native storage bridge did not become ready before timeout",
      );
      return;
    }

    await sleep(50);
  }

  console.log("[bootstrap] Native storage bridge is ready");

  return;
}

async function bootstrap(): Promise<void> {
  await waitForNativeStorageController();
  await initializeDiagnosticsLogger();

  const rootElement = document.getElementById("root");

  if (!rootElement) {
    throw new Error("Root element not found");
  }

  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <>
      <App />
    </>,
  );
}

void bootstrap();
