import { useEffect, useState } from "react";
import { NfcMatchMakerAdapter } from "./adapter/NfcMatchMakerAdapter";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
window.errorLogs = [];
window.onerror = (err) => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.errorLogs.push(err);
};

const matchMaker = new NfcMatchMakerAdapter();

const PrototypeApp = () => {
  // useEffect(() => {
  //   // const checkingHandle = setInterval(() => {
  //   //   if (matchMaker.isInitialized()) {
  //   //     clearInterval(checkingHandle);
  //   //     matchMaker.test();
  //   //   }
  //   // }, 500);
  // }, []);

  const [logs, setLogs] = useState<string[]>(window.errorLogs);

  useEffect(() => {
    window.setLogs = setLogs as (logs: string[]) => string[];
  }, []);

  return (
    <div>
      <div>PrototypeApp</div>
      <span>
        <button
          onClick={() => {
            matchMaker
              .testWrite()
              .then((log) => setLogs((logs) => [...logs, log]));
          }}
        >
          testWrite
        </button>
        <button
          style={{
            marginLeft: "1em",
          }}
          onClick={() => {
            matchMaker
              .testRead()
              .then((log) => setLogs((logs) => [...logs, log]));
          }}
        >
          testRead
        </button>
      </span>

      <div
        style={{
          marginTop: "1em",
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
