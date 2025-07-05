import React, { useState } from "react";

// ConfirmLayer: 리셋 확인용 레이어
const ConfirmLayer: React.FC<{
  confirmPhrase: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ confirmPhrase, onConfirm, onCancel }) => {
  const [input, setInput] = useState("");
  const isMatch = input.trim() === confirmPhrase;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-[90%] max-w-[400px] text-center border-4 border-[#222]">
        <div className="text-lg font-bold mb-4 text-component-negative">정말로 리셋하시겠습니까?</div>
        <div className="mb-2 text-sm text-gray-700">아래 문구를 정확히 입력해야 리셋이 진행됩니다.</div>
        <div className="mb-2 font-mono text-base text-component-negative">{confirmPhrase}</div>
        <input
          className="w-full border-2 border-[#222] rounded px-2 py-1 text-center mb-4"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="문구를 입력하세요"
          autoFocus
        />
        <div className="flex justify-center gap-4 mt-2">
          <button
            className="bg-component-negative text-white px-4 py-2 rounded border-2 border-[#222]"
            onClick={onCancel}
            type="button"
          >취소</button>
          <button
            className="bg-component-positive text-white px-4 py-2 rounded border-2 border-[#222] disabled:opacity-50"
            onClick={isMatch ? onConfirm : undefined}
            disabled={!isMatch}
            type="button"
          >확인</button>
        </div>
      </div>
    </div>
  );
};

const SettingMenuLayer: React.FC = () => {
  const [soundOn, setSoundOn] = useState(true);
  const [bgmOn, setBgmOn] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const confirmPhrase = "RESET";

  // 버튼 포커스 관리 (취소/확인/다음)
  const [focusIdx, setFocusIdx] = useState(0); // 0:취소, 1:확인, 2:다음
  const buttonCount = 3;

  // 키보드/버튼 입력 핸들러 (취소/확인/다음)
  const handleButtonNav = (dir: "prev" | "next") => {
    setFocusIdx(idx => (dir === "next" ? (idx + 1) % buttonCount : (idx + buttonCount - 1) % buttonCount));
  };

  // 실제 버튼 동작
  const handleButtonAction = () => {
    if (focusIdx === 0) setShowConfirm(false); // 취소
    else if (focusIdx === 1) {
      // 확인
      // 실제 리셋 로직 필요
      setShowConfirm(false);
      alert("리셋되었습니다.");
    } else if (focusIdx === 2) {
      // 다음(포커스 input으로 이동)
      const input = document.querySelector<HTMLInputElement>("input[placeholder='문구를 입력하세요']");
      input?.focus();
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-40">
      <div className="bg-white rounded-lg shadow-lg p-6 w-[90%] max-w-[400px] text-center border-4 border-[#222]">
        <div className="text-xl font-bold mb-6 text-component-positive">설정</div>
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between">
            <span>효과음</span>
            <button
              className={`px-4 py-2 rounded border-2 border-[#222] ${soundOn ? "bg-component-positive text-white" : "bg-gray-300 text-gray-700"}`}
              onClick={() => setSoundOn(v => !v)}
              type="button"
            >{soundOn ? "ON" : "OFF"}</button>
          </div>
          <div className="flex items-center justify-between">
            <span>배경음</span>
            <button
              className={`px-4 py-2 rounded border-2 border-[#222] ${bgmOn ? "bg-component-positive text-white" : "bg-gray-300 text-gray-700"}`}
              onClick={() => setBgmOn(v => !v)}
              type="button"
            >{bgmOn ? "ON" : "OFF"}</button>
          </div>
          <div className="flex items-center justify-between">
            <span>코인 충전</span>
            <button
              className="px-4 py-2 rounded border-2 border-[#222] bg-yellow-400 text-black"
              onClick={() => alert("광고 보기 (구현 필요)")}
              type="button"
            >광고 보기</button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            className="w-full px-4 py-2 rounded border-2 border-[#222] bg-component-negative text-white font-bold"
            onClick={() => setShowConfirm(true)}
            type="button"
          >리셋</button>
        </div>
      </div>
      {showConfirm && (
        <ConfirmLayer
          confirmPhrase={confirmPhrase}
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => {
            setShowConfirm(false);
            alert("리셋되었습니다.");
          }}
        />
      )}
    </div>
  );
};

export default SettingMenuLayer;
