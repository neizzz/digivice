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

  // 씬 변경을 위한 콜백 함수 추가
  constructor(app: PIXI.Application, gameEngine?: GameEngine) {
    super();
    this.app = app;

    // 컨테이너 요소 가져오기 (app.view의 부모)
    this.container = app.view.parentElement || document.body;

    // GameEngine 초기화 - 외부에서 주입받거나 없으면 새로 생성
    this.gameEngine =
      gameEngine || new GameEngine(app.screen.width, app.screen.height);

    // 디버그 헬퍼 초기화
    DebugHelper.init(app);
    DebugHelper.setEnabled(true);

    // 하늘색 배경 생성
    const skyBlueColor = 0x87ceeb; // 하늘색 RGB 값
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

    // 새를 위한 물리 바디 생성 - 단순화된 설정
    this.birdBody = Matter.Bodies.circle(
      this.app.screen.width / 3,
      this.app.screen.height / 2,
      this.bird.width / 2,
      {
        label: "bird",
        isStatic: false, // 중요: 정적이 아니어야 중력 영향 받음
      }
    );

    // 중력 확인을 위한 초기 설정
    console.log("Bird created with isStatic:", this.birdBody.isStatic);

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

    // 초기 상태 로깅
    console.log("Bird initial state:", {
      position: { x: this.app.screen.width / 3, y: this.app.screen.height / 2 },
      static: false,
      density: 0.005,
    });

    this.setupScene();
  }

  /**
   * 씬을 동기적으로 설정합니다.
   */
  private setupScene(): void {
    try {
      // GameEngine이 초기화되지 않았을 때만 초기화 (외부에서 이미 초기화된 경우는 스킵)
      if (!this.gameEngine["physics"] || !this.gameEngine["runner"]) {
        this.gameEngine.initialize(this.app); // container 인자 제거
      }

      // 배경 추가
      this.addChild(this.background);

      // 파이프 컨테이너 추가
      this.addChild(this.pipes);

      // 바닥 추가
      this.addChild(this.ground);

      // 새 캐릭터 추가
      this.addChild(this.bird);

      // 게임 엔진에 물리 객체 추가 전 로그
      console.log("Bird body before adding:", {
        isStatic: this.birdBody.isStatic,
        position: this.birdBody.position,
      });

      // 게임 엔진에 물리 객체 추가 (순서 변경)
      this.gameEngine.addGameObject(this.bird, this.birdBody);
      this.gameEngine.addGameObject(this.ground, this.groundBody);

      // 강제로 새의 정적 상태 해제 (중복 확인)
      if (this.birdBody.isStatic) {
        Matter.Body.setStatic(this.birdBody, false);
      }

      // 위치 동기화 확인
      this.bird.position.set(
        this.birdBody.position.x,
        this.birdBody.position.y
      );

      // 초기 위치 설정
      Matter.Body.setPosition(this.birdBody, {
        x: this.app.screen.width / 4,
        y: this.app.screen.height / 2,
      });
      Matter.Body.setVelocity(this.birdBody, { x: 0, y: 0 });

      // 물리 바디 속성 검증
      console.log("Bird physics properties:", {
        isStatic: this.birdBody.isStatic,
        isSleeping: this.birdBody.isSleeping,
        collisionFilter: this.birdBody.collisionFilter,
        position: this.birdBody.position,
      });

      // 충돌 이벤트 리스너 설정
      this.setupCollisionListeners();

      // 디버그 모드 초기화 - 강제로 디버그 모드 활성화
      this.debugMode = true;

      // 조건문 없이 무조건 디버그 렌더러 활성화
      this.setupDebugRenderer();

      // 초기 설정 완료
      this.initialized = true;

      // 화면 크기에 맞게 조정
      this.onResize(this.app.screen.width, this.app.screen.height);

      console.log("FlappyBirdGameScene setup completed");

      // 시작 프롬프트 제거하고 바로 게임 시작
      this.startGame(); // 바로 게임 시작

      // 키보드 이벤트 리스너 추가
      this.setupKeyboardListeners();

      // 새의 초기 위치 설정 (명시적으로 지정)
      Matter.Body.setPosition(this.birdBody, {
        x: this.app.screen.width / 4,
        y: this.app.screen.height / 2,
      });

      // 초기 중력 테스트
      Matter.Body.setVelocity(this.birdBody, { x: 0, y: 0 });

      // 상태 로그 출력
      console.log("Initial bird physics state:", {
        position: this.birdBody.position,
        velocity: this.birdBody.velocity,
        density: this.birdBody.density,
        mass: this.birdBody.mass,
      });

      // GameEngine 물리 정보 로깅
      console.log(
        "Physics engine gravity:",
        this.gameEngine.getPhysicsEngine().gravity
      );
    } catch (error) {
      console.error("Error setting up FlappyBirdGameScene:", error);
    }
  }

  /**
   * Matter.js 디버그 렌더러 설정 - 가시성 개선
   */
  private setupDebugRenderer(): void {
    // 이미 있는 디버그 렌더러 정리
    this.cleanupDebugRenderer();

    // 새 디버그 캔버스 생성
    this.debugCanvas = document.createElement("canvas");
    this.debugCanvas.width = this.app.screen.width;
    this.debugCanvas.height = this.app.screen.height;
    this.debugCanvas.style.position = "absolute";
    this.debugCanvas.style.top = "0";
    this.debugCanvas.style.left = "0";
    this.debugCanvas.style.pointerEvents = "none";
    this.debugCanvas.style.opacity = "0.7"; // 투명도 증가 (더 잘 보이게)
    this.debugCanvas.id = "debug-canvas"; // 식별을 위한 ID 추가
    this.debugCanvas.style.zIndex = "1000"; // z-index 설정으로 항상 앞에 표시
    this.container.appendChild(this.debugCanvas);

    // Matter.js 디버그 렌더러 설정 - 시각화 옵션 강화
    this.debugRenderer = Matter.Render.create({
      canvas: this.debugCanvas,
      engine: this.gameEngine.getPhysicsEngine(), // 직접 엔진 인스턴스 가져오기
      options: {
        width: this.app.screen.width,
        height: this.app.screen.height,
        wireframes: true,
        showBounds: true,
        showCollisions: true,
        showVelocity: true,
        showAngleIndicator: true, // 회전 표시 추가
        wireframeBackground: "transparent",
        showPositions: true,
        lineThickness: 2, // 선 두께 증가
        background: "transparent",
        // showDebug: true,
        showSleeping: true,
        showIds: false,
        showShadows: false,
        showVertexNumbers: false,
        showConvexHulls: true,
      },
    });

    // 디버그 렌더러 시작
    Matter.Render.run(this.debugRenderer);

    console.log("Debug renderer initialized with enhanced visibility");
  }

  /**
   * 디버그 렌더러 정리 - 분리된 함수로 추출
   */
  private cleanupDebugRenderer(): void {
    // 디버그 렌더러 정리
    if (this.debugRenderer) {
      Matter.Render.stop(this.debugRenderer);
      this.debugRenderer = null;
    }

    // 디버그 캔버스 제거
    if (this.debugCanvas && this.debugCanvas.parentElement) {
      this.debugCanvas.parentElement.removeChild(this.debugCanvas);
      this.debugCanvas = null;
    }

    // 혹시라도 남아있는 디버그 캔버스 확인 및 제거 (id로 찾기)
    const existingCanvas = document.getElementById("debug-canvas");
    if (existingCanvas) {
      existingCanvas.parentElement.removeChild(existingCanvas);
    }
  }

  /**
   * 충돌 감지 리스너 설정
   */
  private setupCollisionListeners(): void {
    // Matter.js 충돌 이벤트 리스너 설정
    Matter.Events.on(this.gameEngine["physics"], "collisionStart", (event) => {
      const pairs = event.pairs;

      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];

        // 새와 바닥 또는 파이프의 충돌 확인
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

  /**
   * 키보드 이벤트 리스너 설정
   */
  private setupKeyboardListeners(): void {
    window.addEventListener("keydown", this.handleKeyDown.bind(this));
  }

  /**
   * 키보드 입력 처리
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === "Space" || event.key === " ") {
      // 게임 오버 상태가 아니면 점프
      if (!this.gameOver) {
        this.jump();
      }
      // 게임 오버 상태면 재시작
      else {
        this.restartGame();
      }
    }

    // D 키로 디버그 모드 토글 (개발 중에 유용)
    if (event.code === "KeyD") {
      this.toggleDebugMode();
    }
  }

  /**
   * ControlButton 클릭 처리
   */
  public handleControlButtonClick(buttonType: ControlButtonType): void {
    // 게임 오버 상태라면 재시작
    if (this.gameOver) {
      this.restartGame();
    }
    // 게임 진행 중이라면 점프
    else {
      this.jump();
    }
  }

  /**
   * 게임 시작
   */
  private startGame(): void {
    this.gameStarted = true;

    // 시작 시 새의 물리 상태 체크
    console.log("Starting game with bird:", {
      isStatic: this.birdBody.isStatic,
      position: this.birdBody.position,
    });

    // 중력에 직접 영향을 받도록 속도 명확히 리셋
    Matter.Body.setVelocity(this.birdBody, { x: 0, y: 0 });

    // 물리 엔진 상태 확인
    const engine = this.gameEngine.getPhysicsEngine();
    console.log("Starting game. Engine status:", {
      gravity: engine.gravity,
      birdStatic: this.birdBody.isStatic,
      birdSleeping: this.birdBody.isSleeping,
    });
  }

  /**
   * 새 캐릭터 점프
   */
  private jump(): void {
    // 점프 강도를 높여 중력 대비 충분한 높이 확보
    Matter.Body.setVelocity(this.birdBody, { x: 0, y: -12 });
  }

  /**
   * 새로운 파이프 쌍 생성
   */
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

    // 상단 파이프 생성
    const topPipe = new PIXI.Sprite(PIXI.Texture.WHITE);
    topPipe.width = pipeWidth;
    topPipe.height = topPipeHeight;
    topPipe.tint = 0x00aa00; // 녹색
    topPipe.anchor.set(0.5, 0); // 중앙 상단 기준점 설정
    topPipe.position.set(this.app.screen.width + pipeWidth / 2, 0);

    // 상단 파이프 물리 바디 생성 (위치를 anchor에 맞게 조정)
    const topPipeBody = Matter.Bodies.rectangle(
      this.app.screen.width + pipeWidth / 2,
      topPipeHeight / 2,
      pipeWidth,
      topPipeHeight,
      { isStatic: true, label: "pipe" }
    );

    // 하단 파이프 생성
    const bottomPipe = new PIXI.Sprite(PIXI.Texture.WHITE);
    bottomPipe.width = pipeWidth;
    bottomPipe.height =
      this.app.screen.height - topPipeHeight - gapHeight - this.ground.height;
    bottomPipe.tint = 0x00aa00; // 녹색
    bottomPipe.anchor.set(0.5, 0); // 중앙 상단 기준점 설정
    bottomPipe.position.set(
      this.app.screen.width + pipeWidth / 2,
      topPipeHeight + gapHeight
    );

    // 하단 파이프 물리 바디 생성
    const bottomPipeBody = Matter.Bodies.rectangle(
      this.app.screen.width + pipeWidth / 2,
      topPipeHeight + gapHeight + bottomPipe.height / 2,
      pipeWidth,
      bottomPipe.height,
      { isStatic: true, label: "pipe" }
    );

    // 파이프 컨테이너에 추가
    this.pipes.addChild(topPipe);
    this.pipes.addChild(bottomPipe);

    // 게임 엔진에 파이프 물리 바디 추가
    this.gameEngine.addGameObject(topPipe, topPipeBody);
    this.gameEngine.addGameObject(bottomPipe, bottomPipeBody);

    // 파이프 쌍 추적 (userData 초기화 포함)
    topPipe.userData = { passed: false };
    this.pipesPairs.push({
      top: topPipe,
      bottom: bottomPipe,
      topBody: topPipeBody,
      bottomBody: bottomPipeBody,
    });

    console.log("Created pipe pair at", topPipe.position.x);
  }

  /**
   * 파이프 이동
   */
  private movePipes(): void {
    // 파이프 쌍 이동 처리
    for (let i = 0; i < this.pipesPairs.length; i++) {
      const pair = this.pipesPairs[i];

      // Matter.js를 사용하여 파이프 이동
      Matter.Body.translate(pair.topBody, { x: -this.pipeSpeed, y: 0 });
      Matter.Body.translate(pair.bottomBody, { x: -this.pipeSpeed, y: 0 });

      // 스프라이트 위치 업데이트 (anchor를 고려한 위치 계산)
      pair.top.position.x = pair.topBody.position.x;
      pair.bottom.position.x = pair.bottomBody.position.x;

      // 점수 증가 처리 (새와 파이프가 교차할 때)
      if (
        pair.topBody.position.x < this.birdBody.position.x &&
        !pair.top.userData?.passed
      ) {
        pair.top.userData = { passed: true };
        this.score++;
        this.scoreText.text = `Score: ${this.score}`;
      }

      // 화면 밖으로 나간 파이프 제거
      if (pair.topBody.position.x < -pair.top.width) {
        console.log("Removing pipe at", pair.topBody.position.x);

        this.pipes.removeChild(pair.top);
        this.pipes.removeChild(pair.bottom);

        // Matter.js 물리 엔진에서 파이프 바디 제거
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

  /**
   * 충돌 감지 - Matter.js로 대체되어 간소화
   */
  private checkCollisions(): void {
    if (this.gameOver) return;

    // 천장 충돌 체크
    if (this.birdBody.position.y - this.bird.height / 2 <= 0) {
      Matter.Body.setPosition(this.birdBody, {
        x: this.birdBody.position.x,
        y: this.bird.height / 2,
      });
      Matter.Body.setVelocity(this.birdBody, { x: 0, y: 0 });
    }
  }

  /**
   * 게임 오버 처리
   */
  private handleGameOver(): void {
    this.gameOver = true;

    // 게임 오버 텍스트 표시
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

    // 재시작 안내 표시
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

  /**
   * 게임 재시작
   */
  private restartGame(): void {
    // 게임 상태 초기화
    this.gameOver = false;
    this.score = 0;
    this.scoreText.text = "Score: 0";

    // 새 위치 초기화
    Matter.Body.setPosition(this.birdBody, {
      x: this.app.screen.width / 3,
      y: this.app.screen.height / 2,
    });
    Matter.Body.setVelocity(this.birdBody, { x: 0, y: 0 });

    // 새의 회전 초기화
    Matter.Body.setAngle(this.birdBody, 0);

    // 파이프 제거
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

    // 게임 오버 텍스트 제거
    const gameOverText = this.getChildByName("gameOverText");
    if (gameOverText) {
      this.removeChild(gameOverText);
    }
    const restartText = this.getChildByName("restartText");
    if (restartText) {
      this.removeChild(restartText);
    }

    // 타이머 초기화
    this.lastPipeSpawnTime = 0;

    console.log("Game restarted");
  }

  /**
   * 디버그 모드 토글
   */
  private toggleDebugMode(): void {
    this.debugMode = !this.debugMode;

    if (this.debugMode) {
      this.setupDebugRenderer();
    } else {
      this.cleanupDebugRenderer();
    }

    console.log(`Debug mode: ${this.debugMode ? "ON" : "OFF"}`);
  }

  public setSceneChangeCallback(callback: (key: SceneKey) => void): void {}

  public onResize(width: number, height: number): void {
    // 초기화 전에는 리사이징 무시
    if (!this.initialized) return;

    // 화면 크기 변경 시 배경 크기 조정
    if (this.background instanceof PIXI.Graphics) {
      this.background.clear();
      this.background.beginFill(0x87ceeb); // 하늘색 유지
      this.background.drawRect(0, 0, width, height);
      this.background.endFill();
    }

    // 바닥 위치 및 물리 바디 조정
    if (this.ground && this.groundBody) {
      this.ground.width = width;
      this.ground.y = height - this.ground.height;

      // 물리 바디 위치 업데이트
      Matter.Body.setPosition(this.groundBody, {
        x: width / 2,
        y: height - this.ground.height / 2,
      });
    }

    // 점수 텍스트 위치 조정
    if (this.scoreText) {
      this.scoreText.position.set(width / 2, 20);
    }

    // 게임오버 텍스트 위치 조정
    const gameOverText = this.getChildByName("gameOverText");
    if (gameOverText) {
      gameOverText.position.set(width / 2, height / 3);
    }

    // 재시작 텍스트 위치 조정
    const restartText = this.getChildByName("restartText");
    if (restartText) {
      restartText.position.set(width / 2, height / 2);
    }

    // GameEngine에 resize 이벤트 전달
    if (this.gameEngine) {
      this.gameEngine.resize(width, height);
    }

    // 디버그 렌더러 크기 조정 (있는 경우에만)
    if (this.debugMode && this.debugRenderer && this.debugCanvas) {
      this.debugRenderer.options.width = width;
      this.debugRenderer.options.height = height;
      this.debugCanvas.width = width;
      this.debugCanvas.height = height;
    }
  }

  public update(deltaTime: number): void {
    // 초기화 전이거나 게임이 시작되지 않았으면 업데이트 무시
    if (!this.initialized) return;

    // 현재 시간 계산
    const currentTime = Date.now();

    // 게임 상태에 상관없이 새의 위치는 항상 업데이트
    // if (this.bird && this.birdBody) {
    //   this.bird.position.x = this.birdBody.position.x;
    //   this.bird.position.y = this.birdBody.position.y;
    // }

    // 게임이 시작된 상태에서만 게임 로직 업데이트
    if (this.gameStarted && !this.gameOver) {
      // 새 스프라이트 위치 업데이트 (물리 엔진의 위치로)
      this.bird.position.x = this.birdBody.position.x;
      this.bird.position.y = this.birdBody.position.y;

      // 파이프 생성 (일정 시간마다)
      if (currentTime - this.lastPipeSpawnTime > this.pipeSpawnInterval) {
        this.createPipePair();
        this.lastPipeSpawnTime = currentTime;
      }

      // 파이프 이동 및 점수 계산
      this.movePipes();

      // 천장 충돌 검사
      this.checkCollisions();
    }
    // 게임 오버 상태에서도 새의 위치는 물리 엔진에 따라 업데이트
    else if (this.gameOver) {
      this.bird.position.x = this.birdBody.position.x;
      this.bird.position.y = this.birdBody.position.y;
    }
  }

  // 씬 정리를 위한 메서드 추가
  public destroy(): void {
    // 키보드 이벤트 리스너 제거
    window.removeEventListener("keydown", this.handleKeyDown.bind(this));

    // 디버그 렌더러 정리
    this.cleanupDebugRenderer();

    // GameEngine은 외부에서 관리하도록 하고, 여기서는 정리 작업만 수행
    // this.gameEngine.cleanup();  <-- 이 부분 주석 처리

    // 파이프 제거
    for (const pair of this.pipesPairs) {
      if (pair.topBody && pair.bottomBody) {
        Matter.Composite.remove(this.gameEngine["physics"].world, pair.topBody);
        Matter.Composite.remove(
          this.gameEngine["physics"].world,
          pair.bottomBody
        );
      }
    }

    // 새 캐릭터와 바닥 물리 객체 제거
    if (this.birdBody) {
      Matter.Composite.remove(this.gameEngine["physics"].world, this.birdBody);
    }
    if (this.groundBody) {
      Matter.Composite.remove(
        this.gameEngine["physics"].world,
        this.groundBody
      );
    }

    // 다른 리소스 정리 로직...
    super.destroy();
  }
}
