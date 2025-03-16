import * as PIXI from "pixi.js";
import * as Matter from "matter-js";

export class GameEngine {
  private physics: Matter.Engine;
  private isRunning: boolean = false;
  private gameObjects: { sprite: PIXI.Sprite; body: Matter.Body }[] = [];
  private pixiApp: PIXI.Application | null = null;
  private _frameCount: number = 0;
  private physicsUpdateBound: (delta: number) => void; // 바인딩된 physicsUpdate 메서드

  constructor(width: number = 800, height: number = 600) {
    // Matter.js 엔진 생성
    this.physics = Matter.Engine.create({
      gravity: { x: 0, y: 2.5 },
      enableSleeping: false,
    });

    // 세계 경계 설정
    this.physics.world.bounds = {
      min: { x: 0, y: 0 },
      max: { x: width, y: height },
    };

    // physicsUpdate 메서드를 바인딩하여 저장
    this.physicsUpdateBound = this.physicsUpdate.bind(this);
  }

  public initialize(app: PIXI.Application): void {
    // PIXI 앱 저장
    this.pixiApp = app;
    this.isRunning = true;

    // 디버그 로그
    console.log("[GameEngine] 초기화 시작");

    if (this.pixiApp) {
      // 이미 등록된 콜백 제거
      this.pixiApp.ticker.remove(this.physicsUpdateBound);

      // PIXI 티커 상태 확인
      console.log("[GameEngine] PIXI 티커 상태:", {
        started: this.pixiApp.ticker.started,
        minFPS: this.pixiApp.ticker.minFPS,
        maxFPS: this.pixiApp.ticker.maxFPS,
        speed: this.pixiApp.ticker.speed,
      });

      // 바인딩된 함수 참조를 사용하여 콜백 등록
      this.pixiApp.ticker.add(
        this.physicsUpdateBound,
        null,
        PIXI.UPDATE_PRIORITY.HIGH
      );

      this.pixiApp.ticker.start();

      console.log("[GameEngine] 초기화 완료");
    } else {
      console.warn("[GameEngine] PIXI 앱이 제공되지 않음");
    }
  }

  // 물리 업데이트 함수
  private physicsUpdate(delta: number): void {
    // 중단 상태면 업데이트 안함
    if (!this.isRunning || !this.pixiApp) return;

    try {
      // 물리 엔진 업데이트
      Matter.Engine.update(this.physics, this.pixiApp.ticker.deltaMS);

      // 스프라이트 위치 동기화
      this.syncSprites();
    } catch (error) {
      console.error("[Physics] 물리 업데이트 오류:", error);
    }
  }

  // 스프라이트 동기화
  private syncSprites(): void {
    for (const obj of this.gameObjects) {
      if (!obj.sprite || !obj.body) continue;

      // 위치 동기화
      obj.sprite.position.x = obj.body.position.x;
      obj.sprite.position.y = obj.body.position.y;

      // 회전 동기화 (정적이 아닌 객체)
      if (!obj.body.isStatic) {
        obj.sprite.rotation = obj.body.angle;
      }
    }
  }

  public addGameObject(sprite: PIXI.Sprite, body: Matter.Body): void {
    // 새(bird) 객체인 경우 명시적인 물리 속성 설정
    if (body.label === "bird") {
      // 정적 상태 비활성화
      body.isStatic = false;

      // 새 물리 속성 재정의
      Matter.Body.set(body, {
        inertia: Infinity, // 회전 방지
        friction: 0.0, // 마찰 없음
        frictionAir: 0.01, // 저항 설정
        restitution: 0.0, // 튕김 없음
        density: 0.01, // 밀도
      });
    }

    // 물리 월드에 바디 추가
    Matter.Composite.add(this.physics.world, body);

    // 스프라이트 위치 초기화
    sprite.position.x = body.position.x;
    sprite.position.y = body.position.y;

    // 객체 배열에 추가
    this.gameObjects.push({ sprite, body });

    // 객체가 추가될 때마다 프레임 카운터 초기화
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

    // 티커에서 바인딩된 콜백 제거
    if (this.pixiApp) {
      this.pixiApp.ticker.remove(this.physicsUpdateBound);
    }

    // 물리 엔진 객체 정리
    for (const obj of this.gameObjects) {
      Matter.Composite.remove(this.physics.world, obj.body);
    }
    this.gameObjects = [];

    // 물리 엔진 정리
    Matter.Engine.clear(this.physics);

    // 물리 엔진 재초기화
    this.physics = Matter.Engine.create({
      gravity: { x: 0, y: 2.5 },
      enableSleeping: false,
    });
  }

  // 화면 크기 조정 메서드 추가
  public resize(width: number, height: number) {
    // 물리 엔진의 크기 제약 조건 업데이트
    const bounds = this.physics.world.bounds;
    if (bounds) {
      bounds.max.x = width;
      bounds.max.y = height;
    }
  }

  // 엔진 접근자 추가 (물리 연산에 필요)
  public getPhysicsEngine(): Matter.Engine {
    return this.physics;
  }
}
