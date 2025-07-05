import type { AnimatedSprite, Sprite } from "pixi.js";
import type { ObjectType } from "../types/GameData";
import { generateId } from "../utils/generate";

/**
 * 게임 내 모든 오브젝트의 기본 클래스
 */
export abstract class ObjectBase {
  protected readonly id: string;

  constructor(existingId?: string) {
    this.id = existingId ?? generateId(this.getType());
  }

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
