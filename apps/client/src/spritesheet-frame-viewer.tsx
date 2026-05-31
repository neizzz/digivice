import ReactDOM from "react-dom/client";
import "./index.css";
import TopLeftBuildLogoText from "./components/TopLeftBuildLogoText";
import SpritesheetFrameViewerPage from "./pages/SpritesheetFrameViewerPage";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <>
    <TopLeftBuildLogoText />
    <SpritesheetFrameViewerPage />
  </>,
);
