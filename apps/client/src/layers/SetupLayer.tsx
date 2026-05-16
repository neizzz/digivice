import type React from "react";
import {
  countDisplayCharacters,
  fitsNameLabelWidth,
  measureNameLabelWidth,
  type SunTimesPayload,
} from "@digivice/game";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import PopupLayer from "../components/PopupLayer";
import { useI18n } from "../i18n";

const MIN_NAME_LENGTH = 2;
const SETUP_NAME_MAX_WIDTH = 55;

export type SetupFormData = {
  name: string;
  useLocalTime: boolean;
  cachedSunTimes?: SunTimesPayload | null;
};

export interface SetupLayerProps {
  onComplete: (formData: SetupFormData) => void;
}

export const SetupLayer: React.FC<SetupLayerProps> = ({ onComplete }) => {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const trimmedName = name.trim();
  const nameLength = countDisplayCharacters(trimmedName);
  const nameWidth = measureNameLabelWidth(trimmedName);
  const isWithinVisibleWidth = fitsNameLabelWidth(
    trimmedName,
    SETUP_NAME_MAX_WIDTH,
  );

  const handleConfirm = () => {
    if (!trimmedName) {
      setError(t("setup.error.emptyName"));
      return;
    }

    if (nameLength < MIN_NAME_LENGTH) {
      setError(t("setup.error.minLength", { minLength: MIN_NAME_LENGTH }));
      return;
    }

    if (!isWithinVisibleWidth) {
      setError(
        t("setup.error.maxWidth", { maxWidth: SETUP_NAME_MAX_WIDTH }),
      );
      return;
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    onComplete({
      name: trimmedName,
      useLocalTime: true,
      cachedSunTimes: null,
    });
  };

  const overlay = (
    <div className="fixed inset-0 z-[999] flex min-h-dvh items-center justify-center bg-black/50">
      <PopupLayer
        title={t("setup.title")}
        keyboardAwareTargetRef={nameInputRef}
        dividerBorderClassName="border-[#555]"
        content={
          <div className="flex flex-col items-center gap-4">
            <div className="w-full">
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder={t("setup.placeholder.name")}
                className="w-full border-2 border-[#222] px-3 py-0.5 text-center text-[1.4rem] focus:outline-none focus:ring-2 focus:ring-[#d95763]"
              />
              <div
                className={`mt-2 text-[1.2rem] ${
                  isWithinVisibleWidth ? "text-gray-600" : "text-red-600"
                }`}
              >
                {t("setup.nameWidth", {
                  width: Math.round(nameWidth),
                  maxWidth: SETUP_NAME_MAX_WIDTH,
                })}
              </div>
              {error && (
                <p className="mt-4 text-component-negative text-[0.7em]">
                  {error}
                </p>
              )}
            </div>
          </div>
        }
        onConfirm={handleConfirm}
        confirmText={t("setup.start")}
      />
    </div>
  );

  if (typeof document === "undefined") {
    return overlay;
  }

  return createPortal(overlay, document.body);
};
