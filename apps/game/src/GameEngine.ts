import * as PIXI from "pixi.js";
import * as Matter from "matter-js";

export class GameEngine {
  private physics: Matter.Engine;
  private isRunning = false;
  private gameObjects: {
    displayObject: PIXI.Sprite | PIXI.Container;
    body: Matter.Body;
  }[] = [];
  private pixiApp: PIXI.Application | null = null;
  private _frameCount = 0;
  private physicsUpdateBound: (delta: number) => void;

  constructor(width: number, height: number) {
    this.physics = Matter.Engine.create({
      gravity: { x: 0, y: 2.5 },
      enableSleeping: false,
    });

    this.physics.world.bounds = {
      min: { x: 0, y: 0 },
      max: { x: width, y: height },
    };

    // tick은 밀리초 단위의 델타타임을 나타냄
    this.physicsUpdateBound = (tick: number) => {
      this.physicsUpdate(tick * PIXI.Ticker.shared.deltaMS);
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
        PIXI.UPDATE_PRIORITY.HIGH
      );

      this.pixiApp.ticker.start();
    }
  }

  private physicsUpdate(delta: number): void {
    if (!this.isRunning || !this.pixiApp) return;

    try {
      Matter.Engine.update(this.physics, delta);
      this.syncDisplayObjects();
    } catch (error) {
      console.error("[Physics] 물리 업데이트 오류:", error);
    }
  }

  private syncDisplayObjects(): void {
    for (const obj of this.gameObjects) {
      if (!obj.displayObject || !obj.body) continue;

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

  public addGameObject(
    displayObject: PIXI.Sprite | PIXI.Container,
    body: Matter.Body
  ): void {
    Matter.Composite.add(this.physics.world, body);
    this.gameObjects.push({ displayObject, body });
    this._frameCount = 0;
  }

  public pause(): void {
    this.isRunning = false;
  }

  public resume(): void {
    this.isRunning = true;
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

    Matter.Engine.clear(this.physics);

    this.physics = Matter.Engine.create({
      gravity: { x: 0, y: 2.5 },
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
}
