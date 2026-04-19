import { useState } from "react";
import { PlatformAdapter } from "../adapter/PlatformAdapter";

/**
 * 개발 환경 표시 배지 컴포넌트
 * PC 브라우저에서 개발 중임을 표시하고 환경 정보를 제공합니다.
 */
export function DevEnvironmentBadge() {
  const [platformAdapter] = useState(() => new PlatformAdapter());
  const [isExpanded, setIsExpanded] = useState(false);
  const isNativeApp = platformAdapter.isRunningInNativeApp();

  // 네이티브 앱에서 실행 중이면 배지를 표시하지 않음
  if (isNativeApp) {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: "#ff6b6b",
        color: "white",
        padding: "8px 16px",
        fontSize: "14px",
        fontWeight: "bold",
        textAlign: "center",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        cursor: "pointer",
        fontFamily: "system-ui, -apple-system, sans-serif",
        flexShrink: 0,
      }}
      onClick={() => setIsExpanded(!isExpanded)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          setIsExpanded(!isExpanded);
        }
      }}
      role="button"
      tabIndex={0}
      title="Click to view environment details"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        <span>🖥️ PC Dev Mode</span>
        <span style={{ fontSize: "12px", opacity: 0.9 }}>
          {isExpanded ? "▲" : "▼"} click to{" "}
          {isExpanded ? "collapse" : "expand"}
        </span>
      </div>

      {isExpanded && (
        <div
          style={{
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid rgba(255,255,255,0.3)",
            fontSize: "12px",
            fontWeight: "normal",
            textAlign: "left",
            maxWidth: "800px",
            margin: "12px auto 0",
          }}
        >
          <div style={{ marginBottom: "8px" }}>
            <strong>Environment:</strong> Web browser (not a Flutter native app)
          </div>
          <div style={{ marginBottom: "8px" }}>
            <strong>Platform:</strong> {platformAdapter.getPlatformName()}
          </div>
          <div style={{ marginBottom: "8px" }}>
            <strong>User Agent:</strong>
            <div
              style={{
                marginTop: "4px",
                padding: "8px",
                backgroundColor: "rgba(0,0,0,0.2)",
                borderRadius: "4px",
                wordBreak: "break-all",
                fontSize: "11px",
                fontFamily: "monospace",
              }}
            >
              {navigator.userAgent}
            </div>
          </div>
          <div style={{ marginTop: "12px", opacity: 0.8, fontSize: "11px" }}>
            ⚠️ Native-only features such as NFC do not work in this environment.
            <br />
            Use the Flutter app to test native features.
          </div>
        </div>
      )}
    </div>
  );
}
