import { useRef, useState } from "react";
import { NfcMatchMakerAdapter } from "./adapter/NfcMatchMakerAdapter";
import { getMiniViewService, getStreamingService } from "./main";

// 타입 에러 제거 - window.errorLogs가 이미 global.d.ts에 정의되어 있음
window.errorLogs = window.errorLogs || [];
window.onerror = (err) => {
  window.errorLogs.push(String(err));
};

// 테스트용. TODO: 초기화 로직을 main.tsx로 이동
const matchMaker = new NfcMatchMakerAdapter();

const PLACE_HOLDER = "12345";

const PrototypeApp = () => {
  const inputElRef = useRef<HTMLInputElement>(null);
  // for nfc logs
  const [logs, setLogs] = useState<string[]>(window.errorLogs);
  const [status, setStatus] = useState<string>("idle");

  return (
    <div
      style={{
        height: "80vh",
        boxSizing: "border-box",
        padding: "1em",
        display: "flex",
        flexDirection: "column",
        gap: "0.6em",
      }}
    >
      <input
        ref={inputElRef}
        placeholder={PLACE_HOLDER}
        style={{
          boxSizing: "border-box",
          width: "100%",
          height: "2em",
          fontSize: "1.4em",
          paddingLeft: "0.4em",
        }}
      />
      <span style={{ fontSize: "1.2em" }}>
        Status:
        <span style={{ marginLeft: "1em", fontWeight: 600 }}>{status}</span>
      </span>
      <div style={{ display: "flex", gap: "1em" }}>
        <button
          onClick={() => {
            setStatus("hce");
            matchMaker
              .receiveMatch({
                testMessage: inputElRef.current?.value || PLACE_HOLDER,
              })
              .then((log) => {
                setLogs((logs) => [
                  `[${new Date().toLocaleString()}] ${JSON.stringify(log)}`,
                  ...logs,
                ]);
                setStatus("idle");
              });
          }}
        >
          receiveMatch
        </button>
        <button
          onClick={() => {
            setStatus("read/write");
            matchMaker
              .proposeMatch({
                testMessage: inputElRef.current?.value || PLACE_HOLDER,
              })
              .then((log) => {
                setLogs((logs) => [
                  `[${new Date().toLocaleString()}] ${JSON.stringify(log)}`,
                  ...logs,
                ]);
                setStatus("idle");
              });
          }}
        >
          propseMatch
        </button>
      </div>
      <div style={{ display: "flex", gap: "0.6em" }}>
        <button
          style={{ backgroundColor: "#c6320d" }}
          onClick={() => {
            matchMaker.cancelMatch().then((log) => {
              setLogs((logs) => [
                `[${new Date().toLocaleString()}] ${JSON.stringify(log)}`,
                ...logs,
              ]);
              setStatus("idle");
            });
          }}
        >
          stop
        </button>
        <button
          style={{ backgroundColor: "#0dc67f" }}
          onClick={() => {
            setLogs([]);
          }}
        >
          clearLogs
        </button>
      </div>

      {/* 미니뷰 모드 관련 버튼들 */}
      <div style={{ marginTop: "1em" }}>
        <h3>Mini View Mode Controls</h3>
        <div style={{ display: "flex", gap: "1em", flexWrap: "wrap" }}>
          <button
            style={{ backgroundColor: "#9c27b0" }}
            onClick={() => {
              setStatus("entering mini view mode");
              const quality = inputElRef.current?.value || "medium";
              getMiniViewService()
                .enterMiniViewMode(quality)
                .then((result: MiniViewServiceResult) => {
                  setLogs((logs) => [
                    `[${new Date().toLocaleString()}] Mini View Mode Started: ${JSON.stringify(
                      result
                    )}`,
                    ...logs,
                  ]);
                  setStatus("in mini view mode");
                })
                .catch((error) => {
                  setLogs((logs) => [
                    `[${new Date().toLocaleString()}] Error: ${JSON.stringify(
                      error
                    )}`,
                    ...logs,
                  ]);
                  setStatus("idle");
                });
            }}
          >
            Enter Mini View Mode
          </button>
          <button
            style={{ backgroundColor: "#ff5722" }}
            onClick={() => {
              setStatus("exiting mini view mode");
              getMiniViewService()
                .exitMiniViewMode()
                .then((result: MiniViewServiceResult) => {
                  setLogs((logs) => [
                    `[${new Date().toLocaleString()}] Mini View Mode Ended: ${JSON.stringify(
                      result
                    )}`,
                    ...logs,
                  ]);
                  setStatus("idle");
                })
                .catch((error) => {
                  setLogs((logs) => [
                    `[${new Date().toLocaleString()}] Error: ${JSON.stringify(
                      error
                    )}`,
                    ...logs,
                  ]);
                  setStatus("idle");
                });
            }}
          >
            Exit Mini View Mode
          </button>
        </div>
      </div>

      {/* Streaming 테스트 버튼들 */}
      <div style={{ marginTop: "1em" }}>
        <h3>Streaming Channel Tests</h3>
        <div style={{ display: "flex", gap: "1em", flexWrap: "wrap" }}>
          <button
            style={{ backgroundColor: "#8a2be2" }}
            onClick={() => {
              setStatus("starting streaming");
              const quality = inputElRef.current?.value || "medium";
              getStreamingService()
                .startStreaming({ quality, fps: 30 })
                .then((result: StreamingServiceResult) => {
                  setLogs((logs) => [
                    `[${new Date().toLocaleString()}] Start Streaming: ${JSON.stringify(
                      result
                    )}`,
                    ...logs,
                  ]);
                  setStatus("idle");
                })
                .catch((error) => {
                  setLogs((logs) => [
                    `[${new Date().toLocaleString()}] Error: ${JSON.stringify(
                      error
                    )}`,
                    ...logs,
                  ]);
                  setStatus("idle");
                });
            }}
          >
            Start Streaming
          </button>
          <button
            style={{ backgroundColor: "#ff6347" }}
            onClick={() => {
              setStatus("stopping streaming");
              getStreamingService()
                .stopStreaming()
                .then((result: StreamingServiceResult) => {
                  setLogs((logs) => [
                    `[${new Date().toLocaleString()}] Stop Streaming: ${JSON.stringify(
                      result
                    )}`,
                    ...logs,
                  ]);
                  setStatus("idle");
                })
                .catch((error) => {
                  setLogs((logs) => [
                    `[${new Date().toLocaleString()}] Error: ${JSON.stringify(
                      error
                    )}`,
                    ...logs,
                  ]);
                  setStatus("idle");
                });
            }}
          >
            Stop Streaming
          </button>
          <button
            style={{ backgroundColor: "#3cb371" }}
            onClick={() => {
              setStatus("capturing webview");
              getStreamingService()
                .captureWebView()
                .then((result: StreamingServiceResult) => {
                  setLogs((logs) => [
                    `[${new Date().toLocaleString()}] Capture WebView: ${JSON.stringify(
                      result
                    )}`,
                    ...logs,
                  ]);
                  setStatus("idle");
                })
                .catch((error) => {
                  setLogs((logs) => [
                    `[${new Date().toLocaleString()}] Error: ${JSON.stringify(
                      error
                    )}`,
                    ...logs,
                  ]);
                  setStatus("idle");
                });
            }}
          >
            Capture WebView
          </button>
          <button
            style={{ backgroundColor: "#4682b4" }}
            onClick={() => {
              setStatus("checking status");
              getStreamingService()
                .getStreamingStatus()
                .then((result: StreamingServiceResult) => {
                  setLogs((logs) => [
                    `[${new Date().toLocaleString()}] Streaming Status: ${JSON.stringify(
                      result
                    )}`,
                    ...logs,
                  ]);
                  setStatus("idle");
                })
                .catch((error) => {
                  setLogs((logs) => [
                    `[${new Date().toLocaleString()}] Error: ${JSON.stringify(
                      error
                    )}`,
                    ...logs,
                  ]);
                  setStatus("idle");
                });
            }}
          >
            Get Status
          </button>
        </div>
      </div>

      <div
        style={{
          border: "1px solid green",
          overflowY: "scroll",
          flexGrow: 1,
        }}
      >
        {logs.map((log, index) => (
          <div key={index}>{log}</div>
        ))}
      </div>
    </div>
  );
};

export default PrototypeApp;
