import * as PIXI from "pixi.js";
import { CharacterKey } from "../types/Character";

interface AssetDefinition {
  type: "texture" | "spritesheet";
  path: string;
  key: keyof GameAssets;
}

interface CharacterAssetDefinition {
  type: "spritesheet";
  path: string;
  key: "characterSprites";
  characterKey: CharacterKey;
}

export interface GameAssets {
  backgroundTexture: PIXI.Texture;
  tilesetSprites: PIXI.Spritesheet;
  birdSprites: PIXI.Spritesheet;
  foodSprites: PIXI.Spritesheet;
  foodMaskSprites: PIXI.Spritesheet; // 음식 마스크 스프라이트시트 추가
  common16x16Sprites: PIXI.Spritesheet; // 빗자루 등의 공통 스프라이트
  common32x32Sprites: PIXI.Spritesheet; // 바구니, 무덤 등의 32x32 공통 스프라이트
  eggSprites: PIXI.Spritesheet; // 알(egg) 스프라이트시트 추가
  characterSprites: { [key in CharacterKey]?: PIXI.Spritesheet };
}

const ASSETS_TO_LOAD: AssetDefinition[] = [
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
  {
    type: "spritesheet",
    path: "/sprites/vite-food-mask.json",
    key: "foodMaskSprites", // 음식 마스크 스프라이트시트 로드 추가
  },
  {
    type: "spritesheet",
    path: "/sprites/common16x16.json",
    key: "common16x16Sprites", // 빗자루 등 공통 스프라이트 로드 추가
  },
  {
    type: "spritesheet",
    path: "/sprites/common32x32.json",
    key: "common32x32Sprites", // 바구니, 무덤 등 32x32 공통 스프라이트 추가
  },
  {
    type: "spritesheet",
    path: "/sprites/eggs.json",
    key: "eggSprites", // 알(egg) 스프라이트시트 로드 추가
  },
];

const CHARACTER_ASSETS_TO_LOAD: AssetDefinition[] = Object.values(
  CharacterKey
).map((key) => ({
  type: "spritesheet",
  path: `/sprites/monsters/${key}.json`,
  key: "characterSprites",
  characterKey: key,
}));

// 텍스처 캐시 (성능 향상을 위함)
const textureCache = new Map<string, PIXI.Texture | null>();

export const AssetLoader = {
  assets: {
    backgroundTexture: PIXI.Texture.WHITE,
    tilesetSprites: null,
    birdSprites: null,
    foodSprites: null,
    foodMaskSprites: null, // 초기값 null 추가
    common16x16Sprites: null, // 초기값 null 추가
    common32x32Sprites: null, // 초기값 null 추가
    eggSprites: null, // 초기값 null 추가
    characterSprites: {},
  } as unknown as GameAssets,
  isLoading: false,
  loadingPromise: null as Promise<GameAssets> | null,
  BASE_PATH: "/game",

  async loadAssets(): Promise<void> {
    console.groupCollapsed(
      "[AssetLoader] AssetLoader.loadAssets() called, loading assets..."
    );
    try {
      console.log(
        "[AssetLoader] Starting to load assets from:",
        this.BASE_PATH
      );

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
    console.groupEnd();
  },
  getAssets(): GameAssets {
    if (this.isLoading) {
      console.warn(
        "[AssetLoader] Assets are still loading, this may cause issues. Consider waiting for loadAssets() to complete."
      );
    }

    if (!this.assets.backgroundTexture) {
      console.warn(
        "[AssetLoader] Background texture not loaded, using fallback"
      );
      this.assets.backgroundTexture = PIXI.Texture.WHITE;
    }

    if (!this.assets.tilesetSprites) {
      console.warn("[AssetLoader] Tileset sprites not loaded, using fallback");
    }

    if (!this.assets.birdSprites) {
      console.warn("[AssetLoader] Bird sprites not loaded, using fallback");
    }

    if (!this.assets.foodSprites) {
      console.warn("[AssetLoader] Food sprites not loaded, using fallback");
    }

    if (!this.assets.foodMaskSprites) {
      console.warn(
        "[AssetLoader] Food mask sprites not loaded, using fallback"
      );
    }

    if (!this.assets.common16x16Sprites) {
      console.warn(
        "[AssetLoader] Common 16x16 sprites not loaded, using fallback"
      );
    }

    if (!this.assets.common32x32Sprites) {
      console.warn(
        "[AssetLoader] Common 32x32 sprites not loaded, using fallback"
      );
    }

    if (!this.assets.eggSprites) {
      console.warn("[AssetLoader] Egg sprites not loaded, using fallback");
    }

    for (const key of Object.values(CharacterKey)) {
      if (!this.assets.characterSprites[key]) {
        console.warn(
          `[AssetLoader] Character sprites not loaded for key: ${key}, ignore.`
        );
      }
    }

    return this.assets;
  },
  async _loadAllAssets(): Promise<GameAssets> {
    try {
      const loadPromises = [
        ...ASSETS_TO_LOAD.map((asset) => this._loadAsset(asset)),
        ...CHARACTER_ASSETS_TO_LOAD.map((asset) =>
          this._loadCharacterAsset(asset as CharacterAssetDefinition)
        ),
      ];

      await Promise.all(loadPromises);

      return this.assets;
    } catch (error) {
      console.error("[AssetLoader] Failed to load all assets:", error);
      throw error;
    }
  },
  async _loadAsset(assetDef: AssetDefinition): Promise<void> {
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
            assetDef.key as
              | "tilesetSprites"
              | "birdSprites"
              | "foodSprites"
              | "foodMaskSprites"
              | "common16x16Sprites"
              | "common32x32Sprites"
              | "eggSprites"
          );
          break;
        default:
          console.warn(`[AssetLoader] Unknown asset type: ${assetDef.type})`);
      }
    } catch (error) {
      console.error(
        `[AssetLoader] Failed to load asset ${assetDef.key}:`,
        error
      );
    }
  },
  async _loadCharacterAsset(assetDef: CharacterAssetDefinition): Promise<void> {
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

      const imagePath = metadata.meta.image;
      console.log(`[AssetLoader] Loading ${assetDef.key} from: ${imagePath}`);

      try {
        const baseTexture = await PIXI.Assets.load(imagePath);
        console.log(
          `[AssetLoader] ${assetDef.key} texture loaded successfully`
        );

        const spritesheet = new PIXI.Spritesheet(baseTexture, {
          frames: metadata.frames,
          meta: metadata.meta,
          animations: metadata.animations,
        });

        console.log(`[AssetLoader] Parsing ${assetDef.key} spritesheet...`);
        await spritesheet.parse();

        const frameKeys = Object.keys(spritesheet.textures || {});
        console.log(
          `[AssetLoader] ${assetDef.key} parsed with frames:`,
          frameKeys
        );

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
  },
  async _loadTexture(path: string, key: "backgroundTexture"): Promise<void> {
    try {
      try {
        this.assets[key] = await PIXI.Assets.load(path);
        console.log(`[AssetLoader] ${key} loaded successfully`);
      } catch (error) {
        console.warn(`[AssetLoader] Failed to load texture at ${path}:`, error);
        console.log("[AssetLoader] Creating solid color fallback texture");

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
  },
  async _loadSpritesheet(
    path: string,
    key:
      | "tilesetSprites"
      | "birdSprites"
      | "foodSprites"
      | "foodMaskSprites"
      | "common16x16Sprites"
      | "common32x32Sprites"
      | "eggSprites"
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

      const imagePath = metadata.meta.image;
      console.log(`[AssetLoader] Loading ${key} from: ${imagePath}`);

      try {
        const baseTexture = await PIXI.Assets.load(imagePath);
        console.log(`[AssetLoader] ${key} texture loaded successfully`);

        const spritesheet = new PIXI.Spritesheet(baseTexture, {
          frames: metadata.frames,
          meta: metadata.meta,
          animations: metadata.animations,
        });

        console.log(`[AssetLoader] Parsing ${key} spritesheet...`);
        await spritesheet.parse();

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
  },
  clearAssets(): void {
    if (this.isLoading) {
      console.warn("Cannot clear assets while loading is in progress");
      return;
    }

    if (this.assets) {
      this.assets.tilesetSprites?.destroy(true);
      this.assets.backgroundTexture?.destroy(true);
      this.assets.birdSprites?.destroy(true);
      this.assets.foodSprites?.destroy(true);
      this.assets.foodMaskSprites?.destroy(true);
      this.assets.common16x16Sprites?.destroy(true);
      this.assets.common32x32Sprites?.destroy(true);
      this.assets.eggSprites?.destroy(true); // egg 스프라이트 정리 추가
      for (const key of Object.keys(this.assets.characterSprites)) {
        this.assets.characterSprites[key as CharacterKey]?.destroy(true);
      }
    }

    // 텍스처 캐시도 초기화
    this.clearTextureCache();

    PIXI.utils.clearTextureCache();
  },
  /**
   * 텍스처 이름으로 직접 검색하여 텍스처를 반환합니다 (캐시 적용)
   * @param textureName 찾을 텍스처 이름
   * @returns PIXI.Texture 또는 null
   */ getTextureByName(textureName: string): PIXI.Texture | null {
    // 캐시에서 먼저 확인
    if (textureCache.has(textureName)) {
      return textureCache.get(textureName) || null;
    }

    const assets = this.getAssets();

    // 빈 이름이거나 null 값인 경우
    if (!textureName) {
      textureCache.set(textureName, null);
      return null;
    }

    // Character sprites 확인
    for (const characterSprites of Object.values(assets.characterSprites)) {
      if (characterSprites?.textures?.[textureName]) {
        const texture = characterSprites.textures[textureName];
        textureCache.set(textureName, texture);
        return texture;
      }
    }

    // 다른 스프라이트시트들 확인
    const spritesheets = [
      assets.birdSprites,
      assets.foodSprites,
      assets.foodMaskSprites,
      assets.common16x16Sprites,
      assets.common32x32Sprites,
      assets.eggSprites,
      assets.tilesetSprites,
    ];

    for (const spritesheet of spritesheets) {
      if (spritesheet?.textures?.[textureName]) {
        const texture = spritesheet.textures[textureName];
        textureCache.set(textureName, texture);
        return texture;
      }
    }

    // 백그라운드 텍스처 확인 (특별한 경우)
    if (textureName === "grass-tile" && assets.backgroundTexture) {
      textureCache.set(textureName, assets.backgroundTexture);
      return assets.backgroundTexture;
    }

    // 캐시에 null 저장 (다음번에 다시 검색하지 않도록)
    textureCache.set(textureName, null);
    return null;
  },

  /**
   * 모든 로드된 텍스처를 맵 형태로 반환합니다
   * @returns Map<textureName, PIXI.Texture>
   */
  getAllTexturesMap(): Map<string, PIXI.Texture> {
    const textureMap = new Map<string, PIXI.Texture>();
    const assets = this.getAssets();

    // Character sprites 추가
    for (const characterSprites of Object.values(assets.characterSprites)) {
      if (characterSprites?.textures) {
        for (const [name, texture] of Object.entries(
          characterSprites.textures
        )) {
          textureMap.set(name, texture);
        }
      }
    }

    // 다른 스프라이트시트들 추가
    const spritesheets = [
      assets.birdSprites,
      assets.foodSprites,
      assets.foodMaskSprites,
      assets.common16x16Sprites,
      assets.common32x32Sprites,
      assets.eggSprites,
      assets.tilesetSprites,
    ];

    for (const spritesheet of spritesheets) {
      if (spritesheet?.textures) {
        for (const [name, texture] of Object.entries(spritesheet.textures)) {
          textureMap.set(name, texture);
        }
      }
    }

    // 백그라운드 텍스처 추가
    if (assets.backgroundTexture) {
      textureMap.set("grass-tile", assets.backgroundTexture);
    }

    return textureMap;
  },

  /**
   * 로드된 모든 텍스처 이름 목록을 반환합니다
   * @returns string[] 텍스처 이름 배열
   */
  getAvailableTextureNames(): string[] {
    return Array.from(this.getAllTexturesMap().keys());
  },

  /**
   * 텍스처가 존재하는지 확인합니다
   * @param textureName 확인할 텍스처 이름
   * @returns boolean
   */
  hasTexture(textureName: string): boolean {
    return this.getTextureByName(textureName) !== null;
  },

  /**
   * 텍스처 캐시를 초기화합니다
   */
  clearTextureCache(): void {
    textureCache.clear();
    console.log("[AssetLoader] Texture cache cleared");
  },

  /**
   * 캐시 상태 정보를 반환합니다
   */
  getCacheInfo(): { size: number; keys: string[] } {
    return {
      size: textureCache.size,
      keys: Array.from(textureCache.keys()),
    };
  },
};
