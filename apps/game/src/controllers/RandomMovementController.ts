import * as PIXI from "pixi.js";
import { CharacterState } from "../entities/Character";

// Updatable 인터페이스 정의
interface Updatable {
	update(state: CharacterState): void;
}

export enum MovementState {
	MOVING = 0,
	IDLE = 1,
}

export interface MovementOptions {
	minIdleTime?: number; // 최소 휴식 시간 (ms)
	maxIdleTime?: number; // 최대 휴식 시간 (ms)
	minMoveTime?: number; // 최소 이동 시간 (ms)
	maxMoveTime?: number; // 최대 이동 시간 (ms)
	moveSpeed?: number; // 이동 속도
	boundaryPadding?: number; // 화면 경계 여백
}

export class RandomMovementController {
	private sprite: PIXI.Container & Updatable; // PIXI.Container와 Updatable 결합
	private state: MovementState = MovementState.IDLE;
	private direction: PIXI.Point = new PIXI.Point(0, 0);
	private stateTimer = 0;
	private currentStateDuration = 0;
	private app: PIXI.Application;
	private bounds!: PIXI.Rectangle;
	private originalScale: PIXI.Point;

	private options: MovementOptions = {
		minIdleTime: 1000,
		maxIdleTime: 3000,
		minMoveTime: 1000,
		maxMoveTime: 5000,
		moveSpeed: 2,
		boundaryPadding: 20,
	};

	constructor(
		sprite: PIXI.Container & Updatable, // PIXI.Container와 Updatable 결합
		app: PIXI.Application,
		options?: MovementOptions,
	) {
		this.sprite = sprite;
		this.app = app;

		// scale 속성이 있는지 확인
		this.originalScale = new PIXI.Point(
			this.sprite.scale.x,
			this.sprite.scale.y,
		);

		// 옵션 병합
		if (options) {
			this.options = { ...this.options, ...options };
		}

		// 화면 경계 설정
		this.updateBounds();

		// 초기 상태 설정
		this.changeState();

		// 업데이트 이벤트 리스너 등록
		this.app.ticker.add(this.update, this);

		console.debug("RandomMovementController initialized", this.sprite);
	}

	private updateBounds(): void {
		const padding = this.options.boundaryPadding || 0;
		const { width, height } = this.sprite.getBounds();

		this.bounds = new PIXI.Rectangle(
			padding,
			padding,
			this.app.screen.width - width - padding * 2,
			this.app.screen.height - height - padding * 2,
		);
	}

	private changeState(): void {
		// 상태 변경: 쉬는 상태와 움직이는 상태 사이를 전환
		if (this.state === MovementState.IDLE) {
			this.state = MovementState.MOVING;
			this.currentStateDuration = this.randomRange(
				this.options.minMoveTime || 2000, // 최소 이동 시간 증가
				this.options.maxMoveTime || 7000, // 최대 이동 시간 증가
			);
			this.chooseRandomDirection();
			console.debug("Changed to MOVING state", this.direction);
		} else {
			this.state = MovementState.IDLE;
			this.currentStateDuration = this.randomRange(
				this.options.minIdleTime || 3000, // 최소 휴식 시간 증가
				this.options.maxIdleTime || 8000, // 최대 휴식 시간 증가
			);
			this.direction.x = 0;
			this.direction.y = 0;
			console.debug("Changed to IDLE state");
		}

		this.stateTimer = 0;
	}

	private chooseRandomDirection(): void {
		// 랜덤 각도 생성
		const angle = Math.random() * Math.PI * 2;

		// 각도에서 방향 벡터 계산
		this.direction.x = Math.cos(angle);
		this.direction.y = Math.sin(angle);

		// 이동 거리를 랜덤으로 설정 (기본 이동 거리 증가)
		const moveDistance = this.randomRange(100, 300); // 최소 100, 최대 300
		this.direction.x *= moveDistance;
		this.direction.y *= moveDistance;
	}

	private randomRange(min: number, max: number): number {
		return min + Math.random() * (max - min);
	}

	private containInBounds(): void {
		// 화면 경계에 도달하면 방향 변경
		if (this.sprite.position.x < this.bounds.x) {
			this.sprite.position.x = this.bounds.x;
			this.direction.x *= -1;
		} else if (this.sprite.position.x > this.bounds.width) {
			this.sprite.position.x = this.bounds.width;
			this.direction.x *= -1;
		}

		if (this.sprite.position.y < this.bounds.y) {
			this.sprite.position.y = this.bounds.y;
			this.direction.y *= -1;
		} else if (this.sprite.position.y > this.bounds.height) {
			this.sprite.position.y = this.bounds.height;
			this.direction.y *= -1;
		}
	}

	public update(deltaTime: number): void {
		// 시간 업데이트
		this.stateTimer += deltaTime; // deltaTime은 이미 프레임 단위로 제공됨

		// 상태 지속 시간을 초과했는지 확인
		if (this.stateTimer >= this.currentStateDuration) {
			this.changeState();
		}

		// 이동 상태이면 오브젝트 이동
		if (this.state === MovementState.MOVING) {
			const speed = this.options.moveSpeed || 1;

			// 방향 벡터에 속도와 deltaTime 적용
			this.sprite.position.x += this.direction.x * speed * (deltaTime / 1000);
			this.sprite.position.y += this.direction.y * speed * (deltaTime / 1000);

			// 이동 방향에 따라 스케일 조정
			this.sprite.scale.x =
				this.direction.x < 0
					? -Math.abs(this.originalScale.x)
					: Math.abs(this.originalScale.x);

			this.containInBounds();
		}

		// 캐릭터의 상태를 업데이트
		const state = this.isMoving()
			? CharacterState.WALKING
			: CharacterState.IDLE;
		this.sprite.update(state);
	}

	public isMoving(): boolean {
		// 캐릭터가 움직이고 있는지 여부를 반환하는 로직 추가
		return this.state === MovementState.MOVING;
	}

	public destroy(): void {
		// 컨트롤러 정리
		this.app.ticker.remove(this.update, this);
	}
}
