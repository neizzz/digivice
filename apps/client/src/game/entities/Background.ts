import * as PIXI from "pixi.js";

export class Background extends PIXI.Container {
  private tileSprite: PIXI.TilingSprite;

  constructor(texture: PIXI.Texture) {
    super();

    // 타일링 스프라이트 생성
    this.tileSprite = new PIXI.TilingSprite(texture, 800, 600);
    this.addChild(this.tileSprite);
  }

  public resize(width: number, height: number): void {
    // 화면 크기에 맞게 타일링 스프라이트 크기 조정
    this.tileSprite.width = width;
    this.tileSprite.height = height;
  }
}
