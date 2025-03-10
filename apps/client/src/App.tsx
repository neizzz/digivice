import React, { useEffect, useRef, useState, useCallback } from "react";
import { Game } from "@digivice/game";
import "./App.css";
import ControlButtons from "./components/ControlButtons";
import GameMenu, {
  NavigationAction,
  NavigationActionPayload,
} from "./components/GameMenu";

const App: React.FC = () => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<Game | null>(null);

  // ref 대신 state로 액션 인덱스 관리
  const [actionIndex, setActionIndex] = useState<number>(0);

  // 수정된 네비게이션 액션 상태
  const [navigationAction, setNavigationAction] =
    useState<NavigationActionPayload>({
      type: NavigationAction.NONE,
      index: -1,
    });

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

  // 액션 생성 헬퍼 함수 - 현재 인덱스 사용 후 인덱스 증가
  const createAction = useCallback(
    (type: NavigationAction): NavigationActionPayload => {
      return {
        type,
        index: actionIndex,
      };
    },
    [actionIndex]
  );

  // useCallback을 사용하여 핸들러 함수 메모이제이션
  const handleNextClick = useCallback(() => {
    setNavigationAction(createAction(NavigationAction.NEXT));
    setActionIndex((prev) => prev + 1); // 인덱스 증가
  }, [createAction]);

  const handleSelectClick = useCallback(() => {
    setNavigationAction(createAction(NavigationAction.SELECT));
    setActionIndex((prev) => prev + 1); // 인덱스 증가
  }, [createAction]);

  const handleCancelClick = useCallback(() => {
    setNavigationAction(createAction(NavigationAction.CANCEL));
    setActionIndex((prev) => prev + 1); // 인덱스 증가
  }, [createAction]);

  const handleMenuSelect = useCallback((menuType: string) => {
    console.log(`메뉴 선택됨: ${menuType}`);
    // TODO: 여기에 메뉴 선택에 따른 로직 추가
  }, []);

  const handleMenuCancel = useCallback(() => {
    console.log("메뉴 선택 취소됨");
    // 추가 취소 로직이 필요하면 여기에 구현
  }, []);

  // 네비게이션 처리 완료 후 상태 초기화
  const handleNavigationProcessed = useCallback(() => {
    setNavigationAction((prev) => ({
      type: NavigationAction.NONE,
      index: prev.index, // 인덱스 유지
    }));
  }, []);

  return (
    <div id="app-container">
      <main
        id="game-container"
        ref={gameContainerRef}
        style={{ position: "relative" }}
      >
        <GameMenu
          navigationAction={navigationAction}
          onTypeASelect={() => handleMenuSelect("typeA")}
          onTypeBSelect={() => handleMenuSelect("typeB")}
          onTypeCSelect={() => handleMenuSelect("typeC")}
          onTypeDSelect={() => handleMenuSelect("typeD")}
          onTypeESelect={() => handleMenuSelect("typeE")}
          onTypeFSelect={() => handleMenuSelect("typeF")}
          onCancel={handleMenuCancel}
          onNavigationProcessed={handleNavigationProcessed}
        />
      </main>
      <div id="control-buttons-container" style={{ marginTop: "20%" }}>
        <ControlButtons
          onCancelClick={handleCancelClick}
          onNextClick={handleNextClick}
          onSelectClick={handleSelectClick}
        />
      </div>
    </div>
  );
};

export default App;
