import * as PIXI from "pixi.js";
import type { Character } from "../entities/Character";
import { CharacterState } from "../types/Character";

export interface ThrowSpriteOptions {
	initialScale: number; // 초기 크기
	finalScale: number; // 최종 크기
	velocity: { x: number; y: number }; // 초기 속도
	duration: number; // 애니메이션 지속 시간 (ms)
	onComplete?: (position: { x: number; y: number }) => void; // 애니메이션 완료 콜백 (음식 위치 전달)
	character?: Character; // 음식을 먹을 캐릭터 객체 (선택사항)
}

// 음식 상태를 나타내는 enum
enum FoodState {
	THROWING = 0, // 던져지는 중
	LANDED = 1, // 착지됨
	EATING = 2, // 먹는 중
	FINISHED = 3, // 다 먹음
}

export class ThrowSprite {
	private sprite: PIXI.Sprite;
	private app: PIXI.Application;
	private options: ThrowSpriteOptions;
	private elapsedTime = 0;
	private initialPosition: { x: number; y: number };
	private finalPosition: { x: number; y: number };
	private character?: Character;
	private foodState: FoodState = FoodState.THROWING;
	private eatingProgress = 0;
	private eatingInterval?: number;
	private eatingStartTime = 0;
	private eatingDuration = 4000; // 음식 먹는데 걸리는 총 시간 (4초)

	constructor(
		app: PIXI.Application,
		parent: PIXI.Container,
		texture: PIXI.Texture,
		options: ThrowSpriteOptions,
	) {
		this.app = app;
		this.options = options;
		this.character = options.character;

		// 초기 위치와 최종 위치를 랜덤으로 결정
		this.initialPosition = this.getRandomInitialPosition();
		this.finalPosition = this.getRandomFinalPosition();

		// 스프라이트 생성 및 초기 설정
		this.sprite = new PIXI.Sprite(texture);
		this.sprite.position.set(this.initialPosition.x, this.initialPosition.y);
		this.sprite.scale.set(options.initialScale);
		this.sprite.anchor.set(0.5);

		// 스테이지에 추가
		parent.addChild(this.sprite);

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

	private update(deltaTime: number): void {
		switch (this.foodState) {
			case FoodState.THROWING:
				this.updateThrowing(deltaTime);
				break;
			case FoodState.LANDED:
				this.updateLanded();
				break;
			case FoodState.EATING:
				this.updateEating(deltaTime);
				break;
			case FoodState.FINISHED:
				// 이미 다 먹어서 처리할 필요 없음
				break;
		}
	}

	private updateThrowing(deltaTime: number): void {
		this.elapsedTime += deltaTime * (1000 / 60); // ms 단위로 변환

		// 진행률 계산 (0 ~ 1)
		const progress = Math.min(this.elapsedTime / this.options.duration, 1);

		// 위치 보간
		this.sprite.position.x =
			this.initialPosition.x +
			(this.finalPosition.x - this.initialPosition.x) * progress;

		// 중력 효과를 포함한 y 위치 계산 - 포물선 효과를 유지하면서 finalPosition에 도달
		// 포물선 궤적: 4 * h * (progress - progress^2) 공식 사용 (h는 최대 높이)
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
			// 음식이 착지했으므로 상태 변경
			this.foodState = FoodState.LANDED;

			// 완료 콜백 호출하면서 음식의 현재 위치 전달
			const foodPosition = {
				x: this.sprite.position.x,
				y: this.sprite.position.y,
			};

			if (this.options.onComplete) {
				this.options.onComplete(foodPosition);
			}
		}
	}

	private updateLanded(): void {
		// landed 상태에서는 이제 별도로 할 일이 없음
		// 모든 후속 작업은 onComplete 콜백에서 처리됨
		this.foodState = FoodState.EATING;
		this.eatingStartTime = Date.now();
	}

	// 캐릭터가 음식으로 이동하는 메서드 (외부에서 호출)
	public startEating(character: Character): void {
		if (!character) return;

		this.character = character;

		// 캐릭터 상태 변경
		this.character.update(CharacterState.EATING);

		// 상태 업데이트 (이미 음식이 땅에 닿았다면)
		if (
			this.foodState === FoodState.LANDED ||
			this.foodState === FoodState.EATING
		) {
			this.foodState = FoodState.EATING;
		}
	}

	private updateEating(deltaTime: number): void {
		if (!this.character) return;

		// 경과 시간 계산 (ms)
		const now = Date.now();
		const elapsedEatingTime = now - this.eatingStartTime;

		// 총 먹는 시간 대비 진행률 계산 (0~1)
		const eatingProgress = Math.min(elapsedEatingTime / this.eatingDuration, 1);

		// 1초마다 1/4씩 먹는 효과 표현
		// 크기와 투명도를 조절하여 점점 작아지고 투명해지게 함
		const remainingPortion = 1 - eatingProgress;

		// 음식 스프라이트 크기 및 투명도 업데이트
		this.sprite.scale.set(this.options.finalScale * remainingPortion);
		this.sprite.alpha = remainingPortion;

		// 다 먹었으면 마무리
		if (eatingProgress >= 1) {
			this.finishEating();
		}
	}

	private finishEating(): void {
		// 상태 변경
		this.foodState = FoodState.FINISHED;

		// 음식 스프라이트 제거
		if (this.sprite.parent) {
			this.sprite.parent.removeChild(this.sprite);
		}

		// 캐릭터 상태 원래대로 복원
		if (this.character) {
			this.character.update(CharacterState.IDLE);
		}

		// 게임 tick에서 이 객체 제거
		this.app.ticker.remove(this.update, this);
	}

	public getSprite(): PIXI.Sprite {
		return this.sprite;
	}

	public getPosition(): { x: number; y: number } {
		return {
			x: this.sprite.position.x,
			y: this.sprite.position.y,
		};
	}

	public destroy(): void {
		// 애니메이션 중단
		this.app.ticker.remove(this.update, this);

		// 음식 스프라이트 제거
		if (this.sprite.parent) {
			this.sprite.parent.removeChild(this.sprite);
		}

		// 캐릭터 상태 복원
		if (this.character && this.foodState === FoodState.EATING) {
			this.character.update(CharacterState.IDLE);
		}
	}
}
