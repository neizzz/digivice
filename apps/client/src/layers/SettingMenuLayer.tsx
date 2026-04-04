import type React from "react";
import { useMemo, useState } from "react";
import PopupLayer from "../components/PopupLayer";

interface SettingMenuLayerProps {
  vibrationEnabled: boolean;
  notificationEnabled: boolean;
  onChangeVibration: (enabled: boolean) => void;
  onChangeNotification: (enabled: boolean) => void;
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

const SettingMenuLayer: React.FC<SettingMenuLayerProps> = ({
  vibrationEnabled,
  notificationEnabled,
  onChangeVibration,
  onChangeNotification,
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
        title="환경설정"
        content={
          <div className="flex flex-col gap-5 text-left">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold">진동</div>
                <div className="text-xs text-gray-600">
                  게임 버튼 클릭 시 진동 사용
                </div>
              </div>
              <ToggleButton
                enabled={vibrationEnabled}
                onClick={() => onChangeVibration(!vibrationEnabled)}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold">알림</div>
                <div className="text-xs text-gray-600">
                  아직 알림 기능은 구현 전입니다.
                </div>
              </div>
              <ToggleButton
                enabled={notificationEnabled}
                onClick={() => onChangeNotification(!notificationEnabled)}
              />
            </div>

            <div className="border-t-2 border-[#222] pt-4">
              <div className="text-sm font-bold">게임 데이터 초기화</div>
              <div className="mt-1 text-xs text-gray-600">
                아래 입력창에 <span className="font-bold">confirm</span> 을
                입력하면 초기화 버튼이 활성화됩니다.
              </div>
              <input
                type="text"
                value={resetConfirmText}
                onChange={(event) => setResetConfirmText(event.target.value)}
                placeholder="confirm"
                className="mt-3 w-full border-2 border-[#222] px-3 py-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-[#d95763]"
              />
              <button
                type={"button"}
                disabled={!isResetEnabled}
                onClick={onResetGameData}
                className={`mt-3 w-full border-2 border-[#222] px-4 py-2 text-sm font-bold text-white ${
                  isResetEnabled
                    ? "bg-component-negative"
                    : "cursor-not-allowed bg-gray-400 opacity-60"
                }`}
              >
                게임 데이터 초기화
              </button>
            </div>
          </div>
        }
        onConfirm={onClose}
        confirmText="닫기"
      />
    </div>
  );
};

export default SettingMenuLayer;
