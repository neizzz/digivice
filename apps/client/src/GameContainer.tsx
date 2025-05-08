import { type ControlButtonType, Game } from "@digivice/game";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import ControlButtons from "./components/ControlButtons";
import { type SetupFormData, SetupLayer } from "./layers/SetupLayer";
import AlertLayer from "./layers/AlertLayer";
import useAlert from "./hooks/useAlert";

// TypeScript 전역 선언 추가
declare global {
  interface Window {
    setupComplete?: (formData: SetupFormData) => void;
  }
}

const GameContainer: React.FC = () => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const [gameInstance, setGameInstance] = useState<Game | null>(null);
  const [showSetupLayer, setShowSetupLayer] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { alertState, showAlert, hideAlert } = useAlert();
  const isInitializedRef = useRef<boolean>(false);
  const [buttonTypes, setButtonTypes] = useState<
    [ControlButtonType, ControlButtonType, ControlButtonType] | null
  >(null);

  // Game 인스턴스 생성은 한 번만 실행되도록 보장
  useEffect(() => {
    if (!gameContainerRef.current) return;
    if (isInitializedRef.current) return;

    // Game 인스턴스 생성
    const game = new Game({
      parentElement: gameContainerRef.current as HTMLDivElement,
      onCreateInitialGameData: async () => {
        // 초기 설정 UI 표시
        setShowSetupLayer(true);

        // Promise를 반환하고, setupLayer가 완료될 때까지 대기
        return new Promise((resolve) => {
          // setupComplete 핸들러 정의
          window.setupComplete = (formData: SetupFormData) => {
            setShowSetupLayer(false);
            window.setupComplete = undefined;
            resolve(formData); // formData를 Promise 결과로 반환
          };
        });
      },
      showAlert: (message: string, title?: string) => {
        showAlert(message, title);
      },
      changeControlButtons: (controlButtonParams) => {
        setButtonTypes(
          () =>
            controlButtonParams.map(
              (controlButtonParam) => controlButtonParam.type
            ) as [ControlButtonType, ControlButtonType, ControlButtonType]
        );
      },
    });
    isInitializedRef.current = true;
    setGameInstance(game);
    setIsLoading(false);
  }, [showAlert]); // NOTE: showAlert는 변경되면 안됨.

  // 버튼 클릭 핸들러 - Game 인스턴스에 버튼 타입만 전달
  const handleButtonPress = useCallback(
    (buttonType: ControlButtonType) => {
      if (gameInstance) {
        gameInstance.handleControlButtonClick(buttonType);
      }
    },
    [gameInstance]
  );

  // 슬라이더 값 변경 핸들러 추가
  const handleSliderChange = useCallback(
    (value: number) => {
      if (gameInstance?.handleSliderValueChange) {
        // 게임 인스턴스에 슬라이더 값 전달
        gameInstance.handleSliderValueChange(value);
      }
    },
    [gameInstance]
  );

  // 슬라이더 종료 핸들러 추가
  const handleSliderEnd = useCallback(() => {
    if (gameInstance?.handleSliderEnd) {
      // 게임 인스턴스에 슬라이더 종료 이벤트 전달
      gameInstance.handleSliderEnd();
    }
  }, [gameInstance]);

  // SetupLayer 완료 핸들러
  const handleSetupComplete = useCallback((formData: SetupFormData) => {
    if (typeof window.setupComplete === "function") {
      window.setupComplete(formData);
    }
  }, []);

  return (
    <div
      className={
        "h-full w-full relative flex flex-col items-center justify-center"
      }
    >
      <>
        <div
          id="game-container"
          ref={gameContainerRef}
          className={"relative m-0 p-0 w-full aspect-1/1"}
        >
          {/* 게임 캔버스가 여기에 렌더링됨 */}
        </div>

        {buttonTypes && (
          <div className={"w-full mt-14"}>
            <ControlButtons
              buttonTypes={buttonTypes}
              onButtonPress={handleButtonPress}
              onSliderChange={handleSliderChange}
              onSliderEnd={handleSliderEnd}
            />
          </div>
        )}
      </>
      {isLoading && (
        <div className={"absolute top-0 left-0 text-white p-4"}>Loading..</div>
      )}
      {showSetupLayer && <SetupLayer onComplete={handleSetupComplete} />}
      {alertState && (
        <AlertLayer
          title={alertState.title}
          message={alertState.message}
          onClose={hideAlert}
        />
      )}
    </div>
  );
};

export default GameContainer;
