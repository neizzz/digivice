import React, { useEffect, useRef } from "react";
import { Game } from "@digivice/game";
import "./App.css";

const App: React.FC = () => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<Game | null>(null);

  useEffect(() => {
    // 게임 컨테이너가 준비되면 게임 인스턴스 초기화
    if (gameContainerRef.current) {
      gameInstanceRef.current = new Game(gameContainerRef.current);
    }

    // 컴포넌트 언마운트 시 게임 리소스 정리
    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.destroy();
        gameInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div id="app-container">
      <main id="game-container" ref={gameContainerRef}></main>
    </div>
  );
};

export default App;
