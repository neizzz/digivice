import * as PIXI from "pixi.js";

export class GameObject extends PIXI.Container {
  protected _id: string;
  protected _active: boolean = true;

  constructor(id: string) {
    super();
    this._id = id;
  }

  get id(): string {
    return this._id;
  }

  get active(): boolean {
    return this._active;
  }

  set active(value: boolean) {
    this._active = value;
    this.visible = value;
  }

  update(deltaTime: number): void {
    // 하위 클래스에서 구현
  }

  destroy(): void {
    super.destroy({ children: true });
  }
}
