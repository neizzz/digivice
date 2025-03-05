import * as PIXI from "pixi.js";

export enum MovementState {
  MOVING,
  IDLE,
}

export interface MovementOptions {
  minIdleTime?: number; // 최소 휴식 시간 (ms)
  maxIdleTime?: number; // 최대 휴식 시간 (ms)
  minMoveTime?: number; // 최소 이동 시간 (ms)
  maxMoveTime?: number; // 최대 이동 시간 (ms)
  moveSpeed?: number; // 이동 속도
  boundaryPadding?: number; // 화면 경계 여백
}

export class RandomMovementController {
  private sprite: PIXI.DisplayObject; // 더 일반적인 타입으로 변경
  private state: MovementState = MovementState.IDLE;
  private direction: PIXI.Point = new PIXI.Point(0, 0);
  private stateTimer: number = 0;
  private currentStateDuration: number = 0;
  private app: PIXI.Application;
  private bounds: PIXI.Rectangle;
  private originalScale: PIXI.Point;

  private options: MovementOptions = {
    minIdleTime: 1000,
    maxIdleTime: 3000,
    minMoveTime: 1000,
    maxMoveTime: 5000,
    moveSpeed: 2,
    boundaryPadding: 20,
  };

  constructor(
    sprite: PIXI.DisplayObject, // 더 일반적인 타입으로 변경
    app: PIXI.Application,
    options?: MovementOptions
  ) {
    this.sprite = sprite;
    this.app = app;

    // scale 속성이 있는지 확인
    if ("scale" in this.sprite) {
      this.originalScale = new PIXI.Point(
        (sprite.scale as PIXI.Point).x,
        (sprite.scale as PIXI.Point).y
      );
    } else {
      this.originalScale = new PIXI.Point(1, 1);
    }

    // 옵션 병합
    if (options) {
      this.options = { ...this.options, ...options };
    }

    // 화면 경계 설정
    this.updateBounds();

    // 초기 상태 설정
    this.changeState();

    // 업데이트 이벤트 리스너 등록
    this.app.ticker.add(this.update, this);

    console.log("RandomMovementController initialized", this.sprite);
  }

  private updateBounds(): void {
    const padding = this.options.boundaryPadding || 0;
    const { width, height } = this.sprite.getBounds();

    this.bounds = new PIXI.Rectangle(
      padding,
      padding,
      this.app.screen.width - width - padding * 2,
      this.app.screen.height - height - padding * 2
    );
  }

  private changeState(): void {
    // 상태 변경: 쉬는 상태와 움직이는 상태 사이를 전환
    if (this.state === MovementState.IDLE) {
      this.state = MovementState.MOVING;
      this.currentStateDuration = this.randomRange(
        this.options.minMoveTime || 1000,
        this.options.maxMoveTime || 5000
      );
      this.chooseRandomDirection();
      console.log("Changed to MOVING state", this.direction);
    } else {
      this.state = MovementState.IDLE;
      this.currentStateDuration = this.randomRange(
        this.options.minIdleTime || 1000,
        this.options.maxIdleTime || 3000
      );
      this.direction.x = 0;
      this.direction.y = 0;
      console.log("Changed to IDLE state");
    }

    this.stateTimer = 0;
  }

  private chooseRandomDirection(): void {
    // 랜덤 각도 생성
    const angle = Math.random() * Math.PI * 2;

    // 각도에서 방향 벡터 계산
    this.direction.x = Math.cos(angle);
    this.direction.y = Math.sin(angle);
  }

  private randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  private containInBounds(): void {
    // 화면 경계에 도달하면 방향 변경
    if (this.sprite.position.x < this.bounds.x) {
      this.sprite.position.x = this.bounds.x;
      this.direction.x *= -1;
    } else if (this.sprite.position.x > this.bounds.width) {
      this.sprite.position.x = this.bounds.width;
      this.direction.x *= -1;
    }

    if (this.sprite.position.y < this.bounds.y) {
      this.sprite.position.y = this.bounds.y;
      this.direction.y *= -1;
    } else if (this.sprite.position.y > this.bounds.height) {
      this.sprite.position.y = this.bounds.height;
      this.direction.y *= -1;
    }
  }

  public update(deltaTime: number): void {
    // 시간 업데이트
    this.stateTimer += deltaTime * 16.67; // 약 60FPS 기준 변환

    // 상태 지속 시간을 초과했는지 확인
    if (this.stateTimer >= this.currentStateDuration) {
      this.changeState();
    }

    // 이동 상태이면 오브젝트 이동
    if (this.state === MovementState.MOVING) {
      this.sprite.position.x +=
        this.direction.x * (this.options.moveSpeed || 2);
      this.sprite.position.y +=
        this.direction.y * (this.options.moveSpeed || 2);

      // scale 속성이 있는지 확인하고 이동 방향에 따라 스케일 조정
      if ("scale" in this.sprite) {
        if (this.direction.x < 0) {
          (this.sprite.scale as PIXI.Point).x = -Math.abs(this.originalScale.x);
        } else if (this.direction.x > 0) {
          (this.sprite.scale as PIXI.Point).x = Math.abs(this.originalScale.x);
        }
      }

      this.containInBounds();
    }
  }

  public destroy(): void {
    // 컨트롤러 정리
    this.app.ticker.remove(this.update, this);
  }
}
