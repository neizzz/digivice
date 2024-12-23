import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// import App from "./App.tsx";
import PrototypeApp from "./PrototypeApp.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PrototypeApp />
    {/* <App /> */}
  </StrictMode>
);
