import * as PIXI from "pixi.js";

export interface ThrowSpriteOptions {
	initialScale: number; // 초기 크기
	finalScale: number; // 최종 크기
	velocity: { x: number; y: number }; // 초기 속도
	duration: number; // 애니메이션 지속 시간 (ms)
	gravity?: number; // 중력 가속도 (기본값: 0.5)
	onComplete?: () => void; // 애니메이션 완료 콜백
}

export class ThrowSprite {
	private sprite: PIXI.Sprite;
	private app: PIXI.Application;
	private options: ThrowSpriteOptions;
	private elapsedTime = 0;
	private gravity: number;
	private initialPosition: { x: number; y: number };
	private finalPosition: { x: number; y: number };

	constructor(
		app: PIXI.Application,
		texture: PIXI.Texture,
		options: ThrowSpriteOptions,
	) {
		this.app = app;
		this.options = options;
		this.gravity = options.gravity ?? 0.5;

		// 초기 위치와 최종 위치를 랜덤으로 결정
		this.initialPosition = this.getRandomInitialPosition();
		this.finalPosition = this.getRandomFinalPosition();

		// 스프라이트 생성 및 초기 설정
		this.sprite = new PIXI.Sprite(texture);
		this.sprite.position.set(this.initialPosition.x, this.initialPosition.y);
		this.sprite.scale.set(options.initialScale);
		this.sprite.anchor.set(0.5);

		// 스테이지에 추가
		this.app.stage.addChild(this.sprite);

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

		// 배경 내 랜덤 위치 (y축은 화면 절반 위로 제한)
		return {
			x: Math.random() * screenWidth,
			y: Math.random() * screenHeight - screenHeight / 2, // y축은 화면 절반 위로만 설정
		};
	}

	private update(deltaTime: number): void {
		this.elapsedTime += deltaTime * (1000 / 60); // ms 단위로 변환

		// 진행률 계산 (0 ~ 1)
		const progress = Math.min(this.elapsedTime / this.options.duration, 1);

		// 위치 보간
		this.sprite.position.x =
			this.initialPosition.x +
			(this.finalPosition.x - this.initialPosition.x) * progress;
		this.sprite.position.y =
			this.initialPosition.y +
			(this.finalPosition.y - this.initialPosition.y) * progress +
			0.5 * this.gravity * progress ** 2 * this.options.duration;

		// 크기 업데이트 (선형 보간)
		const scale =
			this.options.initialScale +
			progress * (this.options.finalScale - this.options.initialScale);
		this.sprite.scale.set(scale);

		// 애니메이션 완료 처리
		if (progress >= 1) {
			this.app.ticker.remove(this.update, this);

			// 완료 콜백 호출
			if (this.options.onComplete) {
				this.options.onComplete();
			}
		}
	}

	public getSprite(): PIXI.Sprite {
		return this.sprite;
	}
}
