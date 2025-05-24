import type { AnimatedSprite, Sprite } from "pixi.js";
import type { ObjectType } from "../types/GameData";
import { generateId } from "../utils/generate";

/**
 * 게임 내 모든 오브젝트의 기본 클래스
 */
export abstract class ObjectBase {
  /**
   * 객체의 고유 ID
   */
  protected readonly id: string;

  /**
   * ObjectBase 생성자
   * @param idPrefix ID 생성 시 사용할 접두사 (옵션)
   */
  constructor(id?: string) {
    this.id = id ?? generateId(this.getType());
  }

  /**
   * 객체의 고유 ID를 반환합니다.
   * @returns 객체의 고유 ID
   */
  public getId(): string {
    return this.id;
  }

  public static attachObjectRef(
    sprite: Sprite | AnimatedSprite,
    objectRef: ObjectBase
  ): void {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    (sprite as any).__objectRef = objectRef;
  }

  public static getObjectRef(
    sprite: Sprite | AnimatedSprite
  ): ObjectBase | undefined {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    return (sprite as any).__objectRef;
  }

  public abstract getType(): ObjectType;
}
