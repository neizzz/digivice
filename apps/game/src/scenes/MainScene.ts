import * as PIXI from "pixi.js";
import type { Game } from "../Game";
import { SceneKey } from "../SceneKey";
import { RandomMovementController } from "../controllers/RandomMovementController";
import { Background } from "../entities/Background";
import { Character } from "../entities/Character";
import { Food } from "../entities/Food";
import type { Scene } from "../interfaces/Scene";
import { GameMenu, type GameMenuOptions } from "../ui/GameMenu";
import { GameMenuItemType } from "../ui/GameMenu/GameMenuItem";
import {
  type ControlButtonParams,
  ControlButtonType,
  NavigationAction,
} from "../ui/types";
import { AssetLoader } from "../utils/AssetLoader";
import { GameDataManager } from "../utils/GameDataManager";
import { Broom } from "../entities/Broom";

enum MainSceneControlButtonsSetType {
  Default = "default",
  ActiveMenuItem = "active-menu-item",
  CleanMode = "clean-mode",
}

const CONTROL_BUTTONS_SET: Record<
  MainSceneControlButtonsSetType,
  [ControlButtonParams, ControlButtonParams, ControlButtonParams]
> = {
  [MainSceneControlButtonsSetType.Default]: [
    { type: ControlButtonType.Cancel },
    { type: ControlButtonType.Settings },
    { type: ControlButtonType.Next },
  ],
  [MainSceneControlButtonsSetType.ActiveMenuItem]: [
    { type: ControlButtonType.Cancel },
    { type: ControlButtonType.Confirm },
    { type: ControlButtonType.Next },
  ],
  [MainSceneControlButtonsSetType.CleanMode]: [
    { type: ControlButtonType.Cancel },
    { type: ControlButtonType.Clean },
    { type: ControlButtonType.Clean },
  ],
};

export class MainScene extends PIXI.Container implements Scene {
  private background: Background;
  private character!: Character;
  private initialized = false;

  // RandomMovementController 관련 필드
  private randomMovementController: RandomMovementController | null = null;

  // GameMenu 관련 필드
  private gameMenu: GameMenu | null = null;
  private navigationIndex = 0;

  // CleanMode 관련 필드
  private isCleanModeActive = false;
  private previousSliderValue = 0; // 이전 슬라이더 값
  private broom: Broom | null = null;

  // Game 인스턴스 참조
  private game: Game;

  constructor(game: Game) {
    super();
    this.game = game;

    const assets = AssetLoader.getAssets();
    const backgroundTexture = assets.backgroundTexture || PIXI.Texture.WHITE;
    this.background = new Background(backgroundTexture);
  }

  public async init(): Promise<MainScene> {
    try {
      const gameData = await GameDataManager.loadData();

      if (!gameData) {
        // TODO: 이름 setup씬으로 이동
        throw new Error("게임 데이터가 없습니다"); // 임시
      }

      // 캐릭터 생성 및 추가
      this.character = new Character({
        characterKey: gameData.character.key,
        initialPosition: {
          x: this.game.app.screen.width / 2,
          y: this.game.app.screen.height / 2,
        },
      });

      this.setupScene();
    } catch (error) {
      console.error("Error during MainScene initialization:", error);
    }
    return this;
  }

  /**
   * 씬을 동기적으로 설정합니다.
   */
  private setupScene(): void {
    // 에셋이 이미 로드되었다고 가정하고 동기적으로 처리
    try {
      // zIndex 기반 정렬을 활성화
      this.sortableChildren = true;

      this.addChild(this.background);
      this.addChild(this.character);

      // 초기 설정 완료
      this.positionCharacter();
      this.applyCharacterMovement();
      this.initialized = true;

      // 화면 크기에 맞게 조정
      this.onResize(this.game.app.screen.width, this.game.app.screen.height);

      console.log("MainScene setup completed");
    } catch (error) {
      console.error("Error setting up MainScene:", error);
    }

    // GameMenu 초기화
    this.initGameMenu();
  }

  private positionCharacter(): void {
    const { width, height } = this.game.app.screen;
    this.character.position.set(width / 2, height / 2);
  }

  /**
   * 캐릭터에 랜덤 움직임을 적용하는 메서드
   */
  private applyCharacterMovement(): void {
    // 기존 RandomMovementController가 있다면 제거
    if (this.randomMovementController) {
      this.randomMovementController.destroy();
    }

    // 새로운 RandomMovementController 생성
    this.randomMovementController = new RandomMovementController(
      this.character,
      this.game.app,
      {
        minIdleTime: 3000, // 최소 3초 대기
        maxIdleTime: 8000, // 최대 8초 대기
        minMoveTime: 2000, // 최소 2초 이동
        maxMoveTime: 7000, // 최대 7초 이동
      }
    );
  }

  /**
   * 랜덤 움직임을 중지합니다.
   */
  private stopRandomMovement(): void {
    if (this.randomMovementController) {
      this.randomMovementController.destroy();
      this.randomMovementController = null;
    }
  }

  /**
   * GameMenu를 초기화합니다
   */
  private initGameMenu(): void {
    // 기존 메뉴가 있다면 정리
    if (this.gameMenu) {
      this.gameMenu.destroy();
      this.gameMenu = null;
    }

    // PIXI 뷰의 부모 요소를 찾음
    // @ts-ignore
    const parent = this.game.app.view.parentElement;
    if (!parent) {
      console.error("PIXI view has no parent element");
      return;
    }

    // 게임 내부에서 처리할 콜백 정의
    const gameMenuOptions: GameMenuOptions = {
      onMiniGameSelect: () => this.handleMenuSelect(GameMenuItemType.MiniGame),
      onFeedSelect: () => this.handleMenuSelect(GameMenuItemType.Feed),
      onVersusSelect: () => this.handleMenuSelect(GameMenuItemType.Versus),
      onDrugSelect: () => this.handleMenuSelect(GameMenuItemType.Drug),
      onCleanSelect: () => this.handleMenuSelect(GameMenuItemType.Clean),
      onTrainingSelect: () => this.handleMenuSelect(GameMenuItemType.Training),
      onInformationSelect: () =>
        this.handleMenuSelect(GameMenuItemType.Information),
      onFocusChange: (focusedIndex) => {
        if (focusedIndex === null) {
          this.game.changeControlButtons(
            CONTROL_BUTTONS_SET[MainSceneControlButtonsSetType.Default]
          );
        } else {
          this.game.changeControlButtons(
            CONTROL_BUTTONS_SET[MainSceneControlButtonsSetType.ActiveMenuItem]
          );
        }
      },
    };

    // 메뉴 생성 - 뷰 요소의 부모에 직접 추가
    this.gameMenu = new GameMenu(parent, gameMenuOptions);

    // ControlButtons 생성
    this.game.changeControlButtons(
      CONTROL_BUTTONS_SET[MainSceneControlButtonsSetType.Default]
    );
  }

  /**
   * Game 객체 참조를 설정합니다
   */
  public setGameReference(game: Game): void {
    this.game = game;
  }

  /**
   * 메뉴 선택 처리
   */
  private handleMenuSelect(menuType: GameMenuItemType): void {
    console.log(`메뉴 항목 선택: ${menuType}`);

    switch (menuType) {
      case GameMenuItemType.MiniGame:
        console.log("미니게임 버튼으로 플래피 버드 게임으로 전환 요청");
        if (this.game) {
          // GameMenu 제거
          if (this.gameMenu) {
            this.gameMenu.destroy();
            this.gameMenu = null;
          }

          // 캐릭터의 움직임 중지 (필요한 정리 작업)
          if (this.character) {
            this.stopRandomMovement();
          }

          // Game 인스턴스의 changeScene 호출
          this.game.changeScene(SceneKey.FLAPPY_BIRD_GAME);
        } else {
          console.warn("Game 객체 참조가 설정되지 않았습니다");
        }
        break;
      case GameMenuItemType.Feed:
        {
          console.log("먹이 버튼 선택");
          // 음식 생성 및 던지기
          this.throwFood();
        }
        break;

      case GameMenuItemType.Versus:
        console.log("배틀 버튼 선택");
        // 배틀 로직
        break;

      case GameMenuItemType.Drug:
        console.log("약 버튼 선택");
        // 약 관련 로직
        break;

      case GameMenuItemType.Clean:
        console.log("청소 버튼 선택");
        this.game.changeControlButtons(
          CONTROL_BUTTONS_SET[MainSceneControlButtonsSetType.CleanMode]
        );
        this.initCleanMode();
        break;

      case GameMenuItemType.Training:
        console.log("훈련 버튼 선택");
        // 훈련 관련 로직
        break;

      case GameMenuItemType.Information:
        console.log("정보 버튼 선택");
        // 정보 관련 로직
        break;

      default:
        console.log(`${menuType} 메뉴 항목에 대한 처리가 구현되지 않았습니다`);
    }
  }

  /**
   * 음식을 던지는 로직을 별도 메서드로 분리
   */
  private throwFood(): void {
    // 새로운 Food 객체 생성 - 내부에서 모든 리소스 로드 및 관리
    const food = new Food(this.game.app, this, {
      character: this.character,
    });

    // 음식 먹기가 완료되면 캐릭터의 랜덤 움직임 재개
    food.waitForEatingFinished().then(() => {
      console.log("Food eating completed, restarting random movement");
      this.applyCharacterMovement();
    });
  }

  /**
   * ControlButton 클릭 처리
   */
  public handleControlButtonClick(buttonType: ControlButtonType): void {
    if (!this.gameMenu) {
      console.error("GameMenu is not initialized in MainScene");
      return;
    }

    // 버튼 타입에 따라 적절한 액션 처리
    switch (buttonType) {
      case ControlButtonType.Cancel:
        this.sendNavigationAction(NavigationAction.CANCEL);
        this.isCleanModeActive = false;
        break;
      case ControlButtonType.Settings:
        console.log("TODO: Settings popup 구현");
        break;
      case ControlButtonType.Confirm:
        this.sendNavigationAction(NavigationAction.SELECT);
        break;
      case ControlButtonType.Next:
        this.sendNavigationAction(NavigationAction.NEXT);
        break;
      case ControlButtonType.Clean:
        console.log("청소 작업 수행");
        break;
    }
  }

  /**
   * 네비게이션 액션을 GameMenu에 전달
   */
  private sendNavigationAction(action: NavigationAction): void {
    if (!this.gameMenu) return;

    this.navigationIndex++;

    this.gameMenu.processNavigationAction({
      type: action,
      index: this.navigationIndex,
    });
  }

  public handleSliderValueChange(value: number): void {
    if (!this.isCleanModeActive || !this.broom) return;

    // 슬라이더 드래그 방향에 따라 방향 결정
    // 이전 값과 현재 값의 차이로 방향 판단
    const delta = value - this.previousSliderValue;
    const minDeltaThreshold = 0.03; // 최소 변화량 (노이즈 방지)

    if (Math.abs(delta) > minDeltaThreshold) {
      if (delta < 0) {
        // 빗자루 방향 설정
        this.broom.setDirection(-1);
        console.log("청소 방향: 왼쪽 (드래그 방향)");
      } else {
        // 빗자루 방향 설정
        this.broom.setDirection(1);
        console.log("청소 방향: 오른쪽 (드래그 방향)");
      }
    }

    // 현재 값을 이전 값으로 저장
    this.previousSliderValue = value;

    // 캐릭터 옆에 빗자루 위치 업데이트
    if (this.character) {
      this.broom.setPosition(this.character.x + 50, this.character.y - 20);
    }
  }

  /**
   * 청소 모드를 활성화하고 빗자루 스프라이트를 초기화합니다.
   */
  private initCleanMode(): void {
    this.isCleanModeActive = true;

    // 기존 빗자루가 있으면 제거
    if (this.broom) {
      this.removeChild(this.broom);
      this.broom = null;
    }

    // 새 빗자루 객체 생성
    this.broom = new Broom();

    // 빗자루 위치 설정 (캐릭터 주변)
    if (this.character) {
      this.broom.setPosition(this.character.x + 50, this.character.y - 20);
    } else {
      this.broom.setPosition(
        this.game.app.screen.width / 2,
        this.game.app.screen.height / 2
      );
    }

    // 빗자루의 zIndex 설정
    this.broom.zIndex = 5; // 캐릭터보다 위에 표시되도록

    // 빗자루를 씬에 추가
    this.addChild(this.broom);
  }

  public onResize(width: number, height: number): void {
    // 초기화 전에는 리사이징 무시
    if (!this.initialized) return;

    // 화면 크기 변경 시 배경 크기 조정
    if (this.background) {
      this.background.resize(width, height);
    }

    // 캐릭터 위치 재조정
    if (this.character) {
      this.positionCharacter();
      this.stopRandomMovement();
      this.applyCharacterMovement();
    }
  }

  public update(deltaTime: number): void {
    // 초기화 전에는 업데이트 무시
    if (!this.initialized) return;

    // RandomMovementController가 있으면 업데이트
    if (this.randomMovementController) {
      this.randomMovementController.update(deltaTime);
    }
  }

  // 씬 정리를 위한 메서드 추가
  public destroy(): void {
    // GameMenu 정리
    if (this.gameMenu) {
      this.gameMenu.destroy();
      this.gameMenu = null;
    }

    // 랜덤 움직임 중지
    this.stopRandomMovement();

    // 다른 리소스 정리 로직...
  }
}
