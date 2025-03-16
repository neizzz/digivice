import * as PIXI from "pixi.js";
import * as Matter from "matter-js";
import { Scene } from "../interfaces/Scene";
import { Background } from "../entities/Background";
import { AssetLoader } from "../utils/AssetLoader";
import { DebugHelper } from "../utils/DebugHelper";
import { GameEngine } from "../GameEngine";

export class FlappyBirdGameScene extends PIXI.Container implements Scene {
  private app: PIXI.Application;
  private gameEngine: GameEngine;
  private background: Background;
  private initialized: boolean = false;

  // 플래피 버드 게임 요소
  private bird: PIXI.Sprite;
  private birdBody: Matter.Body;
  private pipes: PIXI.Container;
  private pipesPairs: {
    top: PIXI.Sprite;
    bottom: PIXI.Sprite;
    topBody: Matter.Body;
    bottomBody: Matter.Body;
  }[] = [];
  private scoreText: PIXI.Text;
  private score: number = 0;
  private gameOver: boolean = false;
  private gameStarted: boolean = false;
  private pipeSpeed: number = 2;
  private pipeSpawnInterval: number = 2000; // 2초마다 파이프 생성
  private lastPipeSpawnTime: number = 0;
  private ground: PIXI.Sprite;
  private groundBody: Matter.Body;
  // 디버그 모드 설정
  private debugMode: boolean = true;
  private debugRenderer: Matter.Render;
  private debugCanvas: HTMLCanvasElement;
  private container: HTMLElement;

  constructor(app: PIXI.Application, gameEngine?: GameEngine) {
    super();
    this.app = app;
    this.container = app.view.parentElement || document.body;
    this.gameEngine =
      gameEngine || new GameEngine(app.screen.width, app.screen.height);

    // 디버그 헬퍼 초기화
    DebugHelper.init(app);
    DebugHelper.setEnabled(true);

    // 하늘색 배경 생성
    const skyBlueColor = 0x87ceeb;
    const backgroundGraphics = new PIXI.Graphics();
    backgroundGraphics.beginFill(skyBlueColor);
    backgroundGraphics.drawRect(0, 0, app.screen.width, app.screen.height);
    backgroundGraphics.endFill();
    this.background = backgroundGraphics;

    // 새 캐릭터 생성
    this.bird = new PIXI.Sprite(PIXI.Texture.WHITE);
    this.bird.width = 40;
    this.bird.height = 40;
    this.bird.anchor.set(0.5);

    // 새를 위한 물리 바디 생성
    this.birdBody = Matter.Bodies.circle(
      this.app.screen.width / 3,
      this.app.screen.height / 2,
      this.bird.width / 2,
      {
        label: "bird",
        isStatic: false,
      }
    );

    // 파이프 컨테이너 생성
    this.pipes = new PIXI.Container();

    // 바닥 생성
    this.ground = new PIXI.Sprite(PIXI.Texture.WHITE);
    this.ground.width = this.app.screen.width;
    this.ground.height = 50;
    this.ground.tint = 0x967969; // 갈색 계열
    this.ground.y = this.app.screen.height - this.ground.height;

    // 바닥 물리 바디 생성
    this.groundBody = Matter.Bodies.rectangle(
      this.app.screen.width / 2,
      this.app.screen.height - this.ground.height / 2,
      this.app.screen.width,
      this.ground.height,
      { isStatic: true, label: "ground" }
    );

    // 점수 텍스트 생성
    this.scoreText = new PIXI.Text("Score: 0", {
      fontFamily: "Arial",
      fontSize: 24,
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 4,
      align: "center",
    });
    this.scoreText.anchor.set(0.5, 0);
    this.scoreText.position.set(this.app.screen.width / 2, 20);

    this.setupScene();
  }

  /**
   * 씬을 동기적으로 설정합니다.
   */
  private setupScene(): void {
    try {
      // GameEngine이 초기화되지 않았을 때만 초기화
      if (!this.gameEngine["physics"] || !this.gameEngine["runner"]) {
        this.gameEngine.initialize(this.app);
      }

      // 씬 요소 추가
      this.addChild(this.background);
      this.addChild(this.pipes);
      this.addChild(this.ground);
      this.addChild(this.bird);

      // 점수 텍스트 추가 - 항상 최상위에 표시
      this.addChild(this.scoreText);

      // 게임 엔진에 물리 객체 추가
      this.gameEngine.addGameObject(this.bird, this.birdBody);
      this.gameEngine.addGameObject(this.ground, this.groundBody);

      // 바닥 스프라이트의 앵커 설정 추가 - 중앙 기준점으로 변경
      this.ground.anchor.set(0.5, 0.5);
      // 바닥 위치 재조정
      this.ground.position.set(
        this.app.screen.width / 2,
        this.app.screen.height - this.ground.height / 2
      );

      // 강제로 새의 정적 상태 해제
      if (this.birdBody.isStatic) {
        Matter.Body.setStatic(this.birdBody, false);
      }

      // 위치 설정
      Matter.Body.setPosition(this.birdBody, {
        x: this.app.screen.width / 4,
        y: this.app.screen.height / 2,
      });
      Matter.Body.setVelocity(this.birdBody, { x: 0, y: 0 });

      // 충돌 이벤트 리스너 설정
      this.setupCollisionListeners();

      // 디버그 렌더러 활성화
      this.setupDebugRenderer();

      this.initialized = true;

      // 화면 크기에 맞게 조정
      this.onResize(this.app.screen.width, this.app.screen.height);

      // 바로 게임 시작
      this.startGame();

      // 키보드 이벤트 리스너 추가
      this.setupKeyboardListeners();
    } catch (error) {
      console.error("Error setting up FlappyBirdGameScene:", error);
    }
  }

  /**
   * Matter.js 디버그 렌더러 설정
   */
  private setupDebugRenderer(): void {
    this.cleanupDebugRenderer();

    this.debugCanvas = document.createElement("canvas");
    this.debugCanvas.width = this.app.screen.width;
    this.debugCanvas.height = this.app.screen.height;
    this.debugCanvas.style.position = "absolute";
    this.debugCanvas.style.top = "0";
    this.debugCanvas.style.left = "0";
    this.debugCanvas.style.pointerEvents = "none";
    this.debugCanvas.style.opacity = "0.7";
    this.debugCanvas.id = "debug-canvas";
    this.debugCanvas.style.zIndex = "1000";
    this.container.appendChild(this.debugCanvas);

    this.debugRenderer = Matter.Render.create({
      canvas: this.debugCanvas,
      engine: this.gameEngine.getPhysicsEngine(),
      options: {
        width: this.app.screen.width,
        height: this.app.screen.height,
        wireframes: true,
        showBounds: true,
        showCollisions: true,
        showVelocity: true,
        showAngleIndicator: true,
        wireframeBackground: "transparent",
        showPositions: true,
        lineThickness: 2,
        background: "transparent",
        showSleeping: true,
        showIds: false,
        showShadows: false,
        showVertexNumbers: false,
        showConvexHulls: true,
      },
    });

    Matter.Render.run(this.debugRenderer);
  }

  private cleanupDebugRenderer(): void {
    if (this.debugRenderer) {
      Matter.Render.stop(this.debugRenderer);
      this.debugRenderer = null;
    }

    if (this.debugCanvas && this.debugCanvas.parentElement) {
      this.debugCanvas.parentElement.removeChild(this.debugCanvas);
      this.debugCanvas = null;
    }

    const existingCanvas = document.getElementById("debug-canvas");
    if (existingCanvas) {
      existingCanvas.parentElement.removeChild(existingCanvas);
    }
  }

  private setupCollisionListeners(): void {
    Matter.Events.on(this.gameEngine["physics"], "collisionStart", (event) => {
      const pairs = event.pairs;

      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        if (
          (pair.bodyA.label === "bird" &&
            (pair.bodyB.label === "ground" || pair.bodyB.label === "pipe")) ||
          (pair.bodyB.label === "bird" &&
            (pair.bodyA.label === "ground" || pair.bodyA.label === "pipe"))
        ) {
          if (!this.gameOver) {
            this.handleGameOver();
          }
        }
      }
    });
  }

  private setupKeyboardListeners(): void {
    window.addEventListener("keydown", this.handleKeyDown.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === "Space" || event.key === " ") {
      if (!this.gameOver) {
        this.jump();
      } else {
        this.restartGame();
      }
    }

    if (event.code === "KeyD") {
      this.toggleDebugMode();
    }
  }

  public handleControlButtonClick(buttonType: ControlButtonType): void {
    if (this.gameOver) {
      this.restartGame();
    } else {
      this.jump();
    }
  }

  private startGame(): void {
    this.gameStarted = true;
    Matter.Body.setVelocity(this.birdBody, { x: 0, y: 0 });
  }

  /**
   * 새 캐릭터 점프 - 높이를 반으로 줄임
   */
  private jump(): void {
    // 점프 높이를 -12에서 -6으로 변경 (절반 높이)
    Matter.Body.setVelocity(this.birdBody, { x: 0, y: -8 });
  }

  // 점수 업데이트 함수 - 시각적 효과 제거
  private updateScore(): void {
    this.score++;
    this.scoreText.text = `Score: ${this.score}`;
    // 크기 변경 효과 제거
  }

  private createPipePair(): void {
    if (this.gameOver) return;

    const gapHeight = 150; // 파이프 사이 간격
    const pipeWidth = 60;
    const minPipeHeight = 100; // 최소 파이프 높이

    // 랜덤 간격 위치 계산
    const availableHeight =
      this.app.screen.height -
      this.ground.height -
      (gapHeight + minPipeHeight * 2);
    const topPipeHeight = minPipeHeight + Math.random() * availableHeight;

    // 상단 파이프 생성 - 앵커 수정
    const topPipe = new PIXI.Sprite(PIXI.Texture.WHITE);
    topPipe.width = pipeWidth;
    topPipe.height = topPipeHeight;
    topPipe.tint = 0x00aa00; // 녹색
    topPipe.anchor.set(0.5, 0.5); // 중앙 기준점으로 변경

    // 상단 파이프 물리 바디 생성
    const topPipeBody = Matter.Bodies.rectangle(
      this.app.screen.width + pipeWidth / 2,
      topPipeHeight / 2,
      pipeWidth,
      topPipeHeight,
      { isStatic: true, label: "pipe" }
    );

    // 위치 설정 - 물리 바디의 중심점과 일치시킴
    topPipe.position.set(
      this.app.screen.width + pipeWidth / 2,
      topPipeHeight / 2
    );

    // 하단 파이프 생성 - 앵커 수정
    const bottomPipe = new PIXI.Sprite(PIXI.Texture.WHITE);
    bottomPipe.width = pipeWidth;
    bottomPipe.height =
      this.app.screen.height - topPipeHeight - gapHeight - this.ground.height;
    bottomPipe.tint = 0x00aa00; // 녹색
    bottomPipe.anchor.set(0.5, 0.5); // 중앙 기준점으로 변경

    // 하단 파이프 물리 바디 위치 계산
    const bottomPipeBodyY = topPipeHeight + gapHeight + bottomPipe.height / 2;

    // 하단 파이프 물리 바디 생성
    const bottomPipeBody = Matter.Bodies.rectangle(
      this.app.screen.width + pipeWidth / 2,
      bottomPipeBodyY,
      pipeWidth,
      bottomPipe.height,
      { isStatic: true, label: "pipe" }
    );

    // 위치 설정 - 물리 바디의 중심점과 일치시킴
    bottomPipe.position.set(
      this.app.screen.width + pipeWidth / 2,
      bottomPipeBodyY
    );

    // 파이프 컨테이너에 추가
    this.pipes.addChild(topPipe);
    this.pipes.addChild(bottomPipe);

    // 게임 엔진에 파이프 물리 바디 추가
    this.gameEngine.addGameObject(topPipe, topPipeBody);
    this.gameEngine.addGameObject(bottomPipe, bottomPipeBody);

    // 파이프 쌍 추적
    topPipe.userData = { passed: false };
    this.pipesPairs.push({
      top: topPipe,
      bottom: bottomPipe,
      topBody: topPipeBody,
      bottomBody: bottomPipeBody,
    });
  }

  private movePipes(): void {
    for (let i = 0; i < this.pipesPairs.length; i++) {
      const pair = this.pipesPairs[i];

      Matter.Body.translate(pair.topBody, { x: -this.pipeSpeed, y: 0 });
      Matter.Body.translate(pair.bottomBody, { x: -this.pipeSpeed, y: 0 });

      pair.top.position.x = pair.topBody.position.x;
      pair.bottom.position.x = pair.bottomBody.position.x;

      if (
        pair.topBody.position.x < this.birdBody.position.x &&
        !pair.top.userData?.passed
      ) {
        pair.top.userData = { passed: true };
        // 점수 업데이트 함수 호출로 변경
        this.updateScore();
      }

      if (pair.topBody.position.x < -pair.top.width) {
        this.pipes.removeChild(pair.top);
        this.pipes.removeChild(pair.bottom);

        Matter.Composite.remove(this.gameEngine["physics"].world, pair.topBody);
        Matter.Composite.remove(
          this.gameEngine["physics"].world,
          pair.bottomBody
        );

        this.pipesPairs.splice(i, 1);
        i--;
      }
    }
  }

  private checkCollisions(): void {
    if (this.gameOver) return;

    if (this.birdBody.position.y - this.bird.height / 2 <= 0) {
      Matter.Body.setPosition(this.birdBody, {
        x: this.birdBody.position.x,
        y: this.bird.height / 2,
      });
      Matter.Body.setVelocity(this.birdBody, { x: 0, y: 0 });
    }
  }

  private handleGameOver(): void {
    this.gameOver = true;

    // 게임 오버 시 게임 엔진 일시 중지
    this.gameEngine.pause();

    // 최종 점수 표시 제거 (Final Score 텍스트 추가 코드 삭제)

    const gameOverText = new PIXI.Text("Game Over", {
      fontFamily: "Arial",
      fontSize: 48,
      fill: 0xffffff,
      align: "center",
      stroke: 0x000000,
      strokeThickness: 6,
    });
    gameOverText.name = "gameOverText";
    gameOverText.anchor.set(0.5);
    gameOverText.position.set(
      this.app.screen.width / 2,
      this.app.screen.height / 3
    );
    this.addChild(gameOverText);

    const restartText = new PIXI.Text("Press SPACE to restart", {
      fontFamily: "Arial",
      fontSize: 24,
      fill: 0xffffff,
      align: "center",
      stroke: 0x000000,
      strokeThickness: 4,
    });
    restartText.name = "restartText";
    restartText.anchor.set(0.5);
    restartText.position.set(
      this.app.screen.width / 2,
      this.app.screen.height / 2
    );
    this.addChild(restartText);
  }

  private restartGame(): void {
    this.gameOver = false;
    this.score = 0;
    this.scoreText.text = "Score: 0";
    // 크기 리셋 코드 제거 (크기 변경이 없으므로 필요 없음)

    // 게임 재시작 시 게임 엔진 재개
    this.gameEngine.resume();

    Matter.Body.setPosition(this.birdBody, {
      x: this.app.screen.width / 3,
      y: this.app.screen.height / 2,
    });
    Matter.Body.setVelocity(this.birdBody, { x: 0, y: 0 });
    Matter.Body.setAngle(this.birdBody, 0);

    for (const pair of this.pipesPairs) {
      this.pipes.removeChild(pair.top);
      this.pipes.removeChild(pair.bottom);
      Matter.Composite.remove(this.gameEngine["physics"].world, pair.topBody);
      Matter.Composite.remove(
        this.gameEngine["physics"].world,
        pair.bottomBody
      );
    }
    this.pipesPairs = [];

    const gameOverText = this.getChildByName("gameOverText");
    if (gameOverText) {
      this.removeChild(gameOverText);
    }

    const restartText = this.getChildByName("restartText");
    if (restartText) {
      this.removeChild(restartText);
    }

    this.lastPipeSpawnTime = 0;
  }

  private toggleDebugMode(): void {
    this.debugMode = !this.debugMode;

    if (this.debugMode) {
      this.setupDebugRenderer();
    } else {
      this.cleanupDebugRenderer();
    }
  }

  public setSceneChangeCallback(callback: (key: SceneKey) => void): void {}

  public onResize(width: number, height: number): void {
    if (!this.initialized) return;

    if (this.background instanceof PIXI.Graphics) {
      this.background.clear();
      this.background.beginFill(0x87ceeb);
      this.background.drawRect(0, 0, width, height);
      this.background.endFill();
    }

    if (this.ground && this.groundBody) {
      this.ground.width = width;
      // 바닥의 앵커가 중앙이므로 위치 조정 방식 변경
      this.ground.position.set(width / 2, height - this.ground.height / 2);

      Matter.Body.setPosition(this.groundBody, {
        x: width / 2,
        y: height - this.ground.height / 2,
      });
    }

    if (this.scoreText) {
      this.scoreText.position.set(width / 2, 20);
    }

    const gameOverText = this.getChildByName("gameOverText");
    if (gameOverText) {
      gameOverText.position.set(width / 2, height / 3);
    }

    const restartText = this.getChildByName("restartText");
    if (restartText) {
      restartText.position.set(width / 2, height / 2);
    }

    if (this.gameEngine) {
      this.gameEngine.resize(width, height);
    }

    if (this.debugMode && this.debugRenderer && this.debugCanvas) {
      this.debugRenderer.options.width = width;
      this.debugRenderer.options.height = height;
      this.debugCanvas.width = width;
      this.debugCanvas.height = height;
    }
  }

  public update(deltaTime: number): void {
    if (!this.initialized) return;

    const currentTime = Date.now();

    if (this.gameStarted && !this.gameOver) {
      this.bird.position.x = this.birdBody.position.x;
      this.bird.position.y = this.birdBody.position.y;

      if (currentTime - this.lastPipeSpawnTime > this.pipeSpawnInterval) {
        this.createPipePair();
        this.lastPipeSpawnTime = currentTime;
      }

      this.movePipes();
      this.checkCollisions();
    }
    // 게임 오버 상태에서는 더 이상 새 위치를 업데이트하지 않음
    // else if (this.gameOver) {
    //   this.bird.position.x = this.birdBody.position.x;
    //   this.bird.position.y = this.birdBody.position.y;
    // }
  }

  public destroy(): void {
    window.removeEventListener("keydown", this.handleKeyDown.bind(this));
    this.cleanupDebugRenderer();

    for (const pair of this.pipesPairs) {
      if (pair.topBody && pair.bottomBody) {
        Matter.Composite.remove(this.gameEngine["physics"].world, pair.topBody);
        Matter.Composite.remove(
          this.gameEngine["physics"].world,
          pair.bottomBody
        );
      }
    }

    if (this.birdBody) {
      Matter.Composite.remove(this.gameEngine["physics"].world, this.birdBody);
    }

    if (this.groundBody) {
      Matter.Composite.remove(
        this.gameEngine["physics"].world,
        this.groundBody
      );
    }

    super.destroy();
  }
}
