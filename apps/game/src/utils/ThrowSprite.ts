import type * as PIXI from "pixi.js";

export interface ThrowSpriteOptions {
  initialScale: number; // 초기 크기
  finalScale: number; // 최종 크기
  duration: number; // 애니메이션 지속 시간 (ms)
  onLanded?: (position: { x: number; y: number }) => void; // 착지 완료 콜백 (음식 위치 전달)
  onThrowStart?: (
    finalPosition: { x: number; y: number },
    textureName: string
  ) => void; // 던지기 시작 콜백 (최종 위치와 텍스처 이름 전달)
  foodTextureName?: string; // 음식 텍스처 이름 추가
}

/**
 * ThrowSprite 클래스 - 오직 스프라이트를 던지는 애니메이션만 담당
 */
export class ThrowSprite {
  private sprite: PIXI.Sprite;
  private app: PIXI.Application;
  private options: ThrowSpriteOptions;
  private elapsedTime = 0;
  private initialPosition: { x: number; y: number };
  private finalPosition: { x: number; y: number };
  private isLanded = false;

  constructor(
    app: PIXI.Application,
    parent: PIXI.Container,
    sprite: PIXI.Sprite,
    options: ThrowSpriteOptions
  ) {
    this.app = app;
    this.options = options;
    this.sprite = sprite;

    // 초기 위치와 최종 위치를 랜덤으로 결정
    this.initialPosition = this.getRandomInitialPosition();
    this.finalPosition = this.getRandomFinalPosition();

    // 스프라이트 초기 설정
    this.sprite.position.set(this.initialPosition.x, this.initialPosition.y);
    this.sprite.scale.set(options.initialScale);
    this.sprite.anchor.set(0.5);

    // 스테이지에 추가
    parent.addChild(this.sprite);

    // onThrowStart 콜백 호출
    if (options.onThrowStart) {
      const foodTextureName =
        options.foodTextureName ||
        this.sprite.texture.textureCacheIds[0] ||
        "unknown";
      options.onThrowStart(this.finalPosition, foodTextureName);
    }

    // 애니메이션 시작
    this.app.ticker.add(this.update, this);
  }

  private getRandomInitialPosition(): { x: number; y: number } {
    const screenWidth = this.app.screen.width;
    const screenHeight = this.app.screen.height;

    // 왼쪽 하단 또는 오른쪽 하단에서 랜덤 선택
    return Math.random() < 0.5
      ? { x: 0, y: screenHeight }
      : { x: screenWidth, y: screenHeight };
  }

  private getRandomFinalPosition(): { x: number; y: number } {
    const screenWidth = this.app.screen.width;
    const screenHeight = this.app.screen.height;

    // 배경 내 랜덤 위치 (y축은 화면 중간쯤으로 제한)
    return {
      x: Math.random() * (screenWidth * 0.7) + screenWidth * 0.15, // 화면 중앙 영역에 떨어지도록
      y: Math.random() * (screenHeight * 0.3) + screenHeight * 0.5, // 화면 중간~아래쪽에 떨어지도록
    };
  }

  private update = (deltaTime: number): void => {
    // 이미 착지했으면 더이상 업데이트 하지 않음
    if (this.isLanded) return;

    this.elapsedTime += deltaTime * (1000 / 60); // ms 단위로 변환

    // 진행률 계산 (0 ~ 1)
    const progress = Math.min(this.elapsedTime / this.options.duration, 1);

    // 위치 보간
    this.sprite.position.x =
      this.initialPosition.x +
      (this.finalPosition.x - this.initialPosition.x) * progress;

    // 중력 효과를 포함한 y 위치 계산 - 포물선 효과
    const maxHeight = 200; // 포물선의 최대 높이
    const gravity = 4 * maxHeight * (progress - progress * progress);

    this.sprite.position.y =
      this.initialPosition.y +
      (this.finalPosition.y - this.initialPosition.y) * progress -
      gravity; // gravity를 빼서 위로 올라가는 효과

    // y좌표에 따라 zIndex 설정 (y값이 클수록 앞에 표시)
    this.sprite.zIndex = this.sprite.position.y;

    // 크기 업데이트 (선형 보간)
    const scale =
      this.options.initialScale +
      progress * (this.options.finalScale - this.options.initialScale);
    this.sprite.scale.set(scale);

    // 애니메이션 완료 처리
    if (progress >= 1) {
      this.isLanded = true;

      // 콜백이 제공된 경우 호출
      if (this.options.onLanded) {
        const position = {
          x: this.sprite.position.x,
          y: this.sprite.position.y,
        };
        this.options.onLanded(position);
      }

      // 이제 던지기 애니메이션이 끝났으므로 ticker에서 제거
      this.app.ticker.remove(this.update);
    }
  };

  /**
   * 현재 스프라이트 위치 반환
   */
  public getPosition(): { x: number; y: number } {
    return {
      x: this.sprite.position.x,
      y: this.sprite.position.y,
    };
  }

  /**
   * 최종 위치 반환
   */
  public getFinalPosition(): { x: number; y: number } {
    return this.finalPosition;
  }

  /**
   * 리소스 정리
   */
  public destroy(): void {
    this.app.ticker.remove(this.update);
    // 스프라이트는 호출자가 관리하므로 여기서 제거하지 않음
  }
}
