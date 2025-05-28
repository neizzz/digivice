import type * as PIXI from "pixi.js";
import { CharacterState } from "../types/Character";

/**
 * 캐릭터의 이동 방식을 제어하는 인터페이스
 */
export interface MovableCharacter {
  setPosition(x: number, y: number): void;
  getPosition(): { x: number; y: number };
  setFlipped(flipped: boolean): void;
  getSpeed(): number;
  getState(): CharacterState;
  setState(state: CharacterState, shouldTriggerEvent?: boolean): void;
}

/**
 * MovementController - 캐릭터 이동 및 방향 제어를 위한 기본 컨트롤러
 * 이동 방향에 따라 캐릭터의 방향(좌/우)을 자동으로 설정
 */
export class MovementController {
  protected character: MovableCharacter;
  protected moveSpeed: number;
  protected app: PIXI.Application;

  constructor(
    character: MovableCharacter,
    app: PIXI.Application,
    moveSpeed?: number
  ) {
    this.character = character;
    this.app = app;
    this.moveSpeed = moveSpeed || character.getSpeed();
  }

  /**
   * 캐릭터를 특정 좌표로 이동시킵니다.
   * 이동 방향에 따라 캐릭터의 방향이 자동으로 설정됩니다.
   * @param targetX 목표 X 좌표
   * @param targetY 목표 Y 좌표
   * @param deltaTime 델타 타임
   * @returns 목표에 도달했는지 여부
   */
  public moveTo(targetX: number, targetY: number, deltaTime: number): boolean {
    // 현재 위치
    const currentPos = this.character.getPosition();

    // 방향 벡터
    const directionX = targetX - currentPos.x;
    const directionY = targetY - currentPos.y;

    // 거리 계산
    const distanceSquared = directionX * directionX + directionY * directionY;
    const distance = Math.sqrt(distanceSquared);

    // 목표에 도달했는지 확인 (아주 가까운 거리면)
    if (distance < 5) {
      return true;
    }

    // 정규화된 방향
    const normalizedX = directionX / distance;
    const normalizedY = directionY / distance;

    const moveDistanceX = normalizedX * this.moveSpeed * deltaTime;
    const moveDistanceY = normalizedY * this.moveSpeed * deltaTime;

    // 새 좌표
    const newX = currentPos.x + moveDistanceX;
    const newY = currentPos.y + moveDistanceY;

    if (this.character.getState() !== CharacterState.WALKING) {
      this.character.setState(CharacterState.WALKING);
    }
    this.character.setPosition(newX, newY);
    this.updateCharacterDirection(directionX);

    return false;
  }

  /**
   * 이동 방향에 따라 캐릭터의 방향을 설정합니다.
   * @param directionX X축 방향 벡터 (양수: 오른쪽, 음수: 왼쪽)
   */
  public updateCharacterDirection(directionX: number): void {
    if (directionX > 0) {
      // 오른쪽으로 이동 중이므로 오른쪽을 봐야 함
      this.character.setFlipped(false);
    } else if (directionX < 0) {
      // 왼쪽으로 이동 중이므로 왼쪽을 봐야 함
      this.character.setFlipped(true);
    }
  }

  /**
   * 이동 속도를 설정합니다.
   * @param speed 새 이동 속도
   */
  public setMoveSpeed(speed: number): void {
    this.moveSpeed = speed;
  }

  /**
   * 이동 속도를 반환합니다.
   */
  public getMoveSpeed(): number {
    return this.moveSpeed;
  }
}
