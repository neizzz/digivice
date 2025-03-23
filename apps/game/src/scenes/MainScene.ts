import * as PIXI from "pixi.js";
import { Scene } from "../interfaces/Scene";
import { Background } from "../entities/Background";
import { Character } from "../entities/Character";
import { AssetLoader } from "../utils/AssetLoader";
import { GameMenu, GameMenuOptions } from "../ui/GameMenu";
import { ControlButtonType, NavigationAction } from "../ui/types";
import { SceneKey } from "../SceneKey";
import { CharacterKey } from "../types/CharacterKey";
import { Game } from "../Game";

export class MainScene extends PIXI.Container implements Scene {
  private app: PIXI.Application;
  private background: Background;
  private character: Character;
  private initialized: boolean = false;

  // GameMenu 관련 필드
  private gameMenu: GameMenu | null = null;
  private navigationIndex: number = 0;

  // Game 인스턴스 참조
  private game: Game;

  constructor(app: PIXI.Application) {
    super();
    this.app = app;

    // DebugHelper 초기화 코드 제거

    // 에셋 가져오기 (이미 로드되었으므로 즉시 반환됨)
    const assets = AssetLoader.getAssets();

    // 배경 생성 및 추가
    const backgroundTexture = assets.backgroundTexture || PIXI.Texture.WHITE;
    this.background = new Background(backgroundTexture);

    // 캐릭터 생성 및 추가
    this.character = new Character({
      characterKey: CharacterKey.Mushroom2,
      initialPosition: {
        x: this.app.screen.width / 2,
        y: this.app.screen.height / 2,
      },
      speed: 1,
      scale: 3, // 캐릭터 크기 조정
    });

    this.setupScene();
  }

  /**
   * 씬을 동기적으로 설정합니다.
   */
  private setupScene(): void {
    // 에셋이 이미 로드되었다고 가정하고 동기적으로 처리
    try {
      this.addChild(this.background);
      this.addChild(this.character);

      // 초기 설정 완료
      this.positionCharacter();
      this.applyCharacterMovement();
      this.initialized = true;

      // 화면 크기에 맞게 조정
      this.onResize(this.app.screen.width, this.app.screen.height);

      console.log("MainScene setup completed");
    } catch (error) {
      console.error("Error setting up MainScene:", error);
    }

    // GameMenu 초기화
    this.initGameMenu();

    // 캐릭터 애니메이션 설정
    this.character.setAnimation("idle");
  }

  private positionCharacter(): void {
    const { width, height } = this.app.screen;
    this.character.position.set(width / 2, height / 2);
  }

  /**
   * 캐릭터에 랜덤 움직임을 적용하는 메서드
   */
  private applyCharacterMovement(): void {
    // 약간의 딜레이를 주어 캐릭터가 완전히 초기화된 후에 움직임을 적용
    setTimeout(() => {
      this.character.applyRandomMovement(this.app, {
        minIdleTime: 2000, // 최소 2초 대기
        maxIdleTime: 5000, // 최대 5초 대기
        minMoveTime: 1500, // 최소 1.5초 이동
        maxMoveTime: 4000, // 최대 4초 이동
        // moveSpeed 옵션 제거 - 캐릭터의 speed 속성을 사용함
        boundaryPadding: 50, // 화면 경계 여백
      });

      // 캐릭터 애니메이션 변경
      this.character.setAnimation("walking");
    }, 500);
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
    const parent = this.app.view.parentElement;
    if (!parent) {
      console.error("PIXI view has no parent element");
      return;
    }

    // 게임 내부에서 처리할 콜백 정의
    const gameMenuOptions: GameMenuOptions = {
      onTypeASelect: () => this.handleMenuSelect("typeA"),
      onTypeBSelect: () => this.handleMenuSelect("typeB"),
      onTypeCSelect: () => this.handleMenuSelect("typeC"),
      onTypeDSelect: () => this.handleMenuSelect("typeD"),
      onTypeESelect: () => this.handleMenuSelect("typeE"),
      onTypeFSelect: () => this.handleMenuSelect("typeF"),
      onCancel: () => this.handleMenuCancel(),
    };

    // 메뉴 생성 - 뷰 요소의 부모에 직접 추가
    this.gameMenu = new GameMenu(parent, gameMenuOptions);
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
  private handleMenuSelect(menuType: string): void {
    console.log(`메뉴 항목 선택: ${menuType}`);

    switch (menuType) {
      case "typeA":
        console.log("A 타입 버튼으로 플래피 버드 게임으로 전환 요청");
        if (this.game) {
          // GameMenu 제거
          if (this.gameMenu) {
            this.gameMenu.destroy();
            this.gameMenu = null;
          }

          // 캐릭터의 움직임 중지 (필요한 정리 작업)
          if (this.character) {
            this.character.stopRandomMovement();
          }

          // Game 인스턴스의 changeScene 호출
          this.game.changeScene(SceneKey.FLAPPY_BIRD_GAME);
        } else {
          console.warn("Game 객체 참조가 설정되지 않았습니다");
        }
        break;

      // 다른 메뉴 항목들 처리
      case "typeB":
        console.log("B 타입 버튼 선택");
        // B 타입 메뉴 처리 로직
        break;

      case "typeC":
        console.log("C 타입 버튼 선택");
        // C 타입 메뉴 처리 로직
        break;

      // 기타 메뉴 항목 처리...
      default:
        console.log(`${menuType} 메뉴 항목에 대한 처리가 구현되지 않았습니다`);
    }
  }

  /**
   * 메뉴 취소 처리
   */
  private handleMenuCancel(): void {
    console.log("메뉴 취소");
    // 여기에 취소 동작 로직 구현
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
      case ControlButtonType.LEFT:
        this.sendNavigationAction(NavigationAction.CANCEL);
        break;
      case ControlButtonType.CENTER:
        console.log("CENTER 버튼 클릭 - 선택 액션 전송");
        this.sendNavigationAction(NavigationAction.SELECT);
        break;
      case ControlButtonType.RIGHT:
        this.sendNavigationAction(NavigationAction.NEXT);
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
      this.character.stopRandomMovement();
      this.applyCharacterMovement();
    }
  }

  public update(deltaTime: number): void {
    // 초기화 전에는 업데이트 무시
    if (!this.initialized) return;

    // 캐릭터 업데이트
    if (this.character) {
      this.character.update(deltaTime);
    }
  }

  // 씬 정리를 위한 메서드 추가
  public destroy(): void {
    // GameMenu 정리
    if (this.gameMenu) {
      this.gameMenu.destroy();
      this.gameMenu = null;
    }

    // 캐릭터 정리
    if (this.character) {
      this.character.stopRandomMovement();
    }

    // 다른 리소스 정리 로직...
  }
}
