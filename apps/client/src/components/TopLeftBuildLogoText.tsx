import type { KeyboardEvent } from "react";
import { SHOW_DEBUG_GAUGE_EVENT } from "@digivice/game/debugEvents";
import "./TopLeftBuildLogoText.css";

const buildLogoText = __APP_LOGO_TEXT__.trim();

function toggleDebugGauge(): void {
  window.dispatchEvent(new CustomEvent(SHOW_DEBUG_GAUGE_EVENT));
}

export default function TopLeftBuildLogoText() {
  if (!buildLogoText) {
    return null;
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    toggleDebugGauge();
  };

  return (
    <div
      className="build-logo-text"
      role="button"
      tabIndex={0}
      onClick={toggleDebugGauge}
      onKeyDown={handleKeyDown}
    >
      {buildLogoText}
    </div>
  );
}
