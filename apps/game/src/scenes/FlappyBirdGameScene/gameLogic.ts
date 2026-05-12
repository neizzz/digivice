import * as Matter from "matter-js";
import * as PIXI from "pixi.js";
import type { CharacterKey } from "../../types/Character";
import { AssetLoader, type GameAssets } from "../../utils/AssetLoader";
import { CharacterState } from "../MainScene/types";
import type { FlappyBirdDifficultyState, PipePair } from "./models";
import { resolveNearMissBonusTier } from "./nearMiss";
import { buildPipeSpawnPlan, type PipeSpawnPlanItem } from "./pipeSpawn";
import type { PhysicsManager } from "./physics";

const FLAPPY_BIRD_OBJECT_SCALE = 1.1;
const FLAPPY_BIRD_GROUND_TILE_SCALE = 0.9;
const FLAPPY_BIRD_PIPE_TILE_SCALE = 0.81;
const FLAPPY_BIRD_PIPE_COLLISION_INSET_X_PX = 1;
const FLAPPY_BIRD_PIPE_COLLISION_INSET_BOTTOM_PX = 1;
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
const FLAPPY_BIRD_BASE_FRAME_MS = 1000 / 60;
const FLAPPY_BIRD_MAX_FRAME_SCALE = 2;
const FLAPPY_BIRD_SPEED_TRANSITION_MS = 140;

type CloudSprite = PIXI.Sprite & {
  __flappyCloudAlphaVariance?: number;
};

type CloudVisualStyle = {
  alphaMin: number;
  alphaMax: number;
  tint: number;
};

type PipeDisplayContainer = PIXI.Container & {
  __flappyPipeShaft?: PIXI.TilingSprite;
  __flappyPipeEndCap?: PIXI.Sprite;
  __flappyPipePosition?: "top" | "bottom";
};

type PipeBodyWithMetrics = Matter.Body & {
  __flappyPipeWidth?: number;
  __flappyPipeHeight?: number;
};

type ManagedPipePair = PipePair;

type PipeAssetsContext = {
  tileSize: number;
  pipeBodyTexture: PIXI.Texture;
  pipeEndTexture: PIXI.Texture;
};

function resolveFrameScale(deltaTime: number): number {
  return Math.min(
    FLAPPY_BIRD_MAX_FRAME_SCALE,
    Math.max(0, deltaTime / FLAPPY_BIRD_BASE_FRAME_MS),
  );
}

function resolvePipeCollisionBodySize(
  width: number,
  height: number,
): {
  width: number;
  height: number;
} {
  return {
    width: Math.max(1, width - FLAPPY_BIRD_PIPE_COLLISION_INSET_X_PX * 2),
    height: Math.max(1, height - FLAPPY_BIRD_PIPE_COLLISION_INSET_BOTTOM_PX),
  };
}

function smoothFlappyBirdSpeed(
  current: number,
  target: number,
  deltaTime: number,
): number {
  if (!Number.isFinite(current) || !Number.isFinite(target)) {
    return target;
  }

  if (Math.abs(target - current) < 0.001) {
    return target;
  }

  const alpha =
    1 - Math.exp(-Math.max(0, deltaTime) / FLAPPY_BIRD_SPEED_TRANSITION_MS);
  return current + (target - current) * alpha;
}

/**
 * 배경 구름 관리 클래스
 */
export class CloudManager {
  private app: PIXI.Application;
  private cloudContainer: PIXI.Container;
  private cloudTextures: PIXI.Texture[] = [];
  private clouds: CloudSprite[] = [];
  private speed: number;
  private targetSpeed: number;
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
    this.targetSpeed = this.speed;
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

    this.speed = smoothFlappyBirdSpeed(this.speed, this.targetSpeed, deltaTime);

    const movementStep = this.speed * resolveFrameScale(deltaTime);

    for (const cloud of this.clouds) {
      cloud.position.x -= movementStep;
    }

    while (this.clouds.length > 0) {
      const firstCloud = this.clouds[0];

      if (firstCloud.position.x + firstCloud.width / 2 >= 0) {
        break;
      }

      const recycledCloud = this.clouds.shift();

      if (!recycledCloud) {
        break;
      }

      const lastCloud = this.clouds[this.clouds.length - 1];
      const nextX = lastCloud ? lastCloud.position.x + lastCloud.width / 2 : 0;
      this.configureCloud(recycledCloud, nextX);
      this.clouds.push(recycledCloud);
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
    this.targetSpeed = speed * FLAPPY_BIRD_CLOUD_SPEED_RATIO;
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

  public getCloudCount(): number {
    return this.clouds.length;
  }

  private createCloud(startX: number): number {
    const cloudTexture = this.getRandomCloudTexture();

    if (!cloudTexture) {
      return startX;
    }

    const cloud = new PIXI.Sprite(cloudTexture) as CloudSprite;
    cloud.anchor.set(0.5);
    this.configureCloud(cloud, startX, cloudTexture);

    this.cloudContainer.addChild(cloud);
    this.clouds.push(cloud);

    return cloud.position.x + cloud.width / 2;
  }

  private configureCloud(
    cloud: CloudSprite,
    startX: number,
    texture = this.getRandomCloudTexture(),
  ): void {
    if (!texture) {
      return;
    }

    const scale =
      FLAPPY_BIRD_CLOUD_MIN_SCALE +
      Math.random() *
        (FLAPPY_BIRD_CLOUD_MAX_SCALE - FLAPPY_BIRD_CLOUD_MIN_SCALE);
    cloud.texture = texture;
    cloud.scale.set(scale);
    cloud.__flappyCloudAlphaVariance = Math.random();
    this.applyVisualStyle(cloud);
    cloud.position.x = startX + cloud.width / 2 + this.getRandomCloudGap();
    cloud.position.y = this.getRandomCloudY(cloud.height);
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
  private targetSpeed: number;

  constructor(
    app: PIXI.Application,
    physicsManager: PhysicsManager,
    speed: number,
  ) {
    this.app = app;
    this.physicsManager = physicsManager;
    this.groundContainer = new PIXI.Container();
    this.speed = speed;
    this.targetSpeed = speed;

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
    this.physicsManager.addToEngine(null, this.groundBody, {
      syncDisplay: false,
    });
    this.syncGroundContainerPosition();
  }

  /**
   * 초기 바닥 타일을 설정합니다.
   */
  public setup(): void {
    this.syncGroundContainerPosition();

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

    this.speed = smoothFlappyBirdSpeed(this.speed, this.targetSpeed, deltaTime);

    const movementStep = this.speed * resolveFrameScale(deltaTime);

    for (const tile of this.groundTiles) {
      tile.position.x -= movementStep;
    }

    while (this.groundTiles.length > 0) {
      const firstTile = this.groundTiles[0];

      if (firstTile.position.x + this.groundTileSize >= 0) {
        break;
      }

      const recycledTile = this.groundTiles.shift();

      if (!recycledTile) {
        break;
      }

      const lastTile = this.groundTiles[this.groundTiles.length - 1];
      recycledTile.position.x =
        (lastTile ? lastTile.position.x : 0) + this.groundTileSize;
      this.groundTiles.push(recycledTile);
    }
  }

  public resize(): void {
    this.physicsManager.setPosition(this.groundBody, {
      x: this.groundBody.position.x,
      y: this.getGroundBodyCenterY(),
    });
    this.syncGroundContainerPosition();
    this.setup();
  }

  private getGroundBodyCenterY(): number {
    return this.app.screen.height;
  }

  private syncGroundContainerPosition(): void {
    this.groundContainer.position.set(0, this.groundBody.bounds.min.y);
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

  public getTileCount(): number {
    return this.groundTiles.length;
  }

  public setSpeed(speed: number): void {
    this.targetSpeed = speed;
  }
}

/**
 * 파이프 관리 클래스
 */
export class PipeManager {
  private app: PIXI.Application;
  private physicsManager: PhysicsManager;
  private pipes: PIXI.Container;
  private pipesPairs: ManagedPipePair[] = [];
  private pipePool: ManagedPipePair[] = [];
  private pipeSpawnInterval: number;
  private targetPipeSpawnInterval: number;
  private elapsedSinceLastPipeSpawnMs: number;
  private speed: number;
  private targetSpeed: number;
  private groundHeight: number;
  private passageHeightMinRatio = 0.35;
  private passageHeightMaxRatio = 0.45;
  private passagePositionExpansionTiles = 0;
  private doublePipePatternChance = 0;
  private doublePipePatternGapTileOptions: readonly number[] = [];
  private misalignedDoublePipePatternChance = 0;
  private misalignedDoublePipePatternOffsetTiles = 0;

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
    this.targetSpeed = speed;
    this.pipeSpawnInterval = spawnInterval;
    this.targetPipeSpawnInterval = spawnInterval;
    this.elapsedSinceLastPipeSpawnMs = spawnInterval;
    this.groundHeight = groundHeight;
    this.pipes = new PIXI.Container();
  }

  /**
   * 파이프를 업데이트합니다.
   */
  public update(
    playerBody: Matter.Body,
    onScoreUpdate: (scoreDelta: number) => void,
    deltaTime: number,
    onPlayerCollision?: () => void,
  ): void {
    this.pipeSpawnInterval = smoothFlappyBirdSpeed(
      this.pipeSpawnInterval,
      this.targetPipeSpawnInterval,
      deltaTime,
    );
    this.elapsedSinceLastPipeSpawnMs += Math.max(0, deltaTime);

    // 파이프 생성 로직
    if (this.elapsedSinceLastPipeSpawnMs > this.pipeSpawnInterval) {
      this.createPipePattern();
      this.elapsedSinceLastPipeSpawnMs = 0;
    }

    // 파이프 이동 로직
    this.movePipes(playerBody, onScoreUpdate, deltaTime, onPlayerCollision);
  }

  public prewarmPipePairs(count: number): void {
    const targetCount = Math.max(0, Math.floor(count));

    if (targetCount === 0) {
      return;
    }

    const pipeAssets = this.resolvePipeAssetsContext();

    while (this.pipesPairs.length + this.pipePool.length < targetCount) {
      const spawnPlan = buildPipeSpawnPlan({
        tileSize: pipeAssets.tileSize,
        availableHeight: this.app.screen.height - this.groundHeight,
        passageHeightMinRatio: this.passageHeightMinRatio,
        passageHeightMaxRatio: this.passageHeightMaxRatio,
        passagePositionExpansionTiles: this.passagePositionExpansionTiles,
        doublePipePatternChance: this.doublePipePatternChance,
        doublePipePatternGapTileOptions: this.doublePipePatternGapTileOptions,
        misalignedDoublePipePatternChance:
          this.misalignedDoublePipePatternChance,
        misalignedDoublePipePatternOffsetTiles:
          this.misalignedDoublePipePatternOffsetTiles,
      });

      for (const item of spawnPlan.items) {
        const pair = this.createManagedPipePair(pipeAssets);
        this.configurePipePair(pair, {
          pipeAssets,
          item,
        });
        this.resetPairTracking(pair);
        this.pipePool.push(pair);

        if (this.pipesPairs.length + this.pipePool.length >= targetCount) {
          break;
        }
      }
    }
  }

  /**
   * 파이프 쌍을 생성합니다.
   */
  private createPipePattern(): number {
    const pipeAssets = this.resolvePipeAssetsContext();
    const spawnPlan = buildPipeSpawnPlan({
      tileSize: pipeAssets.tileSize,
      availableHeight: this.app.screen.height - this.groundHeight,
      passageHeightMinRatio: this.passageHeightMinRatio,
      passageHeightMaxRatio: this.passageHeightMaxRatio,
      passagePositionExpansionTiles: this.passagePositionExpansionTiles,
      doublePipePatternChance: this.doublePipePatternChance,
      doublePipePatternGapTileOptions: this.doublePipePatternGapTileOptions,
      misalignedDoublePipePatternChance:
        this.misalignedDoublePipePatternChance,
      misalignedDoublePipePatternOffsetTiles:
        this.misalignedDoublePipePatternOffsetTiles,
    });

    for (const item of spawnPlan.items) {
      this.createPipePair({
        pipeAssets,
        item,
      });
    }

    return spawnPlan.items.length;
  }

  /**
   * 파이프 쌍을 생성합니다.
   */
  private createPipePair(options: {
    pipeAssets: PipeAssetsContext;
    item: PipeSpawnPlanItem;
  }): void {
    const { pipeAssets, item } = options;
    const pair = this.acquirePipePair({
      pipeAssets,
      item,
    });

    this.pipes.addChild(pair.top);
    this.pipes.addChild(pair.bottom);

    this.physicsManager.addToEngine(null, pair.topBody, {
      syncDisplay: false,
    });
    this.physicsManager.addToEngine(null, pair.bottomBody, {
      syncDisplay: false,
    });
    this.syncPipeDisplayObject(pair.top, pair.topBody);
    this.syncPipeDisplayObject(pair.bottom, pair.bottomBody);

    this.pipesPairs.push(pair);
  }

  /**
   * 파이프 쌍 오브젝트를 준비합니다.
   */
  private acquirePipePair(options: {
    pipeAssets: PipeAssetsContext;
    item: PipeSpawnPlanItem;
  }): ManagedPipePair {
    const { pipeAssets, item } = options;
    const pair = this.pipePool.pop();
    const existingPair = pair ?? this.createManagedPipePair(pipeAssets);

    this.configurePipePair(existingPair, {
      pipeAssets,
      item,
    });
    this.resetPairTracking(existingPair);
    return existingPair;
  }

  /**
   * 파이프를 이동시키는 메서드
   */
  private movePipes(
    playerBody: Matter.Body,
    onScoreUpdate: (scoreDelta: number) => void,
    deltaTime: number,
    onPlayerCollision?: () => void,
  ): void {
    this.speed = smoothFlappyBirdSpeed(this.speed, this.targetSpeed, deltaTime);
    const movementStep = this.speed * resolveFrameScale(deltaTime);
    const removalIndexes: number[] = [];

    for (let i = 0; i < this.pipesPairs.length; i++) {
      const pair = this.pipesPairs[i];

      this.physicsManager.translateBody(pair.topBody, {
        x: -movementStep,
        y: 0,
      });
      this.physicsManager.translateBody(pair.bottomBody, {
        x: -movementStep,
        y: 0,
      });
      this.syncPipeDisplayObject(pair.top, pair.topBody);
      this.syncPipeDisplayObject(pair.bottom, pair.bottomBody);

      if (this.hasPairCollidedWithPlayer(pair, playerBody)) {
        onPlayerCollision?.();
        return;
      }

      this.trackNearMissClearances(pair, playerBody);

      if (this.hasPairPassedPlayer(pair, playerBody) && !pair.passed) {
        pair.passed = true;
        onScoreUpdate(1 + this.getNearMissBonus(pair, playerBody));
      }

      if (pair.topBody.position.x < -pair.top.width) {
        removalIndexes.push(i);
      }
    }

    for (let index = removalIndexes.length - 1; index >= 0; index -= 1) {
      const pairIndex = removalIndexes[index];
      if (typeof pairIndex === "number") {
        this.removePipePair(pairIndex);
      }
    }
  }

  private hasPairCollidedWithPlayer(
    pair: PipePair,
    playerBody: Matter.Body,
  ): boolean {
    return (
      Matter.Collision.collides(pair.topBody, playerBody) !== null ||
      Matter.Collision.collides(pair.bottomBody, playerBody) !== null
    );
  }

  /**
   * 특정 인덱스의 파이프 쌍을 제거합니다.
   */
  private removePipePair(index: number): void {
    const pair = this.pipesPairs[index];

    if (!pair) {
      return;
    }

    this.physicsManager.removeFromEngine(pair.topBody);
    this.physicsManager.removeFromEngine(pair.bottomBody);
    this.releasePipePair(pair);
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
    this.elapsedSinceLastPipeSpawnMs = this.pipeSpawnInterval;
  }

  public destroy(): void {
    this.clearAllPipes();

    for (const pair of this.pipePool) {
      pair.top.destroy({ children: true });
      pair.bottom.destroy({ children: true });
    }

    this.pipePool = [];
  }

  public applyDifficulty(options: FlappyBirdDifficultyState): void {
    this.targetSpeed = options.pipeSpeed;
    this.targetPipeSpawnInterval = options.pipeSpawnInterval;

    if (this.pipesPairs.length === 0) {
      this.pipeSpawnInterval = options.pipeSpawnInterval;
    }

    this.passageHeightMinRatio = options.passageHeightMinRatio;
    this.passageHeightMaxRatio = options.passageHeightMaxRatio;
    this.passagePositionExpansionTiles = options.passagePositionExpansionTiles;
    this.doublePipePatternChance = options.doublePipePatternChance;
    this.doublePipePatternGapTileOptions =
      options.doublePipePatternGapTileOptions;
    this.misalignedDoublePipePatternChance =
      options.misalignedDoublePipePatternChance;
    this.misalignedDoublePipePatternOffsetTiles =
      options.misalignedDoublePipePatternOffsetTiles;
  }

  /**
   * 파이프 컨테이너를 반환합니다.
   */
  public getContainer(): PIXI.Container {
    return this.pipes;
  }

  public getActivePairCount(): number {
    return this.pipesPairs.length;
  }

  private createPipeContainer(options: {
    height: number;
    tileSize: number;
    pipeBodyTexture: PIXI.Texture;
    pipeEndTexture: PIXI.Texture;
    position: "top" | "bottom";
  }): PipeDisplayContainer {
    const {
      tileSize,
      pipeBodyTexture,
      pipeEndTexture,
      position,
    } = options;
    const pipe = new PIXI.Container() as PipeDisplayContainer;
    const shaft = new PIXI.TilingSprite({
      texture: pipeBodyTexture,
      width: tileSize,
      height: 1,
    });
    pipe.__flappyPipeShaft = shaft;
    pipe.__flappyPipePosition = position;
    pipe.addChild(shaft);
    const endCap = new PIXI.Sprite(pipeEndTexture);
    pipe.__flappyPipeEndCap = endCap;
    endCap.anchor.set(0.5);
    pipe.addChild(endCap);
    this.configurePipeContainer(pipe, options);
    return pipe;
  }

  private configurePipeContainer(
    pipe: PipeDisplayContainer,
    options: {
      height: number;
      tileSize: number;
      pipeBodyTexture: PIXI.Texture;
      pipeEndTexture: PIXI.Texture;
      position: "top" | "bottom";
    },
  ): void {
    const {
      height,
      tileSize,
      pipeBodyTexture,
      pipeEndTexture,
      position,
    } = options;
    const shaft = pipe.__flappyPipeShaft;
    const endCap = pipe.__flappyPipeEndCap;

    if (!shaft || !endCap) {
      return;
    }

    const shaftHeight = Math.max(0, height - tileSize);
    shaft.texture = pipeBodyTexture;
    shaft.width = tileSize;
    shaft.height = Math.max(1, shaftHeight);
    shaft.visible = shaftHeight > 0;
    shaft.position.set(0, position === "top" ? 0 : tileSize);
    shaft.tileScale.set(
      tileSize / pipeBodyTexture.frame.width,
      tileSize / pipeBodyTexture.frame.height,
    );

    endCap.texture = pipeEndTexture;
    endCap.width = tileSize;
    endCap.height = tileSize;
    endCap.position.set(
      tileSize / 2,
      position === "top" ? height - tileSize / 2 : tileSize / 2,
    );
    endCap.rotation = position === "top" ? Math.PI : 0;
    pipe.__flappyPipePosition = position;
  }

  private resolvePipeAssetsContext(): PipeAssetsContext {
    const assets = AssetLoader.getAssets();
    const tilesetSprites = assets.tilesetSprites;
    const pipeBodyTexture = tilesetSprites?.textures["pipe-body"];
    const pipeEndTexture = tilesetSprites?.textures["pipe-end"];

    if (!pipeBodyTexture || !pipeEndTexture) {
      throw new Error("Pipe textures not found in assets");
    }

    return {
      tileSize: Math.max(
        1,
        Math.round(
          pipeBodyTexture.frame.width *
            FLAPPY_BIRD_OBJECT_SCALE *
            FLAPPY_BIRD_PIPE_TILE_SCALE,
        ),
      ),
      pipeBodyTexture,
      pipeEndTexture,
    };
  }

  private createManagedPipePair(
    pipeAssets: PipeAssetsContext,
  ): ManagedPipePair {
    const { tileSize, pipeBodyTexture, pipeEndTexture } = pipeAssets;
    const top = this.createPipeContainer({
      height: tileSize,
      tileSize,
      pipeBodyTexture,
      pipeEndTexture,
      position: "top",
    });
    const bottom = this.createPipeContainer({
      height: tileSize,
      tileSize,
      pipeBodyTexture,
      pipeEndTexture,
      position: "bottom",
    });
    const topBody = this.createPipeBody({
      width: tileSize,
      height: tileSize,
      x: 0,
      y: 0,
    });
    const bottomBody = this.createPipeBody({
      width: tileSize,
      height: tileSize,
      x: 0,
      y: 0,
    });

    return {
      top,
      bottom,
      topBody,
      bottomBody,
      passed: false,
      minTopClearance: Number.POSITIVE_INFINITY,
      minBottomClearance: Number.POSITIVE_INFINITY,
    };
  }

  private createPipeBody(options: {
    width: number;
    height: number;
    x: number;
    y: number;
  }): Matter.Body {
    const collisionBodySize = resolvePipeCollisionBodySize(
      options.width,
      options.height,
    );
    const body = this.physicsManager.createRectangleBody(
      options.x,
      options.y,
      collisionBodySize.width,
      collisionBodySize.height,
      { isStatic: true, label: "pipe" },
    ) as PipeBodyWithMetrics;
    body.__flappyPipeWidth = collisionBodySize.width;
    body.__flappyPipeHeight = collisionBodySize.height;
    return body;
  }

  private configurePipePair(
    pair: ManagedPipePair,
    options: {
      pipeAssets: PipeAssetsContext;
      item: PipeSpawnPlanItem;
    },
  ): void {
    const { pipeAssets, item } = options;
    const { tileSize, pipeBodyTexture, pipeEndTexture } = pipeAssets;

    this.configurePipeContainer(pair.top as PipeDisplayContainer, {
      height: item.topPipeHeight,
      tileSize,
      pipeBodyTexture,
      pipeEndTexture,
      position: "top",
    });
    this.configurePipeContainer(pair.bottom as PipeDisplayContainer, {
      height: item.bottomPipeHeight,
      tileSize,
      pipeBodyTexture,
      pipeEndTexture,
      position: "bottom",
    });

    const topBodyX =
      this.app.screen.width + tileSize / 2 + item.xOffsetTiles * tileSize;
    const topBodyY = item.topPipeHeight / 2;
    const bottomBodyX = topBodyX;
    const bottomBodyY =
      item.topPipeHeight +
      item.passageHeight +
      item.bottomPipeHeight / 2 +
      tileSize / 2;

    this.configurePipeBody(pair.topBody as PipeBodyWithMetrics, {
      width: tileSize,
      height: item.topPipeHeight,
      x: topBodyX,
      y: topBodyY,
    });
    this.configurePipeBody(pair.bottomBody as PipeBodyWithMetrics, {
      width: tileSize,
      height: item.bottomPipeHeight,
      x: bottomBodyX,
      y: bottomBodyY,
    });
  }

  private configurePipeBody(
    body: PipeBodyWithMetrics,
    options: {
      width: number;
      height: number;
      x: number;
      y: number;
    },
  ): void {
    const collisionBodySize = resolvePipeCollisionBodySize(
      options.width,
      options.height,
    );
    const targetWidth = collisionBodySize.width;
    const targetHeight = collisionBodySize.height;
    const currentWidth =
      body.__flappyPipeWidth ?? body.bounds.max.x - body.bounds.min.x;
    const currentHeight =
      body.__flappyPipeHeight ?? body.bounds.max.y - body.bounds.min.y;

    if (
      Math.abs(currentWidth - targetWidth) > 0.01 ||
      Math.abs(currentHeight - targetHeight) > 0.01
    ) {
      Matter.Body.scale(
        body,
        targetWidth / Math.max(1, currentWidth),
        targetHeight / Math.max(1, currentHeight),
      );
    }

    body.__flappyPipeWidth = targetWidth;
    body.__flappyPipeHeight = targetHeight;
    this.physicsManager.setPosition(body, {
      x: options.x,
      y: options.y,
    });
  }

  private releasePipePair(pair: ManagedPipePair): void {
    if (pair.top.parent) {
      pair.top.parent.removeChild(pair.top);
    }

    if (pair.bottom.parent) {
      pair.bottom.parent.removeChild(pair.bottom);
    }

    this.resetPairTracking(pair);
    this.pipePool.push(pair);
  }

  private resetPairTracking(pair: ManagedPipePair): void {
    pair.passed = false;
    pair.minTopClearance = Number.POSITIVE_INFINITY;
    pair.minBottomClearance = Number.POSITIVE_INFINITY;
  }

  private syncPipeDisplayObject(
    displayObject: PIXI.Container,
    body: Matter.Body,
  ): void {
    displayObject.position.x = body.bounds.min.x;
    displayObject.position.y = body.bounds.min.y;
  }

  private getNearMissBonus(pair: PipePair, playerBody: Matter.Body): number {
    const playerHeight = playerBody.bounds.max.y - playerBody.bounds.min.y;
    const trackedClearance = Math.min(
      pair.minTopClearance,
      pair.minBottomClearance,
    );

    const { topClearance, bottomClearance } = this.resolveGapClearances(
      pair,
      playerBody,
    );
    const currentClearance = Math.min(topClearance, bottomClearance);

    return resolveNearMissBonusTier({
      playerHeight,
      trackedClearance,
      currentClearance,
    });
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
  private lastStableBirdPosition: { x: number; y: number } | null = null;

  constructor(
    app: PIXI.Application,
    physicsManager: PhysicsManager,
    characterKey: CharacterKey,
    entryCharacterState: CharacterState | null = null,
  ) {
    this.app = app;
    this.physicsManager = physicsManager;

    const assets = AssetLoader.getAssets();

    // 바구니 초기화
    this.initializeBasket(characterKey, entryCharacterState, assets);

    // 새(버드) 초기화
    this.initializeBird(assets.birdSprites);
  }

  /**
   * 바구니를 초기화합니다.
   */
  private initializeBasket(
    characterKey: CharacterKey,
    entryCharacterState: CharacterState | null,
    assets: GameAssets,
  ): void {
    const characterSpritesheet = assets.characterSprites[characterKey];
    if (!characterSpritesheet) {
      throw new Error(
        `Character spritesheet not found for key: ${characterKey}`,
      );
    }

    const defaultInBasketTexture = characterSpritesheet.textures["in-basket"];
    const tombInBasketTexture =
      assets.common32x32Sprites?.textures["tomb-in-basket"];
    const inBasketTexture =
      entryCharacterState === CharacterState.DEAD && tombInBasketTexture
        ? tombInBasketTexture
        : defaultInBasketTexture;

    if (!inBasketTexture) {
      throw new Error(
        `In-basket texture not found for character key: ${characterKey}`,
      );
    }

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
      this.bird.position.x = this.basket.position.x + this.basket.width * 0.1;
      this.bird.position.y = this.basket.position.y - this.basket.height * 0.9;
      this.lastStableBirdPosition = {
        x: this.bird.position.x,
        y: this.bird.position.y,
      };
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

  public getBirdPositionSnapshot(): { x: number; y: number } | null {
    if (!this.bird) {
      return null;
    }

    return {
      x: this.bird.position.x,
      y: this.bird.position.y,
    };
  }

  public getLastStableBirdPositionSnapshot(): { x: number; y: number } | null {
    if (this.lastStableBirdPosition === null) {
      return this.getBirdPositionSnapshot();
    }

    return {
      x: this.lastStableBirdPosition.x,
      y: this.lastStableBirdPosition.y,
    };
  }

  public setBirdPosition(position: { x: number; y: number }): void {
    if (!this.bird) {
      return;
    }

    this.bird.position.set(position.x, position.y);
  }

  public clampBasketBottomTo(maxBottomY: number): void {
    const basketRadius =
      typeof this.basketBody.circleRadius === "number"
        ? this.basketBody.circleRadius
        : this.basket.width / 2;
    const clampedCenterY = maxBottomY - basketRadius;

    if (this.basketBody.position.y <= clampedCenterY) {
      return;
    }

    this.physicsManager.setPosition(this.basketBody, {
      x: this.basketBody.position.x,
      y: clampedCenterY,
    });
    this.physicsManager.setVelocity(this.basketBody, { x: 0, y: 0 });
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
