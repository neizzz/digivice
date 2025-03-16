import * as PIXI from "pixi.js";
import * as Matter from "matter-js";

export class GameEngine {
  private physics: Matter.Engine;
  private isRunning: boolean = false;
  private gameObjects: { sprite: PIXI.Sprite; body: Matter.Body }[] = [];
  private pixiApp: PIXI.Application | null = null;
  private _frameCount: number = 0;
  private physicsUpdateBound: (delta: number) => void;

  constructor(width: number = 800, height: number = 600) {
    this.physics = Matter.Engine.create({
      gravity: { x: 0, y: 2.5 },
      enableSleeping: false,
    });

    this.physics.world.bounds = {
      min: { x: 0, y: 0 },
      max: { x: width, y: height },
    };

    this.physicsUpdateBound = this.physicsUpdate.bind(this);
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
      Matter.Engine.update(this.physics, this.pixiApp.ticker.deltaMS);
      this.syncSprites();
    } catch (error) {
      console.error("[Physics] 물리 업데이트 오류:", error);
    }
  }

  private syncSprites(): void {
    for (const obj of this.gameObjects) {
      if (!obj.sprite || !obj.body) continue;

      obj.sprite.position.x = obj.body.position.x;
      obj.sprite.position.y = obj.body.position.y;

      if (!obj.body.isStatic) {
        obj.sprite.rotation = obj.body.angle;
      }
    }
  }

  public addGameObject(sprite: PIXI.Sprite, body: Matter.Body): void {
    if (body.label === "bird") {
      body.isStatic = false;

      Matter.Body.set(body, {
        inertia: Infinity,
        friction: 0.0,
        frictionAir: 0.01,
        restitution: 0.0,
        density: 0.01,
      });
    }

    Matter.Composite.add(this.physics.world, body);

    sprite.position.x = body.position.x;
    sprite.position.y = body.position.y;

    this.gameObjects.push({ sprite, body });
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
