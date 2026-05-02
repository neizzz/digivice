import * as PIXI from "pixi.js";
import type { CharacterKey } from "../../types/Character";
import { AssetLoader, type GameAssets } from "../../utils/AssetLoader";
import type { PipePair } from "./models";
import type { PhysicsManager } from "./physics";

const FLAPPY_BIRD_OBJECT_SCALE = 1.1;
const FLAPPY_BIRD_GROUND_TILE_SCALE = 0.9;
const FLAPPY_BIRD_PIPE_TILE_SCALE = 0.81;
const BASE_BASKET_SIZE = 40;
const BASE_BIRD_SIZE = 32 * 1.4;
const FLAPPY_BIRD_PLAYER_X_RATIO = 0.15;
const FLAPPY_BIRD_CLOUD_SPEED_RATIO = 0.35;
const FLAPPY_BIRD_CLOUD_MIN_SCALE = 1.15;
const FLAPPY_BIRD_CLOUD_MAX_SCALE = 1.85;
const FLAPPY_BIRD_CLOUD_MIN_GAP = 90;
const FLAPPY_BIRD_CLOUD_MAX_GAP = 185;
const FLAPPY_BIRD_CLOUD_TOP_PADDING = 28;
const FLAPPY_BIRD_CLOUD_MAX_HEIGHT_RATIO = 0.72;
const FLAPPY_BIRD_NEAR_MISS_CLEARANCE_RATIO = 0.25;
const FLAPPY_BIRD_BASE_FRAME_MS = 1000 / 60;
const FLAPPY_BIRD_MAX_FRAME_SCALE = 1.25;

type CloudSprite = PIXI.Sprite & {
  __flappyCloudAlphaVariance?: number;
};

type CloudVisualStyle = {
  alphaMin: number;
  alphaMax: number;
  tint: number;
};

function resolveFrameScale(deltaTime: number): number {
  return Math.min(
    FLAPPY_BIRD_MAX_FRAME_SCALE,
    Math.max(0, deltaTime / FLAPPY_BIRD_BASE_FRAME_MS),
  );
}

/**
 * 배경 구름 관리 클래스
 */
export class CloudManager {
  private app: PIXI.Application;
  private cloudContainer: PIXI.Container;
  private cloudTextures: PIXI.Texture[] = [];
  private clouds: PIXI.Sprite[] = [];
  private speed: number;
  private visualStyle: CloudVisualStyle = {
    alphaMin: 0.16,
    alphaMax: 0.28,
    tint: 0xffffff,
  };

  constructor(app: PIXI.Application, speed: number) {
    this.app = app;
    this.cloudContainer = new PIXI.Container();
    this.cloudTextures = Object.values(
      AssetLoader.getAssets().flappyCloudSprites?.textures ?? {},
    );
    this.speed = speed * FLAPPY_BIRD_CLOUD_SPEED_RATIO;
  }

  public setup(): void {
    this.reset();

    if (this.cloudTextures.length === 0) {
      return;
    }

    let nextX = 0;

    while (nextX < this.app.screen.width + FLAPPY_BIRD_CLOUD_MAX_GAP) {
      nextX = this.createCloud(nextX);
    }
  }

  public update(deltaTime: number): void {
    if (this.cloudTextures.length === 0 || this.clouds.length === 0) {
      return;
    }

    const frameScale = resolveFrameScale(deltaTime);

    for (let i = 0; i < this.clouds.length; i++) {
      const cloud = this.clouds[i];
      cloud.position.x -= this.speed * frameScale;

      if (cloud.position.x + cloud.width / 2 < 0) {
        this.cloudContainer.removeChild(cloud);
        this.clouds.splice(i, 1);
        i -= 1;
      }
    }

    const lastCloud = this.clouds[this.clouds.length - 1];

    if (
      !lastCloud ||
      lastCloud.position.x + lastCloud.width / 2 < this.app.screen.width
    ) {
      const nextX = lastCloud ? lastCloud.position.x + lastCloud.width / 2 : 0;
      this.createCloud(nextX);
    }
  }

  public resize(): void {
    if (this.cloudTextures.length === 0) {
      return;
    }

    if (this.clouds.length === 0) {
      this.setup();
      return;
    }

    const maxY = this.getMaxCloudY();

    this.clouds.forEach((cloud) => {
      cloud.position.y = Math.min(cloud.position.y, maxY - cloud.height / 2);
    });

    let nextX =
      this.clouds[this.clouds.length - 1].position.x +
      this.clouds[this.clouds.length - 1].width / 2;

    while (nextX < this.app.screen.width + FLAPPY_BIRD_CLOUD_MAX_GAP) {
      nextX = this.createCloud(nextX);
    }
  }

  public reset(): void {
    this.cloudContainer.removeChildren();
    this.clouds = [];
  }

  public setSpeed(speed: number): void {
    this.speed = speed * FLAPPY_BIRD_CLOUD_SPEED_RATIO;
  }

  public setVisualStyle(style: CloudVisualStyle): void {
    this.visualStyle = style;

    this.clouds.forEach((cloud) => {
      this.applyVisualStyle(cloud as CloudSprite);
    });
  }

  public getContainer(): PIXI.Container {
    return this.cloudContainer;
  }

  private createCloud(startX: number): number {
    const cloudTexture = this.getRandomCloudTexture();

    if (!cloudTexture) {
      return startX;
    }

    const scale =
      FLAPPY_BIRD_CLOUD_MIN_SCALE +
      Math.random() *
        (FLAPPY_BIRD_CLOUD_MAX_SCALE - FLAPPY_BIRD_CLOUD_MIN_SCALE);
    const cloud = new PIXI.Sprite(cloudTexture) as CloudSprite;
    cloud.anchor.set(0.5);
    cloud.scale.set(scale);
    cloud.__flappyCloudAlphaVariance = Math.random();
    this.applyVisualStyle(cloud);
    cloud.position.x = startX + cloud.width / 2 + this.getRandomCloudGap();
    cloud.position.y = this.getRandomCloudY(cloud.height);

    this.cloudContainer.addChild(cloud);
    this.clouds.push(cloud);

    return cloud.position.x + cloud.width / 2;
  }

  private getRandomCloudGap(): number {
    return (
      FLAPPY_BIRD_CLOUD_MIN_GAP +
      Math.random() * (FLAPPY_BIRD_CLOUD_MAX_GAP - FLAPPY_BIRD_CLOUD_MIN_GAP)
    );
  }

  private applyVisualStyle(cloud: CloudSprite): void {
    const variance = cloud.__flappyCloudAlphaVariance ?? 0.5;
    cloud.alpha =
      this.visualStyle.alphaMin +
      variance * (this.visualStyle.alphaMax - this.visualStyle.alphaMin);
    cloud.tint = this.visualStyle.tint;
  }

  private getRandomCloudTexture(): PIXI.Texture | null {
    if (this.cloudTextures.length === 0) {
      return null;
    }

    const textureIndex = Math.floor(Math.random() * this.cloudTextures.length);

    return this.cloudTextures[textureIndex] ?? null;
  }

  private getRandomCloudY(cloudHeight: number): number {
    const minY = FLAPPY_BIRD_CLOUD_TOP_PADDING + cloudHeight / 2;
    const maxY = this.getMaxCloudY() - cloudHeight / 2;

    if (maxY <= minY) {
      return minY;
    }

    return minY + Math.random() * (maxY - minY);
  }

  private getMaxCloudY(): number {
    return this.app.screen.height * FLAPPY_BIRD_CLOUD_MAX_HEIGHT_RATIO;
  }
}

/**
 * 지면 타일 관리 클래스
 */
export class GroundManager {
  private app: PIXI.Application;
  private physicsManager: PhysicsManager;
  private groundContainer: PIXI.Container;
  private groundBody: Matter.Body;
  private groundTiles: PIXI.Sprite[] = [];
  private groundTileSize = 32;
  private lastGroundTileX = 0;
  private speed: number;

  constructor(
    app: PIXI.Application,
    physicsManager: PhysicsManager,
    speed: number,
  ) {
    this.app = app;
    this.physicsManager = physicsManager;
    this.groundContainer = new PIXI.Container();
    this.speed = speed;

    const assets = AssetLoader.getAssets();
    // 지면 타일 크기 설정
    if (assets.tilesetSprites?.textures["ground-1"]) {
      this.groundTileSize = Math.max(
        1,
        Math.round(
          assets.tilesetSprites.textures["ground-1"].frame.width *
            FLAPPY_BIRD_GROUND_TILE_SCALE,
        ),
      );
    }

    // 지면 물리 바디 생성
    this.groundBody = this.physicsManager.createRectangleBody(
      this.app.screen.width / 2,
      this.getGroundBodyCenterY(),
      this.app.screen.width,
      this.groundTileSize,
      { isStatic: true, label: "ground" },
    );

    // 물리 엔진에 추가
    this.physicsManager.addToEngine(this.groundContainer, this.groundBody);
  }

  /**
   * 초기 바닥 타일을 설정합니다.
   */
  public setup(): void {
    // 기존 타일 제거
    this.groundContainer.removeChildren().forEach((child) => child.destroy());
    this.groundTiles = [];
    this.lastGroundTileX = 0;

    const assets = AssetLoader.getAssets();
    const tilesetSprites = assets.tilesetSprites;

    if (tilesetSprites?.textures["ground-1"]) {
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

    const tileIndex = this.groundTiles.length % 2;
    if (tilesetSprites?.textures["ground-1"]) {
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
  public update(deltaTime: number): void {
    if (!this.groundTiles.length) {
      return;
    }

    const frameScale = resolveFrameScale(deltaTime);

    // 모든 타일 이동
    for (let i = 0; i < this.groundTiles.length; i++) {
      const tile = this.groundTiles[i];
      tile.position.x -= this.speed * frameScale;

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

  public resize(): void {
    this.physicsManager.setPosition(this.groundBody, {
      x: this.groundBody.position.x,
      y: this.getGroundBodyCenterY(),
    });
    this.setup();
  }

  private getGroundBodyCenterY(): number {
    return this.app.screen.height;
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

  public setSpeed(speed: number): void {
    this.speed = speed;
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
  private lastPipeSpawnTime = 0;
  private speed: number;
  private groundHeight: number;
  private passageHeightMinRatio = 0.35;
  private passageHeightMaxRatio = 0.45;

  constructor(
    app: PIXI.Application,
    physicsManager: PhysicsManager,
    speed: number,
    spawnInterval: number,
    groundHeight: number,
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
    onScoreUpdate: (scoreDelta: number) => void,
    deltaTime: number,
  ): void {
    // 파이프 생성 로직
    if (currentTime - this.lastPipeSpawnTime > this.pipeSpawnInterval) {
      this.createPipePair();
      this.lastPipeSpawnTime = currentTime;
    }

    // 파이프 이동 로직
    this.movePipes(playerBody, onScoreUpdate, deltaTime);
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
    const tileSize = Math.max(
      1,
      Math.round(
        texture.frame.width *
          FLAPPY_BIRD_OBJECT_SCALE *
          FLAPPY_BIRD_PIPE_TILE_SCALE,
      ),
    );

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
      minTopClearance: Number.POSITIVE_INFINITY,
      minBottomClearance: Number.POSITIVE_INFINITY,
    });
  }

  /**
   * 파이프 쌍 오브젝트를 생성합니다.
   */
  private createPipePairObjects(tileSize: number): {
    top: PIXI.Container;
    topBody: Matter.Body;
    bottom: PIXI.Container;
    bottomBody: Matter.Body;
  } {
    const assets = AssetLoader.getAssets();
    const tilesetSprites = assets.tilesetSprites;
    if (!tilesetSprites) {
      throw new Error("Tileset spritesheet not found");
    }

    const pipeBodyTexture = tilesetSprites.textures["pipe-body"];
    const pipeEndTexture = tilesetSprites.textures["pipe-end"];

    const minPipeHeight = tileSize * 2;
    const availableHeight = this.app.screen.height - this.groundHeight;

    // 새가 지나갈 통로 높이 설정
    const maxAvailablePassageHeight = Math.max(
      tileSize * 2,
      availableHeight - minPipeHeight * 2,
    );
    const minPassageHeight = Math.min(
      maxAvailablePassageHeight,
      Math.max(tileSize * 2, availableHeight * this.passageHeightMinRatio),
    );
    const maxPassageHeight = Math.max(
      minPassageHeight,
      Math.min(
        maxAvailablePassageHeight,
        Math.max(
          minPassageHeight,
          availableHeight * this.passageHeightMaxRatio,
        ),
      ),
    );
    let passageHeight =
      minPassageHeight + Math.random() * (maxPassageHeight - minPassageHeight);
    passageHeight = Math.ceil(passageHeight / tileSize) * tileSize;

    // 상단 파이프 높이 계산
    const topPipeHeight = Math.max(
      minPipeHeight,
      Math.floor(
        (Math.random() *
          (availableHeight - passageHeight - minPipeHeight * 2)) /
          tileSize,
      ) * tileSize,
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

    for (let i = 1; i <= Math.round(bottomPipeHeight / tileSize); i++) {
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
      { isStatic: true, label: "pipe" },
    );

    const bottomBody = this.physicsManager.createRectangleBody(
      bottomBodyX,
      bottomBodyY,
      tileSize,
      bottomPipeHeight,
      { isStatic: true, label: "pipe" },
    );

    return { top, topBody, bottom, bottomBody };
  }

  /**
   * 파이프를 이동시키는 메서드
   */
  private movePipes(
    playerBody: Matter.Body,
    onScoreUpdate: (scoreDelta: number) => void,
    deltaTime: number,
  ): void {
    const movementStep = this.speed * resolveFrameScale(deltaTime);

    for (let i = 0; i < this.pipesPairs.length; i++) {
      const pair = this.pipesPairs[i];

      // 물리 바디 이동
      this.physicsManager.translateBody(pair.topBody, {
        x: -movementStep,
        y: 0,
      });
      this.physicsManager.translateBody(pair.bottomBody, {
        x: -movementStep,
        y: 0,
      });

      this.trackNearMissClearances(pair, playerBody);

      // 점수 처리
      if (this.hasPairPassedPlayer(pair, playerBody) && !pair.passed) {
        pair.passed = true;
        onScoreUpdate(1 + this.getNearMissBonus(pair, playerBody));
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
   * 파이프 상태를 초기화합니다.
   */
  public reset(): void {
    this.clearAllPipes();
    this.lastPipeSpawnTime = 0;
  }

  public applyDifficulty(options: {
    speed: number;
    pipeSpawnInterval: number;
    passageHeightMinRatio: number;
    passageHeightMaxRatio: number;
  }): void {
    this.speed = options.speed;
    this.pipeSpawnInterval = options.pipeSpawnInterval;
    this.passageHeightMinRatio = options.passageHeightMinRatio;
    this.passageHeightMaxRatio = options.passageHeightMaxRatio;
  }

  /**
   * 파이프 컨테이너를 반환합니다.
   */
  public getContainer(): PIXI.Container {
    return this.pipes;
  }

  private getNearMissBonus(pair: PipePair, playerBody: Matter.Body): number {
    const playerHeight = playerBody.bounds.max.y - playerBody.bounds.min.y;
    const threshold = Math.max(
      6,
      Math.round(playerHeight * FLAPPY_BIRD_NEAR_MISS_CLEARANCE_RATIO),
    );
    const trackedClearance = Math.min(
      pair.minTopClearance,
      pair.minBottomClearance,
    );

    if (Number.isFinite(trackedClearance)) {
      return trackedClearance <= threshold ? 1 : 0;
    }

    const { topClearance, bottomClearance } = this.resolveGapClearances(
      pair,
      playerBody,
    );
    const currentClearance = Math.min(topClearance, bottomClearance);

    return currentClearance <= threshold ? 1 : 0;
  }

  private trackNearMissClearances(
    pair: PipePair,
    playerBody: Matter.Body,
  ): void {
    if (!this.isPlayerWithinNearMissWindow(pair, playerBody)) {
      return;
    }

    const { topClearance, bottomClearance } = this.resolveGapClearances(
      pair,
      playerBody,
    );

    pair.minTopClearance = Math.min(pair.minTopClearance, topClearance);
    pair.minBottomClearance = Math.min(
      pair.minBottomClearance,
      bottomClearance,
    );
  }

  private hasPairPassedPlayer(
    pair: PipePair,
    playerBody: Matter.Body,
  ): boolean {
    return pair.topBody.bounds.max.x < playerBody.bounds.min.x;
  }

  private isPlayerWithinNearMissWindow(
    pair: PipePair,
    playerBody: Matter.Body,
  ): boolean {
    return (
      playerBody.bounds.max.x >= pair.topBody.bounds.min.x &&
      playerBody.bounds.min.x <= pair.topBody.bounds.max.x
    );
  }

  private resolveGapClearances(
    pair: PipePair,
    playerBody: Matter.Body,
  ): { topClearance: number; bottomClearance: number } {
    const gapTopY = pair.topBody.bounds.max.y;
    const gapBottomY = pair.bottomBody.bounds.min.y;
    const playerTopY = playerBody.bounds.min.y;
    const playerBottomY = playerBody.bounds.max.y;

    return {
      topClearance: Math.max(0, playerTopY - gapTopY),
      bottomClearance: Math.max(0, gapBottomY - playerBottomY),
    };
  }
}

/**
 * 플레이어 관리 클래스
 */
export class PlayerManager {
  private app: PIXI.Application;
  private physicsManager: PhysicsManager;
  private bird!: PIXI.AnimatedSprite;
  private basket!: PIXI.Sprite;
  private basketBody!: Matter.Body;

  constructor(
    app: PIXI.Application,
    physicsManager: PhysicsManager,
    characterKey: CharacterKey,
  ) {
    this.app = app;
    this.physicsManager = physicsManager;

    const assets = AssetLoader.getAssets();

    // 바구니 초기화
    this.initializeBasket(characterKey, assets);

    // 새(버드) 초기화
    this.initializeBird(assets.birdSprites);
  }

  /**
   * 바구니를 초기화합니다.
   */
  private initializeBasket(
    characterKey: CharacterKey,
    assets: GameAssets,
  ): void {
    const characterSpritesheet = assets.characterSprites[characterKey];
    if (!characterSpritesheet) {
      throw new Error(
        `Character spritesheet not found for key: ${characterKey}`,
      );
    }

    const inBasketTexture = characterSpritesheet.textures["in-basket"];
    this.basket = new PIXI.Sprite(inBasketTexture);
    this.basket.width = BASE_BASKET_SIZE * FLAPPY_BIRD_OBJECT_SCALE;
    this.basket.height = BASE_BASKET_SIZE * FLAPPY_BIRD_OBJECT_SCALE;
    this.basket.anchor.set(0.5);

    // 바구니 물리 바디 생성
    this.basketBody = this.physicsManager.createCircleBody(
      this.getPlayerStartX(),
      this.app.screen.height / 2,
      this.basket.width / 2,
      {
        label: "basket",
        isStatic: false,
        inertia: Number.POSITIVE_INFINITY, // 회전 방지
      },
    );

    // 물리 엔진에 추가
    this.physicsManager.addToEngine(this.basket, this.basketBody);
  }

  /**
   * 새(버드)를 초기화합니다.
   */
  private initializeBird(birdSprites?: PIXI.Spritesheet): void {
    if (!birdSprites) {
      console.warn("Bird spritesheet not found");
      return;
    }

    const textures = birdSprites.animations.fly;
    if (!textures || textures.length === 0) {
      console.warn("Bird 'fly' animation frames not found");
      return;
    }

    this.bird = new PIXI.AnimatedSprite(textures);
    this.bird.animationSpeed = 0.1;
    this.bird.play();
    this.bird.width = BASE_BIRD_SIZE * FLAPPY_BIRD_OBJECT_SCALE;
    this.bird.height = BASE_BIRD_SIZE * FLAPPY_BIRD_OBJECT_SCALE;
    this.bird.anchor.set(0.5);
  }

  /**
   * 플레이어 위치를 초기화합니다.
   */
  public resetPosition(): void {
    this.physicsManager.setPosition(this.basketBody, {
      x: this.getPlayerStartX(),
      y: this.app.screen.height / 2,
    });
    this.physicsManager.setVelocity(this.basketBody, { x: 0, y: 0 });
  }

  /**
   * 플레이어 위치를 업데이트합니다.
   */
  public update(): void {
    if (this.bird) {
      this.bird.position.x =
        this.basketBody.position.x + this.basket.width * 0.1;
      this.bird.position.y =
        this.basketBody.position.y - this.basket.height * 0.9;
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
      this.getPlayerStartX(),
      this.app.screen.height / 2,
      this.basket.width / 2,
      {
        label: "basket",
        isStatic: false,
        angle: 0,
        angularVelocity: 0,
        inertia: Number.POSITIVE_INFINITY,
        frictionAir: 0.01,
      },
    );

    // 새로 생성한 물리 바디 추가
    this.physicsManager.addToEngine(this.basket, this.basketBody);
  }

  private getPlayerStartX(): number {
    return this.app.screen.width * FLAPPY_BIRD_PLAYER_X_RATIO;
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
