import type React from "react";
import {
  countDisplayCharacters,
  fitsNameLabelWidth,
  measureNameLabelWidth,
  NAME_LABEL_MAX_WIDTH,
  type SunTimesPayload,
} from "@digivice/game";
import { useRef, useState } from "react";
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

export const SetupLayer: React.FC<SetupLayerProps> = ({ onComplete }) => {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const trimmedName = name.trim();
  const nameLength = countDisplayCharacters(trimmedName);
  const nameWidth = measureNameLabelWidth(trimmedName);
  const isWithinVisibleWidth = fitsNameLabelWidth(trimmedName);

  const handleConfirm = () => {
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

    onComplete({
      name: trimmedName,
      useLocalTime: true,
      cachedSunTimes: null,
    });
  };

  const overlay = (
    <div className="fixed inset-0 z-[999] flex min-h-dvh items-center justify-center bg-black/50">
      <PopupLayer
        title="Spawn Monster!"
        keyboardAwareTargetRef={nameInputRef}
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
