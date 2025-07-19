import { INTENTED_FRONT_Z_INDEX } from "@/config";
import * as PIXI from "pixi.js";

export class Background extends PIXI.Container {
  private _bgSprite: PIXI.Sprite;

  constructor(texture: PIXI.Texture) {
    super();

    // 배경 스프라이트 생성
    this._bgSprite = new PIXI.Sprite(texture);
    this._bgSprite.anchor.set(0.5); // 중앙 기준점으로 설정
    this.zIndex = -INTENTED_FRONT_Z_INDEX; // 컨테이너 자체도 배경 뒤에 위치시킴
    this.addChild(this._bgSprite);
  }

  public resize(width: number, height: number): void {
    // 배경 위치를 화면 중앙으로 설정
    this.position.set(width / 2, height / 2);

    // 화면을 완전히 채우도록 비율 조정
    const scaleX = width / this._bgSprite.texture.width;
    const scaleY = height / this._bgSprite.texture.height;

    // 더 큰 스케일 값을 사용하여 화면을 완전히 커버
    const scale = Math.max(scaleX, scaleY);
    this._bgSprite.scale.set(scale);
  }
}
