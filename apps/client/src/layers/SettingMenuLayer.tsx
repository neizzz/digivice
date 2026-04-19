import type React from "react";
import { useMemo, useState } from "react";
import PopupLayer from "../components/PopupLayer";

interface SettingMenuLayerProps {
  vibrationEnabled: boolean;
  onChangeVibration: (enabled: boolean) => void;
  onSendDiagnostics: () => void;
  isSendingDiagnostics: boolean;
  onResetGameData: () => void;
  onClose: () => void;
}

const ToggleButton: React.FC<{
  enabled: boolean;
  onClick: () => void;
}> = ({ enabled, onClick }) => {
  return (
    <button
      type={"button"}
      onClick={onClick}
      className={`min-w-20 border-2 border-[#222] px-4 py-2 text-sm font-bold text-white ${
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
      className={`flex min-w-20 items-center justify-center border-2 border-[#222] px-4 py-2 text-center text-sm font-bold text-white ${backgroundClass}`}
    >
      {text}
    </button>
  );
};

const SettingMenuLayer: React.FC<SettingMenuLayerProps> = ({
  vibrationEnabled,
  onChangeVibration,
  onSendDiagnostics,
  isSendingDiagnostics,
  onResetGameData,
  onClose,
}) => {
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [showFinalResetConfirm, setShowFinalResetConfirm] = useState(false);

  const isResetEnabled = useMemo(
    () => resetConfirmText.trim() === "confirm",
    [resetConfirmText],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <PopupLayer
        title="Settings"
        content={
          <div className="flex flex-col gap-5 text-left">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold">Vibration</div>
              </div>
              <ToggleButton
                enabled={vibrationEnabled}
                onClick={() => onChangeVibration(!vibrationEnabled)}
              />
            </div>

            <div className="border-t-2 border-[#222] pt-4">
              <div className="mb-3 text-sm font-bold">Send Diagnostics</div>
              <div className="flex items-center justify-between gap-4">
                <div className="text-xs text-gray-600">
                  Open Gmail with attached diagnostics files.
                </div>
                <ActionButton
                  text={isSendingDiagnostics ? "Sending..." : "Send"}
                  onClick={onSendDiagnostics}
                  disabled={isSendingDiagnostics}
                  variant="warning"
                />
              </div>
            </div>

            <div className="border-t-2 border-[#222] pt-4">
              <div>
                <div className="text-sm font-bold">Reset Game Data</div>
              </div>
              <div className="mt-1 text-xs text-gray-600">
                Type <span className="font-bold">confirm</span> below to enable
                the reset button.
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(event) => setResetConfirmText(event.target.value)}
                  placeholder="confirm"
                  className="w-40 border-2 border-[#222] px-3 py-2 text-center text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#d95763]"
                />
                <button
                  type={"button"}
                  disabled={!isResetEnabled}
                  onClick={() => setShowFinalResetConfirm(true)}
                  className={`border-2 border-[#222] px-4 py-2 text-sm font-bold text-white ${
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
      {showFinalResetConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <PopupLayer
            title="Final Confirmation"
            content={
              <div className="text-sm leading-6">
                This will permanently delete all game data and return you to
                the initial setup screen. This action cannot be undone.
              </div>
            }
            onConfirm={onResetGameData}
            onCancel={() => setShowFinalResetConfirm(false)}
            confirmText="Delete"
            cancelText="Cancel"
          />
        </div>
      )}
    </div>
  );
};

export default SettingMenuLayer;
