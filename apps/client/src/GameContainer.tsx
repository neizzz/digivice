import React, { useEffect, useRef, useState, useCallback } from "react";
import { Game, ControlButtonType } from "@digivice/game";
import ControlButtons from "./components/ControlButtons";

const GameContainer: React.FC = () => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const [gameInstance, setGameInstance] = useState<Game | null>(null);

  // Game 인스턴스 생성은 한 번만 실행되도록 보장
  useEffect(() => {
    let game: Game | null = null;

    if (gameContainerRef.current) {
      // Game 인스턴스 생성
      game = new Game(gameContainerRef.current);
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

  return (
    <>
      <div id="game-container" ref={gameContainerRef}>
        {/* 게임 캔버스가 여기에 렌더링됨 */}
      </div>

      <div style={{ marginTop: "40px" }}>
        <ControlButtons onButtonPress={handleButtonPress} />
      </div>
    </>
  );
};

export default GameContainer;
