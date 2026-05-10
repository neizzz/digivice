import * as PIXI from "pixi.js";
import * as Matter from "matter-js";

export type GameEnginePhysicsPerfSample = {
  timestampMs: number;
  deltaMs: number;
  engineUpdateCostMs: number;
  syncDisplayCostMs: number;
  totalCostMs: number;
  trackedObjectCount: number;
  syncedDisplayObjectCount: number;
};

const GAME_ENGINE_FIXED_TIMESTEP_MS = 1000 / 60;
const GAME_ENGINE_MAX_TIMESTEP_MS = 1000 / 30;
const GAME_ENGINE_MAX_SUBSTEPS = 2;

type GameEnginePerfHooks = {
  onPhysicsStep?: (sample: GameEnginePhysicsPerfSample) => void;
};

function getPerfNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export class GameEngine {
  private physics: Matter.Engine;
  private isRunning = false;
  private gameObjects: {
    displayObject: PIXI.Sprite | PIXI.Container | null;
    body: Matter.Body;
    syncDisplay: boolean;
  }[] = [];
  private pixiApp: PIXI.Application | null = null;
  private physicsUpdateBound: (ticker: PIXI.Ticker) => void;
  private readonly gravityY: number;
  private readonly perfHooks: GameEnginePerfHooks;
  private physicsAccumulatorMs = 0;

  constructor(
    width: number,
    height: number,
    gravityY = 2.5,
    perfHooks: GameEnginePerfHooks = {},
  ) {
    this.gravityY = gravityY;
    this.perfHooks = perfHooks;
    this.physics = Matter.Engine.create({
      gravity: { x: 0, y: this.gravityY },
      enableSleeping: false,
    });

    this.physics.world.bounds = {
      min: { x: 0, y: 0 },
      max: { x: width, y: height },
    };

    // tick은 밀리초 단위의 델타타임을 나타냄
    this.physicsUpdateBound = (ticker: PIXI.Ticker) => {
      this.physicsUpdate(ticker.deltaMS);
    };
  }

  public initialize(app: PIXI.Application): void {
    this.pixiApp = app;
    this.isRunning = true;

    if (this.pixiApp) {
      this.pixiApp.ticker.remove(this.physicsUpdateBound);

      this.pixiApp.ticker.add(
        this.physicsUpdateBound,
        null,
        PIXI.UPDATE_PRIORITY.HIGH,
      );

      this.pixiApp.ticker.start();
    }
  }

  private physicsUpdate(delta: number): void {
    if (!this.isRunning || !this.pixiApp) return;

    try {
      const clampedDeltaMs = Math.min(
        GAME_ENGINE_MAX_TIMESTEP_MS,
        Math.max(0, delta),
      );
      this.physicsAccumulatorMs = Math.min(
        this.physicsAccumulatorMs + clampedDeltaMs,
        GAME_ENGINE_FIXED_TIMESTEP_MS * (GAME_ENGINE_MAX_SUBSTEPS + 1),
      );

      let substeps = 0;
      let totalEngineUpdateCostMs = 0;
      let totalSyncDisplayCostMs = 0;
      let appliedDeltaMs = 0;

      while (
        this.physicsAccumulatorMs >= GAME_ENGINE_FIXED_TIMESTEP_MS &&
        substeps < GAME_ENGINE_MAX_SUBSTEPS
      ) {
        const startedAt = getPerfNow();
        Matter.Engine.update(this.physics, GAME_ENGINE_FIXED_TIMESTEP_MS);
        const afterEngineUpdate = getPerfNow();
        this.syncDisplayObjects();
        const afterSyncDisplay = getPerfNow();

        totalEngineUpdateCostMs += afterEngineUpdate - startedAt;
        totalSyncDisplayCostMs += afterSyncDisplay - afterEngineUpdate;
        appliedDeltaMs += GAME_ENGINE_FIXED_TIMESTEP_MS;
        this.physicsAccumulatorMs -= GAME_ENGINE_FIXED_TIMESTEP_MS;
        substeps += 1;
      }

      if (
        substeps === GAME_ENGINE_MAX_SUBSTEPS &&
        this.physicsAccumulatorMs >= GAME_ENGINE_FIXED_TIMESTEP_MS
      ) {
        this.physicsAccumulatorMs = Math.min(
          this.physicsAccumulatorMs,
          GAME_ENGINE_FIXED_TIMESTEP_MS,
        );
      }

      if (substeps === 0) {
        return;
      }

      this.perfHooks.onPhysicsStep?.({
        timestampMs: Date.now(),
        deltaMs: appliedDeltaMs,
        engineUpdateCostMs: totalEngineUpdateCostMs,
        syncDisplayCostMs: totalSyncDisplayCostMs,
        totalCostMs: totalEngineUpdateCostMs + totalSyncDisplayCostMs,
        trackedObjectCount: this.getTrackedObjectCount(),
        syncedDisplayObjectCount: this.getSyncedDisplayObjectCount(),
      });
    } catch (error) {
      console.error("[Physics] 물리 업데이트 오류:", error);
    }
  }

  private syncDisplayObjects(): void {
    for (const obj of this.gameObjects) {
      if (!obj.syncDisplay || !obj.displayObject || !obj.body) continue;

      if (obj.displayObject instanceof PIXI.Sprite) {
        // PIXI.Sprite
        obj.displayObject.position.x = obj.body.position.x;
        obj.displayObject.position.y = obj.body.position.y;
      } else {
        // PIXI.Container
        obj.displayObject.position.x = obj.body.bounds.min.x;
        obj.displayObject.position.y = obj.body.bounds.min.y;
      }

      if (!obj.body.isStatic) {
        obj.displayObject.rotation = obj.body.angle;
      }
    }
  }

  public syncDisplayObjectsNow(): void {
    this.syncDisplayObjects();
  }

  public addGameObject(
    displayObject: PIXI.Sprite | PIXI.Container | null,
    body: Matter.Body,
    options: {
      syncDisplay?: boolean;
    } = {},
  ): void {
    Matter.Composite.add(this.physics.world, body);
    this.gameObjects.push({
      displayObject,
      body,
      syncDisplay: options.syncDisplay ?? displayObject !== null,
    });
  }

  public removeGameObject(body: Matter.Body): void {
    Matter.Composite.remove(this.physics.world, body);
    this.gameObjects = this.gameObjects.filter((obj) => obj.body !== body);
  }

  public pause(): void {
    this.isRunning = false;
    this.physicsAccumulatorMs = 0;
  }

  public resume(): void {
    this.isRunning = true;
    this.physicsAccumulatorMs = 0;
  }

  public cleanup(): void {
    this.pause();

    if (this.pixiApp) {
      this.pixiApp.ticker.remove(this.physicsUpdateBound);
    }

    for (const obj of this.gameObjects) {
      Matter.Composite.remove(this.physics.world, obj.body);
    }
    this.gameObjects = [];
    this.physicsAccumulatorMs = 0;

    Matter.Engine.clear(this.physics);

    this.physics = Matter.Engine.create({
      gravity: { x: 0, y: this.gravityY },
      enableSleeping: false,
    });
  }

  public resize(width: number, height: number) {
    const bounds = this.physics.world.bounds;
    if (bounds) {
      bounds.max.x = width;
      bounds.max.y = height;
    }
  }

  public getPhysicsEngine(): Matter.Engine {
    return this.physics;
  }

  public getTrackedObjectCount(): number {
    return this.gameObjects.length;
  }

  public getSyncedDisplayObjectCount(): number {
    return this.gameObjects.filter((obj) => obj.syncDisplay).length;
  }
}
