import * as PIXI from "pixi.js";
import type { FlappyBirdSkyContext, Game } from "../../Game";
import { GameEngine } from "../../GameEngine";
import { SceneKey } from "../../SceneKey";
import type { Scene } from "../../interfaces/Scene";
import { type ControlButtonParams, ControlButtonType } from "../../ui/types";
// import { GameDataManager } from "../../managers/GameDataManager";
import {
  CloudManager,
  GroundManager,
  PipeManager,
  PlayerManager,
} from "./gameLogic";
import { FlappyBirdBgmController } from "./bgm";
import { type GameOptions, GameState } from "./models";
import { PhysicsManager } from "./physics";
import { CountdownUI, NearMissUI, ScoreUI } from "./ui";
import { AssetLoader } from "../../utils/AssetLoader";
import {
  getManualSkyVisualState,
  resolveAutoTimeOfDayState,
  type SkyVisualState,
  TimeOfDay,
  TimeOfDayMode,
} from "../MainScene/timeOfDay";
import type { FlappyBirdDifficultyState } from "./models";

enum FlappyBirdGameSceneControlButtonsSetType {
  GamePlay = "game-play",
}

const CONTROL_BUTTONS_SET: Record<
  FlappyBirdGameSceneControlButtonsSetType,
  [ControlButtonParams, ControlButtonParams, ControlButtonParams]
> = {
  [FlappyBirdGameSceneControlButtonsSetType.GamePlay]: [
    { type: ControlButtonType.Jump },
    { type: ControlButtonType.Settings },
    { type: ControlButtonType.DoubleJump },
  ],
};

const GAME_OVER_VIBRATION_DURATION_MS = 18;
const GAME_OVER_VIBRATION_STRENGTH = 110;
const GAME_OVER_VIBRATION_DELAY_MS = 90;
const PIPE_PASS_VIBRATION_DURATION_MS = 12;
const PIPE_PASS_VIBRATION_STRENGTH = 34;
const PIPE_PASS_NEAR_MISS_VIBRATION_STRENGTH = 48;
const FLAPPY_BIRD_START_COUNTDOWN_SECONDS = 2;
const SKY_DAY_COLOR = 0x55c9ff;
const SKY_STAR_COLOR = 0xffef38;
const SKY_STAR_LAYOUT = [
  { x: 0.1, y: 0.12, radius: 1.6 },
  { x: 0.18, y: 0.2, radius: 2.1 },
  { x: 0.28, y: 0.11, radius: 1.4 },
  { x: 0.37, y: 0.18, radius: 1.8 },
  { x: 0.46, y: 0.09, radius: 1.5 },
  { x: 0.58, y: 0.16, radius: 2.2 },
  { x: 0.67, y: 0.1, radius: 1.7 },
  { x: 0.76, y: 0.2, radius: 1.5 },
  { x: 0.85, y: 0.13, radius: 2.0 },
  { x: 0.91, y: 0.22, radius: 1.3 },
  { x: 0.24, y: 0.28, radius: 1.2 },
  { x: 0.72, y: 0.29, radius: 1.4 },
  { x: 0.14, y: 0.38, radius: 1.4 },
  { x: 0.31, y: 0.44, radius: 1.5 },
  { x: 0.52, y: 0.36, radius: 1.3 },
  { x: 0.69, y: 0.48, radius: 1.6 },
  { x: 0.88, y: 0.41, radius: 1.4 },
  { x: 0.09, y: 0.57, radius: 1.3 },
  { x: 0.26, y: 0.63, radius: 1.2 },
  { x: 0.48, y: 0.58, radius: 1.5 },
  { x: 0.63, y: 0.69, radius: 1.3 },
  { x: 0.84, y: 0.61, radius: 1.4 },
] as const;
const FLAPPY_BIRD_GRAVITY_Y = 2.2;
const FLAPPY_BIRD_DOUBLE_JUMP_VELOCITY = 11;
const FLAPPY_BIRD_TUTORIAL_SCORE_LIMIT = 5;
const FLAPPY_BIRD_SPEED_STEP_TWO_SCORE_LIMIT = 20;
const FLAPPY_BIRD_ENDGAME_SCORE_LIMIT = 40;
const FLAPPY_BIRD_MAX_DIFFICULTY_SCORE = 30;
const FLAPPY_BIRD_TUTORIAL_DIFFICULTY: FlappyBirdDifficultyState = {
  pipeSpeed: 3.6,
  pipeSpawnInterval: 2740,
  passageHeightMinRatio: 0.35,
  passageHeightMaxRatio: 0.45,
};
const FLAPPY_BIRD_BASE_DIFFICULTY: FlappyBirdDifficultyState = {
  pipeSpeed: 3.8,
  pipeSpawnInterval: 2480,
  passageHeightMinRatio: 0.35,
  passageHeightMaxRatio: 0.35,
};
const FLAPPY_BIRD_MAX_DIFFICULTY: FlappyBirdDifficultyState = {
  pipeSpeed: 4,
  pipeSpawnInterval: 2025,
  passageHeightMinRatio: 0.3,
  passageHeightMaxRatio: 0.3,
};
const FLAPPY_BIRD_ENDGAME_DIFFICULTY: FlappyBirdDifficultyState = {
  pipeSpeed: 4,
  pipeSpawnInterval: 2025,
  passageHeightMinRatio: 0.28,
  passageHeightMaxRatio: 0.3,
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
  private cloudManager!: CloudManager;
  private groundManager!: GroundManager;
  private pipeManager!: PipeManager;
  private bgmController: FlappyBirdBgmController;

  // UI 요소
  private scoreUI!: ScoreUI;
  private nearMissUI!: NearMissUI;
  private countdownUI!: CountdownUI;

  // 게임 상태 및 설정
  private gameState: GameState = GameState.READY;
  private gameOptions: GameOptions = {
    pipeSpeed: 3.6,
    pipeSpawnInterval: 2740,
    jumpVelocity: 7,
  };
  private skyContext: FlappyBirdSkyContext | null = null;
  private currentSkyState: SkyVisualState = {
    timeOfDay: TimeOfDay.Day,
    progress: 1,
  };
  private currentSkyMinuteKey: string | null = null;
  private isReturningToMain = false;
  private isSettingsMenuOpen = false;
  private gameOverVibrationTimeoutIds: number[] = [];
  private readonly boundHandleKeyDown: (event: KeyboardEvent) => void;

  constructor(
    game: Game,
    // characterKey: CharacterKey,
    // gameEngine?: GameEngine
  ) {
    super();
    this.game = game;
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.bgmController = new FlappyBirdBgmController();
    this.gameEngine = new GameEngine(
      this.game.app.screen.width,
      this.game.app.screen.height,
      FLAPPY_BIRD_GRAVITY_Y,
    );

    // 하늘색 배경 생성
    this.createBackground();

    // 물리 시스템 초기화
    this.physicsManager = new PhysicsManager(this.gameEngine);

    // const data = GameDataManager.getData() as GameData;
  }

  public async init(): Promise<FlappyBirdGameScene> {
    const playerCharacterKey = this.game.getFlappyBirdCharacterKey();

    await AssetLoader.loadAssets(playerCharacterKey);
    this.skyContext = await this.game.getFlappyBirdSkyContext();
    this.syncSkyState(true);

    const bestScore = (await this.game.getFlappyBirdBestScore?.()) ?? 0;

    // 플레이어 초기화
    this.playerManager = new PlayerManager(
      this.game.app,
      this.physicsManager,
      playerCharacterKey,
    );

    // 지면 초기화
    this.groundManager = new GroundManager(
      this.game.app,
      this.physicsManager,
      this.gameOptions.pipeSpeed,
    );
    this.cloudManager = new CloudManager(
      this.game.app,
      this.gameOptions.pipeSpeed,
    );

    // UI 초기화
    this.scoreUI = new ScoreUI(bestScore);
    this.nearMissUI = new NearMissUI();
    this.countdownUI = new CountdownUI();

    // 씬 설정
    this.setupScene();

    return this;
  }

  /**
   * 배경을 생성합니다.
   */
  private createBackground(): void {
    this.background = new PIXI.Graphics();
    this.redrawBackground(
      this.game.app.screen.width,
      this.game.app.screen.height,
    );
  }

  /**
   * 씬을 설정합니다.
   */
  private setupScene(): void {
    try {
      this.gameEngine.initialize(this.game.app);

      // 지면 초기화
      this.groundManager.setup();
      this.cloudManager.setup();
      this.syncCloudVisualStyle();

      // 파이프 관리자 초기화
      this.pipeManager = new PipeManager(
        this.game.app,
        this.physicsManager,
        this.gameOptions.pipeSpeed,
        this.gameOptions.pipeSpawnInterval,
        this.groundManager.getTileHeight(),
      );
      this.applyDifficultyForScore(0);

      // 충돌 이벤트 설정
      this.setupCollisionListeners();

      // 모든 디스플레이 요소 추가
      this.addDisplayObjects();

      // 키보드 이벤트 리스너 추가
      this.setupKeyboardListeners();

      this.initialized = true;

      // 화면 크기에 맞게 조정
      this.resize(this.game.app.screen.width, this.game.app.screen.height);

      // 캐릭터가 보이도록 설정 (MainScene에서 애니메이션 후 캐릭터를 숨겼으므로)
      // if (this.game.character) {
      //   this.game.character.visible = true;
      // }

      this.beginStartCountdown();
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
    this.addChild(this.cloudManager.getContainer());
    this.addChild(this.pipeManager.getContainer());
    this.addChild(this.groundManager.getContainer());
    this.addChild(this.playerManager.getBasket());
    this.addChild(this.playerManager.getBird());
    this.addChild(this.nearMissUI.getDisplayObject());
    this.addChild(this.scoreUI.getDisplayObject());
    this.addChild(this.countdownUI.getDisplayObject());
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
    window.addEventListener("keydown", this.boundHandleKeyDown);
  }

  /**
   * 키보드 이벤트 처리 메서드
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (this.isSettingsMenuOpen) {
      return;
    }

    if (event.code === "Escape") {
      void this.returnToMainScene();
      return;
    }

    if (event.code === "Space" || event.key === " ") {
      if (this.gameState === GameState.PLAYING) {
        this.jump();
      } else if (this.gameState === GameState.PAUSED) {
        this.resumeGame();
      } else if (this.gameState === GameState.GAME_OVER) {
        this.restartGame();
      }
    }

    if (event.code === "KeyD" && import.meta.env.DEV) {
      this.physicsManager.toggleDebugMode(this.game.app);
    }
  }

  /**
   * 게임을 시작합니다.
   */
  private startGame(): void {
    this.clearGameOverVibrationPattern();
    this.gameState = GameState.PLAYING;
    this.game.hideFlappyBirdGameOver?.();
    this.hideSettingsMenu();
    this.countdownUI.hide();
    this.game.changeControlButtons(
      CONTROL_BUTTONS_SET[FlappyBirdGameSceneControlButtonsSetType.GamePlay],
    );
    this.gameEngine.resume();
    this.playerManager.startAnimation();
    this.playerManager.resetPosition();
    this.physicsManager.syncDisplayObjects();
    void this.bgmController.resumeIfAvailable();
  }

  private beginStartCountdown(): void {
    this.clearGameOverVibrationPattern();
    this.gameState = GameState.COUNTDOWN;
    this.game.hideFlappyBirdGameOver?.();
    this.hideSettingsMenu();
    this.game.changeControlButtons(
      CONTROL_BUTTONS_SET[FlappyBirdGameSceneControlButtonsSetType.GamePlay],
    );
    this.gameEngine.pause();
    this.playerManager.stopAnimation();
    this.playerManager.resetPosition();
    this.physicsManager.syncDisplayObjects();
    this.countdownUI.start(FLAPPY_BIRD_START_COUNTDOWN_SECONDS);
    void this.bgmController.playCountdownCue(
      this.countdownUI.getCurrentDisplayValue(),
    );
    this.bgmController.pause();
  }

  /**
   * 플레이어 점프 메서드
   */
  private jump(): void {
    void this.bgmController.startFromGesture();
    this.playerManager.jump(this.gameOptions.jumpVelocity);
  }

  /**
   * 강화된 점프 메서드
   */
  private doubleJump(): void {
    void this.bgmController.startFromGesture();
    this.playerManager.jump(FLAPPY_BIRD_DOUBLE_JUMP_VELOCITY);
  }

  private pauseGame(): void {
    if (this.gameState !== GameState.PLAYING) {
      return;
    }

    this.gameState = GameState.PAUSED;
    this.gameEngine.pause();
    this.playerManager.stopAnimation();
    this.bgmController.pause();
  }

  private resumeGame(): void {
    if (this.gameState !== GameState.PAUSED) {
      return;
    }

    this.gameState = GameState.PLAYING;
    this.gameEngine.resume();
    this.playerManager.startAnimation();
    void this.bgmController.resumeIfAvailable();
  }

  private openSettingsMenu(): void {
    if (
      this.isSettingsMenuOpen ||
      this.gameState === GameState.GAME_OVER ||
      this.isReturningToMain
    ) {
      return;
    }

    if (this.gameState === GameState.PLAYING) {
      this.pauseGame();
    }

    if (this.gameState !== GameState.PAUSED) {
      return;
    }

    this.isSettingsMenuOpen = true;
    this.showSettingsMenu();
  }

  private hideSettingsMenu(): void {
    if (!this.isSettingsMenuOpen) {
      return;
    }

    this.isSettingsMenuOpen = false;
    this.game.hideFlappyBirdSettingsMenu?.();
  }

  private showSettingsMenu(): void {
    this.game.showFlappyBirdSettingsMenu?.({
      isBgmEnabled: this.bgmController.isEnabled(),
      isSfxEnabled: this.bgmController.isSfxEnabled(),
      onChangeBgm: (enabled: boolean) => {
        this.bgmController.setEnabled(enabled);

        if (this.isSettingsMenuOpen) {
          this.showSettingsMenu();
        }
      },
      onChangeSfx: (enabled: boolean) => {
        this.bgmController.setSfxEnabled(enabled);

        if (this.isSettingsMenuOpen) {
          this.showSettingsMenu();
        }
      },
      selectedTimeOfDay: this.currentSkyState.timeOfDay,
      onSelectTimeOfDay: (timeOfDay: TimeOfDay) => {
        this.setDebugSkyTimeOfDay(timeOfDay);

        if (this.isSettingsMenuOpen) {
          this.showSettingsMenu();
        }
      },
      onResume: () => {
        this.hideSettingsMenu();
        this.resumeGame();
      },
      onExit: () => {
        this.hideSettingsMenu();
        return this.returnToMainScene();
      },
    });
  }

  private setDebugSkyTimeOfDay(timeOfDay: TimeOfDay): void {
    this.skyContext = {
      mode: TimeOfDayMode.Manual,
      timeOfDay,
      sunTimes: this.skyContext?.sunTimes ?? null,
    };
    this.currentSkyMinuteKey = null;
    this.syncSkyState(true);
  }

  private handleScoreIncrement(scoreDelta = 1): void {
    const hasNearMissBonus = scoreDelta > 1;

    this.bgmController.playPipePassCue(hasNearMissBonus);
    this.game.triggerTransientVibration?.({
      durationMs: PIPE_PASS_VIBRATION_DURATION_MS,
      strength: hasNearMissBonus
        ? PIPE_PASS_NEAR_MISS_VIBRATION_STRENGTH
        : PIPE_PASS_VIBRATION_STRENGTH,
    });

    if (scoreDelta > 1) {
      this.nearMissUI.showBonus(scoreDelta - 1);
    }

    const scoreState = this.scoreUI.addScore(scoreDelta);
    this.applyDifficultyForScore(scoreState.score);

    if (scoreState.isNewBest) {
      void this.game.persistFlappyBirdBestScore?.(scoreState.bestScore);
    }
  }

  private applyDifficultyForScore(score: number): void {
    const difficulty = this.resolveDifficultyState(score);
    this.pipeManager.applyDifficulty({
      speed: difficulty.pipeSpeed,
      pipeSpawnInterval: difficulty.pipeSpawnInterval,
      passageHeightMinRatio: difficulty.passageHeightMinRatio,
      passageHeightMaxRatio: difficulty.passageHeightMaxRatio,
    });
    this.groundManager.setSpeed(difficulty.pipeSpeed);
    this.cloudManager.setSpeed(difficulty.pipeSpeed);
  }

  private resolveDifficultyState(score: number): FlappyBirdDifficultyState {
    if (score <= FLAPPY_BIRD_TUTORIAL_SCORE_LIMIT) {
      return FLAPPY_BIRD_TUTORIAL_DIFFICULTY;
    }

    const progress = Math.min(
      1,
      (score - FLAPPY_BIRD_TUTORIAL_SCORE_LIMIT) /
        (FLAPPY_BIRD_MAX_DIFFICULTY_SCORE - FLAPPY_BIRD_TUTORIAL_SCORE_LIMIT),
    );

    return {
      pipeSpeed: this.resolvePipeSpeedForScore(score),
      pipeSpawnInterval: Math.round(
        this.interpolateNumber(
          FLAPPY_BIRD_BASE_DIFFICULTY.pipeSpawnInterval,
          FLAPPY_BIRD_MAX_DIFFICULTY.pipeSpawnInterval,
          progress,
        ),
      ),
      ...this.resolvePassageHeightRatiosForScore(score),
    };
  }

  private resolvePassageHeightRatiosForScore(
    score: number,
  ): Pick<
    FlappyBirdDifficultyState,
    "passageHeightMinRatio" | "passageHeightMaxRatio"
  > {
    if (score < FLAPPY_BIRD_SPEED_STEP_TWO_SCORE_LIMIT) {
      return {
        passageHeightMinRatio: 0.35,
        passageHeightMaxRatio: 0.35,
      };
    }

    if (score < FLAPPY_BIRD_ENDGAME_SCORE_LIMIT) {
      return {
        passageHeightMinRatio: 0.3,
        passageHeightMaxRatio: 0.3,
      };
    }

    return {
      passageHeightMinRatio:
        FLAPPY_BIRD_ENDGAME_DIFFICULTY.passageHeightMinRatio,
      passageHeightMaxRatio:
        FLAPPY_BIRD_ENDGAME_DIFFICULTY.passageHeightMaxRatio,
    };
  }

  private resolvePipeSpeedForScore(score: number): number {
    if (score < FLAPPY_BIRD_SPEED_STEP_TWO_SCORE_LIMIT) {
      return FLAPPY_BIRD_BASE_DIFFICULTY.pipeSpeed;
    }

    if (score < FLAPPY_BIRD_ENDGAME_SCORE_LIMIT) {
      return FLAPPY_BIRD_MAX_DIFFICULTY.pipeSpeed;
    }

    return FLAPPY_BIRD_ENDGAME_DIFFICULTY.pipeSpeed;
  }

  private interpolateNumber(
    start: number,
    end: number,
    progress: number,
  ): number {
    return start + (end - start) * progress;
  }

  private clearGameOverVibrationPattern(): void {
    while (this.gameOverVibrationTimeoutIds.length > 0) {
      const timeoutId = this.gameOverVibrationTimeoutIds.pop();

      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    }
  }

  private triggerGameOverVibrationPattern(): void {
    this.clearGameOverVibrationPattern();
    this.game.triggerTransientVibration?.({
      durationMs: GAME_OVER_VIBRATION_DURATION_MS,
      strength: GAME_OVER_VIBRATION_STRENGTH,
    });

    this.gameOverVibrationTimeoutIds.push(
      window.setTimeout(() => {
        this.game.triggerTransientVibration?.({
          durationMs: GAME_OVER_VIBRATION_DURATION_MS,
          strength: GAME_OVER_VIBRATION_STRENGTH,
        });
      }, GAME_OVER_VIBRATION_DELAY_MS),
    );
  }

  /**
   * 게임 오버 처리 메서드
   */
  private handleGameOver(): void {
    if (this.gameState !== GameState.PLAYING) {
      return;
    }

    // 그 다음 게임 상태 변경 및 물리 엔진 정지
    this.gameState = GameState.GAME_OVER;
    this.gameEngine.pause();
    this.hideSettingsMenu();
    this.countdownUI.hide();

    // 애니메이션 정지
    this.playerManager.stopAnimation();
    this.bgmController.pause();
    this.triggerGameOverVibrationPattern();
    this.game.showFlappyBirdGameOver?.({
      score: this.scoreUI.getScore(),
      bestScore: this.scoreUI.getBestScore(),
      onRestart: () => {
        this.restartGame();
      },
      onExit: () => this.returnToMainScene(),
    });
  }

  /**
   * 게임을 재시작합니다.
   */
  private restartGame(): void {
    this.clearGameOverVibrationPattern();
    this.game.hideFlappyBirdGameOver?.();
    this.hideSettingsMenu();

    // 게임 상태 초기화
    this.gameState = GameState.READY;
    this.gameEngine.pause();

    // 점수 초기화
    this.scoreUI.resetScore();
    this.nearMissUI.reset();
    this.applyDifficultyForScore(0);
    this.game.changeControlButtons(
      CONTROL_BUTTONS_SET[FlappyBirdGameSceneControlButtonsSetType.GamePlay],
    );

    // 모든 파이프 제거 및 스폰 타이머 초기화
    this.pipeManager.reset();

    // 플레이어 재설정
    this.playerManager.resetBasket();
    this.playerManager.resetPosition();

    // 바닥 타일 재설정
    this.groundManager.setup();
    this.cloudManager.setup();

    this.beginStartCountdown();
  }

  private async returnToMainScene(): Promise<void> {
    if (this.isReturningToMain) {
      return;
    }

    this.isReturningToMain = true;

    try {
      this.clearGameOverVibrationPattern();
      this.game.hideFlappyBirdGameOver?.();
      this.hideSettingsMenu();
      await this.game.changeScene(SceneKey.MAIN);
    } finally {
      this.isReturningToMain = false;
    }
  }

  /**
   * 화면 크기 변경 처리
   */
  public resize(width: number, height: number): void {
    if (!this.initialized) return;

    this.redrawBackground(width, height);
    this.groundManager.resize();
    this.cloudManager.resize();

    // UI 요소 위치 업데이트
    this.scoreUI.updatePosition(width);
    this.nearMissUI.updatePosition(width, height);
    this.countdownUI.updatePosition(width, height);

    // 디버그 렌더러 업데이트
    this.physicsManager.updateDebugRendererSize(width, height);
    this.physicsManager.syncDisplayObjects();
  }

  /**
   * 컨트롤 버튼 클릭 핸들러
   */
  public handleControlButtonClick(buttonType: ControlButtonType): void {
    switch (buttonType) {
      case ControlButtonType.DoubleJump:
        if (this.gameState === GameState.PLAYING) {
          this.doubleJump();
        }
        break;
      case ControlButtonType.Jump:
        if (this.gameState === GameState.PLAYING) {
          this.jump();
        }
        break;
      case ControlButtonType.Settings:
        this.openSettingsMenu();
        break;
      default:
        throw new Error("Invalid button type");
    }
  }

  public handleSliderValueChange(_value: number): void {}

  public handleSliderEnd(): void {}

  /**
   * 매 프레임마다 실행되는 업데이트 메서드
   */
  public update(deltaTime: number): void {
    if (!this.initialized) return;

    const currentTime = Date.now();
    this.syncSkyState();
    this.nearMissUI.update(deltaTime);
    this.playerManager.update();

    if (this.gameState === GameState.COUNTDOWN) {
      const previousDisplayValue = this.countdownUI.getCurrentDisplayValue();
      const hasCountdownFinished = this.countdownUI.update(deltaTime);
      const currentDisplayValue = this.countdownUI.getCurrentDisplayValue();

      if (
        !hasCountdownFinished &&
        currentDisplayValue > 0 &&
        currentDisplayValue !== previousDisplayValue
      ) {
        void this.bgmController.playCountdownCue(currentDisplayValue);
      }

      if (hasCountdownFinished) {
        this.startGame();
      }

      return;
    }

    if (this.gameState === GameState.PLAYING) {
      this.cloudManager.update(deltaTime);

      // 플레이어 경계 충돌 체크
      this.playerManager.checkCollisions();

      // 파이프 관리
      this.pipeManager.update(
        currentTime,
        this.playerManager.getBasketBody(),
        (scoreDelta) => this.handleScoreIncrement(scoreDelta),
        deltaTime,
      );

      // 바닥 타일 이동
      this.groundManager.update(deltaTime);
    }
  }

  /**
   * 리소스를 정리하고 객체를 파괴합니다.
   */
  public destroy(): void {
    // 이벤트 리스너 제거
    window.removeEventListener("keydown", this.boundHandleKeyDown);
    this.clearGameOverVibrationPattern();
    this.game.hideFlappyBirdGameOver?.();
    this.hideSettingsMenu();
    this.countdownUI.hide();
    this.nearMissUI.reset();
    this.bgmController.destroy();
    this.cloudManager.reset();

    // 물리 시스템 정리
    this.physicsManager.cleanup();
    this.gameEngine.cleanup();

    // 기본 정리
    super.destroy();
  }

  private syncSkyState(force = false): void {
    const now = new Date();
    const nextMinuteKey = this.getSkyMinuteKey(now);

    if (!force && nextMinuteKey === this.currentSkyMinuteKey) {
      return;
    }

    this.currentSkyState = this.resolveSkyState(now);
    this.currentSkyMinuteKey = nextMinuteKey;
    this.syncCloudVisualStyle();
    this.redrawBackground(
      this.game.app.screen.width,
      this.game.app.screen.height,
    );
  }

  private syncCloudVisualStyle(): void {
    if (!this.cloudManager) {
      return;
    }

    switch (this.currentSkyState.timeOfDay) {
      case TimeOfDay.Day:
        this.cloudManager.setVisualStyle({
          alphaMin: 0.3,
          alphaMax: 0.46,
          tint: 0xffffff,
        });
        break;
      case TimeOfDay.Sunrise:
        this.cloudManager.setVisualStyle({
          alphaMin: this.lerp(0.3, 0.22, this.currentSkyState.progress),
          alphaMax: this.lerp(0.42, 0.32, this.currentSkyState.progress),
          tint: this.lerpColor(0xfff7ea, 0xffffff, this.currentSkyState.progress),
        });
        break;
      default:
        this.cloudManager.setVisualStyle({
          alphaMin: 0.16,
          alphaMax: 0.28,
          tint: 0xffffff,
        });
        break;
    }
  }

  private resolveSkyState(now: Date): SkyVisualState {
    if (
      this.skyContext?.mode === TimeOfDayMode.Auto &&
      this.skyContext.sunTimes
    ) {
      const nextAutoState = resolveAutoTimeOfDayState(
        now,
        this.skyContext.sunTimes,
      );

      return {
        timeOfDay: nextAutoState.timeOfDay,
        progress: nextAutoState.progress,
      };
    }

    return getManualSkyVisualState(this.skyContext?.timeOfDay ?? TimeOfDay.Day);
  }

  private getSkyMinuteKey(now: Date): string {
    if (
      this.skyContext?.mode !== TimeOfDayMode.Auto ||
      !this.skyContext.sunTimes
    ) {
      return `manual:${this.skyContext?.timeOfDay ?? TimeOfDay.Day}`;
    }

    return `${Math.floor(now.getTime() / (60 * 1000))}`;
  }

  private redrawBackground(width: number, height: number): void {
    const overlay = this.getSkyOverlayConfig();

    this.background.clear();
    this.background.beginFill(overlay.baseColor);
    this.background.drawRect(0, 0, width, height);
    this.background.endFill();

    if (overlay.alpha > 0.001) {
      this.background.beginFill(overlay.color, overlay.alpha);
      this.background.drawRect(0, 0, width, height);
      this.background.endFill();
    }

    this.drawStars(width, height, overlay.starAlpha, overlay.starScale);
  }

  private drawStars(
    width: number,
    height: number,
    alpha: number,
    scale: number,
  ): void {
    if (alpha <= 0.001) {
      return;
    }

    this.background.beginFill(SKY_STAR_COLOR, alpha);

    for (const star of SKY_STAR_LAYOUT) {
      this.background.drawCircle(
        star.x * width,
        star.y * height,
        Math.max(0.8, star.radius * scale * 0.42),
      );
    }

    this.background.endFill();
  }

  private getSkyOverlayConfig(): {
    baseColor: number;
    color: number;
    alpha: number;
    starAlpha: number;
    starScale: number;
  } {
    const progress = this.easeInOut(this.currentSkyState.progress);

    switch (this.currentSkyState.timeOfDay) {
      case TimeOfDay.Sunrise:
        return {
          baseColor: this.lerpColor(0x4c79d8, 0xffb868, progress),
          color: this.lerpColor(0xff8a38, 0xffc979, progress),
          alpha: this.lerp(0.24, 0.1, progress),
          starAlpha: 0,
          starScale: 1,
        };
      case TimeOfDay.Sunset:
        return {
          baseColor: this.lerpColor(0x78adff, 0x7157be, progress),
          color: this.lerpColor(0xff8d45, 0x1e2f64, progress),
          alpha: this.lerp(0.16, 0.3, progress),
          starAlpha: this.lerp(0.12, 0.28, progress),
          starScale: this.lerp(0.86, 0.98, progress),
        };
      case TimeOfDay.Night:
        return {
          baseColor: 0x16315f,
          color: 0x07142d,
          alpha: 0.36,
          starAlpha: 0.42,
          starScale: 0.96,
        };
      case TimeOfDay.Day:
      default:
        return {
          baseColor: SKY_DAY_COLOR,
          color: 0xffffff,
          alpha: 0,
          starAlpha: 0,
          starScale: 1,
        };
    }
  }

  private lerpColor(from: number, to: number, progress: number): number {
    const fromRed = (from >> 16) & 0xff;
    const fromGreen = (from >> 8) & 0xff;
    const fromBlue = from & 0xff;
    const toRed = (to >> 16) & 0xff;
    const toGreen = (to >> 8) & 0xff;
    const toBlue = to & 0xff;

    const red = Math.round(this.lerp(fromRed, toRed, progress));
    const green = Math.round(this.lerp(fromGreen, toGreen, progress));
    const blue = Math.round(this.lerp(fromBlue, toBlue, progress));

    return (red << 16) | (green << 8) | blue;
  }

  private lerp(from: number, to: number, progress: number): number {
    return from + (to - from) * progress;
  }

  private easeInOut(progress: number): number {
    return progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;
  }
}
