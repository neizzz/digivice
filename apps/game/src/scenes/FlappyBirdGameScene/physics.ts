import * as PIXI from "pixi.js";
import * as Matter from "matter-js";
import { GameEngine } from "../../GameEngine";

/**
 * 물리 시스템 관리 클래스
 */
export class PhysicsManager {
  private gameEngine: GameEngine;
  private debugRenderer?: Matter.Render;
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
  public addToEngine(
    displayObject: PIXI.Sprite | PIXI.Container,
    body: Matter.Body
  ): void {
    this.gameEngine.addGameObject(displayObject, body);

    if (body.label === "basket") {
      Matter.Body.set(body, {
        inertia: Infinity,
        friction: 0.0,
        frictionAir: 0.01,
        restitution: 0.0,
        density: 0.01,
      });
    }
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
   * 디버그 렌더러를 설정합니다.
   */
  public setupDebugRenderer(app: PIXI.Application): void {
    this.cleanupDebugRenderer();

    // 더 밝고 눈에 띄는 색상 사용
    const highlightColor = "#FF00FF"; // 밝은 마젠타

    // 디버그 렌더러용 canvas 요소 생성
    const canvas = document.createElement("canvas");
    canvas.width = app.screen.width;
    canvas.height = app.screen.height;
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.pointerEvents = "none";

    const gameContainer = document.getElementById(
      "game-container"
    ) as HTMLDivElement;
    gameContainer.appendChild(canvas);

    this.debugRenderer = Matter.Render.create({
      canvas,
      engine: this.gameEngine.getPhysicsEngine(),
      options: {
        width: app.screen.width,
        height: app.screen.height,
        wireframes: true, // 실제 스타일 사용
        showBounds: true,
        showCollisions: true,
        showVelocity: true,
        showAngleIndicator: true,
        // background: "rgba(0, 0, 0, 0.1)", // 약간의 배경색 추가
        showPositions: true,
        wireframeBackground: "transparent",
        wireframeStrokeStyle: highlightColor,
        lineWidth: 2, // 더 두꺼운 선
        collisionStrokeStyle: highlightColor,
        boundsStrokeStyle: highlightColor,
        constraintStrokeStyle: highlightColor,
        // showSleeping: true,
        // showIds: true, // ID 표시
        // showVertexNumbers: true, // 꼭지점 번호 표시
        // showConvexHulls: true,
        zIndex: 1000,
      },
    });

    this.debugMode = true;
    Matter.Render.run(this.debugRenderer);
  }

  /**
   * 디버그 렌더러를 정리합니다.
   */
  public cleanupDebugRenderer(): void {
    if (this.debugRenderer) {
      // canvas 요소를 DOM에서 제거
      if (
        this.debugRenderer.canvas &&
        this.debugRenderer.canvas.parentElement
      ) {
        this.debugRenderer.canvas.parentElement.removeChild(
          this.debugRenderer.canvas
        );
      }
      Matter.Render.stop(this.debugRenderer);
      this.debugRenderer = undefined;
      this.debugMode = false;
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
   * 디버그 모드를 토글합니다.
   */
  public toggleDebugMode(app: PIXI.Application): void {
    if (this.debugMode) {
      this.cleanupDebugRenderer();
    } else {
      this.setupDebugRenderer(app);
    }
  }

  /**
   * 물리 엔진을 정리합니다.
   */
  public cleanup(): void {
    this.cleanupDebugRenderer();
  }
}
