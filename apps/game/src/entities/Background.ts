import * as PIXI from "pixi.js";

/**
 * 게임 배경을 관리하는 클래스입니다.
 * 화면 크기에 맞게 배경을 자동 조정합니다.
 */
export class Background extends PIXI.Container {
  private bgSprite: PIXI.Sprite;

  /**
   * 배경 객체를 생성합니다.
   * @param texture 배경에 사용할 텍스처
   */
  constructor(texture: PIXI.Texture) {
    super();

    // 배경 스프라이트 생성
    this.bgSprite = new PIXI.Sprite(texture);
    this.bgSprite.anchor.set(0.5); // 중앙 기준점으로 설정
    this.addChild(this.bgSprite);

    console.log("[Background] Created with texture:", texture);
  }

  /**
   * 배경 크기를 화면 크기에 맞게 조정합니다.
   * @param width 화면 너비
   * @param height 화면 높이
   */
  public resize(width: number, height: number): void {
    // 배경 위치를 화면 중앙으로 설정
    this.position.set(width / 2, height / 2);

    // 화면을 완전히 채우도록 비율 조정
    const scaleX = width / this.bgSprite.texture.width;
    const scaleY = height / this.bgSprite.texture.height;

    // 더 큰 스케일 값을 사용하여 화면을 완전히 커버
    const scale = Math.max(scaleX, scaleY);
    this.bgSprite.scale.set(scale);

    console.log(`[Background] Resized to ${width}x${height}, scale: ${scale}`);
  }

  /**
   * 배경 텍스처를 변경합니다.
   * @param newTexture 새 배경 텍스처
   */
  public changeTexture(newTexture: PIXI.Texture): void {
    this.bgSprite.texture = newTexture;
    console.log("[Background] Texture changed");
  }
}
