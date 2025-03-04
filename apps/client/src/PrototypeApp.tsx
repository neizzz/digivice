import { useRef, useState } from "react";
import { NfcMatchMakerAdapter } from "./adapter/NfcMatchMakerAdapter";
import { getMiniViewService } from "./main";

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
                .then((result: unknown) => {
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
                .then((result: unknown) => {
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
