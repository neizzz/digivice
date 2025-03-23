import * as PIXI from "pixi.js";
import { AssetLoader } from "../../utils/AssetLoader";
import { PipePair } from "./models";
import { PhysicsManager } from "./physics";

/**
 * 지면 타일 관리 클래스
 */
export class GroundManager {
  private app: PIXI.Application;
  private physicsManager: PhysicsManager;
  private groundContainer: PIXI.Container;
  private groundBody: Matter.Body;
  private groundTiles: PIXI.Sprite[] = [];
  private groundTileSize: number = 32;
  private lastGroundTileX: number = 0;
  private speed: number;

  constructor(
    app: PIXI.Application,
    physicsManager: PhysicsManager,
    speed: number
  ) {
    this.app = app;
    this.physicsManager = physicsManager;
    this.speed = speed;
    this.groundContainer = new PIXI.Container();

    // 지면 타일 크기 설정
    const assets = AssetLoader.getAssets();
    if (assets.tilesetSprites && assets.tilesetSprites.textures["ground-1"]) {
      this.groundTileSize =
        assets.tilesetSprites.textures["ground-1"].frame.width;
    }

    // 지면 물리 바디 생성
    this.groundBody = this.physicsManager.createRectangleBody(
      this.app.screen.width / 2,
      this.app.screen.height,
      this.app.screen.width,
      this.groundTileSize,
      { isStatic: true, label: "ground" }
    );

    // 물리 엔진에 추가
    this.physicsManager.addToEngine(this.groundContainer, this.groundBody);
  }

  /**
   * 초기 바닥 타일을 설정합니다.
   */
  public setup(): void {
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
    }
  }

  /**
   * 새 바닥 타일을 생성합니다.
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
   * 바닥 타일을 이동시킵니다.
   */
  public update(): void {
    if (!this.groundTiles.length) {
      return;
    }

    // 모든 타일 이동
    for (let i = 0; i < this.groundTiles.length; i++) {
      const tile = this.groundTiles[i];
      tile.position.x -= this.speed;

      // 타일이 화면 왼쪽으로 벗어났는지 확인
      if (tile.position.x + this.groundTileSize < 0) {
        this.groundContainer.removeChild(tile);
        this.groundTiles.splice(i, 1);
        i--;
      }
    }

    // 오른쪽 끝에 새 타일이 필요한지 확인
    const lastTile = this.groundTiles[this.groundTiles.length - 1];
    if (
      lastTile &&
      lastTile.position.x + this.groundTileSize < this.app.screen.width
    ) {
      this.lastGroundTileX = lastTile.position.x + this.groundTileSize;
      this.createGroundTile();
    }
  }

  /**
   * 지면 컨테이너를 반환합니다.
   */
  public getContainer(): PIXI.Container {
    return this.groundContainer;
  }

  /**
   * 지면 물리 바디를 반환합니다.
   */
  public getBody(): Matter.Body {
    return this.groundBody;
  }

  /**
   * 타일 높이를 반환합니다.
   */
  public getTileHeight(): number {
    return this.groundTileSize;
  }
}

/**
 * 파이프 관리 클래스
 */
export class PipeManager {
  private app: PIXI.Application;
  private physicsManager: PhysicsManager;
  private pipes: PIXI.Container;
  private pipesPairs: PipePair[] = [];
  private pipeSpawnInterval: number;
  private lastPipeSpawnTime: number = 0;
  private speed: number;
  private groundHeight: number;

  constructor(
    app: PIXI.Application,
    physicsManager: PhysicsManager,
    speed: number,
    spawnInterval: number,
    groundHeight: number
  ) {
    this.app = app;
    this.physicsManager = physicsManager;
    this.speed = speed;
    this.pipeSpawnInterval = spawnInterval;
    this.groundHeight = groundHeight;
    this.pipes = new PIXI.Container();
  }

  /**
   * 파이프를 업데이트합니다.
   */
  public update(
    currentTime: number,
    playerBody: Matter.Body,
    onScoreUpdate: () => void
  ): void {
    // 파이프 생성 로직
    if (currentTime - this.lastPipeSpawnTime > this.pipeSpawnInterval) {
      this.createPipePair();
      this.lastPipeSpawnTime = currentTime;
    }

    // 파이프 이동 로직
    this.movePipes(playerBody, onScoreUpdate);
  }

  /**
   * 파이프 쌍을 생성합니다.
   */
  private createPipePair(): void {
    const assets = AssetLoader.getAssets();
    if (
      !assets.tilesetSprites ||
      !assets.tilesetSprites.textures["pipe-body"]
    ) {
      throw new Error("Pipe textures not found in assets");
    }

    const texture = assets.tilesetSprites.textures["pipe-body"];
    const tileSize = texture.frame.width;

    // 파이프 생성 로직
    const { top, topBody, bottom, bottomBody } =
      this.createPipePairObjects(tileSize);

    // 화면 위치 설정
    top.position.x = topBody.position.x;
    top.position.y = topBody.position.y;
    bottom.position.x = bottomBody.position.x;
    bottom.position.y = bottomBody.position.y;

    // 파이프 컨테이너에 추가
    this.pipes.addChild(top);
    this.pipes.addChild(bottom);

    // 게임 엔진에 파이프 물리 바디 추가
    this.physicsManager.addToEngine(top, topBody);
    this.physicsManager.addToEngine(bottom, bottomBody);

    // 파이프 쌍 추적
    this.pipesPairs.push({
      top,
      bottom,
      topBody,
      bottomBody,
      passed: false,
    });
  }

  /**
   * 파이프 쌍 오브젝트를 생성합니다.
   */
  private createPipePairObjects(tileSize: number): {
    top: PIXI.Sprite;
    topBody: Matter.Body;
    bottom: PIXI.Sprite;
    bottomBody: Matter.Body;
  } {
    const assets = AssetLoader.getAssets();
    const tilesetSprites = assets.tilesetSprites;
    const pipeBodyTexture = tilesetSprites.textures["pipe-body"];
    const pipeEndTexture = tilesetSprites.textures["pipe-end"];

    const minPipeHeight = tileSize * 2;
    const availableHeight = this.app.screen.height - this.groundHeight;

    // 새가 지나갈 통로 높이 설정
    const minPassageHeight = Math.max(60, availableHeight * 0.2);
    const maxPassageHeight = Math.max(80, availableHeight * 0.3);
    let passageHeight =
      minPassageHeight + Math.random() * (maxPassageHeight - minPassageHeight);
    passageHeight = Math.ceil(passageHeight / tileSize) * tileSize;

    // 상단 파이프 높이 계산
    const topPipeHeight = Math.max(
      minPipeHeight,
      Math.floor(
        (Math.random() *
          (availableHeight - passageHeight - minPipeHeight * 2)) /
          tileSize
      ) * tileSize
    );

    // 하단 파이프 높이 계산
    const bottomPipeHeight = availableHeight - topPipeHeight - passageHeight;

    // 상단 파이프 생성
    const top = new PIXI.Container();

    for (let i = 0; i < Math.round(topPipeHeight / tileSize) - 1; i++) {
      const segment = new PIXI.Sprite(pipeBodyTexture);
      segment.width = tileSize;
      segment.height = tileSize;
      segment.position.set(0, i * tileSize);
      top.addChild(segment);
    }

    const topEnd = new PIXI.Sprite(pipeEndTexture);
    topEnd.width = tileSize;
    topEnd.height = tileSize;
    topEnd.rotation = Math.PI;
    topEnd.position.set(tileSize, topPipeHeight);
    top.addChild(topEnd);

    // 하단 파이프 생성
    const bottom = new PIXI.Container();

    const bottomEnd = new PIXI.Sprite(pipeEndTexture);
    bottomEnd.width = tileSize;
    bottomEnd.height = tileSize;
    bottomEnd.position.set(0, 0);
    bottom.addChild(bottomEnd);

    for (let i = 1; i < Math.round(bottomPipeHeight / tileSize); i++) {
      const segment = new PIXI.Sprite(pipeBodyTexture);
      segment.width = tileSize;
      segment.height = tileSize;
      segment.position.set(0, i * tileSize);
      bottom.addChild(segment);
    }

    // 위치 설정
    const topBodyX = this.app.screen.width + tileSize / 2;
    const topBodyY = topPipeHeight / 2;
    const bottomBodyX = topBodyX;
    const bottomBodyY =
      topPipeHeight +
      passageHeight +
      bottomPipeHeight / 2 +
      tileSize / 2; /* ground 높이 */

    // 물리 바디 생성
    const topBody = this.physicsManager.createRectangleBody(
      topBodyX,
      topBodyY,
      tileSize,
      topPipeHeight,
      { isStatic: true, label: "pipe" }
    );

    const bottomBody = this.physicsManager.createRectangleBody(
      bottomBodyX,
      bottomBodyY,
      tileSize,
      bottomPipeHeight,
      { isStatic: true, label: "pipe" }
    );

    return { top, topBody, bottom, bottomBody };
  }

  /**
   * 파이프를 이동시키는 메서드
   */
  private movePipes(playerBody: Matter.Body, onScoreUpdate: () => void): void {
    for (let i = 0; i < this.pipesPairs.length; i++) {
      const pair = this.pipesPairs[i];

      // 물리 바디 이동
      this.physicsManager.translateBody(pair.topBody, { x: -this.speed, y: 0 });
      this.physicsManager.translateBody(pair.bottomBody, {
        x: -this.speed,
        y: 0,
      });

      // 점수 처리
      if (pair.topBody.position.x < playerBody.position.x && !pair.passed) {
        pair.passed = true;
        onScoreUpdate();
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
    this.physicsManager.removeFromEngine(pair.topBody);
    this.physicsManager.removeFromEngine(pair.bottomBody);

    // 배열에서 제거
    this.pipesPairs.splice(index, 1);
  }

  /**
   * 모든 파이프를 제거합니다.
   */
  public clearAllPipes(): void {
    while (this.pipesPairs.length > 0) {
      this.removePipePair(0);
    }
  }

  /**
   * 파이프 컨테이너를 반환합니다.
   */
  public getContainer(): PIXI.Container {
    return this.pipes;
  }
}

/**
 * 플레이어 관리 클래스
 */
export class PlayerManager {
  private app: PIXI.Application;
  private physicsManager: PhysicsManager;
  private bird: PIXI.AnimatedSprite;
  private basket: PIXI.Sprite;
  private basketBody: Matter.Body;

  constructor(
    app: PIXI.Application,
    physicsManager: PhysicsManager,
    characterKey: string
  ) {
    this.app = app;
    this.physicsManager = physicsManager;

    const assets = AssetLoader.getAssets();

    // 바구니 초기화
    this.initializeBasket(characterKey, assets);

    // 새(버드) 초기화
    this.initializeBird(assets);
  }

  /**
   * 바구니를 초기화합니다.
   */
  private initializeBasket(characterKey: string, assets: any): void {
    const characterSpritesheet = assets.characterSprites[characterKey];
    if (!characterSpritesheet) {
      throw new Error(
        `Character spritesheet not found for key: ${characterKey}`
      );
    }

    const inBasketTexture = characterSpritesheet.textures["in-basket"];
    this.basket = new PIXI.Sprite(inBasketTexture);
    this.basket.width = 40;
    this.basket.height = 40;
    this.basket.anchor.set(0.5);

    // 바구니 물리 바디 생성
    this.basketBody = this.physicsManager.createCircleBody(
      this.app.screen.width / 3,
      this.app.screen.height / 2,
      this.basket.width / 2,
      {
        label: "basket",
        isStatic: false,
        inertia: Infinity, // 회전 방지
      }
    );

    // 물리 엔진에 추가
    this.physicsManager.addToEngine(this.basket, this.basketBody);
  }

  /**
   * 새(버드)를 초기화합니다.
   */
  private initializeBird(assets: any): void {
    const birdSpritesheet = assets.birdSprites;
    if (!birdSpritesheet) {
      console.warn("Bird spritesheet not found");
      return;
    }

    const textures = birdSpritesheet.animations["fly"];
    if (!textures || textures.length === 0) {
      console.warn("Bird 'fly' animation frames not found");
      return;
    }

    this.bird = new PIXI.AnimatedSprite(textures);
    this.bird.animationSpeed = 0.1;
    this.bird.play();
    this.bird.width = 32 * 1.4;
    this.bird.height = 32 * 1.4;
    this.bird.anchor.set(0.5);
  }

  /**
   * 플레이어 위치를 초기화합니다.
   */
  public resetPosition(): void {
    this.physicsManager.setPosition(this.basketBody, {
      x: this.app.screen.width / 4,
      y: this.app.screen.height / 2,
    });
    this.physicsManager.setVelocity(this.basketBody, { x: 0, y: 0 });
  }

  /**
   * 플레이어 위치를 업데이트합니다.
   */
  public update(): void {
    if (this.bird) {
      this.bird.position.x = this.basketBody.position.x + 4;
      this.bird.position.y = this.basketBody.position.y - 36; // 바구니 위에 위치
    }
  }

  /**
   * 플레이어 점프 메서드
   */
  public jump(velocity: number): void {
    this.physicsManager.setVelocity(this.basketBody, { x: 0, y: -velocity });
  }

  /**
   * 플레이어 애니메이션 시작
   */
  public startAnimation(): void {
    if (this.bird) {
      this.bird.play();
    }
  }

  /**
   * 플레이어 애니메이션 중지
   */
  public stopAnimation(): void {
    if (this.bird) {
      this.bird.stop();
    }
  }

  /**
   * 충돌 검사 메서드
   */
  public checkCollisions(): void {
    // 화면 상단 경계 체크
    if (this.basketBody.position.y - this.basket.height / 2 <= 0) {
      this.physicsManager.setPosition(this.basketBody, {
        x: this.basketBody.position.x,
        y: this.basket.height / 2,
      });
      this.physicsManager.setVelocity(this.basketBody, { x: 0, y: 0 });
    }
  }

  /**
   * 바구니를 재설정합니다.
   */
  public resetBasket(): void {
    // 기존 바스켓 물리 바디 제거
    this.physicsManager.removeFromEngine(this.basketBody);

    // 새 바스켓 물리 바디 생성
    this.basketBody = this.physicsManager.createCircleBody(
      this.app.screen.width / 3,
      this.app.screen.height / 2,
      this.basket.width / 2,
      {
        label: "basket",
        isStatic: false,
        angle: 0,
        angularVelocity: 0,
        inertia: Infinity,
        frictionAir: 0.01,
      }
    );

    // 새로 생성한 물리 바디 추가
    this.physicsManager.addToEngine(this.basket, this.basketBody);
  }

  /**
   * 바구니 물리 바디를 반환합니다.
   */
  public getBasketBody(): Matter.Body {
    return this.basketBody;
  }

  /**
   * 새(버드) 스프라이트를 반환합니다.
   */
  public getBird(): PIXI.AnimatedSprite {
    return this.bird;
  }

  /**
   * 바구니 스프라이트를 반환합니다.
   */
  public getBasket(): PIXI.Sprite {
    return this.basket;
  }
}
