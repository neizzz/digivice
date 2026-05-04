import type React from "react";
import { useMemo, useState } from "react";
import PopupLayer from "../components/PopupLayer";

interface SettingMenuLayerProps {
  releaseLabel: string;
  vibrationEnabled: boolean;
  onChangeVibration: (enabled: boolean) => void;
  onSendDiagnostics: () => void;
  isSendingDiagnostics: boolean;
  showFinalResetConfirm: boolean;
  onOpenResetConfirm: () => void;
  onCloseResetConfirm: () => void;
  onResetGameData: () => void;
  onClose: () => void;
}

type OpenSourceNoticeItem = {
  name: string;
  version: string;
  license: string;
};

type OpenSourceNoticeSection = {
  title: string;
  items: readonly OpenSourceNoticeItem[];
};

const OPEN_SOURCE_NOTICE_SECTIONS: readonly OpenSourceNoticeSection[] = [
  {
    title: "Web App",
    items: [
      { name: "react", version: "19.1.0", license: "MIT" },
      { name: "react-dom", version: "19.1.0", license: "MIT" },
      { name: "tailwindcss", version: "4.1.3", license: "MIT" },
      { name: "uuid", version: "11.1.0", license: "MIT" },
    ],
  },
  {
    title: "Game Runtime",
    items: [
      { name: "pixi.js", version: "8.11.0", license: "MIT" },
      {
        name: "@pixi/filter-color-matrix",
        version: "7.4.3",
        license: "MIT",
      },
      { name: "@pixi/gif", version: "3.0.1", license: "MIT" },
      { name: "matter-js", version: "0.20.0", license: "MIT" },
      { name: "bitecs", version: "0.3.40", license: "MPL-2.0" },
      { name: "gif-frames", version: "1.0.1", license: "MIT" },
      { name: "lodash.throttle", version: "4.1.1", license: "MIT" },
    ],
  },
  {
    title: "Native Shell",
    items: [
      { name: "nfc_manager", version: "4.2.1", license: "MIT" },
      {
        name: "webview_flutter",
        version: "4.0.0",
        license: "BSD-3-Clause",
      },
      {
        name: "webview_flutter_android",
        version: "4.3.2",
        license: "BSD-3-Clause",
      },
      {
        name: "path_provider",
        version: "2.0.15",
        license: "BSD-3-Clause",
      },
      {
        name: "android_intent_plus",
        version: "5.2.1",
        license: "BSD-3-Clause",
      },
      { name: "flutter_nfc_hce", version: "0.1.8", license: "MIT" },
      {
        name: "google_mobile_ads",
        version: "5.2.0",
        license: "Apache-2.0",
      },
      {
        name: "shared_preferences",
        version: "2.3.4",
        license: "BSD-3-Clause",
      },
      { name: "vibration", version: "3.1.8", license: "BSD-2-Clause" },
      { name: "geolocator", version: "13.0.2", license: "MIT" },
      { name: "in_app_update", version: "4.2.5", license: "MIT" },
    ],
  },
];

const FONT_NOTICE = {
  name: "Neo둥근모 Pro",
  lines: [
    "Copyright © 2017-2024, Eunbin Jeong (Dalgona.) <project-neodgm@dalgona.dev>",
    'with reserved font name "Neo둥근모 Pro" and "NeoDunggeunmo Pro".',
  ] as const,
};

const ToggleButton: React.FC<{
  enabled: boolean;
  onClick: () => void;
}> = ({ enabled, onClick }) => {
  return (
    <button
      type={"button"}
      onClick={onClick}
      className={`min-w-20 border-2 border-[#222] px-4 py-0.5 font-bold text-white ${
        enabled ? "bg-component-positive" : "bg-gray-400"
      }`}
    >
      {enabled ? "ON" : "OFF"}
    </button>
  );
};

const ActionButton: React.FC<{
  text: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "positive" | "warning" | "negative";
}> = ({ text, onClick, disabled = false, variant = "positive" }) => {
  const backgroundClass = disabled
    ? "cursor-wait bg-gray-400 opacity-60"
    : variant === "warning"
      ? "bg-yellow-500"
      : variant === "negative"
        ? "bg-component-negative"
        : "bg-component-positive";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-w-20 items-center justify-center border-2 border-[#222] px-4 py-0.5 text-center font-bold text-white ${backgroundClass}`}
    >
      {text}
    </button>
  );
};

const SettingMenuLayer: React.FC<SettingMenuLayerProps> = ({
  releaseLabel,
  vibrationEnabled,
  onChangeVibration,
  onSendDiagnostics,
  isSendingDiagnostics,
  showFinalResetConfirm,
  onOpenResetConfirm,
  onCloseResetConfirm,
  onResetGameData,
  onClose,
}) => {
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [showOpenSourceNotice, setShowOpenSourceNotice] = useState(false);

  const isResetEnabled = useMemo(
    () => resetConfirmText.trim() === "confirm",
    [resetConfirmText],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <PopupLayer
        title="Settings"
        suppressInitialActionsMs={180}
        topLeftContent={
          <div className="text-[10px] leading-none text-gray-500">
            {releaseLabel}
          </div>
        }
        content={
          <div className="flex flex-col gap-5 text-left text-[1.5rem]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-bold">Vibration</div>
              </div>
              <ToggleButton
                enabled={vibrationEnabled}
                onClick={() => onChangeVibration(!vibrationEnabled)}
              />
            </div>

            <div className="border-t-2 border-[#222] pt-4">
              <div className="flex items-center justify-between gap-4">
                <div className="font-bold">Report Bug</div>
                <ActionButton
                  text="Send"
                  onClick={onSendDiagnostics}
                  disabled={isSendingDiagnostics}
                  variant="warning"
                />
              </div>
            </div>

            <div className="border-t-2 border-[#222] pt-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold">OpenSource License</div>
                </div>
                <ActionButton
                  text="View"
                  onClick={() => setShowOpenSourceNotice(true)}
                />
              </div>
            </div>

            <div className="border-t-2 border-[#222] pt-4">
              <div>
                <div className="font-bold text-red-600">
                  Raise a New Monster
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(event) => setResetConfirmText(event.target.value)}
                  placeholder="confirm"
                  className="w-40 border-2 border-[#222] px-3 py-0.5 text-center placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#d95763]"
                />
                <button
                  type={"button"}
                  disabled={!isResetEnabled}
                  onClick={onOpenResetConfirm}
                  className={`border-2 border-[#222] px-4 py-0.5 font-bold text-white ${
                    isResetEnabled
                      ? "bg-component-negative"
                      : "cursor-not-allowed bg-gray-400 opacity-60"
                  }`}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        }
        onConfirm={onClose}
        confirmText="Close"
      />
      {showOpenSourceNotice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <PopupLayer
            title="OpenSource License"
            content={
              <div className="text-left text-[1rem] leading-[1.4]">
                <div className="space-y-4">
                  {OPEN_SOURCE_NOTICE_SECTIONS.map((section) => (
                    <section key={section.title}>
                      <div className="border-t-2 border-[#555] pt-3 font-bold text-[1rem] text-gray-700 first:border-t-0 first:pt-0">
                        {section.title}
                      </div>
                      <ul className="mt-2 space-y-2">
                        {section.items.map((item) => (
                          <li key={item.name} className="leading-[1.35]">
                            <div className="break-all font-bold">
                              {item.name}
                            </div>
                            <div className="text-[0.95rem] text-gray-600">
                              {item.version} · {item.license}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                  <section>
                    <div className="border-t-2 border-[#555] pt-3 font-bold text-[1rem] text-gray-700">
                      Fonts
                    </div>
                    <div className="mt-2 space-y-1 leading-[1.35]">
                      <div className="break-all font-bold">
                        {FONT_NOTICE.name}
                      </div>
                      {FONT_NOTICE.lines.map((line) => (
                        <div
                          key={line}
                          className="break-all text-[0.95rem] text-gray-600"
                        >
                          {line}
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            }
            onConfirm={() => setShowOpenSourceNotice(false)}
            confirmText="Close"
          />
        </div>
      )}
      {showFinalResetConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <PopupLayer
            title="Reset?"
            content={
              <div className="leading-[1.6]">
                This will permanently delete your current monster and all
                progress. You&apos;ll return to the setup screen to hatch a new
                one.
              </div>
            }
            onConfirm={onResetGameData}
            onCancel={onCloseResetConfirm}
            confirmText="Reset"
            cancelText="Cancel"
            confirmVariant="negative"
            cancelVariant="positive"
          />
        </div>
      )}
    </div>
  );
};

export default SettingMenuLayer;
