import * as PIXI from "pixi.js";
import { SceneKey } from "./SceneKey";
import type { Scene } from "./interfaces/Scene";
import { FlappyBirdGameScene } from "./scenes/FlappyBirdGameScene";
import { MainScene } from "./scenes/MainScene";
import type { ControlButtonParams, ControlButtonType } from "./ui/types";
import { AssetLoader } from "./utils/AssetLoader";
import { DebugUI } from "./utils/DebugUI";
import { DebugFlags } from "./utils/DebugFlags";
import { Character } from "./entities/Character"; // 캐릭터 임포트
import { Egg } from "./entities/Egg"; // Egg 클래스 임포트 추가
import { GameDataManager } from "./managers/GameDataManager"; // GameDataManager 임포트
import type { GameData } from "./types/GameData"; // GameData 타입 임포트
import { CHARACTER_MOVEMENT, GAME_LOOP } from "./config"; // TimeConfig로 변경
import { TimeManager } from "./managers/TimeManager"; // TimeManager 임포트 추가
import { EventBus, EventTypes } from "./utils/EventBus"; // EventBus 임포트 추가
import { CharacterState, type CharacterKey } from "./types/Character";

PIXI.BaseTexture.defaultOptions.scaleMode = PIXI.SCALE_MODES.NEAREST;

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
  public character?: Character | Egg; // Character 또는 Egg 타입으로 변경
  public showAlert: ShowAlertCallback; // 팝업 콜백 추가

  private currentScene?: Scene;
  private scenes: Map<SceneKey, Scene> = new Map();
  private currentSceneKey?: SceneKey;
  private assetsLoaded = false;
  private timeManager: TimeManager; // TimeManager 인스턴스 추가
  private isUnloading = false;

  constructor(params: {
    parentElement: HTMLElement;
    onCreateInitialGameData: CreateInitialGameDataCallback;
    changeControlButtons: ControlButtonsChangeCallback;
    showAlert: ShowAlertCallback; // 팝업 콜백 추가
  }) {
    const { parentElement, changeControlButtons, showAlert } = params;
    this.changeControlButtons = changeControlButtons;
    this.showAlert = showAlert; // 팝업 콜백 저장
    this.timeManager = TimeManager.getInstance(); // TimeManager 인스턴스 초기화

    // PIXI 애플리케이션을 생성하고 DOM에 추가합니다
    this.app = new PIXI.Application({
      width: parentElement.clientWidth,
      height: parentElement.clientHeight,
      backgroundColor: 0xaaaaaa,
      autoDensity: true,
      resolution: window.devicePixelRatio || 2, // 해상도를 디바이스 픽셀 비율로 설정하거나 원하는 값(예: 2)으로 설정
    });

    // 렌더링 주기를 60fps로 설정
    this.app.ticker.minFPS = 60;
    this.app.ticker.maxFPS = 60;

    // DOM에 캔버스 추가
    parentElement.appendChild(this.app.view as HTMLCanvasElement);

    // 리사이징 핸들러 설정
    window.addEventListener("resize", this.onResize.bind(this));
    this.onResize();

    // NOTE: 디버그 UI 초기화 / from "@digivice/client"
    if (import.meta.env.DEV === true) {
      DebugFlags.getInstance(); // 인스턴스 생성
      DebugUI.getInstance();
    }

    this.getData().then((gameData) => {
      if (gameData) {
        // 앱이 완전히 껐다 켜졌을 때도 resume 이벤트를 발생시킴
        EventBus.publish(EventTypes.APP_RESUME, { timestamp: Date.now() });
        this.startInitialization(gameData);
      } else {
        console.log("게임 데이터가 없습니다. setup layer 생성");
        params
          .onCreateInitialGameData()
          .then((initializationFormData: { name: string }) =>
            GameDataManager.createInitialGameData(initializationFormData)
          )
          .then((gameData) => {
            if (gameData) {
              console.log("게임 데이터 생성 성공:", gameData);
              this.startInitialization(gameData);
            } else {
              throw new Error("게임 데이터 로드 실패");
            }
          })
          .catch((error) => {
            console.error("게임 데이터 생성 중 오류:", error);
          });
      }
    });
    GameDataManager.initialize();
  }

  /**
   * 초기화 프로세스를 시작합니다 (비동기 작업을 동기적으로 관리)
   */
  private startInitialization(gameData: GameData): void {
    console.log("게임 초기화 프로세스 시작");
    this.waitForAppInitialization().then(() => {
      AssetLoader.loadAssets()
        .then(() => {
          this.assetsLoaded = true;
          console.log("에셋 로딩 완료");

          this.initializeCharacter(gameData).then(() => {
            // 캐릭터 진화 이벤트 리스너 등록
            this.setupCharacterEvolutionListener();

            this.setupInitialScene();
            this.setupGameLoop();
          });
        })
        .catch((error) => {
          console.error("에셋 로딩 오류:", error);
        });
    });
  }

  /**
   * 캐릭터 진화 이벤트 리스너 설정
   */
  private setupCharacterEvolutionListener(): void {
    EventBus.subscribe(EventTypes.CHARACTER_EVOLVED, async (data) => {
      console.log(`캐릭터 진화 이벤트 수신: ${data.characterKey}`);

      try {
        // 현재 character가 Egg인 경우에만 진화 처리
        if (this.character instanceof Egg) {
          const position = {
            x: this.character.position.x,
            y: this.character.position.y,
          };

          // 기존 Egg 객체 스테이지에서 제거
          if (this.currentScene instanceof MainScene) {
            this.currentScene.removeChild(this.character);
          }

          // 새 캐릭터 생성
          const newCharacter = new Character({
            characterKey: data.characterKey,
            app: this.app,
            status: {
              position,
              state: CharacterState.IDLE,
              stamina: 6,
              sick: false,
            },
          });

          // 새 캐릭터를 Game 인스턴스와 현재 씬에 등록
          this.character = newCharacter;

          // 현재 씬이 MainScene인 경우 새 캐릭터 추가
          if (this.currentScene instanceof MainScene) {
            this.currentScene.addChild(newCharacter);
          }

          // DebugUI에 캐릭터 참조 설정
          DebugUI.getInstance().setCharacter(newCharacter);

          console.log("캐릭터 진화 완료: 화면 업데이트됨");
        }
      } catch (error) {
        console.error("캐릭터 진화 처리 중 오류:", error);
      }
    });
  }

  /**
   * 캐릭터 초기화
   */
  private async initializeCharacter(gameData: GameData): Promise<void> {
    try {
      const characterKey = gameData.character.key;
      const status = gameData.character.status;

      // 저장된 마지막 위치가 있으면 사용, 없으면 화면 중앙으로 설정
      const position = (() => {
        if (
          status?.position &&
          !Number.isNaN(status.position.x) &&
          !Number.isNaN(status.position.y)
        ) {
          return status.position;
        }
        return {
          x: this.app.screen.width / 2,
          y: this.app.screen.height / 2,
        };
      })();

      // 캐릭터 타입에 따라 적절한 클래스 인스턴스 생성
      if (characterKey === "egg") {
        console.log("Egg 생성 (Character와 별개의 간단한 엔티티)");
        // Egg는 Character를 상속받지 않는 독립적인 간단한 엔티티
        this.character = new Egg({
          position,
          app: this.app,
        });
      } else {
        console.log(`일반 캐릭터(${characterKey}) 생성`);
        // 기존 Character 클래스 사용
        this.character = new Character({
          characterKey: characterKey as CharacterKey,
          app: this.app,
          status: gameData.character.status,
        });

        // 현재 씬이 MainScene이면 캐릭터 추가
        if (this.currentScene instanceof MainScene) {
          this.currentScene.addChild(this.character);
        }
      }

      // DebugUI에 캐릭터 참조 설정
      if (this.character instanceof Character) {
        DebugUI.getInstance().setCharacter(this.character);
      }

      console.log("캐릭터 초기화 완료");
    } catch (error) {
      console.error("캐릭터 초기화 중 오류:", error);
      throw error;
    }
  }

  /**
   * ControlButton 클릭 이벤트를 처리합니다
   * @param buttonType 클릭된 버튼 타입
   */
  public handleControlButtonClick(buttonType: ControlButtonType): void {
    // 현재 씬이 있으면 컨트롤 이벤트 전달
    if (this.currentScene) {
      this.currentScene.handleControlButtonClick(buttonType);
      return;
    }
  }

  public handleSliderValueChange(value: number): void {
    // 현재 씬이 있으면 슬라이더 값 변경 이벤트 전달
    if (this.currentScene) {
      this.currentScene.handleSliderValueChange?.(value);
      return;
    }
    throw new Error("현재 씬이 없습니다");
  }
  public handleSliderEnd(): void {
    this.currentScene?.handleSliderEnd?.();
  }

  /**
   * 기본 씬을 설정합니다
   */
  private setupInitialScene(): void {
    this.changeScene(SceneKey.MAIN);
  }

  /**
   * 게임 루프를 설정합니다
   */
  private setupGameLoop(): void {
    // TimeManager 시작
    this.timeManager.start();

    // 앱 포커스 이벤트 리스너 설정
    this.setupAppFocusListeners();

    this.app.ticker.add((tick: number) => {
      this.update(tick * GAME_LOOP.DELTA_MS);
    });
  }

  /**
   * 앱 포커스 이벤트 리스너 설정
   */
  private setupAppFocusListeners(): void {
    // 브라우저 환경에서만 동작
    if (typeof document !== "undefined" && typeof window !== "undefined") {
      // 새로고침/탭 닫힘 감지용 플래그
      window.addEventListener("beforeunload", () => {
        this.isUnloading = true;
      });

      // 앱이 포커스를 잃을 때 (백그라운드로 전환)
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          if (!this.isUnloading) {
            console.log("앱이 백그라운드로 전환되었습니다");
            this.saveGameState();
          } else {
            console.log(
              "새로고침/탭 닫힘으로 인한 백그라운드 전환 - 저장 생략"
            );
          }
          this.timeManager.stop();
        } else {
          console.log("앱이 포그라운드로 돌아왔습니다");
          // 앱이 다시 포커스를 얻을 때 resume 이벤트 발행
          EventBus.publish(EventTypes.APP_RESUME, { timestamp: Date.now() });
          this.timeManager.start();
        }
      });
      // // 창이 포커스를 잃을 때
      // window.addEventListener("blur", () => {
      //   if (!this.isUnloading) {
      //     console.log("앱이 포커스를 잃었습니다");
      //     // 캐릭터 위치 및 상태 저장
      //     this.saveGameState();
      //   } else {
      //     console.log("새로고침/탭 닫힘으로 인한 blur - 저장 생략");
      //   }
      //   this.timeManager.stop();
      // });
      // // 창이 포커스를 얻을 때
      // window.addEventListener("focus", () => {
      //   console.log("앱이 포커스를 얻었습니다");
      //   EventBus.publish(EventTypes.APP_RESUME, { timestamp: Date.now() });
      //   this.timeManager.start();
      // });
    }
  }

  /**
   * 게임 상태(캐릭터 위치, 상태 등)를 저장합니다.
   */
  private saveGameState(): void {
    // 캐릭터 위치와 상태 저장
    if (this.character instanceof Character) {
      this.character.savePositionAndState();
    }
  }

  private update(deltaTime: number): void {
    // 현재 씬 업데이트
    if (this.currentScene) {
      this.currentScene.update(deltaTime);
    }

    // TimeManager 업데이트
    this.timeManager.update(deltaTime);
  }

  /**
   * PIXI 애플리케이션이 완전히 초기화될 때까지 대기
   */
  private waitForAppInitialization = (): Promise<void> => {
    return new Promise<void>((resolve) => {
      const onFirstRender = () => {
        // 한 번 실행 후 제거
        this.app.ticker.remove(onFirstRender);
        resolve();
      };

      // 다음 프레임에서 초기화 완료로 간주
      this.app.ticker.add(onFirstRender);
    });
  };

  private onResize(): void {
    // 화면 크기에 맞게 캔버스 조정
    const parent = this.app.view;
    if (!parent || !parent.getBoundingClientRect) {
      throw new Error("Parent element is not available.");
    }

    const { width, height } = parent.getBoundingClientRect();
    this.app.renderer.resize(width, height);

    // 리사이징 시에도 해상도 설정 유지
    this.app.renderer.resolution = window.devicePixelRatio || 2;

    if (this.currentScene) {
      this.currentScene.onResize(width, height);
    }
  }

  /**
   * SceneKey에 맞는 씬 객체를 생성합니다
   * @param key 생성할 씬의 키
   * @returns 생성된 씬 객체
   */
  private async createScene(key: SceneKey): Promise<Scene> {
    console.log(`Creating new scene: ${key}`);

    // 에셋이 로드되지 않았으면 오류 표시
    if (!this.assetsLoaded) {
      console.warn(
        "에셋이 아직 로드되지 않았습니다. 씬이 제대로 표시되지 않을 수 있습니다."
      );
    }

    switch (key) {
      case SceneKey.MAIN:
        return new MainScene(this).init();
      case SceneKey.FLAPPY_BIRD_GAME:
        return new FlappyBirdGameScene(this).init();
      default:
        throw new Error(`Unknown scene key: ${key}`);
    }
  }

  /**
   * 씬을 키를 통해 전환합니다
   * @param key 전환할 씬의 키
   * @returns 성공 여부
   */
  public async changeScene(key: SceneKey): Promise<boolean> {
    try {
      console.log(`씬 전환 요청: ${key}`);

      // 기존 씬과 같은 씬으로 전환하는 경우 무시
      if (this.currentSceneKey === key) {
        console.log(`이미 ${key} 씬에 있습니다`);
        return true;
      }

      // 캐시된 씬이 없으면 새로 생성
      if (!this.scenes.has(key)) {
        console.log(`새로운 씬 생성: ${key}`);
        const newScene = await this.createScene(key);
        this.scenes.set(key, newScene);
      }

      // 기존 씬이 있으면 제거
      if (
        this.currentScene &&
        this.currentScene instanceof PIXI.DisplayObject
      ) {
        console.log(`기존 씬 제거: ${this.currentSceneKey}`);
        this.app.stage.removeChild(this.currentScene);
      }

      // 새 씬 설정
      this.currentScene = this.scenes.get(key) as Scene;
      this.currentSceneKey = key;

      // 새 씬이 DisplayObject이면 스테이지에 추가
      if (this.currentScene instanceof PIXI.DisplayObject) {
        this.app.stage.addChild(this.currentScene);
      }

      // 새 씬의 크기 조정
      const { width, height } = this.app.renderer.screen;
      this.currentScene.onResize(width, height);

      console.log(`씬 전환 완료: ${key}`);
      return true;
    } catch (error) {
      console.error(`씬 전환 오류 (${key}):`, error);
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

  /**
   * 게임 데이터를 가져옵니다
   * @returns 게임 데이터
   */
  public async getData(): Promise<GameData | undefined> {
    try {
      const gameData = await GameDataManager.loadData();
      console.log("게임 데이터 로드 완료:", gameData);
      return gameData;
    } catch (error) {
      console.error("게임 데이터 로드 중 오류:", error);
      return undefined;
    }
  }

  public destroy(): void {
    // 정리 작업
    window.removeEventListener("resize", this.onResize.bind(this));
    this.app.destroy(true, {
      children: true,
      texture: true,
      baseTexture: true,
    });

    // 현재 씬이 MainScene이면 destroy 호출
    this.currentScene?.destroy?.();
  }
}
