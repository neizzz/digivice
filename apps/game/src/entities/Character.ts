import * as PIXI from "pixi.js";
import {
	CharacterDictionary,
	type CharacterKey,
	CharacterState,
} from "../types/Character";
import type { Position } from "../types/Position";
import { AssetLoader } from "../utils/AssetLoader";

export class Character extends PIXI.Container {
	public animatedSprite: PIXI.AnimatedSprite | undefined;
	private speed: number; // 캐릭터 이동 속도
	private currentAnimation = "idle"; // 현재 애니메이션 상태
	private spritesheet?: PIXI.Spritesheet; // spritesheet 객체
	private scaleFactor: number; // 캐릭터 크기 조정 인자
	private currentState: CharacterState = CharacterState.IDLE; // 현재 상태
	private animationMapping: Record<CharacterState, string>; // 상태와 애니메이션 이름 매핑

	constructor(params: {
		characterKey: CharacterKey; // CharacterKey 사용
		initialPosition: Position;
	}) {
		super();

		const characterInfo = CharacterDictionary[params.characterKey];

		this.position.set(params.initialPosition.x, params.initialPosition.y);
		this.speed = characterInfo.speed;
		this.scaleFactor = characterInfo.scale;
		this.animationMapping = characterInfo.animationMapping;

		// AssetLoader에서 스프라이트시트 가져오기
		const assets = AssetLoader.getAssets();
		this.spritesheet = assets.characterSprites[params.characterKey];

		// 기본 매핑 설정 (외부에서 주입된 매핑이 있으면 덮어씀)

		this.loadCharacterSprite(this.spritesheet);
	}

	private async loadCharacterSprite(
		spritesheet?: PIXI.Spritesheet,
	): Promise<void> {
		try {
			if (!spritesheet) {
				console.warn("Spritesheet not provided for character");
				this.createFallbackAnimation();
				return;
			}

			// spritesheet 설정
			this.spritesheet = spritesheet;

			// spritesheet.animations이 정의되어 있는지 확인
			if (this.spritesheet.animations) {
				console.log(
					"Available animations:",
					Object.keys(this.spritesheet.animations),
				);

				// 초기 애니메이션 설정
				await this.setAnimation(this.currentAnimation);
				return;
			}

			// animations이 없거나 유효하지 않은 경우 대체 애니메이션 생성
			console.warn("No valid animations found in spritesheet, using fallback");
			this.createFallbackAnimation();
		} catch (error) {
			console.error("Error creating character:", error);
			this.createFallbackAnimation();
		}
	}

	public async setAnimation(animationName: string): Promise<boolean> {
		if (!this.spritesheet) {
			console.error("Cannot set animation, spritesheet is not loaded");
			return false;
		}

		const textures = this.spritesheet.animations[animationName];
		if (!textures || textures.length === 0) {
			console.error(`Animation not found: ${animationName}`);
			return false;
		}

		// 기존 애니메이션 제거
		if (this.animatedSprite) {
			this.removeChild(this.animatedSprite);
			this.animatedSprite.destroy();
		}

		// 새 애니메이션 생성
		this.animatedSprite = new PIXI.AnimatedSprite(textures);

		// 프레임 개수에 따라 애니메이션 속도 설정
		const frameCount = textures.length;
		this.animatedSprite.animationSpeed = 0.02 * frameCount;

		// 기본 루프 설정
		this.animatedSprite.loop = true;

		// 스프라이트 설정
		this.animatedSprite.width = textures[0].width * this.scaleFactor;
		this.animatedSprite.height = textures[0].height * this.scaleFactor;
		this.animatedSprite.play();
		this.addChild(this.animatedSprite);

		// pivot과 anchor 설정
		this.animatedSprite.anchor.set(0.5, 0.5);

		this.currentAnimation = animationName;
		return true;
	}

	private createFallbackAnimation(): void {
		try {
			console.log("Creating fallback animation for character");

			// 복잡한 렌더 텍스처 생성 대신 기본 텍스처 사용
			const texture = PIXI.Texture.WHITE;

			// 빨간색 착색 필터 생성
			const colorMatrix = new PIXI.ColorMatrixFilter();
			colorMatrix.tint(0xff3300); // 빨간색

			// 단일 프레임으로 애니메이션 생성
			this.animatedSprite = new PIXI.AnimatedSprite([texture]);
			this.addChild(this.animatedSprite);

			// 필터 적용
			this.animatedSprite.filters = [colorMatrix];

			// 기본 속성 설정
			this.animatedSprite.anchor.set(0.5);
			this.animatedSprite.width = 50 * this.scaleFactor;
			this.animatedSprite.height = 50 * this.scaleFactor;

			console.log("Fallback animation created successfully");
		} catch (error) {
			// 최후의 방어선: 모든 것이 실패한 경우 빈 컨테이너만 유지
			console.error("Failed to create even fallback animation:", error);

			// animatedSprite가 생성되지 않았으면 null 참조 방지
			if (!this.animatedSprite) {
				// 빈 스프라이트라도 만들어 두기
				const emptyTexture = PIXI.Texture.EMPTY;
				this.animatedSprite = new PIXI.AnimatedSprite([emptyTexture]);
				this.addChild(this.animatedSprite);
				this.animatedSprite.anchor.set(0.5);
			}
		}
	}

	public update(state: CharacterState): void {
		if (this.currentState !== state) {
			this.currentState = state;
			// 상태에 따른 애니메이션 이름 가져오기
			const animationName = this.animationMapping[state];
			if (animationName) {
				this.setAnimation(animationName);
			} else {
				console.warn(`No animation mapped for state: ${state}`);
			}
		}
	}

	// 명시적으로 캐릭터 위치 설정하는 메서드 추가
	public setPosition(x: number, y: number): void {
		this.position.set(x, y);
	}

	public getSpeed(): number {
		return this.speed;
	}
}
