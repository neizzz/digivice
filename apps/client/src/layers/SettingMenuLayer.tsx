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
