import * as PIXI from "pixi.js";
import { AssetLoader } from "../utils/AssetLoader";

/**
 * Bird 클래스는 게임에서 새를 표현하는 엔티티입니다.
 * 새는 다양한 오브젝트를 발로 매달고 날 수 있습니다.
 */
export class Bird extends PIXI.Container {
  private animatedSprite!: PIXI.AnimatedSprite;
  private hangingObject: PIXI.Sprite | null = null;
  private correctScale = 1.2;
  private app: PIXI.Application;
  private isAnimating = false;

  /**
   * Bird 객체를 초기화합니다.
   * @param app PIXI Application 참조
   */
  constructor(app: PIXI.Application) {
    super();
    this.app = app;

    this.sortableChildren = true;

    const assets = AssetLoader.getAssets();

    // 새 애니메이션 초기화
    if (assets.birdSprites?.animations.fly) {
      const textures = assets.birdSprites.animations.fly;
      this.animatedSprite = new PIXI.AnimatedSprite(textures);
      this.animatedSprite.animationSpeed = 0.1;
      this.animatedSprite.play();
      this.animatedSprite.width = 32 * 1.4 * this.correctScale;
      this.animatedSprite.height = 32 * 1.4 * this.correctScale;
      this.animatedSprite.zIndex = 9999;
      this.animatedSprite.anchor.set(0.5);
      this.addChild(this.animatedSprite);
    } else {
      console.error("Bird animations not found!");
      // Fallback: 빈 스프라이트 생성
      this.animatedSprite = new PIXI.AnimatedSprite([PIXI.Texture.WHITE]);
      this.animatedSprite.width = 32 * 1.4 * this.correctScale;
      this.animatedSprite.height = 32 * 1.4 * this.correctScale;
      this.animatedSprite.anchor.set(0.5);
      this.addChild(this.animatedSprite);
    }
  }

  /**
   * 새의 애니메이션을 시작합니다.
   */
  public startAnimation(): void {
    this.animatedSprite.play();
  }

  /**
   * 새의 애니메이션을 중지합니다.
   */
  public stopAnimation(): void {
    this.animatedSprite.stop();
  }

  /**
   * 새의 발에 오브젝트를 매달아 추가합니다.
   * @param object 새가 매달 PIXI 디스플레이 오브젝트
   */
  public hangObject(object: PIXI.Sprite): void {
    // 기존에 매달린 오브젝트가 있으면 제거
    this.unHangObject();

    // 새로운 오브젝트 추가
    this.hangingObject = object;
    this.hangingObject.scale.x *= this.correctScale;
    this.hangingObject.scale.y *= this.correctScale;
    this.hangingObject.zIndex = 9998; // 새보다 아래에 위치
    this.addChild(object);

    // 오브젝트가 반드시 보이도록 설정
    object.visible = true;

    // 오브젝트 위치 조정 (새의 발 위치에 맞게)
    // basket을 새의 발 아래에 위치시킴
    object.position.set(0, 32 * this.correctScale); // 발 위치를 기준으로 아래로 조정

    console.log("Bird에 오브젝트 매달기 완료:", {
      objectVisible: object.visible,
      position: object.position,
    });
  }

  /**
   * 매달린 오브젝트를 제거합니다.
   * @returns 제거된 오브젝트 또는 매달린 오브젝트가 없는 경우 null
   */
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

  /**
   * Bird와 매달린 오브젝트를 함께 업데이트합니다.
   * 매 프레임 호출됩니다.
   */
  public update(deltaTime: number): void {
    // 애니메이션 업데이트는 PIXI에서 자동으로 처리됨
    // 추가 업데이트 로직이 필요하면 여기에 구현
  }

  /**
   * 새의 크기를 설정합니다.
   * @param scale 크기 배율 (1이 기본 크기)
   */
  public setScale(scale: number): void {
    this.scale.set(scale);
  }

  /**
   * 지정된 위치로 새가 움직이는 애니메이션을 수행합니다.
   * @param targetX 목표 X 좌표
   * @param targetY 목표 Y 좌표
   * @param durationMs 애니메이션 지속 시간 (밀리초)
   * @returns Promise - 애니메이션 완료 시 해결됨
   */
  public async flyTo(
    targetX: number,
    targetY: number,
    durationMs = 1000
  ): Promise<void> {
    if (this.isAnimating) return;

    this.isAnimating = true;

    // 시작 위치 저장
    const startX = this.position.x;
    const startY = this.position.y;

    // 이동 거리 계산
    const dx = targetX - startX;
    const dy = targetY - startY;

    // 이동 방향에 따라 뒤집기 (왼쪽으로 이동하면 뒤집기)
    this.scale.x = dx < 0 ? -Math.abs(this.scale.x) : Math.abs(this.scale.x);

    return new Promise<void>((resolve) => {
      const startTime = Date.now();

      const animate = () => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / durationMs, 1);

        // 이징 함수 적용 (부드러운 움직임)
        const easeProgress = this.easeInOutQuad(progress);

        // 새 위치 계산
        this.position.x = startX + dx * easeProgress;
        this.position.y = startY + dy * easeProgress;

        if (progress < 1) {
          // 애니메이션 계속
          requestAnimationFrame(animate);
        } else {
          // 애니메이션 완료
          this.position.x = targetX;
          this.position.y = targetY;
          this.isAnimating = false;
          resolve();
        }
      };

      // 애니메이션 시작
      animate();
    });
  }

  /**
   * 이징 함수: ease-in-out-quad
   * 부드러운 시작과 종료를 가진 애니메이션에 사용
   */
  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  }

  /**
   * 캐릭터를 바구니에 태우는 함수
   * @param character 태울 캐릭터 객체
   * @returns 애니메이션 완료 시 해결되는 Promise
   */
  public async pickupCharacter(character: PIXI.Container): Promise<void> {
    if (!this.hangingObject) {
      console.warn("바구니가 없어 캐릭터를 태울 수 없습니다.");
      return;
    }

    // 캐릭터의 원래 부모와 위치 저장
    const originalParent = character.parent;
    const originalPosition = {
      x: character.position.x,
      y: character.position.y,
    };
    const originalScale = { x: character.scale.x, y: character.scale.y };

    // 캐릭터를 바구니에 추가
    originalParent.removeChild(character);
    this.hangingObject.addChild(character);

    // 캐릭터 위치와 크기 조정 (바구니 안에 맞게)
    character.position.set(0, -5);
    character.scale.set(0.8 / this.correctScale);

    return Promise.resolve();
  }

  /**
   * 바구니에서 캐릭터를 내려놓는 함수
   * @param character 내려놓을 캐릭터 객체
   * @param targetParent 캐릭터를 추가할 새 부모 컨테이너
   * @param targetX X 좌표
   * @param targetY Y 좌표
   */
  public async releaseCharacter(
    character: PIXI.Container,
    targetParent: PIXI.Container,
    targetX: number,
    targetY: number
  ): Promise<void> {
    if (
      !this.hangingObject ||
      !this.hangingObject.children.includes(character)
    ) {
      console.warn("바구니에 캐릭터가 없습니다.");
      return;
    }

    // 바구니에서 캐릭터 제거
    this.hangingObject.removeChild(character);

    // 캐릭터를 새 부모에 추가하고 위치 설정
    targetParent.addChild(character);
    character.position.set(targetX, targetY);
    character.scale.set(1, 1); // 원래 크기로 복원

    return Promise.resolve();
  }
}
