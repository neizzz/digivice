import * as PIXI from "pixi.js";
import { AssetLoader } from "../utils/AssetLoader";

/**
 * 빗자루 클래스
 * 방향에 따라 좌우 반전되는 빗자루 스프라이트
 */
export class Broom extends PIXI.Container {
  private sprite: PIXI.Sprite;
  private direction = 0; // -1: 왼쪽, 1: 오른쪽

  constructor() {
    super();

    // 빗자루 스프라이트 생성
    const assets = AssetLoader.getAssets();
    let broomTexture: PIXI.Texture;

    // common16x16Sprites가 로드되었는지 확인
    if (assets.common16x16Sprites?.textures?.broom) {
      broomTexture = assets.common16x16Sprites.textures.broom;
      console.log("[Broom] Loaded broom texture from common16x16Sprites");
    } else {
      // 로드되지 않은 경우 흰색 텍스처 사용
      console.warn("[Broom] No broom texture found, using fallback");
      broomTexture = PIXI.Texture.WHITE;
    }

    this.sprite = new PIXI.Sprite(broomTexture);
    this.sprite.anchor.set(0.5, 0.5);

    // 빗자루 크기 조정 (원본이 16x16이므로 2배로 확대)
    this.sprite.width = 32;
    this.sprite.height = 32;

    this.addChild(this.sprite);
  }

  /**
   * 빗자루의 방향 설정
   * @param direction -1: 왼쪽, 1: 오른쪽
   */
  public setDirection(direction: number): void {
    this.direction = direction;

    if (direction < 0) {
      // 왼쪽 방향
      this.sprite.scale.x = -1;
    } else if (direction > 0) {
      // 오른쪽 방향
      this.sprite.scale.x = 1;
    }
  }

  /**
   * 빗자루의 현재 방향 값 반환
   */
  public getDirection(): number {
    return this.direction;
  }

  /**
   * 빗자루 위치 설정
   */
  public setPosition(x: number, y: number): void {
    this.position.set(x, y);
  }
}
apps / game / src / interfaces / Scene.ts;
