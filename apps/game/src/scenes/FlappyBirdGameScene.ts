import * as PIXI from "pixi.js";
import * as Matter from "matter-js";
import { Scene } from "../interfaces/Scene";
import { Background } from "../entities/Background";
import { AssetLoader } from "../utils/AssetLoader";
import { DebugHelper } from "../utils/DebugHelper";
import { GameEngine } from "../GameEngine";
import { PipeGenerator } from "../entities/PipeGenerator";

export class FlappyBirdGameScene extends PIXI.Container implements Scene {
  private app: PIXI.Application;
  private gameEngine: GameEngine;
  private background: Background;
  private initialized: boolean = false;

  // 플래피 버드 게임 요소
  private bird: PIXI.Sprite;
  private birdBody: Matter.Body;
  private pipes: PIXI.Container;
  private pipeGenerator: PipeGenerator; // PipeGenerator 인스턴스 추가
  private pipesPairs: PipePair[] = []; // 파이프 쌍을 관리하는 배열 추가
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

    // AssetLoader에서 타일셋 가져오기
    const assets = AssetLoader.getAssets();
    const tilesetSprites = assets.tilesetSprites;

    // 타일 크기를 텍스처 프레임 기반으로 결정
    let tileSize = 32; // 기본값

    // 바닥 생성 - 타일셋 사용
    if (tilesetSprites && tilesetSprites.textures["ground-1"]) {
      const groundTexture = tilesetSprites.textures["ground-1"];
      tileSize = groundTexture.frame.width; // 텍스처 프레임 크기 사용
      console.log("[FlappyBirdGameScene] Using tileset texture for ground");
    } else {
      console.warn(
        "[FlappyBirdGameScene] Tileset texture not found for ground, using default"
      );
    }

    // 지면 컨테이너 생성 - 타입 캐스팅 대신 명시적 선언
    const groundContainer = new PIXI.Container();
    groundContainer.width = this.app.screen.width;
    groundContainer.height = tileSize;
    this.ground = groundContainer as any; // 인터페이스 호환을 위해 any로 캐스팅

    // 지면에 타일 추가 (초기 상태)
    if (tilesetSprites && tilesetSprites.textures["ground-1"]) {
      const tilesNeeded = Math.ceil(this.app.screen.width / tileSize);

      for (let i = 0; i < tilesNeeded; i++) {
        const tileTexture =
          i % 2 === 0
            ? tilesetSprites.textures["ground-1"]
            : tilesetSprites.textures["ground-2"];

        const tile = new PIXI.Sprite(tileTexture);
        tile.width = tileSize;
        tile.height = tileSize;
        tile.position.x = i * tileSize;
        groundContainer.addChild(tile);
      }
    } else {
      // 타일셋이 없는 경우 단색 사각형 추가
      const fallbackGround = new PIXI.Graphics();
      fallbackGround.beginFill(0x967969);
      fallbackGround.drawRect(0, 0, this.app.screen.width, tileSize);
      fallbackGround.endFill();
      groundContainer.addChild(fallbackGround);
    }

    // 지면 물리 바디 생성
    this.groundBody = Matter.Bodies.rectangle(
      this.app.screen.width / 2,
      this.app.screen.height - tileSize / 2,
      this.app.screen.width,
      tileSize,
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
      this.addChild(this.scoreText);

      // 게임 엔진에 물리 객체 추가
      this.gameEngine.addGameObject(this.bird, this.birdBody);
      this.gameEngine.addGameObject(this.ground, this.groundBody);

      // 바닥 위치 재조정
      const tileSize = 32;
      this.ground.position.set(
        this.app.screen.width / 2,
        this.app.screen.height - tileSize / 2
      );

      // PipeGenerator 초기화
      this.pipeGenerator = new PipeGenerator(this.app, this.gameEngine);

      // 새 물리 설정
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

    const brightGreen = "#26ff00";

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
        // 디버그 경계선 색상 변경
        wireframeStrokeStyle: brightGreen,
        collisionStrokeStyle: brightGreen,
        boundsStrokeStyle: brightGreen,
        constraintStrokeStyle: brightGreen,
        background: "transparent",
        showSleeping: true,
        showIds: false,
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
   * 새 캐릭터 점프
   */
  private jump(): void {
    Matter.Body.setVelocity(this.birdBody, { x: 0, y: -8 });
  }

  // 점수 업데이트 함수
  private updateScore(): void {
    this.score++;
    this.scoreText.text = `Score: ${this.score}`;
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

    // 게임 재시작 시 게임 엔진 재개
    this.gameEngine.resume();

    // 모든 파이프 제거
    while (this.pipesPairs.length > 0) {
      this.removePipePair(0);
    }

    Matter.Body.setPosition(this.birdBody, {
      x: this.app.screen.width / 3,
      y: this.app.screen.height / 2,
    });
    Matter.Body.setVelocity(this.birdBody, { x: 0, y: 0 });
    Matter.Body.setAngle(this.birdBody, 0);

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
      // 텍스처 기반으로 타일 크기 결정
      const assets = AssetLoader.getAssets();
      const tileSize =
        assets.tilesetSprites && assets.tilesetSprites.textures["ground-1"]
          ? assets.tilesetSprites.textures["ground-1"].frame.width
          : 32;

      // 바닥 텍스처를 타일 형태로 반복
      if (assets.tilesetSprites && assets.tilesetSprites.textures["ground-1"]) {
        this.removeChild(this.ground);
        const groundContainer = new PIXI.Container();
        groundContainer.width = width;
        groundContainer.height = tileSize;

        const tilesNeeded = Math.ceil(width / tileSize);

        for (let i = 0; i < tilesNeeded; i++) {
          const tileTexture =
            i % 2 === 0
              ? assets.tilesetSprites.textures["ground-1"]
              : assets.tilesetSprites.textures["ground-2"];

          const tile = new PIXI.Sprite(tileTexture);
          tile.width = tileSize;
          tile.height = tileSize;
          tile.position.x = i * tileSize;
          groundContainer.addChild(tile);
        }

        groundContainer.pivot.x = width / 2;
        groundContainer.pivot.y = tileSize / 2;
        groundContainer.position.set(width / 2, height - tileSize / 2);

        this.addChild(groundContainer);
        this.ground = groundContainer;
      } else {
        this.ground.width = width;
        this.ground.height = tileSize;
        this.ground.position.set(width / 2, height - tileSize / 2);
      }

      // 바닥 물리 바디 업데이트
      Matter.Body.setPosition(this.groundBody, {
        x: width / 2,
        y: height - tileSize / 2,
      });
      Matter.Body.setVertices(
        this.groundBody,
        Matter.Vertices.fromPath(
          `0 0 ${width} 0 ${width} ${tileSize} 0 ${tileSize}`
        )
      );
    }

    // UI 요소 위치 업데이트
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

    // 디버그 렌더러 업데이트
    if (this.debugMode && this.debugRenderer && this.debugCanvas) {
      this.debugRenderer.options.width = width;
      this.debugRenderer.options.height = height;
      this.debugCanvas.width = width;
      this.debugCanvas.height = height;
    }
  }

  /**
   * 파이프를 생성하는 메서드
   */
  private createPipePair(): void {
    if (this.gameOver) return;

    // 텍스처 기반으로 타일 크기 결정
    const assets = AssetLoader.getAssets();

    if (
      !assets.tilesetSprites ||
      !assets.tilesetSprites.textures["pipe-body"]
    ) {
      throw new Error("Pipe textures not found in assets");
    }

    const texture = assets.tilesetSprites.textures["pipe-body"];
    const tileSize = texture.frame.width;

    // PipeGenerator에서 파이프 쌍 생성 - 정확한 타일 크기 전달
    const pipePair = this.pipeGenerator.createPipePair(
      this.ground.height,
      tileSize
    );

    // 파이프 컨테이너에 추가
    this.pipes.addChild(pipePair.top);
    this.pipes.addChild(pipePair.bottom);

    // 게임 엔진에 파이프 물리 바디 추가
    this.gameEngine.addGameObject(pipePair.top, pipePair.topBody);
    this.gameEngine.addGameObject(pipePair.bottom, pipePair.bottomBody);

    // 파이프 쌍 추적
    this.pipesPairs.push(pipePair);
  }

  /**
   * 파이프를 이동시키는 메서드
   */
  private movePipes(): void {
    for (let i = 0; i < this.pipesPairs.length; i++) {
      const pair = this.pipesPairs[i];

      // 물리 바디 이동
      Matter.Body.translate(pair.topBody, { x: -this.pipeSpeed, y: 0 });
      Matter.Body.translate(pair.bottomBody, { x: -this.pipeSpeed, y: 0 });

      // 렌더링 객체 위치 업데이트
      pair.top.position.x = pair.topBody.position.x;
      pair.bottom.position.x = pair.bottomBody.position.x;

      // 점수 처리
      if (pair.topBody.position.x < this.birdBody.position.x && !pair.passed) {
        pair.passed = true;
        this.updateScore();
      }

      // 화면 밖으로 나간 파이프 제거
      if (pair.topBody.position.x < -pair.top.width) {
        this.removePipePair(i);
        i--;
      }
    }
  }

  /**
   * 특정 인덱스의 파이프 쌍을 제거합니다.
   */
  private removePipePair(index: number): void {
    const pair = this.pipesPairs[index];

    // 디스플레이 객체 제거
    this.pipes.removeChild(pair.top);
    this.pipes.removeChild(pair.bottom);

    // 물리 바디 제거
    Matter.Composite.remove(this.gameEngine["physics"].world, pair.topBody);
    Matter.Composite.remove(this.gameEngine["physics"].world, pair.bottomBody);

    // 배열에서 제거
    this.pipesPairs.splice(index, 1);
  }

  public update(deltaTime: number): void {
    if (!this.initialized) return;

    const currentTime = Date.now();

    if (this.gameStarted && !this.gameOver) {
      this.bird.position.x = this.birdBody.position.x;
      this.bird.position.y = this.birdBody.position.y;

      // 파이프 생성 로직
      if (currentTime - this.lastPipeSpawnTime > this.pipeSpawnInterval) {
        this.createPipePair();
        this.lastPipeSpawnTime = currentTime;
      }

      // 파이프 이동 로직
      this.movePipes();

      this.checkCollisions();
    }
  }

  public destroy(): void {
    window.removeEventListener("keydown", this.handleKeyDown.bind(this));
    this.cleanupDebugRenderer();

    // 모든 파이프 제거
    while (this.pipesPairs.length > 0) {
      this.removePipePair(0);
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
