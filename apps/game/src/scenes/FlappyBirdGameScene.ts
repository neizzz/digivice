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
  private bird: PIXI.AnimatedSprite; // bird 타입을 AnimatedSprite로 변경
  private basket: PIXI.Sprite;
  private basketBody: Matter.Body;
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
    const inBasketTexture = characterSpritesheet.textures["in-basket"];

    const inBasketSprite = new PIXI.Sprite(inBasketTexture);

    // bird 애니메이션 스프라이트 생성
    const birdSpritesheet = assets.birdSprites;
    if (birdSpritesheet) {
      // 'fly' 애니메이션 프레임 가져오기
      // const flyFrames = birdSpritesheet.animations["fly"];
      const textures = birdSpritesheet.animations["fly"];
      if (textures && textures.length > 0) {
        // 애니메이션 프레임으로 AnimatedSprite 생성
        this.bird = new PIXI.AnimatedSprite(textures);

        // 애니메이션 설정
        this.bird.animationSpeed = 0.1; // 애니메이션 속도 조절
        this.bird.play(); // 애니메이션 시작

        // 크기 및 앵커 설정
        this.bird.width = 30;
        this.bird.height = 30;
        this.bird.anchor.set(0.5);
      } else {
        console.warn(
          "[FlappyBirdGameScene] Bird 'fly' animation frames not found"
        );
      }
    } else {
      console.warn("[FlappyBirdGameScene] Bird spritesheet not found");
    }

    this.basket = inBasketSprite;
    this.basket.width = 40;
    this.basket.height = 40;
    this.basket.anchor.set(0.5);

    // 새를 위한 물리 바디 생성
    this.basketBody = Matter.Bodies.circle(
      this.app.screen.width / 3,
      this.app.screen.height / 2,
      this.basket.width / 2,
      {
        label: "basket",
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
      this.addChild(this.basket);
      this.addChild(this.bird);
      this.addChild(this.scoreText);

      // 게임 엔진에 물리 객체 추가
      this.gameEngine.addGameObject(this.basket, this.basketBody);
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
      Matter.Body.setPosition(this.basketBody, {
        x: this.app.screen.width / 4,
        y: this.app.screen.height / 2,
      });
      Matter.Body.setVelocity(this.basketBody, { x: 0, y: 0 });

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
          (pair.bodyA.label === "basket" &&
            (pair.bodyB.label === "ground" || pair.bodyB.label === "pipe")) ||
          (pair.bodyB.label === "basket" &&
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
    Matter.Body.setVelocity(this.basketBody, { x: 0, y: 0 });
  }

  /**
   * 새 캐릭터 점프
   */
  private jump(): void {
    Matter.Body.setVelocity(this.basketBody, { x: 0, y: -8 });
  }

  // 점수 업데이트 함수
  private updateScore(): void {
    this.score++;
    this.scoreText.text = `Score: ${this.score}`;
  }

  private checkCollisions(): void {
    if (this.gameOver) return;

    if (this.basketBody.position.y - this.basket.height / 2 <= 0) {
      Matter.Body.setPosition(this.basketBody, {
        x: this.basketBody.position.x,
        y: this.basket.height / 2,
      });
      Matter.Body.setVelocity(this.basketBody, { x: 0, y: 0 });
    }
  }

  private handleGameOver(): void {
    this.gameOver = true;

    // 애니메이션 정지
    if (this.bird) {
      this.bird.stop();
    }

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

    // 기존 바스켓 물리 바디 제거
    Matter.Composite.remove(this.gameEngine["physics"].world, this.basketBody);

    // 새 바스켓 물리 바디 생성 - 회전 문제를 완전히 해결하기 위함
    this.basketBody = Matter.Bodies.circle(
      this.app.screen.width / 3,
      this.app.screen.height / 2,
      this.basket.width / 2,
      {
        label: "basket",
        isStatic: false,
        angle: 0,
        angularVelocity: 0,
        inertia: Infinity, // 회전 관성을 무한대로 설정하여 회전을 방지
        frictionAir: 0.01, // 적당한 공기 마찰력 설정
      }
    );

    // 새로 생성한 물리 바디를 게임 엔진에 추가
    this.gameEngine.addGameObject(this.basket, this.basketBody);

    const gameOverText = this.getChildByName("gameOverText");
    if (gameOverText) {
      this.removeChild(gameOverText);
    }

    const restartText = this.getChildByName("restartText");
    if (restartText) {
      this.removeChild(restartText);
    }

    // 바닥 타일도 재설정
    this.setupGround();

    // 애니메이션 다시 시작
    if (this.bird) {
      this.bird.play();
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
    if (this.debugMode && this.debugRenderer) {
      this.debugRenderer.options.width = width;
      this.debugRenderer.options.height = height;
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
      if (
        pair.topBody.position.x < this.basketBody.position.x &&
        !pair.passed
      ) {
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
      this.basket.position.x = this.basketBody.position.x;
      this.basket.position.y = this.basketBody.position.y;

      // bird 위치 업데이트 - bird보다 살짝 위에 위치
      if (this.bird) {
        this.bird.position.x = this.basketBody.position.x;
        this.bird.position.y = this.basketBody.position.y - 30; // 20픽셀 위에 배치
      }

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

    if (this.basketBody) {
      Matter.Composite.remove(
        this.gameEngine["physics"].world,
        this.basketBody
      );
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
