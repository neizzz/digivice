import * as PIXI from "pixi.js";
import * as Matter from "matter-js";
import { GameEngine } from "../../GameEngine";

/**
 * 물리 시스템 관리 클래스
 */
export class PhysicsManager {
  private gameEngine: GameEngine;
  private debugRenderer: Matter.Render;
  private debugMode: boolean = false;

  constructor(gameEngine: GameEngine) {
    this.gameEngine = gameEngine;
  }

  /**
   * 물리 바디를 생성합니다.
   */
  public createCircleBody(
    x: number,
    y: number,
    radius: number,
    options: Matter.IBodyDefinition = {}
  ): Matter.Body {
    return Matter.Bodies.circle(x, y, radius, options);
  }

  /**
   * 사각형 물리 바디를 생성합니다.
   */
  public createRectangleBody(
    x: number,
    y: number,
    width: number,
    height: number,
    options: Matter.IBodyDefinition = {}
  ): Matter.Body {
    return Matter.Bodies.rectangle(x, y, width, height, options);
  }

  /**
   * 물체를 물리 엔진에 추가합니다.
   */
  public addToEngine(sprite: PIXI.Sprite, body: Matter.Body): void {
    this.gameEngine.addGameObject(sprite, body);
  }

  /**
   * 물체를 물리 엔진에서 제거합니다.
   */
  public removeFromEngine(body: Matter.Body): void {
    Matter.Composite.remove(this.gameEngine.getPhysicsEngine().world, body);
  }

  /**
   * 물체를 특정 방향으로 이동시킵니다.
   */
  public translateBody(
    body: Matter.Body,
    translation: { x: number; y: number }
  ): void {
    Matter.Body.translate(body, translation);
  }

  /**
   * 물체의 속도를 설정합니다.
   */
  public setVelocity(
    body: Matter.Body,
    velocity: { x: number; y: number }
  ): void {
    Matter.Body.setVelocity(body, velocity);
  }

  /**
   * 물체의 위치를 설정합니다.
   */
  public setPosition(
    body: Matter.Body,
    position: { x: number; y: number }
  ): void {
    Matter.Body.setPosition(body, position);
  }

  /**
   * 충돌 이벤트 리스너를 설정합니다.
   */
  public setupCollisionListener(
    callback: (bodyA: Matter.Body, bodyB: Matter.Body) => void
  ): void {
    Matter.Events.on(
      this.gameEngine.getPhysicsEngine(),
      "collisionStart",
      (event) => {
        const pairs = event.pairs;
        for (let i = 0; i < pairs.length; i++) {
          const pair = pairs[i];
          callback(pair.bodyA, pair.bodyB);
        }
      }
    );
  }

  /**
   * 디버그 모드를 전환합니다.
   */
  public toggleDebugMode(app: PIXI.Application): boolean {
    this.debugMode = !this.debugMode;

    if (this.debugMode) {
      this.setupDebugRenderer(app);
    } else {
      this.cleanupDebugRenderer();
    }

    return this.debugMode;
  }

  /**
   * 디버그 렌더러를 설정합니다.
   */
  public setupDebugRenderer(app: PIXI.Application): void {
    this.cleanupDebugRenderer();

    const brightGreen = "#26ff00";

    this.debugRenderer = Matter.Render.create({
      engine: this.gameEngine.getPhysicsEngine(),
      options: {
        width: app.screen.width,
        height: app.screen.height,
        wireframes: true,
        showBounds: true,
        showCollisions: true,
        showVelocity: true,
        showAngleIndicator: true,
        wireframeBackground: "transparent",
        showPositions: true,
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

  /**
   * 디버그 렌더러를 정리합니다.
   */
  public cleanupDebugRenderer(): void {
    if (this.debugRenderer) {
      Matter.Render.stop(this.debugRenderer);
      this.debugRenderer = null;
    }
  }

  /**
   * 디버그 렌더러 크기를 업데이트합니다.
   */
  public updateDebugRendererSize(width: number, height: number): void {
    if (this.debugMode && this.debugRenderer) {
      this.debugRenderer.options.width = width;
      this.debugRenderer.options.height = height;
    }
  }

  /**
   * 디버그 모드 상태를 반환합니다.
   */
  public isDebugMode(): boolean {
    return this.debugMode;
  }

  /**
   * 물리 엔진을 정리합니다.
   */
  public cleanup(): void {
    this.cleanupDebugRenderer();
  }
}
