import * as PIXI from "pixi.js";
import { Cleanable } from "../interfaces/Cleanable";
import { ObjectType, type ObjectData } from "../types/GameData";
import type { Position } from "../types/Position";
import { ObjectBase } from "../interfaces/ObjectBase";

// export enum PillState {
//   FLYING = "flying",
//   LANDED = "landed",
//   EATING = "eating",
// }
// export enum PillFreshness {
//   NORMAL = "normal",
//   STALE = "stale",
// }

export interface PillOptions {
  data: ObjectData[ObjectType.Pill];
}

export class Pill extends Cleanable {
  private sprite: PIXI.Sprite;
  public textureKey: string;
  // public id: string;
  // private state: PillState;
  // private freshness: PillFreshness;
  // private createdAt: number;

  constructor(options?: PillOptions) {
    super(options?.data.id);
    const data = options?.data;
    this.textureKey =
      data?.textureKey ??
      ["pill-1", "pill-2", "pill-3", "pill-4"][Math.floor(Math.random() * 4)];
    const assets = PIXI.utils.TextureCache;
    const pillTexture = assets[this.textureKey];
    this.sprite = new PIXI.Sprite(pillTexture);
    this.sprite.anchor.set(0.5);
    this.sprite.width = 32;
    this.sprite.height = 32;
    this.sprite.scale.set(3.2);
    ObjectBase.attachObjectRef(this.sprite, this);
    if (data?.position) {
      this.setPosition(data.position.x, data.position.y);
      this.setZIndex(data.position.y);
    }
    // this.state = PillState.FLYING; // 항상 FLYING으로 초기화
    // 신선도 및 생성 시각 처리
    // this.createdAt = data?._createdAt ?? Date.now();
    // 신선도 계산
  }

  public getId(): string {
    return this.id;
  }
  public getType(): ObjectType {
    return ObjectType.Pill;
  }
  public getPosition(): Position {
    return {
      x: this.sprite.position.x,
      y: this.sprite.position.y,
    };
  }
  public getSprite(): PIXI.Sprite {
    return this.sprite;
  }
  public setPosition(x: number, y: number): void {
    this.sprite.position.set(x, y);
  }
  public setZIndex(zIndex: number): void {
    this.sprite.zIndex = zIndex;
  }
  public setScale(scale: number): void {
    this.sprite.scale.set(scale);
  }
  // public getState(): PillState {
  //   return this.state;
  // }
  // public setState(state: PillState): void {
  //   this.state = state;
  // }
  // public getFreshness(): PillFreshness {
  //   return this.freshness;
  // }
  // public setFreshness(freshness: PillFreshness): void {
  //   this.freshness = freshness;
  //   // TODO: 신선도에 따른 시각 효과 적용 가능
  // }
  protected onCleaningStart(): void {
    // 필요시 청소 시작 효과
  }
  protected onCleaningProgress(progress: number): void {
    this.sprite.alpha = 1.0 - progress * 0.8;
  }
  protected onCleaningFinish(): void {
    if (this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
    }
  }
  public destroy(): void {
    if (this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
    }
    this.sprite.destroy();
  }
}
