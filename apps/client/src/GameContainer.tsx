import { ControlButtonType, Game } from "@digivice/game";
import { FlutterStorage, type Storage, WebLocalStorage } from "@shared/storage";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import ControlButtons from "./components/ControlButtons";
import { type SetupFormData, SetupLayer } from "./layers/SetupLayer";
import AlertLayer from "./layers/AlertLayer";
import SettingMenuLayer from "./layers/SettingMenuLayer";
import useAlert from "./hooks/useAlert";
import {
  getGameSettings,
  updateGameSettings,
} from "./settings/gameSettings";

const WORLD_DATA_STORAGE_KEY = "MainSceneWorldData";

type StoredWorldData = {
  entities?: unknown[];
};

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

async function waitForLayoutStabilization(): Promise<void> {
  await waitForAnimationFrame();
  await waitForAnimationFrame();
  await new Promise((resolve) => window.setTimeout(resolve, 250));
  await waitForAnimationFrame();
}

function createStorage(): Storage {
  if (typeof window !== "undefined" && "storageController" in window) {
    return new FlutterStorage();
  }

  return new WebLocalStorage();
}

const GameContainer: React.FC = () => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const [gameInstance, setGameInstance] = useState<Game | null>(null);
  const [showSetupLayer, setShowSetupLayer] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { alertState, showAlert, hideAlert } = useAlert();
  const isInitializedRef = useRef<boolean>(false);
  const initialSetupDataRef = useRef<SetupFormData | null>(null);
  const pendingSetupResolverRef = useRef<
    ((formData: SetupFormData) => void) | null
  >(null);
  const [showSettingMenu, setShowSettingMenu] = useState(false);
  const [gameSettings, setGameSettings] = useState(getGameSettings);
  const [gameSessionKey, setGameSessionKey] = useState(0);
  const [buttonTypes, setButtonTypes] = useState<
    [ControlButtonType, ControlButtonType, ControlButtonType] | null
  >(null);

  const openSettingMenu = useCallback(() => {
    setShowSettingMenu(true);
  }, []);

  const closeSettingMenu = useCallback(() => {
    setShowSettingMenu(false);
  }, []);

  const handleVibrationSettingChange = useCallback((enabled: boolean) => {
    setGameSettings(updateGameSettings({ vibrationEnabled: enabled }));
  }, []);

  const handleNotificationSettingChange = useCallback((enabled: boolean) => {
    setGameSettings(updateGameSettings({ notificationEnabled: enabled }));
  }, []);

  const handleResetGameData = useCallback(() => {
    try {
      const storage = createStorage();
      storage.removeData(WORLD_DATA_STORAGE_KEY);
      gameInstance?.destroy();
      initialSetupDataRef.current = null;
      pendingSetupResolverRef.current = null;
      isInitializedRef.current = false;
      setShowSettingMenu(false);
      setButtonTypes(null);
      setShowSetupLayer(false);
      setIsLoading(false);
      setGameInstance(null);
      setGameSessionKey((previous) => previous + 1);
    } catch (error) {
      console.error("[GameContainer] 게임 데이터 초기화 중 오류:", error);
      showAlert("게임 데이터 초기화에 실패했습니다.", "오류");
    }
  }, [gameInstance, showAlert]);

  const hasSavedGameData = useCallback(async (): Promise<boolean> => {
    try {
      const storage = createStorage();
      const savedData = (await storage.getData(
        WORLD_DATA_STORAGE_KEY,
      )) as StoredWorldData | null;

      return !!savedData?.entities?.length;
    } catch (error) {
      console.error("[GameContainer] 게임 데이터 확인 중 오류:", error);
      return false;
    }
  }, []);

  const requestInitialGameData =
    useCallback(async (): Promise<SetupFormData> => {
      if (initialSetupDataRef.current) {
        return initialSetupDataRef.current;
      }

      setIsLoading(false);
      setShowSetupLayer(true);

      return new Promise((resolve) => {
        pendingSetupResolverRef.current = (formData: SetupFormData) => {
          initialSetupDataRef.current = formData;
          setShowSetupLayer(false);
          pendingSetupResolverRef.current = null;
          resolve(formData);
        };
      });
    }, []);

  const initializeGame = useCallback(() => {
    if (!gameContainerRef.current) return;
    if (isInitializedRef.current) return;

    setIsLoading(true);

    const game = new Game({
      parentElement: gameContainerRef.current as HTMLDivElement,
      onCreateInitialGameData: async () => {
        return initialSetupDataRef.current ?? (await requestInitialGameData());
      },
      showAlert: (message: string, title?: string) => {
        showAlert(message, title);
      },
      showSettings: () => {
        openSettingMenu();
      },
      changeControlButtons: (controlButtonParams) => {
        setButtonTypes(
          () =>
            controlButtonParams.map(
              (controlButtonParam) => controlButtonParam.type,
            ) as [ControlButtonType, ControlButtonType, ControlButtonType],
        );
      },
    });

    setTimeout(() => {
      game.initialize().then(() => {
        isInitializedRef.current = true;
        setGameInstance(game);
        setIsLoading(false);
      });
    });
  }, [openSettingMenu, requestInitialGameData, showAlert]);

  // Game 인스턴스 생성은 한 번만 실행되도록 보장
  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      if (!gameContainerRef.current) return;
      if (isInitializedRef.current) return;

      const savedGameDataExists = await hasSavedGameData();
      if (!isMounted) return;

      if (!savedGameDataExists) {
        await requestInitialGameData();
        if (!isMounted) return;
        await waitForLayoutStabilization();
        if (!isMounted) return;
      }

      initializeGame();
    };

    void bootstrap();

    return () => {
      isMounted = false;
      pendingSetupResolverRef.current = null;
    };
  }, [gameSessionKey, hasSavedGameData, initializeGame, requestInitialGameData]);

  // 버튼 클릭 핸들러 - Game 인스턴스에 버튼 타입만 전달
  const handleButtonPress = useCallback(
    (buttonType: ControlButtonType) => {
      if (buttonType === ControlButtonType.Settings) {
        openSettingMenu();
        return;
      }

      if (gameInstance) {
        gameInstance.handleControlButtonClick(buttonType);
      }
    },
    [gameInstance, openSettingMenu],
  );

  // 슬라이더 값 변경 핸들러 추가
  const handleSliderChange = useCallback(
    (value: number) => {
      if (gameInstance?.handleSliderValueChange) {
        // 게임 인스턴스에 슬라이더 값 전달
        gameInstance.handleSliderValueChange(value);
      }
    },
    [gameInstance],
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
    pendingSetupResolverRef.current?.(formData);
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
      {showSettingMenu && (
        <SettingMenuLayer
          vibrationEnabled={gameSettings.vibrationEnabled}
          notificationEnabled={gameSettings.notificationEnabled}
          onChangeVibration={handleVibrationSettingChange}
          onChangeNotification={handleNotificationSettingChange}
          onResetGameData={handleResetGameData}
          onClose={closeSettingMenu}
        />
      )}
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
