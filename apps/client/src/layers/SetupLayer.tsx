import type React from "react";
import {
  countDisplayCharacters,
  fitsNameLabelWidth,
  measureNameLabelWidth,
  NAME_LABEL_MAX_WIDTH,
  type SunTimesPayload,
} from "@digivice/game";
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import PopupLayer from "../components/PopupLayer";

const MIN_NAME_LENGTH = 2;

export type SetupFormData = {
  name: string;
  useLocalTime: boolean;
  cachedSunTimes?: SunTimesPayload | null;
};

export interface SetupLayerProps {
  onComplete: (formData: SetupFormData) => void;
}

const DEFAULT_USE_LOCAL_TIME = import.meta.env.DEV;

export const SetupLayer: React.FC<SetupLayerProps> = ({ onComplete }) => {
  const [name, setName] = useState("");
  const [useLocalTime, setUseLocalTime] = useState(DEFAULT_USE_LOCAL_TIME);
  const [cachedSunTimes, setCachedSunTimes] =
    useState<SunTimesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localTimeError, setLocalTimeError] = useState<string | null>(null);
  const [isRequestingLocationPermission, setIsRequestingLocationPermission] =
    useState(false);
  const trimmedName = name.trim();
  const nameLength = countDisplayCharacters(trimmedName);
  const nameWidth = measureNameLabelWidth(trimmedName);
  const isWithinVisibleWidth = fitsNameLabelWidth(trimmedName);

  const loadSunTimesForLocalTime =
    useCallback(async (): Promise<SunTimesPayload | null> => {
      if (typeof window === "undefined" || !window.sunController) {
        setLocalTimeError(
          "Local day/night time is only available in the native app.",
        );
        return null;
      }

      setIsRequestingLocationPermission(true);

      try {
        try {
          const sunTimes = await window.sunController.getSunTimes(false);
          if (sunTimes?.hasLocationPermission) {
            return sunTimes;
          }
        } catch (permissionCheckError) {
          console.warn(
            "[SetupLayer] Failed to check location permission state:",
            permissionCheckError,
          );
        }

        const result = await window.sunController.requestLocationPermission();
        if (!result?.granted) {
          setLocalTimeError(
            "Location permission is required to enable local day/night time.",
          );
          return null;
        }

        const sunTimes = await window.sunController.getSunTimes(false);
        if (sunTimes) {
          return sunTimes;
        }

        setLocalTimeError("Failed to load local day/night time.");
        return null;
      } catch (permissionRequestError) {
        console.warn(
          "[SetupLayer] Failed to load local day/night time:",
          permissionRequestError,
        );
        setLocalTimeError("Failed to load local day/night time.");
        return null;
      } finally {
        setIsRequestingLocationPermission(false);
      }
    }, []);

  const handleUseLocalTimeChange = useCallback(
    async (checked: boolean) => {
      setLocalTimeError(null);

      if (!checked) {
        setUseLocalTime(false);
        setCachedSunTimes(null);
        return;
      }

      const sunTimes = await loadSunTimesForLocalTime();
      setCachedSunTimes(sunTimes);
      setUseLocalTime(!!sunTimes);
    },
    [loadSunTimesForLocalTime],
  );

  const handleConfirm = async () => {
    if (isRequestingLocationPermission) {
      setError("Please wait for the location permission request to finish.");
      return;
    }

    if (!trimmedName) {
      setError("Please enter a name.");
      return;
    }

    if (nameLength < MIN_NAME_LENGTH) {
      setError(`Name must be at least ${MIN_NAME_LENGTH} characters long.`);
      return;
    }

    if (!isWithinVisibleWidth) {
      setError(
        `Name must fit within ${NAME_LABEL_MAX_WIDTH}px on the in-game label.`,
      );
      return;
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const canLoadNativeSunTimes =
      typeof window !== "undefined" && !!window.sunController;
    const sunTimes =
      useLocalTime && canLoadNativeSunTimes
        ? cachedSunTimes ?? (await loadSunTimesForLocalTime())
        : cachedSunTimes;

    if (useLocalTime && canLoadNativeSunTimes && !sunTimes) {
      return;
    }

    // 닉네임 유효성 검사 통과 시 완료 콜백 호출
    onComplete({
      name: trimmedName,
      useLocalTime,
      cachedSunTimes: sunTimes,
    });
  };

  const overlay = (
    <div className="fixed inset-0 z-[999] flex min-h-dvh items-center justify-center bg-black/50">
      <PopupLayer
        title="Spawn Monster!"
        content={
          <div className="flex flex-col items-center gap-4">
            <div className="w-full">
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="Monster Name"
                className="w-full px-3 py-2 text-center border-2 border-[#222] text-xs focus:outline-none focus:ring-2 focus:ring-[#d95763]"
              />
              <div
                className={`mt-4 text-xs ${
                  isWithinVisibleWidth ? "text-gray-600" : "text-red-600"
                }`}
              >
                Name width: {Math.round(nameWidth)}/{NAME_LABEL_MAX_WIDTH}px
              </div>
              {error && (
                <p className="mt-4 text-component-negative text-[0.7em]">
                  {error}
                </p>
              )}
            </div>
            <div className="w-full border-t border-[#222]/20 pt-4 text-left">
              <label className="flex items-start gap-3 text-xs text-[#222]">
                <input
                  type="checkbox"
                  checked={useLocalTime}
                  disabled={isRequestingLocationPermission}
                  onChange={(e) => {
                    setError(null);
                    void handleUseLocalTimeChange(e.target.checked);
                  }}
                  className="mt-0.5 h-4 w-4 min-h-4 min-w-4 shrink-0 flex-none appearance-none bg-center bg-no-repeat bg-contain cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    backgroundImage: `url("${
                      useLocalTime
                        ? "/assets/ui/checkbox.png"
                        : "/assets/ui/checkbox_off.png"
                    }")`,
                  }}
                />
                <span className="leading-5">
                  <span className="block font-semibold">
                    Use local day/night time
                  </span>
                  {isRequestingLocationPermission && (
                    <span className="mt-1 block text-[0.92em] text-gray-600">
                      Requesting location permission...
                    </span>
                  )}
                  {localTimeError && (
                    <span className="mt-1 block text-[0.92em] text-red-600">
                      {localTimeError}
                    </span>
                  )}
                </span>
              </label>
            </div>
          </div>
        }
        onConfirm={handleConfirm}
        confirmText="Start"
      />
    </div>
  );

  if (typeof document === "undefined") {
    return overlay;
  }

  return createPortal(overlay, document.body);
};
