import * as PIXI from "pixi.js";

export class Character extends PIXI.Container {
  private animatedSprite: PIXI.AnimatedSprite;

  constructor(spritesheet: PIXI.Spritesheet) {
    super();

    // 슬라임 애니메이션 생성
    const idleFrames = spritesheet.animations["idle"];
    if (!idleFrames) {
      throw new Error("Idle animation frames not found in spritesheet");
    }

    this.animatedSprite = new PIXI.AnimatedSprite(idleFrames);
    this.addChild(this.animatedSprite);

    // 애니메이션 설정
    this.animatedSprite.anchor.set(0.5);
    this.animatedSprite.animationSpeed = 0.1;
    this.animatedSprite.play();

    // 적절한 크기로 조정
    this.animatedSprite.scale.set(0.3);
  }

  public update(deltaTime: number): void {
    // 애니메이션은 PIXI에서 자동 업데이트됨
    // 필요한 경우 여기에 추가 로직 구현
  }
}
