import { type ControlButtonType, Game } from "@digivice/game";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import ControlButtons from "./components/ControlButtons";

const GameContainer: React.FC = () => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const [gameInstance, setGameInstance] = useState<Game | null>(null);

  const [buttonTypes, setButtonTypes] = useState<
    [ControlButtonType, ControlButtonType, ControlButtonType] | null
  >(null);

  // Game 인스턴스 생성은 한 번만 실행되도록 보장
  useEffect(() => {
    let game: Game | null = null;

    if (gameContainerRef.current) {
      // Game 인스턴스 생성
      game = new Game({
        parentElement: gameContainerRef.current as HTMLDivElement,
        changeControlButtons: (controlButtonParams) => {
          setButtonTypes(
            () =>
              controlButtonParams.map(
                (controlButtonParam) => controlButtonParam.type
              ) as [ControlButtonType, ControlButtonType, ControlButtonType]
          );
        },
      });
      setGameInstance(game);
    }

    // 컴포넌트 언마운트 시 제대로 정리
    return () => {
      if (game) {
        game.destroy();
        setGameInstance(null);
      }
    };
  }, []);

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

  return (
    <div
      className={
        "h-full w-full relative flex flex-col items-center justify-center"
      }
    >
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
    </div>
  );
};

export default GameContainer;
