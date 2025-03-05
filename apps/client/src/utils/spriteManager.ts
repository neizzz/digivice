import { SpriteMetadata } from "../types/sprites";

class SpriteManager {
  private sprites: Map<string, SpriteMetadata> = new Map();

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

      // 이미지 프리로드
      const img = new Image();
      img.src = metadata.image;

      return metadata;
    } catch (error) {
      console.error(`Failed to load sprite: ${id}`, error);
      return undefined;
    }
  }

  getSprite(id: string): SpriteMetadata | undefined {
    return this.sprites.get(id);
  }
}

export const spriteManager = new SpriteManager();
