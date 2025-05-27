import * as PIXI from "pixi.js";
import { AssetLoader } from "../utils/AssetLoader";
import { INTENTED_FRONT_Z_INDEX } from "../config";

/**
 * Bird 클래스는 게임에서 새를 표현하는 엔티티입니다.
 * 새는 다양한 오브젝트를 발로 매달고 날 수 있습니다.
 */
export class Bird extends PIXI.Container {
  private animatedSprite!: PIXI.AnimatedSprite;
  private hangingObject: PIXI.Sprite | null = null;
  private isAnimating = false;

  /**
   * Bird 객체를 초기화합니다.
   * @param app PIXI Application 참조
   */
  constructor() {
    super();

    this.sortableChildren = true;

    const assets = AssetLoader.getAssets();
    this.zIndex = INTENTED_FRONT_Z_INDEX; // 새는 항상 앞에 위치

    // 새 애니메이션 초기화
    if (assets.birdSprites?.animations.fly) {
      const textures = assets.birdSprites.animations.fly;
      this.animatedSprite = new PIXI.AnimatedSprite(textures);
      this.animatedSprite.animationSpeed = 0.1;
      this.animatedSprite.play();
      this.animatedSprite.width = 32 * 1.6;
      this.animatedSprite.height = 32 * 1.6;
      this.animatedSprite.zIndex = INTENTED_FRONT_Z_INDEX;
      this.animatedSprite.anchor.set(0.5);
      this.addChild(this.animatedSprite);
    } else {
      console.error("[Bird] Bird animations not found!");
    }
  }

  public startAnimation(): void {
    this.animatedSprite.play();
  }

  public stopAnimation(): void {
    this.animatedSprite.stop();
  }

  public hangObject(object: PIXI.Sprite, adjustmentY = 0): void {
    // 기존에 매달린 오브젝트가 있으면 제거
    this.unHangObject();

    // 새로운 오브젝트 추가
    this.hangingObject = object;
    this.hangingObject.zIndex = INTENTED_FRONT_Z_INDEX - 1; // 새보다 아래에 위치

    this.addChild(object);

    object.visible = true;
    object.position.set(0, 32 + adjustmentY); // 발 위치를 기준으로 아래로 조정

    console.log("[Bird] Bird에 오브젝트 매달기 완료:", {
      objectVisible: object.visible,
      position: object.position,
    });
  }

  public unHangObject(): PIXI.Sprite | null {
    if (this.hangingObject) {
      const object = this.hangingObject;
      this.removeChild(object);
      this.hangingObject = null;
      return object;
    }
    return null;
  }

  /**
   * 현재 매달려 있는 오브젝트를 반환합니다.
   */
  public getHangingObject(): PIXI.Sprite | null {
    return this.hangingObject;
  }

  public update(deltaTime: number): void {
    // 애니메이션 업데이트는 PIXI에서 자동으로 처리됨
    // 추가 업데이트 로직이 필요하면 여기에 구현
  }

  public setScale(scale: number): void {
    this.scale.set(scale);
  }

  public async flyToWithScale(
    targetX: number,
    targetY: number,
    startScale: number,
    endScale: number,
    durationMs = 1000
  ): Promise<void> {
    if (this.isAnimating) return;
    this.isAnimating = true;
    const startX = this.position.x;
    const startY = this.position.y;
    const dx = targetX - startX;
    const dy = targetY - startY;
    // 이동 방향에 따라 sprite 반전 (좌우)
    if (this.animatedSprite) {
      this.animatedSprite.scale.x =
        dx < 0
          ? -Math.abs(this.animatedSprite.scale.x)
          : Math.abs(this.animatedSprite.scale.x);
    }
    return new Promise<void>((resolve) => {
      const startTime = Date.now();
      const animate = () => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / durationMs, 1);
        const easeProgress = this._easeInOutQuad(progress);
        this.position.x = startX + dx * easeProgress;
        this.position.y = startY + dy * easeProgress;
        const newScale = startScale + (endScale - startScale) * easeProgress;
        this.setScale(newScale);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.position.x = targetX;
          this.position.y = targetY;
          this.setScale(endScale);
          this.isAnimating = false;
          resolve();
        }
      };
      animate();
    });
  }

  private _easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  }

  public pickupCharacter(character: PIXI.Container): void {
    if (!this.hangingObject) {
      console.warn("[Bird] 바구니가 없어 캐릭터를 태울 수 없습니다.");
      return;
    }

    // 캐릭터의 원래 부모와 위치 저장
    const originalParent = character.parent;
    // const originalPosition = {
    //   x: character.position.x,
    //   y: character.position.y,
    // };
    // const originalScale = { x: character.scale.x, y: character.scale.y };

    // 캐릭터를 바구니에 추가
    originalParent.removeChild(character);
    this.hangingObject.addChild(character);

    // 캐릭터 위치와 크기 조정 (바구니 안에 맞게)
    character.position.set(0, -5);
    // character.scale.set(0.8 / this.correctScale);
  }
}
