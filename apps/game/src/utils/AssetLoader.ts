import * as PIXI from "pixi.js";

export interface GameAssets {
  backgroundTexture?: PIXI.Texture;
  slimeSprites?: PIXI.Spritesheet;
  tilesetSprites?: PIXI.Spritesheet; // 추가: 타일셋 스프라이트시트
}

export class AssetLoader {
  private static assets: GameAssets = {};
  private static isLoading: boolean = false;
  private static loadingPromise: Promise<GameAssets> | null = null;

  // 개발 환경에서는 /game 경로 사용
  private static readonly BASE_PATH = "/game";

  public static async loadAssets(): Promise<void> {
    try {
      console.log(
        "[AssetLoader] Starting to load assets from:",
        this.BASE_PATH
      );

      // 이미 로딩 중인지 확인
      if (this.isLoading) {
        console.log(
          "[AssetLoader] Assets are already being loaded, waiting..."
        );
        await this.loadingPromise;
        return;
      }

      this.isLoading = true;
      this.loadingPromise = this._loadAllAssets();

      await this.loadingPromise;
      this.isLoading = false;
      console.log("[AssetLoader] All assets loaded successfully");
    } catch (error) {
      this.isLoading = false;
      console.error("[AssetLoader] Error loading assets:", error);
      throw error;
    }
  }

  /**
   * 현재 로드된 에셋을 반환합니다.
   * @returns 로드된 게임 에셋 객체
   */
  public static getAssets(): GameAssets {
    // 에셋이 로딩 중이면 경고 표시
    if (this.isLoading) {
      console.warn(
        "[AssetLoader] Assets are still loading, this may cause issues. Consider waiting for loadAssets() to complete."
      );
    }

    // 기본 텍스처가 없는 경우 임시 텍스처 생성
    if (!this.assets.backgroundTexture) {
      console.warn(
        "[AssetLoader] Background texture not loaded, using fallback"
      );
      this.assets.backgroundTexture = PIXI.Texture.WHITE;
    }

    // 스프라이트시트가 없는 경우 임시 객체 생성
    if (!this.assets.slimeSprites) {
      console.warn("[AssetLoader] Slime sprites not loaded, using fallback");
      this.assets.slimeSprites = {} as PIXI.Spritesheet;
    }

    // 타일셋 스프라이트시트가 없는 경우 경고
    if (!this.assets.tilesetSprites) {
      console.warn("[AssetLoader] Tileset sprites not loaded, using fallback");
    }

    return this.assets;
  }

  private static async _loadAllAssets(): Promise<GameAssets> {
    try {
      // 배경 텍스처 로드
      await this.loadBackgroundTexture();

      // 스프라이트시트 로드
      await this.loadSpriteSheets();

      return this.assets;
    } catch (error) {
      console.error("[AssetLoader] Failed to load all assets:", error);
      throw error;
    }
  }

  /**
   * 배경 텍스처를 로드합니다
   */
  private static async loadBackgroundTexture(): Promise<void> {
    try {
      console.log("[AssetLoader] Loading background texture");

      // 배경 텍스처 경로 설정 (기본 배경 이미지)
      const bgPath = `${this.BASE_PATH}/tiles/grass-tile.jpg`;

      try {
        // 실제 배경 이미지 로드 시도
        this.assets.backgroundTexture = await PIXI.Assets.load(bgPath);
        console.log("[AssetLoader] Background texture loaded successfully");
      } catch (bgError) {
        // 이미지 로드 실패 시 단색 텍스처 생성
        console.warn(
          `[AssetLoader] Failed to load background image at ${bgPath}:`,
          bgError
        );
        console.log("[AssetLoader] Creating solid color background texture");

        // 단색 배경 만들기 (연한 파란색)
        const graphics = new PIXI.Graphics();
        graphics.beginFill(0x87cefa); // 연한 파란색
        graphics.drawRect(0, 0, 800, 600); // 기본 크기 설정
        graphics.endFill();

        this.assets.backgroundTexture = PIXI.RenderTexture.create({
          width: 800,
          height: 600,
          resolution: 1,
        });

        // 그래픽을 텍스처로 렌더링
        const renderer = PIXI.autoDetectRenderer();
        if (renderer) {
          renderer.render(graphics, {
            renderTexture: this.assets.backgroundTexture as PIXI.RenderTexture,
          });
          console.log("[AssetLoader] Created solid color background texture");
        }
      }
    } catch (error) {
      console.error(
        "[AssetLoader] Failed to create background texture:",
        error
      );
      // 기본 텍스처 설정 (흰색)
      this.assets.backgroundTexture = PIXI.Texture.WHITE;
    }
  }

  private static async loadSpriteSheets(): Promise<void> {
    try {
      // 슬라임 스프라이트시트 로드
      await this.loadSlimeSpritesheet();

      // 타일셋 스프라이트시트 로드
      await this.loadTilesetSpritesheet();
    } catch (error) {
      console.error("[AssetLoader] Failed to load sprite sheets:", error);
    }
  }

  /**
   * 슬라임 스프라이트시트를 로드합니다
   */
  private static async loadSlimeSpritesheet(): Promise<void> {
    try {
      // 슬라임 스프라이트시트 메타데이터 로드
      const slimeMetadataPath = `${this.BASE_PATH}/sprites/monsters/test-slime/metadata.json`;
      console.log(
        "[AssetLoader] Loading slime metadata from:",
        slimeMetadataPath
      );

      // 직접 파일 시스템 경로 확인 (디버깅용)
      console.log(
        "[AssetLoader] Full URL path:",
        new URL(slimeMetadataPath, window.location.origin).href
      );

      const response = await fetch(slimeMetadataPath, {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to load metadata: ${response.status} ${response.statusText}`
        );
      }

      const slimeMetadata = await response.json();
      console.log("[AssetLoader] Slime metadata loaded successfully");
      console.log(
        "[AssetLoader] Metadata animations:",
        slimeMetadata.animations
      );

      // 스프라이트시트 이미지 경로 로깅
      const imagePath = slimeMetadata.meta.image;
      console.log("[AssetLoader] Loading sprite sheet from:", imagePath);

      try {
        // 스프라이트시트 텍스처 로드
        const baseTexture = await PIXI.Assets.load(imagePath);
        console.log("[AssetLoader] Sprite sheet texture loaded successfully");

        // 간소화된 스프라이트시트 생성 방법 사용
        // PIXI의 내장 메서드를 활용하여 spritesheet 생성
        const spritesheet = new PIXI.Spritesheet(baseTexture, {
          frames: slimeMetadata.frames,
          meta: slimeMetadata.meta,
          animations: slimeMetadata.animations,
        });

        // 비동기적으로 스프라이트시트 파싱
        console.log("[AssetLoader] Parsing spritesheet...");
        await spritesheet.parse();

        // 파싱 결과 확인
        const animationKeys = Object.keys(spritesheet.animations || {});
        console.log(
          "[AssetLoader] Spritesheet parsed successfully with animations:",
          animationKeys
        );

        if (animationKeys.length === 0) {
          console.warn(
            "[AssetLoader] No animations found in parsed spritesheet!"
          );
        }

        // idle 애니메이션 확인
        if (spritesheet.animations && spritesheet.animations.idle) {
          const frames = spritesheet.animations.idle;
          console.log(
            `[AssetLoader] Idle animation found with ${frames.length} frames`
          );
        } else {
          console.warn(
            "[AssetLoader] 'idle' animation not found in spritesheet"
          );
        }

        // 파싱된 스프라이트시트 저장
        this.assets.slimeSprites = spritesheet;
      } catch (textureError) {
        console.error(
          "[AssetLoader] Failed to load/parse spritesheet:",
          textureError
        );
      }
    } catch (error) {
      console.error("[AssetLoader] Failed to load slime sprites:", error);
    }
  }

  /**
   * 타일셋 스프라이트시트를 로드합니다
   */
  private static async loadTilesetSpritesheet(): Promise<void> {
    try {
      // 타일셋 스프라이트시트 메타데이터 로드
      const tilesetMetadataPath = `${this.BASE_PATH}/sprites/tiles/game-tileset/metadata.json`;
      console.log(
        "[AssetLoader] Loading tileset metadata from:",
        tilesetMetadataPath
      );

      const response = await fetch(tilesetMetadataPath, {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to load tileset metadata: ${response.status} ${response.statusText}`
        );
      }

      const tilesetMetadata = await response.json();
      console.log("[AssetLoader] Tileset metadata loaded successfully");

      // 스프라이트시트 이미지 경로
      const imagePath = tilesetMetadata.meta.image;
      console.log("[AssetLoader] Loading tileset from:", imagePath);

      try {
        // 스프라이트시트 텍스처 로드
        const baseTexture = await PIXI.Assets.load(imagePath);
        console.log("[AssetLoader] Tileset texture loaded successfully");

        // 스프라이트시트 생성
        const spritesheet = new PIXI.Spritesheet(baseTexture, {
          frames: tilesetMetadata.frames,
          meta: tilesetMetadata.meta,
        });

        // 비동기적으로 스프라이트시트 파싱
        console.log("[AssetLoader] Parsing tileset spritesheet...");
        await spritesheet.parse();

        // 파싱된 프레임 확인
        const frameKeys = Object.keys(spritesheet.textures || {});
        console.log(
          "[AssetLoader] Tileset spritesheet parsed successfully with frames:",
          frameKeys
        );

        // 파싱된 스프라이트시트 저장
        this.assets.tilesetSprites = spritesheet;
      } catch (textureError) {
        console.error(
          "[AssetLoader] Failed to load/parse tileset spritesheet:",
          textureError
        );
      }
    } catch (error) {
      console.error("[AssetLoader] Failed to load tileset sprites:", error);
    }
  }

  // 필요시 에셋 캐시를 지우는 메서드 추가
  public static clearAssets(): void {
    // 로딩 중인 경우 완료될 때까지 대기
    if (this.isLoading) {
      console.warn("Cannot clear assets while loading is in progress");
      return;
    }

    if (this.assets) {
      // 스프라이트시트의 텍스처 해제
      if (this.assets.slimeSprites) {
        this.assets.slimeSprites.destroy(true);
      }

      // 타일셋 스프라이트시트 해제
      if (this.assets.tilesetSprites) {
        this.assets.tilesetSprites.destroy(true);
      }

      // 배경 텍스처 해제
      if (this.assets.backgroundTexture) {
        this.assets.backgroundTexture.destroy(true);
      }

      this.assets = {};
    }

    // PIXI 캐시 정리
    PIXI.utils.clearTextureCache();
  }
}
