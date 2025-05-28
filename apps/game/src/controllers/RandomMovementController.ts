import * as PIXI from "pixi.js";
import { CharacterState } from "../types/Character";
import {
  type MovableCharacter,
  MovementController,
} from "./MovementController";

export interface MovementOptions {
  minIdleTime: number; // 최소 휴식 시간 (ms)
  maxIdleTime: number; // 최대 휴식 시간 (ms)
  minMoveTime: number; // 최소 이동 시간 (ms)
  maxMoveTime: number; // 최대 이동 시간 (ms)
}

const BOUNDARY_PADDING = 10; // 화면 경계 패딩

export class RandomMovementController extends MovementController {
  private isMovingState = false;
  private moveDirection = { x: 0, y: 0 }; // 이동 방향 벡터
  private stateTimer = 0;
  private currentStateDuration = 0; // 현재 상태(이동 또는 휴식) 지속 시간
  private bounds!: PIXI.Rectangle;
  private enabled = false; // 컨트롤러 활성화 상태

  private options: MovementOptions = {
    minIdleTime: 1000,
    maxIdleTime: 3000,
    minMoveTime: 1000,
    maxMoveTime: 5000,
  };

  constructor(
    character: MovableCharacter,
    app: PIXI.Application,
    options?: MovementOptions
  ) {
    super(character, app);

    // 옵션 병합
    if (options) {
      this.options = { ...this.options, ...options };
    }

    this.updateBounds();
    this.app.ticker.add(this.update, this);
    console.log("[RandomMovementController] 초기화 완료:", this.character);
  }

  public enable(): void {
    if (!this.enabled) {
      this.enabled = true;
      Math.random() > 0.5
        ? this.changeToMovingState()
        : this.changeToIdleState();
      console.log("[RandomMovenmentController] Enabled and started moving.");
    }
  }
  public disable(): void {
    // NOTE:FIXME: 여기서 캐릭터 상태변이를 하면 로직이 꼬임.
    if (this.enabled) {
      this.enabled = false;
      this.isMovingState = false; // 이동 상태 해제
      this.stateTimer = 0; // 상태 타이머 초기화
      console.log("[RandomMovenmentController] Disabled and stopped moving.");
    }
  }

  private updateBounds(): void {
    this.bounds = new PIXI.Rectangle(
      BOUNDARY_PADDING,
      BOUNDARY_PADDING,
      this.app.screen.width - BOUNDARY_PADDING,
      this.app.screen.height - BOUNDARY_PADDING
    );
  }

  private changeToIdleState(): void {
    this.isMovingState = false;
    this.currentStateDuration = this.randomRange(
      this.options.minIdleTime || 3000, // 최소 휴식 시간
      this.options.maxIdleTime || 8000 // 최대 휴식 시간
    );
    this.character.setState(CharacterState.IDLE, true);
    // idle 상태에서도 마지막 이동 방향을 바라보게 함
    this.stateTimer = 0;
  }

  private changeToMovingState(): void {
    this.isMovingState = true;
    // 이동 상태 지속 시간 설정
    this.currentStateDuration = this.randomRange(
      this.options.minMoveTime,
      this.options.maxMoveTime
    );
    this.chooseRandomDirection();
    this.character.setState(CharacterState.WALKING, true);
    this.updateCharacterFacing(); // 캐릭터 방향 업데이트
    this.stateTimer = 0; // 상태 타이머 초기화
    console.debug(
      "[RandomMovenmentController] Changed to WALKING state with direction:",
      this.moveDirection
    );
  }

  // 랜덤 방향 선택
  private chooseRandomDirection(): void {
    const angle = Math.random() * Math.PI * 2;
    this.moveDirection = {
      x: Math.cos(angle),
      y: Math.sin(angle),
    };
    console.debug(
      "[RandomMOvenmentController] Random direction selected:",
      this.moveDirection
    );
  }

  // 캐릭터의 시각적 방향을 업데이트하는 메서드
  private updateCharacterFacing(): void {
    // moveDirection.x가 양수면 오른쪽, 음수면 왼쪽을 바라봄
    if (this.moveDirection.x > 0) {
      // 오른쪽 이동 중
      this.character.setFlipped(false); // 오른쪽 바라보기
      console.debug("[RandomMovenmentController] Character looking RIGHT");
    } else if (this.moveDirection.x < 0) {
      // 왼쪽 이동 중
      this.character.setFlipped(true); // 왼쪽 바라보기
      console.debug("[RandomMovenmentController] Character looking LEFT");
    }
  }

  private randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  public update(tick: number): void {
    // 컨트롤러가 비활성화 상태면 업데이트 건너뜀
    if (!this.enabled) {
      return;
    }

    const deltaTime = tick * PIXI.Ticker.shared.deltaMS;

    // 시간 업데이트
    this.stateTimer += deltaTime;

    if (this.isMovingState) {
      const currentPos = this.character.getPosition();
      const speedFactor = 60 / 1000; // 1초에 60프레임 기준
      let moveX =
        this.moveDirection.x * this.moveSpeed * deltaTime * speedFactor;
      let moveY =
        this.moveDirection.y * this.moveSpeed * deltaTime * speedFactor;

      const nextX = currentPos.x + moveX;
      const nextY = currentPos.y + moveY;

      // 경계 검사 및 방향 조정
      let shouldUpdateFacing = false;

      if (nextX < this.bounds.x || nextX > this.bounds.width) {
        // X축 방향 반전
        this.moveDirection.x *= -1;
        moveX = -moveX; // 이동 방향도 반전
        shouldUpdateFacing = true;
      }

      // Y축 경계 확인
      if (nextY < this.bounds.y || nextY > this.bounds.height) {
        // Y축 방향 반전
        this.moveDirection.y *= -1;
        moveY = -moveY;
      }

      // 계산된 위치로 캐릭터 이동
      let newX = currentPos.x + moveX;
      let newY = currentPos.y + moveY;

      // 유효 바운더리 내에 위치하도록 보정
      const correctedPosition = this.ensureWithinBounds(newX, newY);
      newX = correctedPosition.x;
      newY = correctedPosition.y;

      this.character.setPosition(newX, newY);

      // 방향이 바뀌었으면 캐릭터 방향도 업데이트
      if (shouldUpdateFacing) {
        this.updateCharacterFacing();
      }

      // 이동 시간이 만료되면 IDLE 상태로 변경
      if (this.stateTimer >= this.currentStateDuration) {
        this.changeToIdleState();
      }
    } else {
      // IDLE 상태 시간이 만료되면 이동 상태로 변경
      if (this.stateTimer >= this.currentStateDuration) {
        this.changeToMovingState();
      }
    }
  }

  /**
   * 위치가 바운더리 내에 있는지 확인하고, 벗어날 경우 가장 가까운 경계 위치로 조정합니다.
   * @param x X 좌표
   * @param y Y 좌표
   * @returns 조정된 위치 {x, y}
   */
  private ensureWithinBounds(x: number, y: number): { x: number; y: number } {
    // X 좌표가 왼쪽 경계를 벗어나면
    let newX = x;
    let newY = y;
    if (x < this.bounds.x) {
      newX = this.bounds.x;
    }
    // X 좌표가 오른쪽 경계를 벗어나면
    else if (x > this.bounds.width) {
      newX = this.bounds.width;
    }

    // Y 좌표가 위쪽 경계를 벗어나면
    if (y < this.bounds.y) {
      newY = this.bounds.y;
    }
    // Y 좌표가 아래쪽 경계를 벗어나면
    else if (y > this.bounds.height) {
      newY = this.bounds.height;
    }

    return { x: newX, y: newY };
  }

  public isMoving(): boolean {
    return this.isMovingState;
  }
  public destroy(): void {
    this.app.ticker.remove(this.update, this);
  }
}
