import type React from "react";
import {
  countDisplayCharacters,
  fitsNameLabelWidth,
  measureNameLabelWidth,
  NAME_LABEL_MAX_WIDTH,
} from "@digivice/game";
import { useState } from "react";
import { createPortal } from "react-dom";
import PopupLayer from "../components/PopupLayer";

const MIN_NAME_LENGTH = 2;

export type SetupFormData = {
  name: string;
};

export interface SetupLayerProps {
  onComplete: (formData: SetupFormData) => void;
}

export const SetupLayer: React.FC<SetupLayerProps> = ({ onComplete }) => {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const trimmedName = name.trim();
  const nameLength = countDisplayCharacters(trimmedName);
  const nameWidth = measureNameLabelWidth(trimmedName);
  const isWithinVisibleWidth = fitsNameLabelWidth(trimmedName);

  const handleConfirm = () => {
    if (!trimmedName) {
      setError("닉네임을 입력해주세요!");
      return;
    }

    if (nameLength < MIN_NAME_LENGTH) {
      setError(`닉네임은 최소 ${MIN_NAME_LENGTH}글자 이상 입력해주세요!`);
      return;
    }

    if (!isWithinVisibleWidth) {
      setError(
        `닉네임은 게임 화면 이름표 기준 ${NAME_LABEL_MAX_WIDTH}px 안에 들어와야 해요!`,
      );
      return;
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    // 닉네임 유효성 검사 통과 시 완료 콜백 호출
    onComplete({
      name: trimmedName,
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
