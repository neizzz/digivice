import * as PIXI from "pixi.js";
import { SceneKey } from "./SceneKey";
import type { Scene } from "./interfaces/Scene";
import { FlappyBirdGameScene } from "./scenes/FlappyBirdGameScene";
import type { ControlButtonParams, ControlButtonType } from "./ui/types";
// import { AssetLoader } from "./utils/AssetLoader";
// import { DebugUI } from "./utils/DebugUI";
// import { DebugFlags } from "./utils/DebugFlags";
// import { Character } from "./entities/Character"; // 캐릭터 임포트
// import { Egg } from "./entities/Egg"; // Egg 클래스 임포트 추가
// import { GameDataManager } from "./managers/GameDataManager"; // GameDataManager 임포트
import type { GameData } from "./types/GameData"; // GameData 타입 임포트
import { GAME_LOOP } from "./config"; // TimeConfig로 변경
import type { CharacterKey } from "./types/Character";
import { simulateCharacterStatus } from "./utils/simulator";
import { MainSceneWorld } from "./scenes/MainScene/world";

PIXI.TexturePool.textureOptions.scaleMode = "nearest";

const SCREEN_PADDING = 10;

export type ControlButtonsChangeCallback = (
  controlButtonParamsSet: [
    ControlButtonParams,
    ControlButtonParams,
    ControlButtonParams
  ]
) => void;

export type CreateInitialGameDataCallback = () => Promise<{
  name: string;
}>;

export type ShowAlertCallback = (message: string, title?: string) => void;

export class Game {
  public app: PIXI.Application;
  public changeControlButtons: ControlButtonsChangeCallback;
  public showAlert: ShowAlertCallback; // 팝업 콜백 추가

  private _parentElement: HTMLElement;
  private currentScene?: Scene;
  // private scenes: Map<SceneKey, Scene> = new Map();
  private currentSceneKey?: SceneKey;
  private assetsLoaded = false;
  // private characterManager: CharacterManager; // CharacterManager 인스턴스 추가
  // private shouldSaveDataBeforeUnload = false;

  constructor(params: {
    parentElement: HTMLElement;
    onCreateInitialGameData: CreateInitialGameDataCallback;
    changeControlButtons: ControlButtonsChangeCallback;
    showAlert: ShowAlertCallback; // 팝업 콜백 추가
  }) {
    const { parentElement, changeControlButtons, showAlert } = params;
    this.changeControlButtons = changeControlButtons;
    this.showAlert = showAlert; // 팝업 콜백 저장

    // CharacterManager와 TimeManager 인스턴스 초기화(순서 중요)
    // this.characterManager = new CharacterManager(this); // CharacterManager 인스턴스 초기화

    this.app = new PIXI.Application();

    // 렌더링 주기를 60fps로 설정
    this._parentElement = parentElement;

    // DOM에 캔버스 추가
    // parentElement.appendChild(this.app.canvas);

    // 리사이징 핸들러 설정
    window.addEventListener("resize", this._onResize.bind(this));
    // this._onResize();

    // NOTE: 디버그 UI 초기화 / from "@digivice/client"
    // if (import.meta.env.DEV === true) {
    //   DebugFlags.getInstance(); // 인스턴스 생성
    //   DebugUI.getInstance();
    // }

    // GameDataManager.initialize();
    // LastCheckDataManager.initialize();

    // this.getData().then(async (gameData) => {
    //   if (gameData) {
    //     console.log("[Game] 게임 데이터 로드 성공:", gameData);
    //     const lastCheckData =
    //       (await LastCheckDataManager.loadData()) as unknown as LastCheckData;

    //     console.log(
    //       `[Game] 저장 시간 : ${new Date(
    //         gameData._savedAt
    //       ).toLocaleString()} (lastCheckData: ${new Date(
    //         lastCheckData._savedAt
    //       ).toLocaleString()}) / 차이: ${
    //         gameData._savedAt - lastCheckData._savedAt
    //       }ms`
    //     );

    //     const { resultGameData, resultLastCheckData } = simulateCharacterStatus(
    //       {
    //         elapsedTime: Date.now() - gameData._savedAt,
    //         inputGameData: gameData,
    //         inputCheckData: lastCheckData,
    //       }
    //     );
    //     GameDataManager._saveData(resultGameData);
    //     LastCheckDataManager._saveData(resultLastCheckData);
    //     this.startInitialization(gameData);
    //   } else {
    //     console.log("[Game] 게임 데이터가 없습니다. setup layer 생성");
    //     params
    //       .onCreateInitialGameData()
    //       .then(async (initializationFormData: { name: string }) => {
    //         const initialGameData = GameDataManager.createInitialData(
    //           initializationFormData,
    //           {
    //             position: {
    //               x: this.app.screen.width / 2,
    //               y: this.app.screen.height / 2,
    //             },
    //           }
    //         );
    //         await LastCheckDataManager.createInitialData();
    //         return initialGameData;
    //       })
    //       .then((gameData) => {
    //         if (gameData) {
    //           console.log("[Game] 게임 데이터 생성 성공:", gameData);
    //           this.startInitialization(gameData);
    //         } else {
    //           throw new Error("게임 데이터 로드 실패");
    //         }
    //       })
    //       .catch((error) => {
    //         console.error("[Game] 게임 데이터 생성 중 오류:", error);
    //       });
    //   }
    // });
  }

  /**
   * 초기화 프로세스를 시작합니다 (비동기 작업을 동기적으로 관리)
   */
  // private startInitialization(gameData: GameData): void {
  //   console.log("[Game] 게임 초기화 프로세스 시작");
  //   this.waitForAppInitialization()
  //     .then(async () => {
  //       await AssetLoader.loadAssets();
  //     })
  //     .then(() => {
  //       this.assetsLoaded = true;
  //       this._initializeCharacter(gameData).then(() => {
  //         this._setupInitialScene();
  //         this._setupGameLoop();
  //       });

  //       if (import.meta.env.DEV) {
  //         DebugUI.getInstance();
  //       }
  //     })
  //     .catch((error) => {
  //       console.error("[Game] 에셋 로딩 오류:", error);
  //     });
  // }

  // private async _initializeCharacter(gameData: GameData): Promise<void> {
  //   try {
  //     const characterKey = gameData.character.key;
  //     const status = gameData.character.status;

  //     // 캐릭터 타입에 따라 적절한 클래스 인스턴스 생성
  //     const entity = (() => {
  //       if (characterKey === "egg") {
  //         console.log("[Game] Egg 생성 (Character와 별개의 간단한 엔티티)");
  //         // Egg는 Character를 상속받지 않는 독립적인 간단한 엔티티
  //         return new Egg({
  //           position: status.position,
  //           app: this.app,
  //         });
  //       }
  //       console.log(`[Game] 일반 캐릭터(${characterKey}) 생성`);
  //       // 기존 Character 클래스 사용
  //       return new Character({
  //         characterKey: characterKey as CharacterKey,
  //         app: this.app,
  //         status: gameData.character.status,
  //       });
  //     })();

  //     this.characterManager.setEntity(entity);

  //     if (import.meta.env.DEV && entity instanceof Character) {
  //       DebugUI.getInstance().setCharacter(entity);
  //     }
  //   } catch (error) {
  //     console.error("[Game] 캐릭터 초기화 중 오류:", error);
  //     throw error;
  //   }
  // }

  /**
   * ControlButton 클릭 이벤트를 처리합니다
   * @param buttonType 클릭된 버튼 타입
   */
  public handleControlButtonClick(buttonType: ControlButtonType): void {
    this.currentScene?.handleControlButtonClick(buttonType);
  }

  public handleSliderValueChange(value: number): void {
    this.currentScene?.handleSliderValueChange?.(value);
  }
  public handleSliderEnd(): void {
    this.currentScene?.handleSliderEnd?.();
  }

  /** NOTE: 싱글턴 인스턴스가 모두 초기화되고 호출되어야 함. */
  public async initialize(): Promise<void> {
    // this._waitForAppInitialization()
    this.app
      .init({
        width: this._parentElement.clientWidth,
        height: this._parentElement.clientHeight,
        backgroundColor: 0xaaaaaa,
        autoDensity: true,
        resolution: window.devicePixelRatio || 2, // 해상도를 디바이스 픽셀 비율로 설정하거나 원하는 값(예: 2)으로 설정
      })
      .then(async () => {
        this.app.ticker.minFPS = 60;
        this.app.ticker.maxFPS = 60;
        this._parentElement.appendChild(this.app.canvas);
        this._onResize();
      })
      .then(() => {
        this.assetsLoaded = true;

        // if (import.meta.env.DEV) {
        //   DebugUI.getInstance();
        // }

        this._setupInitialScene();
        this._setupGameLoop();
        this.start();
      })
      .catch((error) => {
        console.error("[Game] 초기화 오류:", error);
      });
  }

  public start(): void {
    this.app.ticker.start();
  }

  public stop(): void {
    this.app.ticker.stop();
  }

  private _setupInitialScene(): void {
    this.changeScene(SceneKey.MAIN);
  }

  private _setupGameLoop(): void {
    // 앱 포커스 이벤트 리스너 설정
    this._setupAppLifecycleListeners();

    this.app.ticker.add((ticker: PIXI.Ticker) => {
      this._update(ticker.deltaMS);
    });
  }

  /**
   * 앱 포커스 이벤트 리스너 설정
   */
  private _setupAppLifecycleListeners(): void {
    // 브라우저 환경에서만 동작
    // NOTE: ❗️❗️❗️❗️❗️
    // if (typeof document !== "undefined" && typeof window !== "undefined") {
    //   // NOTE: PC브라우저 디버깅용 새로고침/탭 닫힘 감지용 플래그
    //   window.addEventListener("reload", async () => {
    //     const gameData = await GameDataManager._loadData();
    //     this.shouldSaveDataBeforeUnload = !!gameData;
    //   });
    //   window.addEventListener("beforeunload", async () => {
    //     const gameData = await GameDataManager._loadData();
    //     this.shouldSaveDataBeforeUnload = !!gameData;
    //   });
    //   // 페이지 숨김/표시 이벤트
    //   document.addEventListener("visibilitychange", async () => {
    //     // NOTE: 앱이 새로 켜질때는 Game생성자에서 처리. 여기서는 앱끄기/홈버튼/resume 케이스만 다룸.
    //     if (document.hidden) {
    //       // "앱끄기/홈버튼" 시점
    //       console.log("[Game] 앱 상태 변경: background-running");
    //       this.app.ticker.stop(); // 게임 루프 중지
    //       if (this.shouldSaveDataBeforeUnload) {
    //         console.log("[Game] 화면이 꺼지기 전에 게임 데이터 저장.");
    //         this.saveGameState();
    //       }
    //     } else {
    //       // "resume" 시점
    //       console.log("[Game] 앱 상태 변경: active");
    //       const gameData = (await GameDataManager.getData()) as GameData;
    //       const lastCheckData =
    //         (await LastCheckDataManager.loadData()) as LastCheckData;
    //       const elapsedTime = Date.now() - gameData._savedAt;
    //       const { resultGameData, resultLastCheckData } =
    //         simulateCharacterStatus({
    //           elapsedTime: elapsedTime,
    //           inputGameData: gameData,
    //           inputCheckData: lastCheckData,
    //         });
    //       this.characterManager.updateCharacter({
    //         before: gameData.character,
    //         after: resultGameData.character,
    //       });
    //       this.app.ticker.start();
    //       GameDataManager._saveData(resultGameData);
    //       LastCheckDataManager._saveData(resultLastCheckData);
    //     }
    //   });
    // }
  }

  /**
   * 게임 상태(캐릭터 위치, 상태 등)를 저장합니다.
   */
  // private saveGameState(): void {
  //   // 캐릭터 위치와 상태 저장
  //   const character = this.characterManager.getCharacter();
  //   if (character) {
  //     character.savePositionAndState();
  //   }
  //   false;
  // }

  private _update(deltaTime: number): void {
    this.currentScene?.update(deltaTime);
  }

  /**
   * PIXI 애플리케이션이 완전히 초기화될 때까지 대기
   */
  // private _waitForAppInitialization = (): Promise<void> => {
  //   return new Promise<void>((resolve) => {
  //     const onFirstRender = () => {
  //       // 한 번 실행 후 제거
  //       this.app.ticker.remove(onFirstRender);
  //       resolve();
  //     };

  //     // 다음 프레임에서 초기화 완료로 간주
  //     this.app.ticker.add(onFirstRender);
  //   });
  // };

  private _onResize(): void {
    const parent = this.app.canvas;
    if (!parent || !parent.getBoundingClientRect) {
      throw new Error("Parent element is not available.");
    }
    const { width, height } = parent.getBoundingClientRect();
    this.app.renderer.resize(width, height);
    this.app.renderer.resolution = window.devicePixelRatio || 2;
    this.app.stage.setSize(width, height);

    // MainSceneWorld의 resize 메소드 호출
    if (this.currentScene && this.currentSceneKey === SceneKey.MAIN) {
      const mainSceneWorld = this.currentScene as unknown as MainSceneWorld;
      mainSceneWorld.resize(
        width - 2 * SCREEN_PADDING,
        height - 2 * SCREEN_PADDING
      );
    }
  }

  /**
   * SceneKey에 맞는 씬 객체를 생성합니다
   * @param key 생성할 씬의 키
   * @returns 생성된 씬 객체
   */
  private async _createScene(
    key: SceneKey
    // gameData: GameData
  ): Promise<Scene> {
    console.log(`[Game] Creating new scene: ${key}`);

    // 에셋이 로드되지 않았으면 오류 표시
    if (!this.assetsLoaded) {
      console.warn(
        "[Game] 에셋이 아직 로드되지 않았습니다. 씬이 제대로 표시되지 않을 수 있습니다."
      );
    }

    switch (key) {
      case SceneKey.MAIN:
        // return new MainScene(this).init(gameData);
        const mainSceneWorld = new MainSceneWorld({
          stage: this.app.stage,
          positionBoundary: {
            x: SCREEN_PADDING,
            y: SCREEN_PADDING,
            width: this.app.screen.width - 2 * SCREEN_PADDING,
            height: this.app.screen.height - 2 * SCREEN_PADDING,
          },
          parentElement: this._parentElement,
        });
        await mainSceneWorld.init();
        return mainSceneWorld as unknown as Scene;

      // case SceneKey.FLAPPY_BIRD_GAME:
      //   return new FlappyBirdGameScene(this).init();
      default:
        throw new Error(`[Game] Unknown scene key: ${key}`);
    }
  }

  /**
   * 씬을 키를 통해 전환합니다
   * @param key 전환할 씬의 키
   * @returns 성공 여부
   */
  public async changeScene(key: SceneKey): Promise<boolean> {
    try {
      console.log(`[Game] 씬 전환 요청: ${key}`);

      // 기존 씬과 같은 씬으로 전환하는 경우 무시
      if (this.currentSceneKey === key) {
        console.log(`[Game] 이미 ${key} 씬에 있습니다`);
        return true;
      }

      // 캐시된 씬이 없으면 새로 생성
      // if (!this.scenes.has(key)) {
      //   console.log(`[Game] 새로운 씬 생성: ${key}`);
      //   // const gameData = await GameDataManager.getData();
      //   // const newScene = await this._createScene(key, gameData as GameData);
      //   this.scenes.set(key, newScene);
      // }

      // // 기존 씬이 있으면 제거
      // if (
      //   this.currentScene &&
      //   this.currentScene instanceof PIXI.DisplayObject
      // ) {
      //   console.log(`[Game] 기존 씬 제거: ${this.currentSceneKey}`);
      //   this.app.stage.removeChild(this.currentScene);
      // }

      this.currentScene = await this._createScene(key);
      this.currentSceneKey = key;

      // 새 씬이 DisplayObject이면 스테이지에 추가
      // if (this.currentScene instanceof PIXI.DisplayObject) {
      // this.app.stage.addChild(newScene);
      // }

      // 새 씬의 크기 조정
      // const { width, height } = this.app.renderer.screen;
      // this.currentScene.onResize(width, height);

      console.log(`[Game] 씬 전환 완료: ${key}`);
      return true;
    } catch (error) {
      console.error(`[Game] 씬 전환 오류 (${key}):`, error);
      return false;
    }
  }

  /**
   * 현재 활성화된 씬의 키를 반환합니다
   */
  public getCurrentSceneKey(): SceneKey | undefined {
    return this.currentSceneKey;
  }

  /**
   * 사용 가능한 모든 씬 키 목록을 반환합니다
   */
  public getAvailableSceneKeys(): SceneKey[] {
    return Object.values(SceneKey);
  }

  // public getCharacterManager(): CharacterManager {
  //   return this.characterManager;
  // }

  // /**
  //  * 게임 데이터를 가져옵니다
  //  * @returns 게임 데이터
  //  */
  // public async getData(): Promise<GameData | undefined> {
  //   try {
  //     const gameData = await GameDataManager.getData();
  //     return gameData;
  //   } catch (error) {
  //     console.error("[Game] 게임 데이터 로드 중 오류:", error);
  //     return undefined;
  //   }
  // }

  public destroy(): void {
    // 정리 작업
    window.removeEventListener("resize", this._onResize.bind(this));
    this.app.destroy(true, {
      children: true,
      texture: true,
    });

    // 현재 씬이 MainScene이면 destroy 호출
    this.currentScene?.destroy?.();
  }
}
