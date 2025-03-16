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

    // 바닥 생성 - 타일셋 사용
    let groundTexture = PIXI.Texture.WHITE; // 기본값
    if (tilesetSprites && tilesetSprites.textures["ground-1"]) {
      groundTexture = tilesetSprites.textures["ground-1"];
      console.log("[FlappyBirdGameScene] Using tileset texture for ground");
    } else {
      console.warn(
        "[FlappyBirdGameScene] Tileset texture not found for ground, using default"
      );
    }

    // 타일 크기를 정사각형으로 유지하기 위한 기본 크기 설정
    const tileSize = 32; // 타일 크기를 32x32로 설정 (원래 16x16의 2배)

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

      // 점수 텍스트 추가 - 항상 최상위에 표시
      this.addChild(this.scoreText);

      // 게임 엔진에 물리 객체 추가
      this.gameEngine.addGameObject(this.bird, this.birdBody);
      this.gameEngine.addGameObject(this.ground, this.groundBody);

      // Container에는 anchor 속성이 없으므로 pivot 속성 사용
      const tileSize = 32; // 이미 정의된 타일 크기
      if (this.ground instanceof PIXI.Container) {
        this.ground.pivot.x = this.app.screen.width / 2;
        this.ground.pivot.y = tileSize / 2;
      } else if (this.ground instanceof PIXI.Sprite) {
        // Sprite인 경우에만 anchor 사용
        this.ground.anchor.set(0.5, 0.5);
      }

      // 바닥 위치 재조정
      this.ground.position.set(
        this.app.screen.width / 2,
        this.app.screen.height - tileSize / 2
      );

      // PipeGenerator 초기화
      this.pipeGenerator = new PipeGenerator(
        this.app,
        this.gameEngine,
        this.pipes,
        this.ground,
        this.birdBody,
        this.updateScore.bind(this)
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

    // PipeGenerator에 게임 오버 상태 전달
    this.pipeGenerator.setGameOver(true);

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

    // PipeGenerator 상태 초기화
    this.pipeGenerator.setGameOver(false);
    this.pipeGenerator.clearPipes();

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
      const tileSize = 32; // 정사각형 타일 크기

      // 바닥 텍스처를 타일 형태로 반복 - tilesetSprites가 있는 경우
      const assets = AssetLoader.getAssets();
      if (assets.tilesetSprites && assets.tilesetSprites.textures["ground-1"]) {
        // 바닥 스프라이트를 컨테이너로 교체하여 타일 패턴 생성
        this.removeChild(this.ground);
        const groundContainer = new PIXI.Container();
        groundContainer.width = width;
        groundContainer.height = tileSize;

        // 타일 패턴으로 바닥 채우기
        const tilesNeeded = Math.ceil(width / tileSize);

        for (let i = 0; i < tilesNeeded; i++) {
          // 번갈아가며 ground-1과 ground-2 타일 사용
          const tileTexture =
            i % 2 === 0
              ? assets.tilesetSprites.textures["ground-1"]
              : assets.tilesetSprites.textures["ground-2"];

          const tile = new PIXI.Sprite(tileTexture);
          tile.width = tileSize;
          tile.height = tileSize; // 높이도 tileSize로 설정하여 정사각형 유지
          tile.position.x = i * tileSize;
          groundContainer.addChild(tile);
        }

        // 앵커 및 위치 설정
        groundContainer.pivot.x = width / 2;
        groundContainer.pivot.y = tileSize / 2;
        groundContainer.position.set(width / 2, height - tileSize / 2);

        this.addChild(groundContainer);
        this.ground = groundContainer;
      } else {
        // 기존 방식 (타일셋이 없을 경우)
        this.ground.width = width;
        this.ground.height = tileSize;
        this.ground.position.set(width / 2, height - tileSize / 2);
      }

      // 바닥 물리 바디 위치와 크기 조정
      Matter.Body.setPosition(this.groundBody, {
        x: width / 2,
        y: height - tileSize / 2,
      });

      // 바닥 물리 바디 크기 변경
      Matter.Body.setVertices(
        this.groundBody,
        Matter.Vertices.fromPath(
          `0 0 ${width} 0 ${width} ${tileSize} 0 ${tileSize}`
        )
      );
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

      // PipeGenerator의 update 메서드 호출
      this.pipeGenerator.update(deltaTime);

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

    // 기존 파이프 쌍 배열 대신 PipeGenerator의 clearPipes 메서드 사용
    if (this.pipeGenerator) {
      this.pipeGenerator.clearPipes();
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
