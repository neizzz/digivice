import * as PIXI from "pixi.js";
import type { Game } from "../../Game";
import { GameEngine } from "../../GameEngine";
import type { Scene } from "../../interfaces/Scene";
import { type ControlButtonParams, ControlButtonType } from "../../ui/types";
import { GameDataManager } from "../../utils/GameDataManager";
import { GroundManager, PipeManager, PlayerManager } from "./gameLogic";
import { type GameOptions, GameState } from "./models";
import { PhysicsManager } from "./physics";
import { GameOverUI, ScoreUI } from "./ui";
import type { Bird } from "../../entities/Bird";
import { AssetLoader } from "../../utils/AssetLoader";

enum FlappyBirdGameSceneControlButtonsSetType {
  GamePlay = "game-play",
  GameEnd = "game-end",
}

const CONTROL_BUTTONS_SET: Record<
  FlappyBirdGameSceneControlButtonsSetType,
  [ControlButtonParams, ControlButtonParams, ControlButtonParams]
> = {
  [FlappyBirdGameSceneControlButtonsSetType.GamePlay]: [
    { type: ControlButtonType.Attack },
    { type: ControlButtonType.DoubleJump },
    { type: ControlButtonType.Jump },
  ],
  [FlappyBirdGameSceneControlButtonsSetType.GameEnd]: [
    { type: ControlButtonType.Cancel },
    { type: ControlButtonType.Confirm },
    { type: ControlButtonType.Next },
  ],
};

export class FlappyBirdGameScene extends PIXI.Container implements Scene {
  // 핵심 컴포넌트
  private game: Game;
  private gameEngine: GameEngine;
  private background!: PIXI.Graphics;
  private initialized = false;

  // 게임 매니저
  private physicsManager: PhysicsManager;
  private playerManager!: PlayerManager;
  private groundManager!: GroundManager;
  private pipeManager!: PipeManager;

  // UI 요소
  private scoreUI!: ScoreUI;
  private gameOverUI!: GameOverUI;

  // 게임 상태 및 설정
  private gameState: GameState = GameState.READY;
  private gameOptions: GameOptions = {
    pipeSpeed: 4,
    pipeSpawnInterval: 2000,
    jumpVelocity: 8,
  };
  private lastPipeSpawnTime = 0;

  constructor(
    game: Game
    // characterKey: CharacterKey,
    // gameEngine?: GameEngine
  ) {
    super();
    this.game = game;
    this.gameEngine = new GameEngine(
      this.game.app.screen.width,
      this.game.app.screen.height
    );

    // 하늘색 배경 생성
    this.createBackground();

    // 물리 시스템 초기화
    this.physicsManager = new PhysicsManager(this.gameEngine);

    // const data = GameDataManager.loadData() as GameData;
  }

  public async init(): Promise<FlappyBirdGameScene> {
    const data = await GameDataManager.loadData();

    if (!data) {
      throw new Error("게임 데이터가 없습니다");
    }

    // 플레이어 초기화
    this.playerManager = new PlayerManager(
      this.game.app,
      this.physicsManager,
      data.character.key
    );

    // 지면 초기화
    this.groundManager = new GroundManager(
      this.game.app,
      this.physicsManager,
      this.gameOptions.pipeSpeed
    );

    // UI 초기화
    this.scoreUI = new ScoreUI();
    this.gameOverUI = new GameOverUI();
    this.game.changeControlButtons(
      CONTROL_BUTTONS_SET[FlappyBirdGameSceneControlButtonsSetType.GamePlay]
    );

    // 씬 설정
    this.setupScene();

    return this;
  }

  /**
   * 배경을 생성합니다.
   */
  private createBackground(): void {
    const skyBlueColor = 0x87ceeb;
    this.background = new PIXI.Graphics();
    this.background.beginFill(skyBlueColor);
    this.background.drawRect(
      0,
      0,
      this.game.app.screen.width,
      this.game.app.screen.height
    );
    this.background.endFill();
  }

  /**
   * 씬을 설정합니다.
   */
  private setupScene(): void {
    try {
      this.gameEngine.initialize(this.game.app);

      // 지면 초기화
      this.groundManager.setup();

      // 파이프 관리자 초기화
      this.pipeManager = new PipeManager(
        this.game.app,
        this.physicsManager,
        this.gameOptions.pipeSpeed,
        this.gameOptions.pipeSpawnInterval,
        this.groundManager.getTileHeight()
      );

      // 충돌 이벤트 설정
      this.setupCollisionListeners();

      // 모든 디스플레이 요소 추가
      this.addDisplayObjects();

      // 키보드 이벤트 리스너 추가
      this.setupKeyboardListeners();

      this.initialized = true;

      // 화면 크기에 맞게 조정
      this.onResize(this.game.app.screen.width, this.game.app.screen.height);

      // 디버그 모드 토글
      this.physicsManager.toggleDebugMode(this.game.app);

      // 캐릭터가 보이도록 설정 (MainScene에서 애니메이션 후 캐릭터를 숨겼으므로)
      if (this.game.character) {
        this.game.character.visible = true;
      }

      // 바로 게임 시작 (MainScene에서 애니메이션을 완료했으므로)
      this.startGame();
    } catch (error) {
      console.error("Error setting up FlappyBirdGameScene:", error);
    }
  }

  /**
   * 모든 디스플레이 요소를 씬에 추가합니다.
   */
  private addDisplayObjects(): void {
    // 순서대로 추가
    this.addChild(this.background);
    this.addChild(this.pipeManager.getContainer());
    this.addChild(this.groundManager.getContainer());
    this.addChild(this.playerManager.getBasket());
    this.addChild(this.playerManager.getBird());
    this.addChild(this.scoreUI.getDisplayObject());
    this.addChild(this.gameOverUI.getDisplayObject());
  }

  /**
   * 충돌 이벤트 리스너를 설정합니다.
   */
  private setupCollisionListeners(): void {
    this.physicsManager.setupCollisionListener((bodyA, bodyB) => {
      const isBasketCollision =
        (bodyA.label === "basket" &&
          (bodyB.label === "ground" || bodyB.label === "pipe")) ||
        (bodyB.label === "basket" &&
          (bodyA.label === "ground" || bodyA.label === "pipe"));

      if (isBasketCollision && this.gameState === GameState.PLAYING) {
        this.handleGameOver();
      }
    });
  }

  /**
   * 키보드 이벤트 리스너를 설정합니다.
   */
  private setupKeyboardListeners(): void {
    window.addEventListener("keydown", this.handleKeyDown.bind(this));
  }

  /**
   * 키보드 이벤트 처리 메서드
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === "Space" || event.key === " ") {
      if (this.gameState === GameState.PLAYING) {
        this.jump();
      } else if (this.gameState === GameState.GAME_OVER) {
        this.restartGame();
      }
    }

    if (event.code === "KeyD") {
      this.physicsManager.toggleDebugMode(this.game.app);
    }
  }

  /**
   * 게임을 시작합니다.
   */
  private startGame(): void {
    this.gameState = GameState.PLAYING;
    this.playerManager.resetPosition();
  }

  /**
   * 플레이어 점프 메서드
   */
  private jump(): void {
    this.playerManager.jump(this.gameOptions.jumpVelocity);
  }

  /**
   * 강화된 점프 메서드
   */
  private doubleJump(): void {
    this.playerManager.jump(this.gameOptions.jumpVelocity * 1.5); // 기존 점프 속도의 1.5배
  }

  /**
   * 게임 오버 처리 메서드
   */
  private handleGameOver(): void {
    // 그 다음 게임 상태 변경 및 물리 엔진 정지
    this.gameState = GameState.GAME_OVER;
    this.gameEngine.pause();

    // 애니메이션 정지
    this.playerManager.stopAnimation();

    // 게임 오버 UI 표시
    this.gameOverUI.show();
  }

  /**
   * 게임을 재시작합니다.
   */
  private restartGame(): void {
    // 게임 상태 초기화
    this.gameState = GameState.PLAYING;

    // 게임 엔진 재개
    this.gameEngine.resume();

    // 점수 초기화
    this.scoreUI.resetScore();

    // 게임 오버 UI 숨기기
    this.gameOverUI.hide();

    // 모든 파이프 제거
    this.pipeManager.clearAllPipes();

    // 플레이어 재설정
    this.playerManager.resetBasket();
    this.playerManager.resetPosition();

    // 바닥 타일 재설정
    this.groundManager.setup();

    // 애니메이션 재시작
    this.playerManager.startAnimation();

    this.lastPipeSpawnTime = 0;
  }

  /**
   * 화면 크기 변경 처리
   */
  public onResize(width: number, height: number): void {
    if (!this.initialized) return;

    // 배경 리사이징
    this.background.clear();
    this.background.beginFill(0x87ceeb);
    this.background.drawRect(0, 0, width, height);
    this.background.endFill();

    // UI 요소 위치 업데이트
    this.scoreUI.updatePosition(width);
    this.gameOverUI.updatePosition(width, height);

    // 디버그 렌더러 업데이트
    this.physicsManager.updateDebugRendererSize(width, height);
  }

  /**
   * 컨트롤 버튼 클릭 핸들러
   */
  public handleControlButtonClick(buttonType: ControlButtonType): void {
    switch (buttonType) {
      case ControlButtonType.Attack:
        // TODO:
        break;
      case ControlButtonType.DoubleJump:
        this.doubleJump();
        break;
      case ControlButtonType.Jump:
        this.jump();
        break;
      default:
        throw new Error("Invalid button type");
    }
  }

  /**
   * 매 프레임마다 실행되는 업데이트 메서드
   */
  public update(deltaTime: number): void {
    if (!this.initialized) return;

    const currentTime = Date.now();

    this.playerManager.update();

    if (this.gameState === GameState.PLAYING) {
      // 플레이어 경계 충돌 체크
      this.playerManager.checkCollisions();

      // 파이프 관리
      this.pipeManager.update(
        currentTime,
        this.playerManager.getBasketBody(),
        () => this.scoreUI.incrementScore()
      );

      // 바닥 타일 이동
      this.groundManager.update();
    }
  }

  /**
   * 리소스를 정리하고 객체를 파괴합니다.
   */
  public destroy(): void {
    // 이벤트 리스너 제거
    window.removeEventListener("keydown", this.handleKeyDown.bind(this));

    // 물리 시스템 정리
    this.physicsManager.cleanup();
    this.gameEngine.cleanup();

    // 기본 정리
    super.destroy();
  }
}
