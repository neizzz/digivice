import * as PIXI from "pixi.js";
import type { SpriteMetadata, TextureMap } from "../types/Sprites";

class SpriteManager {
	private sprites: Map<string, SpriteMetadata> = new Map();
	private textures: Map<string, TextureMap> = new Map();

	constructor() {
		// PIXI 로더 설정
		PIXI.Assets.init();
	}

	async loadSprite(id: string): Promise<SpriteMetadata | undefined> {
		// 이미 로드된 스프라이트가 있으면 반환
		if (this.sprites.has(id)) {
			return this.sprites.get(id);
		}

		try {
			// 스프라이트 메타데이터 동적 로드
			const spriteModule = await import(
				`../assets/sprites/${id}/metadata.json`
			);
			const metadata: SpriteMetadata = spriteModule.default;
			this.sprites.set(id, metadata);

			// 스프라이트시트 이미지 로드
			const baseTexture = await PIXI.Assets.load(metadata.image);

			// 각 애니메이션과 프레임에 대한 텍스처 생성
			const textureMap: TextureMap = {};

			for (const animation of metadata.animations) {
				const frames = animation.frames.map(
					(frame) =>
						new PIXI.Texture(
							baseTexture.baseTexture,
							new PIXI.Rectangle(frame.x, frame.y, frame.width, frame.height),
						),
				);
				textureMap[animation.name] = frames;
			}

			this.textures.set(id, textureMap);

			return metadata;
		} catch (error) {
			console.error(`Failed to load sprite: ${id}`, error);
			return undefined;
		}
	}

	getSprite(id: string): SpriteMetadata | undefined {
		return this.sprites.get(id);
	}

	getTextures(id: string): TextureMap | undefined {
		return this.textures.get(id);
	}

	getAnimationTextures(
		id: string,
		animationName: string,
	): PIXI.Texture[] | undefined {
		const textureMap = this.textures.get(id);
		if (!textureMap) return undefined;

		return textureMap[animationName];
	}
}

export default new SpriteManager();
