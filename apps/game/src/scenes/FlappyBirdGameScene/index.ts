import * as PIXI from "pixi.js";
import { Scene } from "../../interfaces/Scene";
import { AssetLoader } from "../../utils/AssetLoader";
import { GameEngine } from "../../GameEngine";
import { CharacterKey } from "../../types/CharacterKey";
import { GameOptions, GameState, SceneKey } from "./models";
import { GameOverUI, ScoreUI } from "./ui";
import { GroundManager, PipeManager, PlayerManager } from "./gameLogic";
import { PhysicsManager } from "./physics";
import { ControlButtonType } from "../../ui/types";
import { Game } from "../../Game";

export class FlappyBirdGameScene extends PIXI.Container implements Scene {
  // 핵심 컴포넌트
  private app: PIXI.Application;
  private gameEngine: GameEngine;
  private background!: PIXI.Graphics;
  private initialized: boolean = false;

  // 게임 매니저
  private physicsManager: PhysicsManager;
  private playerManager: PlayerManager;
  private groundManager: GroundManager;
  private pipeManager!: PipeManager;

  // UI 요소
  private scoreUI: ScoreUI;
  private gameOverUI: GameOverUI;

  // 게임 상태 및 설정
  private gameState: GameState = GameState.READY;
  private gameOptions: GameOptions = {
    pipeSpeed: 2,
    pipeSpawnInterval: 2000,
    jumpVelocity: 8,
  };
  private lastPipeSpawnTime: number = 0;

  // 게임 인스턴스 참조
  private game!: Game;

  constructor(
    app: PIXI.Application,
    characterKey: CharacterKey,
    gameEngine?: GameEngine
  ) {
    super();
    this.app = app;
    this.gameEngine =
      gameEngine || new GameEngine(app.screen.width, app.screen.height);

    // 하늘색 배경 생성
    this.createBackground();

    // 물리 시스템 초기화
    this.physicsManager = new PhysicsManager(this.gameEngine);

    // 플레이어 초기화
    this.playerManager = new PlayerManager(
      this.app,
      this.physicsManager,
      characterKey
    );

    // 지면 초기화
    this.groundManager = new GroundManager(
      this.app,
      this.physicsManager,
      this.gameOptions.pipeSpeed
    );

    // UI 초기화
    this.scoreUI = new ScoreUI();
    this.gameOverUI = new GameOverUI();

    // 씬 설정
    this.setupScene();
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
      this.app.screen.width,
      this.app.screen.height
    );
    this.background.endFill();
  }

  /**
   * 씬을 설정합니다.
   */
  private setupScene(): void {
    try {
      // GameEngine이 초기화되지 않았을 때만 초기화
      if (!this.gameEngine["physics"] || !this.gameEngine["runner"]) {
        this.gameEngine.initialize(this.app);
      }

      // 지면 초기화
      this.groundManager.setup();

      // 파이프 관리자 초기화
      this.pipeManager = new PipeManager(
        this.app,
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
      this.onResize(this.app.screen.width, this.app.screen.height);

      this.physicsManager.toggleDebugMode(this.app);

      // 바로 게임 시작
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
      this.physicsManager.toggleDebugMode(this.app);
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
   * 게임 오버 처리 메서드
   */
  private handleGameOver(): void {
    this.gameState = GameState.GAME_OVER;

    // 애니메이션 정지
    this.playerManager.stopAnimation();

    // 게임 엔진 일시 중지
    this.gameEngine.pause();

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
   * Scene 인터페이스 구현 메서드: Game 참조 설정
   */
  public setGameReference(game: Game): void {
    this.game = game;
  }

  /**
   * 다른 씬으로 전환합니다.
   */
  private navigateToScene(sceneKey: SceneKey): void {
    if (this.game) {
      this.game.changeScene(sceneKey);
    } else {
      console.error(
        "Game reference not set. Cannot navigate to scene:",
        sceneKey
      );
    }
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
    if (this.gameState === GameState.GAME_OVER) {
      this.restartGame();
    } else if (this.gameState === GameState.PLAYING) {
      this.jump();
    }
  }

  /**
   * 매 프레임마다 실행되는 업데이트 메서드
   */
  public update(deltaTime: number): void {
    if (!this.initialized || this.gameState === GameState.GAME_OVER) return;

    const currentTime = Date.now();

    if (this.gameState === GameState.PLAYING) {
      // 플레이어 위치 업데이트
      this.playerManager.updatePosition();

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

    // 기본 정리
    super.destroy();
  }
}
