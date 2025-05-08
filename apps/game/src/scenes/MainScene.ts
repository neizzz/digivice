import * as PIXI from "pixi.js";
import type { Game } from "../Game";
import { SceneKey } from "../SceneKey";
import { Background } from "../entities/Background";
import { Food } from "../entities/Food";
import type { FoodTracker } from "../trackers/FoodTracker";
import type { Scene } from "../interfaces/Scene";
import { GameMenu, type GameMenuOptions } from "../ui/GameMenu";
import { GameMenuItemType } from "../ui/GameMenu/GameMenuItem";
import {
  type ControlButtonParams,
  ControlButtonType,
  NavigationAction,
} from "../ui/types";
import { AssetLoader } from "../utils/AssetLoader";
import { CleaningManager } from "../managers/CleaningManager";
import type { CharacterKey } from "../types/Character";
import { Bird } from "../entities/Bird"; // Bird 클래스 import 추가
import { Character } from "../entities/Character";
import { Egg } from "../entities/Egg";

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
  private initialized = false;

  // GameMenu 관련 필드
  private gameMenu: GameMenu | null = null;
  private navigationIndex = 0;

  // CleanMode 관련 필드
  private isCleanModeActive = false;

  // CleaningManager 추가
  private cleaningManager: CleaningManager | null = null;

  // Bird와 Basket 관련 필드 추가
  private bird: Bird | null = null; // Bird 클래스를 사용하도록 수정
  private basket: PIXI.Sprite | null = null;
  private isBirdVisible = false;

  // Transition Animation 관련 필드 추가
  private isTransitionAnimationPlaying = false;

  // Game 인스턴스 참조
  private game: Game;

  // FoodTracker 관련 필드 추가
  private foodTracker: FoodTracker | null = null;

  constructor(game: Game) {
    super();
    this.game = game;

    const assets = AssetLoader.getAssets();
    const backgroundTexture = assets.backgroundTexture || PIXI.Texture.WHITE;
    this.background = new Background(backgroundTexture);
  }

  public async init(): Promise<MainScene> {
    try {
      // 씬 구성 요소 설정
      this.setupScene();
      return this;
    } catch (error) {
      console.error("Error during MainScene initialization:", error);
      return this;
    }
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

      // Game에서 캐릭터를 가져와서 씬에 추가
      if (this.game.character) {
        this.addChild(this.game.character);
      } else {
        console.error("Game에 캐릭터가 초기화되지 않았습니다.");
      }

      // Bird와 Basket 초기화
      this.initBirdAndBasket();

      // 초기 설정 완료
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

  /**
   * 랜덤 움직임을 중지합니다.
   */
  private stopRandomMovement(): void {
    if (this.game.character instanceof Character) {
      this.game.character.disableRandomMovement();
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

    // Egg 상태 확인
    const isEggState = this.game.character instanceof Egg;

    switch (menuType) {
      case GameMenuItemType.MiniGame:
        console.log("미니게임 버튼으로 플래피 버드 게임으로 전환 요청");
        if (isEggState) {
          // Egg 상태일 경우 팝업 표시 (영문으로 변경)
          this.game.showAlert("not available in egg state.", "Notice");
        } else if (this.game) {
          this.flyToFlappyBirdGame();
        } else {
          console.warn("Game 객체 참조가 설정되지 않았습니다");
        }
        break;
      case GameMenuItemType.Feed:
        // 음식 생성 및 던지기
        this.throwFood();
        break;

      case GameMenuItemType.Versus:
        console.log("배틀 버튼 선택");
        // 배틀 로직
        break;

      case GameMenuItemType.Drug:
        console.log("약 버튼 선택");
        if (isEggState) {
          // Egg 상태일 경우 팝업 표시 (영문으로 변경)
          this.game.showAlert("not available in egg state.", "Notice");
        } else {
          // 약 관련 로직
          console.log("약 사용 로직 실행");
          // TODO: 약 사용 로직 구현
        }
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
        console.log("정보 버튼 선택 - Bird와 Basket 토글");
        // Bird와 Basket을 토글합니다
        // this.toggleBirdAndBasket();
        break;

      default:
        console.log(`${menuType} 메뉴 항목에 대한 처리가 구현되지 않았습니다`);
    }
  }

  /**
   * 음식을 던지는 로직을 별도 메서드로 분리
   */
  private throwFood(): void {
    // Game에서 캐릭터 참조
    const character = this.game.character;
    if (!character) {
      console.error("캐릭터가 초기화되지 않았습니다.");
      return;
    }

    // Character 인스턴스인 경우에만 음식 던지기 처리
    if (character instanceof Character) {
      // 새로운 Food 객체 생성 - 캐릭터 의존성 없이 생성
      const food = new Food(this.game.app, this, {});

      // 이미 Character 내부에서 FoodTracker가 초기화되었으므로
      // 별도의 FoodTracker 생성 로직이 필요 없음
    }
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
        // 청소 모드가 활성화되어 있으면 비활성화
        if (this.isCleanModeActive) {
          this.isCleanModeActive = false;

          // 청소 관리자 비활성화
          if (this.cleaningManager) {
            this.cleaningManager.deactivate();
          }

          // 기본 컨트롤 버튼으로 복귀
          this.game.changeControlButtons(
            CONTROL_BUTTONS_SET[MainSceneControlButtonsSetType.ActiveMenuItem]
          );

          // 랜덤 움직임 다시 적용
          if (this.game.character instanceof Character) {
            this.game.character.enableRandomMovement();
          }
        } else {
          this.sendNavigationAction(NavigationAction.CANCEL);
        }
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
        // 이미 청소 모드일 때는 추가 액션 없음
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
    // 청소 모드가 활성화된 경우에만 슬라이더 값 변경 처리
    if (this.isCleanModeActive && this.cleaningManager) {
      this.cleaningManager.handleSliderValueChange(value);
    }
  }

  public handleSliderEnd(): void {
    // 청소 모드가 활성화된 경우에만 슬라이더 값 변경 처리
    if (this.isCleanModeActive && this.cleaningManager) {
      this.cleaningManager.handleSliderEnd();
    }
  }

  /**
   * 청소 모드를 활성화하고 청소 관리자를 초기화합니다.
   */
  private initCleanMode(): void {
    console.log("청소 모드 초기화 시작");
    this.isCleanModeActive = true;

    // CleaningManager 초기화 및 활성화
    if (!this.cleaningManager) {
      console.log("새 CleaningManager 생성");
      this.cleaningManager = new CleaningManager({
        app: this.game.app,
        parent: this,
        onCleaningComplete: () => {
          // 청소가 완료되었을 때 기본 모드로 돌아가기
          console.log("청소가 모두 완료되었습니다.");
          this.isCleanModeActive = false;
          this.game.changeControlButtons(
            CONTROL_BUTTONS_SET[MainSceneControlButtonsSetType.ActiveMenuItem]
          );
        },
      });
    }

    this.cleaningManager.activate();
  }

  public onResize(width: number, height: number): void {
    // 초기화 전에는 리사이징 무시
    if (!this.initialized) return;

    // 화면 크기 변경 시 배경 크기 조정
    if (this.background) {
      this.background.resize(width, height);
    }

    // 캐릭터 위치는 이제 Game 객체에서 관리
  }

  public update(deltaTime: number): void {
    // 초기화 전에는 업데이트 무시
    if (!this.initialized) return;

    // 캐릭터 관련 업데이트는 캐릭터 내부 및 컨트롤러에서 처리

    // Bird와 Basket 관련 업데이트
    if (this.isBirdVisible) {
      this.updateBirdAndBasketPositions();
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

    // CleaningManager 정리
    if (this.cleaningManager) {
      this.cleaningManager.destroy();
      this.cleaningManager = null;
    }

    // 다른 리소스 정리 로직...
  }

  /**
   * Bird와 Basket을 초기화합니다.
   */
  private initBirdAndBasket(): void {
    const assets = AssetLoader.getAssets();

    try {
      // Basket 초기화 - common32x32 스프라이트시트의 'basket' 사용
      if (!this.basket && assets.common32x32Sprites) {
        // commonSprites에서 basket 텍스처 가져오기
        console.log("basket 텍스처 가져오기 시도");
        const basketTexture = assets.common32x32Sprites.textures.basket;

        if (basketTexture) {
          console.log("basket 텍스처 성공적으로 가져옴");
          this.basket = new PIXI.Sprite(basketTexture);
          this.basket.width = 32;
          this.basket.height = 32;
          this.basket.anchor.set(0.5);
          this.basket.visible = false; // 초기에는 보이지 않음
          this.addChild(this.basket);
        } else {
          console.warn(
            "common32x32 스프라이트시트에서 'basket' 텍스처를 찾을 수 없습니다."
          );
        }
      }

      // Bird 초기화
      if (!this.bird) {
        console.log("Bird 객체 생성");
        this.bird = new Bird(this.game.app); // Bird 클래스 사용
        this.bird.visible = false; // 초기에는 보이지 않음
        this.addChild(this.bird);
      }
    } catch (error) {
      console.error("Bird와 Basket 초기화 중 오류 발생:", error);
    }
  }

  /**
   * Bird와 Basket의 위치를 업데이트합니다.
   */
  private updateBirdAndBasketPositions(): void {
    if (!this.isBirdVisible || !this.bird) return;

    const screenWidth = this.game.app.screen.width;
    const screenHeight = this.game.app.screen.height;

    // 새의 위치를 설정 (바구니는 새의 발에 매달림)
    this.bird.position.x = screenWidth * 0.25;
    this.bird.position.y = screenHeight * 0.4;

    // 위아래 움직임 애니메이션 제거
  }

  /**
   * 미니게임으로 전환할 때 새가 캐릭터를 데리고 날아가는 애니메이션
   */
  private async flyToFlappyBirdGame(): Promise<void> {
    // 이미 진행 중인 애니메이션이 있다면 중단
    if (this.isTransitionAnimationPlaying) return;

    this.isTransitionAnimationPlaying = true;
    console.log("새가 캐릭터를 데리러 오는 애니메이션 시작");

    try {
      // 메뉴 제거 및 즉시 실행 (지연 없이)
      if (this.gameMenu) {
        this.gameMenu.destroy();
        this.gameMenu = null;
      }

      const screenWidth = this.game.app.screen.width;
      const screenHeight = this.game.app.screen.height;

      // 새 객체 생성 (기존 bird는 숨기고 새로운 bird 인스턴스 생성)
      if (this.bird) {
        this.bird.visible = false;
      }

      const transitionBird = new Bird(this.game.app);
      transitionBird.visible = true;

      // 바구니 생성
      const assets = AssetLoader.getAssets();
      let transitionBasket: PIXI.Sprite | null = null;

      if (assets.common32x32Sprites?.textures.basket) {
        transitionBasket = new PIXI.Sprite(
          assets.common32x32Sprites.textures.basket
        );
        transitionBasket.anchor.set(0.5);
        transitionBasket.visible = true;

        // 바구니를 새에 매달기
        transitionBird.hangObject(transitionBasket);
      }

      // 새를 큰 크기로 설정하고 명확하게 왼쪽 하단 구석에 위치시킴
      transitionBird.setScale(3.0);
      // 확실하게 화면 왼쪽 하단 구석에 배치 (화면 안에 약간만 보이도록)
      transitionBird.position.set(20, screenHeight - 20);
      this.addChild(transitionBird);

      // 애니메이션 지연 없이 즉시 시작
      await this.trackAndApproachCharacter(
        transitionBird,
        this.game.character as Character,
        3.0,
        1.8,
        2000
      );

      // 캐릭터의 in-basket 스프라이트로 교체하는 로직
      this.pickupCharacterWithInBasket(
        transitionBird,
        this.game.character as Character
      );

      // 화면 오른쪽 아래로 다시 커지면서 날아감
      await this.flyWithScaleChange(
        transitionBird,
        { x: screenWidth + 200, y: screenHeight + 100 },
        1.8,
        3.0,
        2000
      );

      // 정리 및 씬 전환
      this.removeChild(transitionBird);
      await this.game.changeScene(SceneKey.FLAPPY_BIRD_GAME);
    } catch (error) {
      console.error("전환 애니메이션 오류:", error);
      // 오류 발생 시 바로 씬 전환
      await this.game.changeScene(SceneKey.FLAPPY_BIRD_GAME);
    } finally {
      this.isTransitionAnimationPlaying = false;
    }
  }

  /**
   * 캐릭터를 실시간으로 추적하면서 접근하는 애니메이션
   */
  private trackAndApproachCharacter(
    bird: Bird,
    character: PIXI.Container,
    startScale: number,
    endScale: number,
    durationMs: number
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const startTime = Date.now();
      const startPosition = { x: bird.position.x, y: bird.position.y };

      // 애니메이션 틱 함수
      const animate = () => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / durationMs, 1);

        // 이징 함수 적용 (부드러운 움직임)
        const easeProgress = this.easeInOutQuad(progress);

        // 캐릭터의 현재 위치 (실시간으로 가져옴)
        const currentCharacterPosition = {
          x: character.position.x,
          y: character.position.y - 60, // 캐릭터 바로 위에 위치하도록
        };

        // 시작점과 목표점 사이의 중간 지점을 계산 (수정: 곡선 경로가 아닌 직선 경로로)
        // 곡선 경로 대신에 직선 경로를 사용하여 아래로 내려갔다 올라오는 현상을 방지
        const currentX =
          startPosition.x +
          (currentCharacterPosition.x - startPosition.x) * easeProgress;
        const currentY =
          startPosition.y +
          (currentCharacterPosition.y - startPosition.y) * easeProgress;

        // 새의 위치와 크기 업데이트
        bird.position.x = currentX;
        bird.position.y = currentY;

        // 크기 변경
        const newScale = startScale + (endScale - startScale) * easeProgress;
        bird.setScale(newScale);

        if (progress < 1) {
          // 애니메이션 계속
          requestAnimationFrame(animate);
        } else {
          // 애니메이션 완료 - 마지막으로 정확히 캐릭터 위치로 이동
          bird.position.x = currentCharacterPosition.x;
          bird.position.y = currentCharacterPosition.y;
          bird.setScale(endScale);
          resolve();
        }
      };

      // 애니메이션 시작
      animate();
    });
  }

  /**
   * 새가 날아가면서 크기가 변하는 애니메이션
   */
  private flyWithScaleChange(
    bird: Bird,
    targetPosition: { x: number; y: number },
    startScale: number,
    endScale: number,
    durationMs: number
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const startTime = Date.now();
      const startPosition = { x: bird.position.x, y: bird.position.y };

      const animate = () => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / durationMs, 1);

        // 이징 함수 적용 (부드러운 움직임)
        const easeProgress = this.easeInOutQuad(progress);

        // 새 위치 계산
        bird.position.x =
          startPosition.x + (targetPosition.x - startPosition.x) * easeProgress;
        bird.position.y =
          startPosition.y + (targetPosition.y - startPosition.y) * easeProgress;

        // 크기 변경
        const newScale = startScale + (endScale - startScale) * easeProgress;
        bird.setScale(newScale);

        if (progress < 1) {
          // 애니메이션 계속
          requestAnimationFrame(animate);
        } else {
          // 애니메이션 완료
          bird.position.x = targetPosition.x;
          bird.position.y = targetPosition.y;
          bird.setScale(endScale);
          resolve();
        }
      };

      // 애니메이션 시작
      animate();
    });
  }

  /**
   * 이징 함수: ease-in-out-quad
   */
  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  }

  /**
   * 캐릭터를 픽업하면서 바구니를 in-basket으로 교체하는 메서드
   */
  private pickupCharacterWithInBasket(bird: Bird, character: Character): void {
    // 캐릭터의 in-basket 스프라이트를 가져옴
    const assets = AssetLoader.getAssets();
    const characterSpritesheet =
      assets.characterSprites[character.getCharacterKey()];

    if (characterSpritesheet?.textures["in-basket"]) {
      // 1. 기존 바구니를 제거 (unHangObject 호출)
      const oldBasket = bird.unHangObject();
      if (oldBasket) {
        this.removeChild(oldBasket);
      }

      // 2. 새로운 바구니(캐릭터가 들어간) 스프라이트를 생성하고
      const inBasketTexture = characterSpritesheet.textures["in-basket"];
      const inBasket = new PIXI.Sprite(inBasketTexture);
      inBasket.anchor.set(0.5);

      // 3. 새로운 바구니를 새에 매달기 (hangObject는 한 번만 호출)
      bird.hangObject(inBasket);

      // 4. 원래 캐릭터는 화면에서 숨김
      character.visible = false;
    } else {
      console.warn("캐릭터의 in-basket 텍스처를 찾을 수 없습니다");
    }
  }
}
