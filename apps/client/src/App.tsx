import React, { useEffect, useRef } from "react";
import { Game } from "./game";

const App: React.FC = () => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<Game | null>(null);

  useEffect(() => {
    // 게임 컨테이너가 준비되면 게임 인스턴스 초기화
    if (gameContainerRef.current) {
      const containerId = "game-container";
      gameContainerRef.current.id = containerId;

      gameInstanceRef.current = new Game(containerId);
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
    <div
      className="app-container"
      style={{ width: "100%", height: "100vh", overflow: "hidden" }}
    >
      <main style={{ width: "100%", height: "calc(100% - 60px)" }}>
        <div
          ref={gameContainerRef}
          style={{ width: "100%", height: "100%", background: "#222" }}
        />
      </main>
    </div>
  );
};

export default App;
