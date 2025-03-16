import * as PIXI from "pixi.js";
import * as Matter from "matter-js";
import { GameEngine } from "../GameEngine";
import { AssetLoader } from "../utils/AssetLoader";

export interface PipePair {
  top: PIXI.Sprite | PIXI.Container;
  bottom: PIXI.Sprite | PIXI.Container;
  topBody: Matter.Body;
  bottomBody: Matter.Body;
}

export class PipeGenerator {
  private app: PIXI.Application;
  private gameEngine: GameEngine;
  private pipes: PIXI.Container;
  private pipesPairs: PipePair[] = [];
  private pipeSpeed: number = 2;
  private pipeSpawnInterval: number = 2000; // 2초마다 파이프 생성
  private lastPipeSpawnTime: number = 0;
  private ground: PIXI.DisplayObject;
  private birdBody: Matter.Body;
  private onScoreCallback: () => void;
  private gameOver: boolean = false;

  // 텍스처 캐싱
  private pipeBodyTexture: PIXI.Texture;
  private pipeEndTexture: PIXI.Texture;

  constructor(
    app: PIXI.Application,
    gameEngine: GameEngine,
    pipes: PIXI.Container,
    ground: PIXI.DisplayObject,
    birdBody: Matter.Body,
    onScoreCallback: () => void
  ) {
    this.app = app;
    this.gameEngine = gameEngine;
    this.pipes = pipes;
    this.ground = ground;
    this.birdBody = birdBody;
    this.onScoreCallback = onScoreCallback;

    // 텍스처 초기화
    this.initTextures();
  }

  /**
   * 필요한 텍스처를 초기화하고 캐시합니다.
   */
  private initTextures(): void {
    // 기본 텍스처 설정
    this.pipeBodyTexture = PIXI.Texture.WHITE;
    this.pipeEndTexture = PIXI.Texture.WHITE;
    this.pipeEndTopTexture = PIXI.Texture.WHITE;

    // AssetLoader에서 텍스처 가져오기
    const assets = AssetLoader.getAssets();
    if (assets.tilesetSprites) {
      if (assets.tilesetSprites.textures["pipe-body"]) {
        this.pipeBodyTexture = assets.tilesetSprites.textures["pipe-body"];
      }
      if (assets.tilesetSprites.textures["pipe-end"]) {
        this.pipeEndTexture = assets.tilesetSprites.textures["pipe-end"];
        // 렌더 텍스처 방식은 제거 - 직접 스프라이트 뒤집기로 변경
      }
    }
  }

  /**
   * 파이프 쌍을 생성합니다.
   */
  public createPipePair(): void {
    if (this.gameOver) return;

    // 기본 변수 설정
    const tileSize = 32; // 기본 타일 크기
    const pipeWidth = tileSize * 1.5; // 파이프 너비
    const minPipeSegments = 3; // 최소 파이프 세그먼트 수
    const gapHeight = pipeWidth * 3; // 파이프 사이 간격을 너비의 3배로 설정

    // 사용 가능한 공간 계산 (세그먼트 단위)
    const screenHeightInSegments = Math.floor(
      (this.app.screen.height - this.ground.height) / pipeWidth
    );
    const minGapSegments = Math.ceil(gapHeight / pipeWidth);
    const availableSegments =
      screenHeightInSegments - minGapSegments - minPipeSegments * 2;

    // 상단 파이프 높이 계산 (세그먼트 단위로)
    const topSegments =
      minPipeSegments + Math.floor(Math.random() * availableSegments);
    const topPipeHeight = topSegments * pipeWidth; // 정확히 너비의 배수로 설정

    // 하단 파이프 높이 계산 (남은 공간 모두 사용)
    const bottomSegments =
      screenHeightInSegments - topSegments - minGapSegments;
    const bottomPipeHeight = bottomSegments * pipeWidth;

    // 파이프 쌍 생성
    const { pipe: topPipe, body: topPipeBody } = this.createTopPipe(
      topPipeHeight,
      pipeWidth
    );

    const { pipe: bottomPipe, body: bottomPipeBody } = this.createBottomPipe(
      bottomPipeHeight,
      pipeWidth,
      pipeWidth, // tileSize 대신 pipeWidth 사용
      topPipeHeight,
      gapHeight
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

  /**
   * 상단 파이프를 생성합니다.
   */
  private createTopPipe(
    height: number,
    width: number
  ): { pipe: PIXI.Container; body: Matter.Body } {
    // 상단 파이프 생성
    const pipe = new PIXI.Container();
    pipe.width = width;
    pipe.height = height;

    // 세그먼트 수 계산 (마지막 1개는 파이프 끝부분용)
    const segmentsCount = Math.floor(height / width) - 1;

    // 파이프 본체 세그먼트 생성 - 각 세그먼트를 정사각형으로 유지
    for (let i = 0; i < segmentsCount; i++) {
      const segment = new PIXI.Sprite(this.pipeBodyTexture);
      segment.width = width;
      segment.height = width; // width를 높이로 사용하여 정사각형 유지
      segment.position.x = 0;
      segment.position.y = i * width;
      pipe.addChild(segment);
    }

    // 상단 파이프 끝부분 추가 - 스케일링 대신 회전 사용
    const pipeEnd = new PIXI.Sprite(this.pipeEndTexture);
    pipeEnd.width = width;
    pipeEnd.height = width;

    // 원본 크기와 비율 유지
    pipeEnd.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;

    // 앵커 포인트를 중앙으로 설정하고 180도 회전
    pipeEnd.anchor.set(0.5, 0.5);
    pipeEnd.rotation = Math.PI;

    // 위치 조정 - 파이프 하단에 정확히 위치시키기
    pipeEnd.position.x = width / 2;
    pipeEnd.position.y = segmentsCount * width + width / 2;

    pipe.addChild(pipeEnd);

    // 앵커 설정
    pipe.pivot.x = width / 2;
    pipe.pivot.y = height / 2;

    // 위치 설정
    pipe.position.set(this.app.screen.width + width / 2, height / 2);

    // 물리 바디 생성
    const body = Matter.Bodies.rectangle(
      this.app.screen.width + width / 2,
      height / 2,
      width,
      height,
      { isStatic: true, label: "pipe" }
    );

    return { pipe, body };
  }

  /**
   * 하단 파이프를 생성합니다.
   */
  private createBottomPipe(
    height: number,
    width: number,
    segmentSize: number,
    topPipeHeight: number,
    gapHeight: number
  ): { pipe: PIXI.Container; body: Matter.Body } {
    // 하단 파이프 생성
    const pipe = new PIXI.Container();
    pipe.width = width;
    pipe.height = height;

    // 파이프 끝부분 추가
    const pipeEnd = new PIXI.Sprite(this.pipeEndTexture);
    pipeEnd.width = width;
    pipeEnd.height = segmentSize; // 너비와 동일하게 설정
    pipeEnd.position.x = 0;
    pipeEnd.position.y = 0;
    pipe.addChild(pipeEnd);

    // 파이프 본체 세그먼트 생성 - 각 세그먼트를 정사각형으로 유지
    const segmentsNeeded = Math.ceil((height - segmentSize) / segmentSize);

    for (let i = 0; i < segmentsNeeded; i++) {
      const segment = new PIXI.Sprite(this.pipeBodyTexture);
      segment.width = width;
      segment.height = segmentSize; // 너비와 동일하게 설정
      segment.position.x = 0;
      segment.position.y = segmentSize + i * segmentSize; // 끝부분 다음부터 시작
      pipe.addChild(segment);
    }

    // 앵커 및 위치 설정
    pipe.pivot.x = width / 2;
    pipe.pivot.y = 0; // 상단을 기준점으로 유지

    const yPos = topPipeHeight + gapHeight;
    pipe.position.set(this.app.screen.width + width / 2, yPos);

    // 물리 바디 생성
    const body = Matter.Bodies.rectangle(
      this.app.screen.width + width / 2,
      yPos + height / 2, // 파이프의 중심에 바디 배치
      width,
      height,
      { isStatic: true, label: "pipe" }
    );

    return { pipe, body };
  }

  /**
   * 파이프를 이동시킵니다.
   */
  public movePipes(): void {
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
        pair.topBody.position.x < this.birdBody.position.x &&
        !pair.top.userData?.passed
      ) {
        pair.top.userData = { passed: true };
        this.onScoreCallback();
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

  /**
   * 파이프 생성 로직을 업데이트합니다.
   */
  public update(deltaTime: number): void {
    if (this.gameOver) return;

    const currentTime = Date.now();
    if (currentTime - this.lastPipeSpawnTime > this.pipeSpawnInterval) {
      this.createPipePair();
      this.lastPipeSpawnTime = currentTime;
    }

    this.movePipes();
  }

  /**
   * 모든 파이프를 제거합니다.
   */
  public clearPipes(): void {
    // 모든 파이프 쌍을 삭제
    while (this.pipesPairs.length > 0) {
      this.removePipePair(0);
    }
    this.lastPipeSpawnTime = 0;
  }

  /**
   * 게임 오버 상태를 설정합니다.
   */
  public setGameOver(isGameOver: boolean): void {
    this.gameOver = isGameOver;
  }

  /**
   * 파이프 속도를 설정합니다.
   */
  public setPipeSpeed(speed: number): void {
    this.pipeSpeed = speed;
  }

  /**
   * 파이프 생성 간격을 설정합니다.
   */
  public setPipeSpawnInterval(interval: number): void {
    this.pipeSpawnInterval = interval;
  }
}
