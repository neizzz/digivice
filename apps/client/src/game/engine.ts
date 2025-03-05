import * as PIXI from "pixi.js";
import * as Matter from "matter-js";

export class GameEngine {
  private app: PIXI.Application;
  private physics: Matter.Engine;
  private runner: Matter.Runner;
  private isRunning: boolean = false;
  private gameObjects: { sprite: PIXI.Sprite; body: Matter.Body }[] = [];

  constructor(width: number = 800, height: number = 600) {
    // PIXI 앱 설정
    this.app = new PIXI.Application({
      width,
      height,
      backgroundColor: 0x1099bb,
      antialias: false, // 저사양 환경에서는 안티알리아싱을 끄는 것이 좋습니다
    });

    // Matter.js 물리 엔진 설정
    this.physics = Matter.Engine.create({
      gravity: { x: 0, y: 1 },
      enableSleeping: true, // 움직임이 없는 객체는 연산에서 제외
    });

    this.runner = Matter.Runner.create({
      isFixed: true,
    });
  }

  public initialize(container: HTMLElement): void {
    container.appendChild(this.app.view as HTMLCanvasElement);
    Matter.Runner.run(this.runner, this.physics);
    this.isRunning = true;

    // 메인 게임 루프 설정
    this.app.ticker.add(this.update.bind(this));
  }

  private update(delta: number): void {
    if (!this.isRunning) return;

    // 여기서 게임 업데이트 로직 실행
    // delta는 마지막 프레임 이후 경과된 시간
  }

  public addGameObject(sprite: PIXI.Sprite, body: Matter.Body): void {
    this.app.stage.addChild(sprite);
    Matter.Composite.add(this.physics.world, body);
  }

  public pause(): void {
    this.isRunning = false;
    Matter.Runner.stop(this.runner);
    this.app.ticker.stop();
  }

  public resume(): void {
    this.isRunning = true;
    Matter.Runner.run(this.runner, this.physics);
    this.app.ticker.start();
  }

  public cleanup(): void {
    this.pause();
    this.app.destroy(true, {
      children: true,
      texture: true,
      baseTexture: true,
    });
    Matter.Engine.clear(this.physics);
  }

  // 화면 크기 조정 메서드 추가
  public resize(width: number, height: number) {
    this.app.renderer.resize(width, height);

    // 필요하다면 물리 엔진의 크기 제약 조건도 업데이트
    const bounds = this.physics.world.bounds;
    if (bounds) {
      bounds.max.x = width;
      bounds.max.y = height;
    }
  }
}
