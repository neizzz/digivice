import * as PIXI from "pixi.js";
import { CharacterKey } from "../types/CharacterKey";

export interface GameAssets {
  backgroundTexture: PIXI.Texture;
  tilesetSprites: PIXI.Spritesheet; // flappy bird 미니게임 타일 시트
  birdSprites: PIXI.Spritesheet; // flappy bird
  foodSprites: PIXI.Spritesheet; // 추가: 음식 스프라이트시트
  characterSprites: { [key in CharacterKey]?: PIXI.Spritesheet }; // 캐릭터 스프라이트시트 저장용 맵
}

// 로드할 에셋 정의
interface AssetDefinition {
  type: "texture" | "spritesheet";
  path: string;
  key: keyof GameAssets;
}

// 캐릭터 전용 에셋 정의
interface CharacterAssetDefinition {
  type: "spritesheet";
  path: string;
  key: "characterSprites";
  characterKey: CharacterKey;
}

export class AssetLoader {
  private static assets: GameAssets = {
    characterSprites: {},
  };
  private static isLoading: boolean = false;
  private static loadingPromise: Promise<GameAssets> | null = null;

  // 개발 환경에서는 /game 경로 사용
  private static readonly BASE_PATH = "/game";

  // 로드할 모든 에셋 정의
  private static readonly ASSETS_TO_LOAD: AssetDefinition[] = [
    {
      type: "texture",
      path: "/tiles/grass-tile.jpg",
      key: "backgroundTexture",
    },
    {
      type: "spritesheet",
      path: "/sprites/tiles/game-tileset.json",
      key: "tilesetSprites",
    },
    {
      type: "spritesheet",
      path: "/sprites/bird.json",
      key: "birdSprites",
    },
    {
      type: "spritesheet",
      path: "/sprites/food.json",
      key: "foodSprites",
    },
  ];

  // 캐릭터 전용 에셋 정의
  private static readonly CHARACTER_ASSETS_TO_LOAD: CharacterAssetDefinition[] =
    Object.values(CharacterKey).map((key) => ({
      type: "spritesheet",
      path: `/sprites/monsters/${key}.json`,
      key: "characterSprites",
      characterKey: key,
    }));

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

    // 타일셋 스프라이트시트가 없는 경우 경고
    if (!this.assets.tilesetSprites) {
      console.warn("[AssetLoader] Tileset sprites not loaded, using fallback");
    }

    // 새 스프라이트시트가 없는 경우 경고
    if (!this.assets.birdSprites) {
      console.warn("[AssetLoader] Bird sprites not loaded, using fallback");
    }

    // 음식 스프라이트시트가 없는 경우 경고
    if (!this.assets.foodSprites) {
      console.warn("[AssetLoader] Food sprites not loaded, using fallback");
    }

    // 캐릭터 스프라이트시트가 없는 경우 경고
    Object.values(CharacterKey).forEach((key) => {
      if (!this.assets.characterSprites[key]) {
        console.warn(
          `[AssetLoader] Character sprites not loaded for key: ${key}, using fallback`
        );
      }
    });

    return this.assets;
  }

  private static async _loadAllAssets(): Promise<GameAssets> {
    try {
      const loadPromises = [
        ...this.ASSETS_TO_LOAD.map((asset) => this._loadAsset(asset)),
        ...this.CHARACTER_ASSETS_TO_LOAD.map((asset) =>
          this._loadCharacterAsset(asset)
        ),
      ];

      await Promise.all(loadPromises);
      return this.assets;
    } catch (error) {
      console.error("[AssetLoader] Failed to load all assets:", error);
      throw error;
    }
  }

  /**
   * 정의된 에셋을 유형에 맞게 로드합니다
   */
  private static async _loadAsset(assetDef: AssetDefinition): Promise<void> {
    try {
      const fullPath = `${this.BASE_PATH}${assetDef.path}`;
      console.log(`[AssetLoader] Loading ${assetDef.type} from: ${fullPath}`);

      switch (assetDef.type) {
        case "texture":
          await this._loadTexture(
            fullPath,
            assetDef.key as "backgroundTexture"
          );
          break;
        case "spritesheet":
          await this._loadSpritesheet(
            fullPath,
            assetDef.key as "tilesetSprites" | "birdSprites" | "foodSprites"
          );
          break;
        default:
          console.warn(
            `[AssetLoader] Unknown asset type: ${(assetDef as any).type}`
          );
      }
    } catch (error) {
      console.error(
        `[AssetLoader] Failed to load asset ${assetDef.key}:`,
        error
      );
    }
  }

  /**
   * 캐릭터 에셋을 로드합니다
   */
  private static async _loadCharacterAsset(
    assetDef: CharacterAssetDefinition
  ): Promise<void> {
    try {
      const fullPath = `${this.BASE_PATH}${assetDef.path}`;
      console.log(`[AssetLoader] Loading ${assetDef.type} from: ${fullPath}`);

      const response = await fetch(fullPath, {
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

      const metadata = await response.json();
      console.log(`[AssetLoader] ${assetDef.key} metadata loaded successfully`);

      // 스프라이트시트 이미지 경로
      const imagePath = metadata.meta.image;
      console.log(`[AssetLoader] Loading ${assetDef.key} from: ${imagePath}`);

      try {
        // 스프라이트시트 텍스처 로드
        const baseTexture = await PIXI.Assets.load(imagePath);
        console.log(
          `[AssetLoader] ${assetDef.key} texture loaded successfully`
        );

        // 스프라이트시트 생성
        const spritesheet = new PIXI.Spritesheet(baseTexture, {
          frames: metadata.frames,
          meta: metadata.meta,
          animations: metadata.animations,
        });

        // 비동기적으로 스프라이트시트 파싱
        console.log(`[AssetLoader] Parsing ${assetDef.key} spritesheet...`);
        await spritesheet.parse();

        // 로그 관련 정보 출력
        const frameKeys = Object.keys(spritesheet.textures || {});
        console.log(
          `[AssetLoader] ${assetDef.key} parsed with frames:`,
          frameKeys
        );

        // 파싱된 스프라이트시트 저장
        this.assets.characterSprites[assetDef.characterKey] = spritesheet;
      } catch (textureError) {
        console.error(
          `[AssetLoader] Failed to load/parse ${assetDef.key}:`,
          textureError
        );
      }
    } catch (error) {
      console.error(`[AssetLoader] Failed to load ${assetDef.key}:`, error);
    }
  }

  /**
   * 텍스처를 로드합니다
   */
  private static async _loadTexture(
    path: string,
    key: "backgroundTexture"
  ): Promise<void> {
    try {
      try {
        this.assets[key] = await PIXI.Assets.load(path);
        console.log(`[AssetLoader] ${key} loaded successfully`);
      } catch (error) {
        console.warn(`[AssetLoader] Failed to load texture at ${path}:`, error);
        console.log("[AssetLoader] Creating solid color fallback texture");

        // 단색 배경 만들기 (연한 파란색)
        const graphics = new PIXI.Graphics();
        graphics.beginFill(0x87cefa);
        graphics.drawRect(0, 0, 800, 600);
        graphics.endFill();

        this.assets[key] = PIXI.RenderTexture.create({
          width: 800,
          height: 600,
          resolution: 1,
        });

        const renderer = PIXI.autoDetectRenderer();
        if (renderer) {
          renderer.render(graphics, {
            renderTexture: this.assets[key] as PIXI.RenderTexture,
          });
        }
      }
    } catch (error) {
      console.error("[AssetLoader] Failed to create texture:", error);
      this.assets[key] = PIXI.Texture.WHITE;
    }
  }

  private static async _loadSpritesheet(
    path: string,
    key: "tilesetSprites" | "birdSprites" | "foodSprites"
  ): Promise<void> {
    try {
      const response = await fetch(path, {
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

      const metadata = await response.json();
      console.log(`[AssetLoader] ${key} metadata loaded successfully`);

      // 스프라이트시트 이미지 경로
      const imagePath = metadata.meta.image;
      console.log(`[AssetLoader] Loading ${key} from: ${imagePath}`);

      try {
        // 스프라이트시트 텍스처 로드
        const baseTexture = await PIXI.Assets.load(imagePath);
        console.log(`[AssetLoader] ${key} texture loaded successfully`);

        // 스프라이트시트 생성
        const spritesheet = new PIXI.Spritesheet(baseTexture, {
          frames: metadata.frames,
          meta: metadata.meta,
          animations: metadata.animations,
        });

        // 비동기적으로 스프라이트시트 파싱
        console.log(`[AssetLoader] Parsing ${key} spritesheet...`);
        await spritesheet.parse();

        // 로그 관련 정보 출력
        const frameKeys = Object.keys(spritesheet.textures || {});
        console.log(`[AssetLoader] ${key} parsed with frames:`, frameKeys);

        this.assets[key] = spritesheet;
      } catch (textureError) {
        console.error(
          `[AssetLoader] Failed to load/parse ${key}:`,
          textureError
        );
      }
    } catch (error) {
      console.error(`[AssetLoader] Failed to load ${key}:`, error);
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
      if (this.assets.tilesetSprites) {
        this.assets.tilesetSprites.destroy(true);
      }

      // 배경 텍스처 해제
      if (this.assets.backgroundTexture) {
        this.assets.backgroundTexture.destroy(true);
      }

      this.assets = {
        characterSprites: {},
      };
    }

    // PIXI 캐시 정리
    PIXI.utils.clearTextureCache();
  }
}
