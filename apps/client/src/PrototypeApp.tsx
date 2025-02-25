import { useEffect, useRef, useState } from "react";
import { NfcMatchMakerAdapter } from "./adapter/NfcMatchMakerAdapter";
import { MiniViewControlAdapter } from "./adapter/MiniViewControlAdapter";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
window.errorLogs = [];
window.onerror = (err) => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.errorLogs.push(err);
};

const matchMaker = new NfcMatchMakerAdapter();
const miniViewController = new MiniViewControlAdapter();

const PLACE_HOLDER = "12345";

const PrototypeApp = () => {
  // useEffect(() => {
  //   // const checkingHandle = setInterval(() => {
  //   //   if (matchMaker.isInitialized()) {
  //   //     clearInterval(checkingHandle);
  //   //     matchMaker.test();
  //   //   }
  //   // }, 500);
  // }, []);

  const inputElRef = useRef<HTMLInputElement>(null);
  // for nfc logs
  const [logs, setLogs] = useState<string[]>(window.errorLogs);
  const [status, setStatus] = useState<string>("idle");

  useEffect(() => {
    window.setLogs = setLogs as (logs: string[]) => string[];
  }, []);

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
              .testHce(inputElRef.current?.value || PLACE_HOLDER)
              .then((log) => {
                setLogs((logs) => [
                  `[${new Date().toLocaleString()}] ${log}`,
                  ...logs,
                ]);
                matchMaker.testStop();
                setStatus("idle");
              });
          }}
        >
          startHce
        </button>
        <button
          onClick={() => {
            setStatus("read/write");
            matchMaker
              .testReadWrite(inputElRef.current?.value || PLACE_HOLDER)
              .then((log) => {
                setLogs((logs) => [
                  `[${new Date().toLocaleString()}] ${log}`,
                  ...logs,
                ]);
                matchMaker.testStop();
                setStatus("idle");
              });
          }}
        >
          read/write
        </button>
      </div>
      <div style={{ display: "flex", gap: "0.6em" }}>
        <button
          style={{ backgroundColor: "#c6320d" }}
          onClick={() => {
            matchMaker.testStop().then((log) => {
              setLogs((logs) => [
                `[${new Date().toLocaleString()}] ${log}`,
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

      {/* <div style={{ display: "flex", gap: "1em", flexWrap: "wrap" }}>
        <button
          onClick={() => {
            miniViewController.enterMiniViewMode();
          }}
        >
          enter mini view
        </button>
        <button
          onClick={() => {
            miniViewController.exitMiniViewMode();
          }}
        >
          exit mini view
        </button>
      </div> */}
      <div
        style={{
          border: "1px solid green",
          overflowY: "scroll",
          flexGrow: 1,
        }}
      >
        {logs.map((log) => (
          <div>{log}</div>
        ))}
      </div>
    </div>
  );
};

export default PrototypeApp;
