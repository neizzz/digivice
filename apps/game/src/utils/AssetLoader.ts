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
];

const CHARACTER_ASSETS_TO_LOAD: AssetDefinition[] = Object.values(
  CharacterKey
).map((key) => ({
  type: "spritesheet",
  path: `/sprites/monsters/${key}.json`,
  key: "characterSprites",
  characterKey: key,
}));

export const AssetLoader = {
  assets: {
    backgroundTexture: PIXI.Texture.WHITE,
    tilesetSprites: null,
    birdSprites: null,
    foodSprites: null,
    foodMaskSprites: null, // 초기값 null 추가
    characterSprites: {},
  } as unknown as GameAssets,
  isLoading: false,
  loadingPromise: null as Promise<GameAssets> | null,
  BASE_PATH: "/game",
  async loadAssets(): Promise<void> {
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

    for (const key of Object.values(CharacterKey)) {
      if (!this.assets.characterSprites[key]) {
        console.warn(
          `[AssetLoader] Character sprites not loaded for key: ${key}, using fallback`
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
    key: "tilesetSprites" | "birdSprites" | "foodSprites" | "foodMaskSprites"
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
      for (const key of Object.keys(this.assets.characterSprites)) {
        this.assets.characterSprites[key as CharacterKey]?.destroy(true);
      }
    }

    PIXI.utils.clearTextureCache();
  },
};
