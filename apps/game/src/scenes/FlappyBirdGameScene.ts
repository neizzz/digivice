import * as PIXI from "pixi.js";
import * as Matter from "matter-js";
import { Scene } from "../interfaces/Scene";
import { Background } from "../entities/Background";
import { AssetLoader } from "../utils/AssetLoader";
import { GameEngine } from "../GameEngine";
import { PipeGenerator } from "../entities/PipeGenerator";
import { CharacterKey } from "types/CharacterKey";

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
  // 바닥 타일 관련 속성 추가
  private groundTiles: PIXI.Sprite[] = [];
  private groundTileSize: number = 32;
  private lastGroundTileX: number = 0; // 마지막으로 생성된 타일의 X 위치
  private groundContainer: PIXI.Container; // 바닥 타일을 담을 컨테이너
  // 디버그 모드 설정
  private debugMode: boolean = true;
  private debugRenderer: Matter.Render;

  constructor(
    app: PIXI.Application,
    characterKey: CharacterKey,
    gameEngine?: GameEngine
  ) {
    super();
    this.app = app;
    // this.container = app.view.parentElement || document.body;
    this.gameEngine =
      gameEngine || new GameEngine(app.screen.width, app.screen.height);

    // 하늘색 배경 생성
    const skyBlueColor = 0x87ceeb;
    const backgroundGraphics = new PIXI.Graphics();
    backgroundGraphics.beginFill(skyBlueColor);
    backgroundGraphics.drawRect(0, 0, app.screen.width, app.screen.height);
    backgroundGraphics.endFill();
    this.background = backgroundGraphics;

    // 새 캐릭터 생성
    const assets = AssetLoader.getAssets();
    const characterSpritesheet = assets.characterSprites[characterKey];
    if (!characterSpritesheet) {
      throw new Error(
        `Character spritesheet not found for key: ${characterKey}`
      );
    }

    const birdTexture = characterSpritesheet.textures["bird"];
    const inBasketTexture = characterSpritesheet.textures["in-basket"];

    const birdSprite = new PIXI.Sprite(birdTexture);
    const inBasketSprite = new PIXI.Sprite(inBasketTexture);

    // in-basket 스프라이트 위에 bird 스프라이트를 조합
    inBasketSprite.addChild(birdSprite);
    birdSprite.anchor.set(0.5);
    birdSprite.position.set(
      inBasketSprite.width / 2,
      inBasketSprite.height / 2
    );

    this.bird = inBasketSprite;
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

    // 바닥 컨테이너 생성
    this.groundContainer = new PIXI.Container();
    this.ground = this.groundContainer as any;

    // AssetLoader에서 타일셋 가져오기
    const tilesetSprites = assets.tilesetSprites;

    // 타일 크기를 텍스처 프레임 기반으로 결정
    if (tilesetSprites && tilesetSprites.textures["ground-1"]) {
      this.groundTileSize = tilesetSprites.textures["ground-1"].frame.width;
      console.log(
        "[FlappyBirdGameScene] Using tileset texture for ground, size:",
        this.groundTileSize
      );
    } else {
      this.groundTileSize = 32; // 기본값
      console.warn(
        "[FlappyBirdGameScene] Tileset texture not found for ground, using default size:",
        this.groundTileSize
      );
    }

    // 지면 물리 바디 생성
    this.groundBody = Matter.Bodies.rectangle(
      this.app.screen.width / 2,
      this.app.screen.height - this.groundTileSize / 2,
      this.app.screen.width,
      this.groundTileSize,
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
      this.addChild(this.groundContainer); // groundContainer를 직접 추가
      this.addChild(this.bird);
      this.addChild(this.scoreText);

      // 게임 엔진에 물리 객체 추가
      this.gameEngine.addGameObject(this.bird, this.birdBody);
      this.gameEngine.addGameObject(this.groundContainer, this.groundBody); // groundContainer 사용

      // 바닥 위치 재조정 및 타일 초기화
      this.setupGround();
      console.log(
        "[FlappyBirdGameScene] Ground setup complete, tiles:",
        this.groundTiles.length
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
   * 바닥 타일을 설정하는 메서드
   */
  private setupGround(): void {
    // 기존 타일 제거
    this.groundContainer.removeChildren();
    this.groundTiles = [];
    this.lastGroundTileX = 0;

    const assets = AssetLoader.getAssets();
    const tilesetSprites = assets.tilesetSprites;

    if (tilesetSprites && tilesetSprites.textures["ground-1"]) {
      // 초기 화면을 채울 타일 생성
      const tilesNeeded =
        Math.ceil(this.app.screen.width / this.groundTileSize) + 2;

      for (let i = 0; i < tilesNeeded; i++) {
        this.createGroundTile();
      }

      // 바닥 위치 설정 (중요: 정확한 위치로 설정)
      this.groundContainer.pivot.x = this.app.screen.width / 2;
      this.groundContainer.pivot.y = this.groundTileSize / 2;
      this.groundContainer.position.y =
        this.app.screen.height - this.groundTileSize;
    } else {
      console.warn("[FlappyBirdGameScene] Failed to find ground textures");
    }

    // 바닥 물리 바디 위치 조정
    Matter.Body.setPosition(this.groundBody, {
      x: this.app.screen.width / 2,
      y: this.app.screen.height - this.groundTileSize / 2,
    });
  }

  /**
   * 새 바닥 타일을 생성하는 메서드
   */
  private createGroundTile(): void {
    const assets = AssetLoader.getAssets();
    const tilesetSprites = assets.tilesetSprites;

    if (tilesetSprites && tilesetSprites.textures["ground-1"]) {
      const tileIndex = this.groundTiles.length % 2;
      const tileTexture =
        tileIndex === 0
          ? tilesetSprites.textures["ground-1"]
          : tilesetSprites.textures["ground-2"];

      const tile = new PIXI.Sprite(tileTexture);
      tile.width = this.groundTileSize;
      tile.height = this.groundTileSize;
      tile.position.x = this.lastGroundTileX;

      // 타일 추가
      this.groundContainer.addChild(tile);
      this.groundTiles.push(tile);

      // 다음 타일 위치 업데이트
      this.lastGroundTileX += this.groundTileSize;
    }
  }

  /**
   * 바닥 타일을 이동시키는 메서드
   */
  private moveGround(): void {
    if (!this.groundTiles.length) {
      console.warn("[FlappyBirdGameScene] No ground tiles to move!");
      return;
    }

    // 모든 타일 이동
    for (let i = 0; i < this.groundTiles.length; i++) {
      const tile = this.groundTiles[i];
      tile.position.x -= this.pipeSpeed; // 파이프와 같은 속도로 이동

      // 타일이 화면 왼쪽으로 완전히 벗어났는지 확인
      if (tile.position.x + this.groundTileSize < 0) {
        // 타일 제거
        this.groundContainer.removeChild(tile);
        this.groundTiles.splice(i, 1);
        i--;
      }
    }

    // 화면 오른쪽 끝에 새 타일이 필요한지 확인
    const lastTile = this.groundTiles[this.groundTiles.length - 1];
    const rightEdge = this.app.screen.width;

    // 마지막 타일의 오른쪽 가장자리가 화면 오른쪽 끝보다 작으면 새 타일 추가
    if (lastTile && lastTile.position.x + this.groundTileSize < rightEdge) {
      this.lastGroundTileX = lastTile.position.x + this.groundTileSize;
      this.createGroundTile();
    }
  }

  /**
   * Matter.js 디버그 렌더러 설정
   */
  private setupDebugRenderer(): void {
    this.cleanupDebugRenderer();

    const brightGreen = "#26ff00";

    this.debugRenderer = Matter.Render.create({
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

    // 바닥 타일도 재설정 (추가)
    this.setupGround();

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

    // 배경 리사이징
    if (this.background instanceof PIXI.Graphics) {
      this.background.clear();
      this.background.beginFill(0x87ceeb);
      this.background.drawRect(0, 0, width, height);
      this.background.endFill();
    }

    // UI 요소 위치 업데이트
    if (this.scoreText) {
      this.scoreText.position.set(width / 2, 20);
    }

    // 게임오버 관련 UI 위치 업데이트
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

      // 바닥 이동 로직을 확실하게 호출
      if (this.groundTiles.length > 0) {
        this.moveGround();
      } else {
        console.warn("[FlappyBirdGameScene] No ground tiles in update!");
        // 만약 타일이 없다면 다시 설정
        this.setupGround();
      }

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
