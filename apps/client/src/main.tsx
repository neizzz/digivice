import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// import App from "./App.tsx";
import PrototypeApp from "./PrototypeApp.tsx";

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
    {/* <App /> */}
  </StrictMode>
);
