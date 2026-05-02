import type React from "react";
import {
  getTimeOfDayLabel,
  TIME_OF_DAY_OPTIONS,
  type TimeOfDay,
} from "@digivice/game";
import PopupLayer from "../components/PopupLayer";

const isNativeFeatureDebugMode =
  import.meta.env.NATIVE_FEATURE_DEBUG_MODE === "true";

export interface FlappyBirdSettingsLayerProps {
  isBgmEnabled: boolean;
  isSfxEnabled: boolean;
  onChangeBgm: (enabled: boolean) => void;
  onChangeSfx: (enabled: boolean) => void;
  selectedTimeOfDay?: TimeOfDay;
  onSelectTimeOfDay?: (timeOfDay: TimeOfDay) => void;
  onResume: () => void;
  onExit: () => void;
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

const SelectButton: React.FC<{
  active: boolean;
  label: string;
  onClick: () => void;
}> = ({ active, label, onClick }) => {
  return (
    <button
      type={"button"}
      onClick={onClick}
      className={`border-2 border-[#222] px-3 py-2 text-sm font-bold ${
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
  onResume,
  onExit,
}) => {
  const shouldShowSkySelector =
    import.meta.env.DEV &&
    isNativeFeatureDebugMode &&
    selectedTimeOfDay !== undefined &&
    onSelectTimeOfDay !== undefined;

  return (
    <div className="fixed inset-0 z-[50] flex items-center justify-center bg-black/50">
      <PopupLayer
        title="Settings"
        suppressInitialActionsMs={180}
        content={
          <div className="flex flex-col gap-5 text-left">
            <div className="text-sm text-gray-600">The game is paused.</div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold">BGM</div>
              </div>
              <ToggleButton
                enabled={isBgmEnabled}
                onClick={() => onChangeBgm(!isBgmEnabled)}
              />
            </div>

            <div className="border-t-2 border-[#222] pt-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold">SFX</div>
                </div>
                <ToggleButton
                  enabled={isSfxEnabled}
                  onClick={() => onChangeSfx(!isSfxEnabled)}
                />
              </div>
            </div>

            {shouldShowSkySelector ? (
              <div className="border-t-2 border-[#222] pt-4">
                <div className="mb-3 text-sm font-bold">Sky Dev</div>
                <div className="grid grid-cols-2 gap-2">
                  {TIME_OF_DAY_OPTIONS.map((timeOfDay) => (
                    <SelectButton
                      key={timeOfDay}
                      active={selectedTimeOfDay === timeOfDay}
                      label={getTimeOfDayLabel(timeOfDay)}
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
        confirmText="Resume"
        cancelText="Exit"
        initialFocusTarget="confirm"
      />
    </div>
  );
};

export default FlappyBirdSettingsLayer;
