import type React from "react";
import {
  getTimeOfDayLabel,
  TIME_OF_DAY_OPTIONS,
  type TimeOfDay,
} from "@digivice/game";
import PopupLayer from "../components/PopupLayer";
import { useI18n } from "../i18n";

const isNativeFeatureDebugMode =
  import.meta.env.NATIVE_FEATURE_DEBUG_MODE === "true";

export interface FlappyBirdSettingsLayerProps {
  isBgmEnabled: boolean;
  isSfxEnabled: boolean;
  onChangeBgm: (enabled: boolean) => void;
  onChangeSfx: (enabled: boolean) => void;
  selectedTimeOfDay?: TimeOfDay;
  onSelectTimeOfDay?: (timeOfDay: TimeOfDay) => void;
  onSendLogs: () => void;
  isSendingLogs?: boolean;
  onResume: () => void;
  onExit: () => void;
}

const ToggleButton: React.FC<{
  enabled: boolean;
  onClick: () => void;
}> = ({ enabled, onClick }) => {
  const { t } = useI18n();

  return (
    <button
      type={"button"}
      onClick={onClick}
      className={`min-w-20 border-2 border-[#222] px-4 py-0.5 font-bold text-white ${
        enabled ? "bg-component-positive" : "bg-gray-400"
      }`}
    >
      {enabled ? t("common.on") : t("common.off")}
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

const SelectButton: React.FC<{
  active: boolean;
  label: string;
  onClick: () => void;
}> = ({ active, label, onClick }) => {
  return (
    <button
      type={"button"}
      onClick={onClick}
      className={`border-2 border-[#222] px-3 py-0.5 font-bold ${
        active ? "bg-component-positive text-white" : "bg-white text-[#222]"
      }`}
    >
      {label}
    </button>
  );
};

const FlappyBirdSettingsLayer: React.FC<FlappyBirdSettingsLayerProps> = ({
  isBgmEnabled,
  isSfxEnabled,
  onChangeBgm,
  onChangeSfx,
  selectedTimeOfDay,
  onSelectTimeOfDay,
  onSendLogs,
  isSendingLogs = false,
  onResume,
  onExit,
}) => {
  const { locale, t } = useI18n();
  const shouldShowSkySelector =
    import.meta.env.DEV &&
    isNativeFeatureDebugMode &&
    selectedTimeOfDay !== undefined &&
    onSelectTimeOfDay !== undefined;

  return (
    <div className="fixed inset-0 z-[50] flex items-center justify-center bg-black/50">
      <PopupLayer
        title={t("settings.title")}
        suppressInitialActionsMs={180}
        content={
          <div className="flex flex-col gap-5 text-left text-[1.5rem]">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold">{t("flappy.bgm")}</div>
                </div>
                <ToggleButton
                  enabled={isBgmEnabled}
                  onClick={() => onChangeBgm(!isBgmEnabled)}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold">{t("flappy.sfx")}</div>
                </div>
                <ToggleButton
                  enabled={isSfxEnabled}
                  onClick={() => onChangeSfx(!isSfxEnabled)}
                />
              </div>
            </div>

            <div className="border-t-2 border-[#222] pt-4">
              <div className="flex items-center justify-between gap-4">
                <div className="font-bold">{t("settings.reportBug")}</div>
                <ActionButton
                  text={isSendingLogs ? t("flappy.preparing") : t("settings.send")}
                  onClick={onSendLogs}
                  disabled={isSendingLogs}
                  variant="warning"
                />
              </div>
            </div>

            {shouldShowSkySelector ? (
              <div className="border-t-2 border-[#222] pt-4">
                <div className="mb-3 font-bold">{t("flappy.skyDev")}</div>
                <div className="grid grid-cols-2 gap-2">
                  {TIME_OF_DAY_OPTIONS.map((timeOfDay) => (
                    <SelectButton
                      key={timeOfDay}
                      active={selectedTimeOfDay === timeOfDay}
                      label={getTimeOfDayLabel(timeOfDay, locale)}
                      onClick={() => onSelectTimeOfDay(timeOfDay)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        }
        onConfirm={onResume}
        onCancel={onExit}
        confirmText={t("flappy.resume")}
        cancelText={t("flappy.exit")}
        initialFocusTarget="confirm"
      />
    </div>
  );
};

export default FlappyBirdSettingsLayer;
