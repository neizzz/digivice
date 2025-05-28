import * as PIXI from "pixi.js";
import type { Game } from "../Game";
import type { GameData } from "../types/GameData";
import { SceneKey } from "../SceneKey";
import { Background } from "../entities/Background";
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
import { CleaningManager } from "../managers/CleaningManager";
import { Bird } from "../entities/Bird"; // Bird 클래스 import 추가
import { Character } from "../entities/Character";
import type { Egg } from "../entities/Egg";
import { GameDataManager } from "../managers/GameDataManager";
import { ObjectType } from "../types/GameData";
import { Poob } from "../entities/Poob";
import { Pill } from "../entities/Pill";
import { simulateCharacterStatus } from "../utils/simulator";
import {
  type LastCheckData,
  LastCheckDataManager,
} from "../managers/LastCheckDataManager";
import { CharacterState } from "../types/Character";
import { EventBus, EventTypes } from "../utils/EventBus";

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

  constructor(game: Game) {
    super();
    this.game = game;

    const assets = AssetLoader.getAssets();
    const backgroundTexture = assets.backgroundTexture || PIXI.Texture.WHITE;
    this.background = new Background(backgroundTexture);
  }

  public init(gameData: GameData): MainScene {
    try {
      // 에셋이 이미 로드되었다고 가정하고 동기적으로 처리
      try {
        // zIndex 기반 정렬을 활성화
        this.sortableChildren = true;

        this.addChild(this.background);

        // Game에서 캐릭터를 가져와서 씬에 추가
        const characterManager = this.game.getCharacterManager();
        const character = characterManager.getCharacter();
        if (character) {
          character.initialize(gameData.character, this);
        } else {
          this.addChild(characterManager.getEgg() as Egg);
        }

        this._initBirdAndBasket();
        this._restoreObjects();
        this.onResize(this.game.app.screen.width, this.game.app.screen.height);

        console.log("[MainScene] MainScene setup completed");
      } catch (error) {
        console.error("[MainScene] Error setting up MainScene:", error);
      }

      // GameMenu 초기화
      this._initGameMenu();
      this.initialized = true;
      return this;
    } catch (error) {
      console.error(
        "[MainScene] Error during MainScene initialization:",
        error
      );
      return this;
    }
  }

  /**
   * 이전에 저장된 게임 오브젝트들(음식, 똥)을 복원합니다.
   */
  private async _restoreObjects(): Promise<void> {
    try {
      const gameData = await GameDataManager.getData();
      if (!gameData || !gameData.objectsMap) return;

      if (
        gameData.objectsMap[ObjectType.Food] &&
        gameData.objectsMap[ObjectType.Food].length > 0
      ) {
        console.log(
          `[MainScene] ${
            gameData.objectsMap[ObjectType.Food].length
          }개의 음식 오브젝트를 복원합니다.`
        );
        for (const foodData of gameData.objectsMap[ObjectType.Food]) {
          // 음식 오브젝트 생성
          const food = new Food(this.game.app, this, {
            data: foodData,
          });
          food.setState(1); // FoodState.LANDED와 동일한 값
        }
      }

      if (
        gameData.objectsMap[ObjectType.Poob] &&
        gameData.objectsMap[ObjectType.Poob].length > 0
      ) {
        console.log(
          `[MainScene] ${
            gameData.objectsMap[ObjectType.Poob].length
          }개의 Poob 오브젝트를 복원합니다.`
        );
        for (const poobData of gameData.objectsMap[ObjectType.Poob]) {
          new Poob(this, { position: poobData.position });
        }
      }

      if (
        gameData.objectsMap[ObjectType.Pill] &&
        gameData.objectsMap[ObjectType.Pill].length > 0
      ) {
        console.log(
          `[MainScene] ${
            gameData.objectsMap[ObjectType.Pill].length
          }개의 Pill 오브젝트를 복원합니다.`
        );
        for (const data of gameData.objectsMap[ObjectType.Pill]) {
          const pill = new Pill({
            data,
          });
          this.addChild(pill.getSprite());
        }
      }
    } catch (error) {
      console.trace("[MainScene] 오브젝트 복원 중 오류:", error);
    }
  }

  private _stopRandomMovement(): void {
    this.game.getCharacterManager().getCharacter()?.disableRandomMovement();
  }

  private _initGameMenu(): void {
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
      onMiniGameSelect: () => this._handleMenuSelect(GameMenuItemType.MiniGame),
      onFeedSelect: () => this._handleMenuSelect(GameMenuItemType.Feed),
      onVersusSelect: () => this._handleMenuSelect(GameMenuItemType.Versus),
      onDrugSelect: () => this._handleMenuSelect(GameMenuItemType.Drug),
      onCleanSelect: () => this._handleMenuSelect(GameMenuItemType.Clean),
      onTrainingSelect: () => this._handleMenuSelect(GameMenuItemType.Training),
      onInformationSelect: () =>
        this._handleMenuSelect(GameMenuItemType.Information),
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
   * 메뉴 선택 처리
   */
  private async _handleMenuSelect(menuType: GameMenuItemType): Promise<void> {
    console.log(`[MainScene] 메뉴 항목 선택: ${menuType}`);

    // Egg 상태 확인
    const isEggState = this.game.getCharacterManager().hasEgg();

    switch (menuType) {
      case GameMenuItemType.MiniGame:
        if (isEggState) {
          // Egg 상태일 경우 팝업 표시 (영문으로 변경)
          this.game.showAlert("not available in egg state.", "Notice");
        } else if (this.game) {
          this._flyToFlappyBirdGame();
        } else {
          console.warn("[MainScene] Game 객체 참조가 설정되지 않았습니다");
        }
        break;
      case GameMenuItemType.Feed:
        this._throwFood();
        break;
      case GameMenuItemType.Versus:
        // 배틀 로직
        break;
      case GameMenuItemType.Drug:
        if (isEggState) {
          this.game.showAlert("not available in egg state.", "Notice");
        } else {
          this._birdBringPillToCharacter();
        }
        break;
      case GameMenuItemType.Clean:
        this.game.changeControlButtons(
          CONTROL_BUTTONS_SET[MainSceneControlButtonsSetType.CleanMode]
        );
        this._initCleanMode();
        break;

      case GameMenuItemType.Training:
        // 훈련 관련 로직
        break;

      case GameMenuItemType.Information:
        // Bird와 Basket을 토글합니다
        // this.toggleBirdAndBasket();
        break;

      default:
        console.log(
          `[MainScene] ${menuType} 메뉴 항목에 대한 처리가 구현되지 않았습니다`
        );
    }
  }

  /**
   * 음식을 던지는 로직을 별도 메서드로 분리
   */
  private _throwFood(): void {
    // Game에서 캐릭터 참조
    const character = this.game.getCharacterManager().getCharacter();
    if (!character) {
      console.error("캐릭터가 초기화되지 않았습니다.");
      return;
    }

    // Character 인스턴스인 경우에만 음식 던지기 처리
    if (character instanceof Character) {
      // 새로운 Food 객체 생성 - 캐릭터 의존성 없이 생성
      new Food(this.game.app, this);
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
          this.cleaningManager?.deactivate();

          // 기본 컨트롤 버튼로 복귀
          this.game.changeControlButtons(
            CONTROL_BUTTONS_SET[MainSceneControlButtonsSetType.ActiveMenuItem]
          );

          this.game
            .getCharacterManager()
            .getCharacter()
            ?.enableRandomMovement();
        } else {
          this._sendNavigationAction(NavigationAction.CANCEL);
        }
        break;
      case ControlButtonType.Settings:
        console.log("TODO: Settings popup 구현");
        break;
      case ControlButtonType.Confirm:
        this._sendNavigationAction(NavigationAction.SELECT);
        break;
      case ControlButtonType.Next:
        this._sendNavigationAction(NavigationAction.NEXT);
        break;
      case ControlButtonType.Clean:
        console.log("청소 작업 수행");
        // 이미 청소 모드일 때는 추가 액션 없음
        break;
    }
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
   * 네비게이션 액션을 GameMenu에 전달
   */
  private _sendNavigationAction(action: NavigationAction): void {
    if (!this.gameMenu) return;

    this.navigationIndex++;

    this.gameMenu.processNavigationAction({
      type: action,
      index: this.navigationIndex,
    });
  }

  /**
   * 청소 모드를 활성화하고 청소 관리자를 초기화합니다.
   */
  private _initCleanMode(): void {
    console.log("청소 모드 초기화 시작");
    this.isCleanModeActive = true;

    // CleaningManager 초기화 및 활성화
    if (!this.cleaningManager) {
      console.log("새 CleaningManager 생성");
      this.cleaningManager = new CleaningManager({
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
    if (!this.initialized) return;
    this.background?.resize(width, height);
  }

  public async update(deltaTime: number): Promise<void> {
    if (!this.initialized) return;

    // TODO: 미니게임에서 돌아왔을 때(씬 전환)의 elapsedTime 처리
    const inputGameData = (await this.game.getData()) as GameData;

    if (inputGameData.character.status.state === CharacterState.DEAD) {
      return;
    }

    const inputCheckData =
      (await LastCheckDataManager.loadData()) as LastCheckData;
    const { resultCharacterInfo, resultLastCheckData } =
      simulateCharacterStatus({
        elapsedTime: deltaTime,
        inputGameData,
        inputCheckData,
      });

    if (resultCharacterInfo.key === "egg") {
      return;
    }

    // FIXME: 리팩토링 포인트(GameDataManager 저장 로직이 상이함. 일관성 이슈.)
    LastCheckDataManager._saveData(resultLastCheckData);

    const isHatched =
      inputGameData.character.key === "egg" &&
      // @ts-ignore
      resultCharacterInfo.key !== "egg";
    const characterManager = this.game.getCharacterManager();

    if (isHatched) {
      const egg = characterManager.getEgg() as Egg;
      this.removeChild(egg);
      characterManager.hatch(resultCharacterInfo, this);
    } else {
      characterManager.updateCharacter({
        before: inputGameData.character,
        after: resultCharacterInfo,
      });
    }

    if (this.isBirdVisible) {
      this._updateBirdAndBasketPositions();
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
    this._stopRandomMovement();

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
  private _initBirdAndBasket(): void {
    const assets = AssetLoader.getAssets();

    try {
      // Basket 초기화 - common32x32 스프라이트시트의 'basket' 사용
      if (!this.basket && assets.common32x32Sprites) {
        const basketTexture = assets.common32x32Sprites.textures.basket;

        if (basketTexture) {
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
        this.bird = new Bird(); // Bird 클래스 사용
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
  private _updateBirdAndBasketPositions(): void {
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
  private async _flyToFlappyBirdGame(): Promise<void> {
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

      const transitionBird = new Bird();
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
      const character = this.game
        .getCharacterManager()
        .getCharacter() as Character;
      await this._trackAndApproachCharacter(
        transitionBird,
        character,
        3.0,
        1.8,
        2000,
        -60
      );

      // 캐릭터의 in-basket 스프라이트로 교체하는 로직
      this._pickupCharacterWithInBasket(transitionBird, character);

      // 화면 오른쪽 아래로 다시 커지면서 날아감
      await transitionBird.flyToWithScale(
        screenWidth + 200,
        screenHeight + 100,
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
  private _trackAndApproachCharacter(
    bird: Bird,
    character: PIXI.Container,
    startScale: number,
    endScale: number,
    durationMs: number,
    adjustmentY = 0
  ): Promise<void> {
    // 캐릭터의 현재 위치를 실시간으로 추적하지 않고, 최초 위치로 이동
    // 필요시 실시간 추적 로직을 유지할 수 있음
    const charPos = character.position;
    return bird.flyToWithScale(
      charPos.x,
      charPos.y + adjustmentY,
      startScale,
      endScale,
      durationMs
    );
  }

  private _pickupCharacterWithInBasket(bird: Bird, character: Character): void {
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

  /**
   * Bird가 약을 랜덤 방향에서 들고 등장, 캐릭터 앞에 약을 내려놓고 무작위 방향으로 퇴장
   */
  private async _birdBringPillToCharacter(): Promise<void> {
    if (this.isTransitionAnimationPlaying) {
      console.warn("[MainScene] Bird Transition animation is already playing.");
      return;
    }
    try {
      const character = this.game
        .getCharacterManager()
        .getCharacter() as Character;
      const charPos = character.getPosition();
      const pillTargetPosition = {
        x: charPos.x,
        y: charPos.y + 30, // 캐릭터 앞에 약을 내려놓기 위해 Y 좌표를 조정
      };
      const pillObj = new Pill();
      const pillId = pillObj.getId();
      EventBus.publish(EventTypes.Object.OBJECT_CREATED, {
        type: ObjectType.Pill,
        id: pillId,
        position: pillTargetPosition,
        textureKey: pillObj.textureKey,
      });

      const screenWidth = this.game.app.screen.width;
      const screenHeight = this.game.app.screen.height;
      const directions = ["left", "right", "top", "bottom"] as const;
      const birdStartDir =
        directions[Math.floor(Math.random() * directions.length)];
      const birdEndDir: typeof birdStartDir =
        directions[Math.floor(Math.random() * directions.length)];

      const { birdStartPos, birdStartScale, birdEndPos, birdTargetScale } =
        (() => {
          let _birdStartPos = { x: 0, y: 0 };
          switch (birdStartDir) {
            case "left":
              _birdStartPos = { x: -80, y: Math.random() * screenHeight };
              break;
            case "right":
              _birdStartPos = {
                x: screenWidth + 80,
                y: Math.random() * screenHeight,
              };
              break;
            case "top":
              _birdStartPos = { x: Math.random() * screenWidth, y: -80 };
              break;
            case "bottom":
              _birdStartPos = {
                x: Math.random() * screenWidth,
                y: screenHeight + 80,
              };
              break;
          }
          // 퇴장 위치/scale
          let _birdEndPos = { x: 0, y: 0 };
          switch (birdEndDir) {
            case "left":
              _birdEndPos = { x: -80, y: Math.random() * screenHeight };
              break;
            case "right":
              _birdEndPos = {
                x: screenWidth + 80,
                y: Math.random() * screenHeight,
              };
              break;
            case "top":
              _birdEndPos = { x: Math.random() * screenWidth, y: -80 };
              break;
            case "bottom":
              _birdEndPos = {
                x: Math.random() * screenWidth,
                y: screenHeight + 80,
              };
              break;
          }
          return {
            birdStartPos: _birdStartPos,
            birdStartScale: 3.0,
            birdEndPos: _birdEndPos,
            birdTargetScale: 1.2,
          };
        })();

      const transitionBird = new Bird();
      transitionBird.visible = true;
      transitionBird.setScale(birdStartScale);
      transitionBird.position.set(birdStartPos.x, birdStartPos.y);
      transitionBird.hangObject(pillObj.getSprite(), -10); // 약을 새에 매달기
      this.addChild(transitionBird);
      await this._trackAndApproachCharacter(
        transitionBird,
        character,
        birdStartScale,
        birdTargetScale,
        1200,
        -20
      );
      // 약 내려놓기 (캐릭터 앞)
      if (pillObj.getSprite()) {
        console.log("[MainScene] Pill landed at character front");
        const pillSprite = pillObj.getSprite();
        this.addChild(pillSprite);
        pillSprite.position.set(pillTargetPosition.x, pillTargetPosition.y);
        pillSprite.zIndex = pillSprite.position.y; // 약이 캐릭터 앞에 보이도록 zIndex 설정
        transitionBird.unHangObject();
        pillObj.setScale(3.2); // 원래의 약 스케일

        if (character.getState() === "sick") {
          const duration = 3000; // ms
          const startTime = Date.now();
          const startScale = pillSprite.scale.x;
          const startAlpha = pillSprite.alpha;
          const charCenter = {
            x: character.position.x,
            y: character.position.y,
          };
          const startX = pillSprite.position.x;
          const startY = pillSprite.position.y;
          const animateAbsorb = () => {
            const elapsed = Date.now() - startTime;
            const t = Math.min(elapsed / duration, 1);
            const ease = 1 - (1 - t) ** 2;
            // Get character center position

            // Update position to move toward character center
            pillSprite.position.x = startX + (charCenter.x - startX) * ease;
            pillSprite.position.y = startY + (charCenter.y - startY) * ease;
            pillSprite.scale.set(startScale * (1 - ease));
            pillSprite.alpha = startAlpha * (1 - ease);
            if (t < 1) {
              requestAnimationFrame(animateAbsorb);
            } else {
              // 흡수 완료 후
              pillObj.destroy();
              character.setState(CharacterState.IDLE, true);
              // FIXME: 엄밀히하면 청소가 아니기 때문에 추후에 필요하면 수정
              EventBus.publish(EventTypes.Object.OBJECT_CLEANED, {
                type: ObjectType.Pill,
                id: pillId,
              });
            }
          };
          setTimeout(() => {
            console.log("[MainScene] Pill absorb start");
            animateAbsorb();
          }, 500);
        }
      }
      // 퇴장 애니메이션 (캐릭터 앞→퇴장 위치, scale 작아짐)
      await transitionBird.flyToWithScale(
        birdEndPos.x,
        birdEndPos.y,
        birdTargetScale,
        birdStartScale,
        900
      );
      transitionBird.destroy();
    } catch (e) {
      console.error("[MainScene] 약 가져다주기 연출 오류:", e);
    } finally {
      this.isTransitionAnimationPlaying = false;
    }
  }
}
