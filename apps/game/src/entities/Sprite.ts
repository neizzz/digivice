import * as PIXI from "pixi.js";
import type { SpriteMetadata } from "../types/Sprites";
import SpriteManager from "../utils/SpriteManager";
import { GameObject } from "./GameObject";

export class Sprite extends GameObject {
	private animatedSprite: PIXI.AnimatedSprite | null = null;
	private metadata: SpriteMetadata | null = null;
	private currentAnimation = "idle";

	constructor(spriteId: string, animation?: string) {
		super(spriteId);
		this.currentAnimation = animation || "idle";
		this.loadSprite();
	}

	private async loadSprite(): Promise<void> {
		const metadata = await SpriteManager.loadSprite(this.id);
		if (!metadata) {
			console.error(`Failed to load sprite metadata: ${this.id}`);
			return;
		}

		this.metadata = metadata;

		// 지정된 애니메이션 또는 기본 애니메이션 설정
		const animationName =
			this.currentAnimation || metadata.defaultAnimation || "idle";
		await this.setAnimation(animationName);
	}

	public async setAnimation(animationName: string): Promise<boolean> {
		if (!this.metadata) {
			console.error("Cannot set animation, sprite not loaded yet");
			return false;
		}

		const textures = SpriteManager.getAnimationTextures(this.id, animationName);
		if (!textures || textures.length === 0) {
			console.error(
				`Animation not found: ${animationName} for sprite ${this.id}`,
			);
			return false;
		}

		// 기존 애니메이션 제거
		if (this.animatedSprite) {
			this.removeChild(this.animatedSprite);
			this.animatedSprite.destroy();
		}

		// 새 애니메이션 생성
		this.animatedSprite = new PIXI.AnimatedSprite(textures);

		// 애니메이션 설정
		const animation = this.metadata.animations.find(
			(a) => a.name === animationName,
		);
		if (animation) {
			this.animatedSprite.animationSpeed = animation.frameRate / 60; // PixiJS는 fps가 아니라 프레임당 진행 속도를 사용
			this.animatedSprite.loop = animation.loop !== false; // 기본값은 loop
		}

		// 스프라이트 설정
		this.animatedSprite.width = this.metadata.width;
		this.animatedSprite.height = this.metadata.height;
		this.animatedSprite.play();
		this.addChild(this.animatedSprite);

		this.currentAnimation = animationName;
		return true;
	}

	public update(deltaTime: number): void {
		// 필요한 경우 여기서 추가 업데이트 로직 구현
	}

	public setScale(x: number, y: number = x): void {
		if (this.animatedSprite) {
			this.animatedSprite.scale.set(x, y);
		}
	}

	override destroy(): void {
		if (this.animatedSprite) {
			this.animatedSprite.destroy();
		}
		super.destroy();
	}
}
