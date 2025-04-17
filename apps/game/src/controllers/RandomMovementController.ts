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
  boundaryPadding?: number; // 화면 경계 여백
}

export class RandomMovementController extends MovementController {
  private isMovingState = false;
  private moveDirection = { x: 0, y: 0 }; // 이동 방향 벡터
  private stateTimer = 0;
  private currentIdleDuration = 0;
  private currentMoveDuration = 0;
  private bounds!: PIXI.Rectangle;

  private options: MovementOptions = {
    minIdleTime: 1000,
    maxIdleTime: 3000,
    minMoveTime: 1000,
    maxMoveTime: 5000,
    boundaryPadding: 40,
  };

  constructor(
    character: MovableCharacter,
    app: PIXI.Application,
    options: MovementOptions
  ) {
    super(character, app);

    // 옵션 병합
    if (options) {
      this.options = { ...this.options, ...options };
    }

    // 화면 경계 설정
    this.updateBounds();

    // 초기 상태 설정
    this.changeToIdleState();

    // 업데이트 이벤트 리스너 등록
    this.app.ticker.add(this.update, this);

    console.debug("RandomMovementController initialized", this.character);
  }

  private updateBounds(): void {
    const padding = this.options.boundaryPadding || 0;

    // Character 객체에서 getBounds 메서드가 없으므로 대략적인 크기 추정
    const characterWidth = 32; // 예상 캐릭터 너비
    const characterHeight = 32; // 예상 캐릭터 높이

    this.bounds = new PIXI.Rectangle(
      padding,
      padding,
      this.app.screen.width - characterWidth - padding * 2,
      this.app.screen.height - characterHeight - padding * 2
    );
  }

  // IDLE 상태로 전환
  private changeToIdleState(): void {
    this.isMovingState = false;
    this.currentIdleDuration = this.randomRange(
      this.options.minIdleTime || 3000, // 최소 휴식 시간
      this.options.maxIdleTime || 8000 // 최대 휴식 시간
    );
    this.character.update(CharacterState.IDLE);
    // idle 상태에서도 마지막 이동 방향을 바라보게 함
    this.stateTimer = 0;
    console.debug("Changed to IDLE state", this.moveDirection.x);
  }

  // MOVING 상태로 전환
  private changeToMovingState(): void {
    this.isMovingState = true;
    // 이동 상태 지속 시간 설정
    this.currentMoveDuration = this.randomRange(
      this.options.minMoveTime,
      this.options.maxMoveTime
    );
    this.chooseRandomDirection();
    this.character.update(CharacterState.WALKING);
    this.updateCharacterFacing(); // 캐릭터 방향 업데이트
    this.stateTimer = 0; // 상태 타이머 초기화
    console.debug(
      "Changed to WALKING state with direction:",
      this.moveDirection
    );
  }

  // 랜덤 방향 선택
  private chooseRandomDirection(): void {
    // 랜덤 각도 생성 (라디안)
    const angle = Math.random() * Math.PI * 2;

    // 방향 벡터 계산
    this.moveDirection = {
      x: Math.cos(angle),
      y: Math.sin(angle),
    };

    console.debug("Random direction selected:", this.moveDirection);
  }

  // 캐릭터의 시각적 방향을 업데이트하는 메서드
  private updateCharacterFacing(): void {
    // moveDirection.x가 양수면 오른쪽, 음수면 왼쪽을 바라봄
    if (this.moveDirection.x > 0) {
      // 오른쪽 이동 중
      this.character.setFlipped(false); // 오른쪽 바라보기
      console.debug("Character looking RIGHT");
    } else if (this.moveDirection.x < 0) {
      // 왼쪽 이동 중
      this.character.setFlipped(true); // 왼쪽 바라보기
      console.debug("Character looking LEFT");
    }
  }

  private randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  public update(deltaTime: number): void {
    // 시간 업데이트
    this.stateTimer += deltaTime;

    if (this.isMovingState) {
      // 현재 위치 가져오기
      const currentPos = this.character.getPosition();

      // 방향 벡터에 속도와 deltaTime 적용
      const speedFactor = 60 / 1000; // 60fps 기준 계수
      let moveX =
        this.moveDirection.x * this.moveSpeed * deltaTime * speedFactor;
      let moveY =
        this.moveDirection.y * this.moveSpeed * deltaTime * speedFactor;

      // 다음 위치 계산
      const nextX = currentPos.x + moveX;
      const nextY = currentPos.y + moveY;

      // 경계 검사 및 방향 조정
      if (nextX < this.bounds.x || nextX > this.bounds.width) {
        // X축 방향 반전
        this.moveDirection.x *= -1;
        moveX = -moveX; // 이동 방향도 반전

        // 방향이 바뀌었으므로 캐릭터 방향도 업데이트
        this.updateCharacterFacing();
      }

      // Y축 경계 확인
      if (nextY < this.bounds.y || nextY > this.bounds.height) {
        // Y축 방향 반전
        this.moveDirection.y *= -1;
        moveY = -moveY;
      }

      // 계산된 위치로 캐릭터 이동
      const newX = currentPos.x + moveX;
      const newY = currentPos.y + moveY;
      this.character.setPosition(newX, newY);

      // 캐릭터 상태 업데이트
      this.character.update(CharacterState.WALKING);

      // 이동 시간이 만료되면 IDLE 상태로 변경
      if (this.stateTimer >= this.currentMoveDuration) {
        this.changeToIdleState();
      }
    } else {
      // IDLE 상태일 때
      if (this.stateTimer >= this.currentIdleDuration) {
        this.changeToMovingState();
      }
    }
  }

  public isMoving(): boolean {
    // 캐릭터가 움직이고 있는지 여부를 반환
    return this.isMovingState;
  }

  public destroy(): void {
    // 컨트롤러 정리
    this.app.ticker.remove(this.update, this);
  }
}
