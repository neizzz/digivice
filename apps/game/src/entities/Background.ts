import * as PIXI from "pixi.js";

export class Background extends PIXI.Container {
  private tileSprite: PIXI.TilingSprite;

  constructor(texture: PIXI.Texture) {
    super();

    // 타일링 스프라이트 생성
    this.tileSprite = new PIXI.TilingSprite(texture, 800, 600);

    // 타일 크기 조정 - 값이 작을수록 타일이 더 작게(자주) 반복됨
    this.tileSprite.tileScale.set(0.5, 0.5);

    // 필요하다면 초기 타일 위치 설정
    this.tileSprite.tilePosition.set(0, 0);

    this.addChild(this.tileSprite);
  }

  public resize(width: number, height: number): void {
    // 화면 크기에 맞게 타일링 스프라이트 크기 조정
    this.tileSprite.width = width;
    this.tileSprite.height = height;
  }

  // 선택적: 배경 타일을 움직이는 메서드 추가 (필요시 사용)
  public updateTilePosition(deltaX: number, deltaY: number): void {
    this.tileSprite.tilePosition.x += deltaX;
    this.tileSprite.tilePosition.y += deltaY;
  }
}
