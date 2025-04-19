import * as PIXI from "pixi.js";

// 반짝임 파티클의 사용자 정의 속성을 위한 인터페이스
interface SparkleProps {
  lifespan: number;
  age: number;
}

/**
 * SparkleEffect 클래스 - 반짝이는 효과를 구현
 */
export class SparkleEffect {
  private target: PIXI.DisplayObject;
  private container: PIXI.Container;
  private app: PIXI.Application;
  private sparkles: PIXI.Container[] = [];
  private active = false;
  private numSparkles = 5;
  private timer = 0;
  private spawnInterval = 500; // 0.5초마다 새로운 반짝임 생성
  private animationSpeed = 0.05;

  /**
   * @param target 효과를 적용할 대상 오브젝트
   * @param container 효과를 표시할 컨테이너
   * @param app PIXI 애플리케이션
   */
  constructor(
    target: PIXI.DisplayObject,
    container: PIXI.Container,
    app: PIXI.Application
  ) {
    this.target = target;
    this.container = container;
    this.app = app;
  }

  /**
   * 반짝임 효과 시작
   */
  public start(): void {
    if (this.active) return;

    this.active = true;
    this.app.ticker.add(this.update, this);
  }

  /**
   * 반짝임 효과 중지
   */
  public stop(): void {
    if (!this.active) return;

    this.active = false;
    this.app.ticker.remove(this.update, this);

    // 모든 반짝임 제거
    this.clearSparkles();
  }

  /**
   * 효과 업데이트 (매 프레임마다 호출)
   */
  private update = (deltaTime: number): void => {
    if (!this.active) return;

    // 타이머 업데이트
    this.timer += this.app.ticker.elapsedMS;

    // 주기적으로 새 반짝임 생성
    if (this.timer >= this.spawnInterval) {
      this.createSparkle();
      this.timer = 0;
    }

    // 기존 반짝임 업데이트
    this.updateSparkles(deltaTime);
  };

  /**
   * 별 모양의 그래픽 생성 (4개의 꼭지)
   * @returns 별 모양의 PIXI.Graphics 객체
   */
  private createStarGraphics(): PIXI.Graphics {
    const star = new PIXI.Graphics();
    const outerRadius = 4;
    const innerRadius = 2;
    const numPoints = 4; // 4개의 꼭지로 변경

    // 금색 계열로 설정
    star.beginFill(0xffffff);

    // 4꼭지 별 그리기
    star.moveTo(0, -outerRadius); // 시작점 (상단)

    for (let i = 0; i < numPoints * 2; i++) {
      const radius = i % 2 === 0 ? innerRadius : outerRadius;
      const angle = (Math.PI / numPoints) * (i + 1);
      const x = Math.sin(angle) * radius;
      const y = -Math.cos(angle) * radius;
      star.lineTo(x, y);
    }

    star.closePath();
    star.endFill();
    return star;
  }

  /**
   * 새로운 반짝임 생성
   */
  private createSparkle(): void {
    // 타겟 주변에 랜덤하게 위치 설정
    const targetBounds = this.target.getBounds();

    // 컨테이너를 생성하여 반짝임 내용을 담음
    const sparkleContainer = new PIXI.Container();
    const sparkleGraphic = this.createStarGraphics();

    // 컨테이너에 그래픽 추가
    sparkleContainer.addChild(sparkleGraphic);

    // 타겟 주변 랜덤한 위치에 배치
    sparkleContainer.position.x =
      targetBounds.x + Math.random() * targetBounds.width;
    sparkleContainer.position.y =
      targetBounds.y + Math.random() * targetBounds.height;

    // 랜덤 크기로 시작
    const initialScale = 0.3 + Math.random() * 0.7;
    sparkleContainer.scale.set(initialScale);

    // 초기 투명도
    sparkleContainer.alpha = 0.1 + Math.random() * 0.5;

    // 사용자 정의 속성 추가
    const sparkleProps: SparkleProps = {
      lifespan: 1 + Math.random() * 0.5, // 수명
      age: 0, // 현재 나이
    };

    // 컨테이너에 속성 추가
    Object.defineProperty(sparkleContainer, "sparkleProps", {
      value: sparkleProps,
      writable: true,
      enumerable: true,
    });

    // 컨테이너에 추가
    this.container.addChild(sparkleContainer);
    sparkleContainer.zIndex = this.target.zIndex + 1;
    this.sparkles.push(sparkleContainer);

    // 반짝임 개수 제한
    if (this.sparkles.length > this.numSparkles * 2) {
      const oldestSparkle = this.sparkles.shift();
      if (oldestSparkle?.parent) {
        oldestSparkle.parent.removeChild(oldestSparkle);
      }
    }
  }

  /**
   * 반짝임들 업데이트
   */
  private updateSparkles(deltaTime: number): void {
    // 각 반짝임 업데이트
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const sparkle = this.sparkles[i];

      // 사용자 정의 속성 가져오기
      const props: SparkleProps = (
        sparkle as PIXI.Container & { sparkleProps: SparkleProps }
      ).sparkleProps;
      if (!props) continue;

      // 나이 증가
      props.age += this.animationSpeed * deltaTime;

      // 반짝임 애니메이션 (크기와 투명도)
      const lifePercent = props.age / props.lifespan;
      if (lifePercent < 0.3) {
        // 시작 - 점점 커짐
        sparkle.alpha = lifePercent / 0.3;
        sparkle.scale.set(0.3 + (lifePercent / 0.3) * 0.7);
      } else if (lifePercent > 0.7) {
        // 끝 - 점점 작아짐
        const fadeOut = 1 - (lifePercent - 0.7) / 0.3;
        sparkle.alpha = fadeOut;
        const currentScale = 0.3 + 0.7 * fadeOut;
        sparkle.scale.set(currentScale);
      }

      // 수명이 다하면 제거
      if (props.age >= props.lifespan) {
        if (sparkle.parent) sparkle.parent.removeChild(sparkle);
        this.sparkles.splice(i, 1);
      }
    }
  }

  /**
   * 모든 반짝임 제거
   */
  private clearSparkles(): void {
    for (const sparkle of this.sparkles) {
      if (sparkle.parent) {
        sparkle.parent.removeChild(sparkle);
      }
    }
    this.sparkles = [];
  }

  /**
   * 리소스 정리
   */
  public destroy(): void {
    this.stop();
    this.clearSparkles();
  }
}
