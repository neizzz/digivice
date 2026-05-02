import * as PIXI from "pixi.js";
import { CharacterKey } from "../types/Character";

export type GameAssets = {
  birdSprites?: PIXI.Spritesheet;
  flappyCloudSprites?: PIXI.Spritesheet;
  common16x16Sprites?: PIXI.Spritesheet;
  common32x32Sprites?: PIXI.Spritesheet;
  tilesetSprites?: PIXI.Spritesheet;
  characterSprites: Partial<Record<CharacterKey, PIXI.Spritesheet>>;
};

type AssetDefinition = {
  alias: string;
  src: string;
};

function applyNearestScaleMode(asset: unknown): void {
  if (asset instanceof PIXI.Texture) {
    asset.source.scaleMode = "nearest";
    return;
  }

  if (asset instanceof PIXI.Spritesheet) {
    asset.textureSource.scaleMode = "nearest";
  }
}

const ASSET_DEFINITIONS: AssetDefinition[] = [
  {
    alias: "bird",
    src: "/assets/game/sprites/bird.json",
  },
  {
    alias: "flappy-cloud",
    src: "/assets/game/sprites/clouds.json",
  },
  {
    alias: "common16x16",
    src: "/assets/game/sprites/common16x16.json",
  },
  {
    alias: "common32x32",
    src: "/assets/game/sprites/common32x32.json",
  },
  {
    alias: "game-tileset",
    src: "/assets/game/sprites/tiles/game-tileset.json",
  },
];

function getSpritesheet(alias: string): PIXI.Spritesheet | undefined {
  try {
    const asset = PIXI.Assets.get(alias);

    return asset instanceof PIXI.Spritesheet ? asset : undefined;
  } catch {
    return undefined;
  }
}

export class AssetLoader {
  private static loadPromise: Promise<void> | null = null;
  private static characterLoadPromises = new Map<CharacterKey, Promise<void>>();

  static async loadAssets(
    characterKey: CharacterKey = CharacterKey.TestGreenSlimeA1,
  ): Promise<GameAssets> {
    if (this.loadPromise) {
      await this.loadPromise;
      await this.ensureCharacterSpritesheetLoaded(
        CharacterKey.TestGreenSlimeA1,
      );
      await this.ensureCharacterSpritesheetLoaded(characterKey);
      return this.getAssets();
    }

    this.loadPromise = (async () => {
      await Promise.all(
        ASSET_DEFINITIONS.map(async ({ alias, src }) => {
          if (getSpritesheet(alias)) {
            return;
          }

          try {
            PIXI.Assets.add({
              alias,
              src,
            });
          } catch {
            // 이미 등록된 alias일 수 있으므로 무시
          }

          const asset = await PIXI.Assets.load(alias);
          applyNearestScaleMode(asset);
        }),
      );
    })();

    try {
      await this.loadPromise;
      await this.ensureCharacterSpritesheetLoaded(
        CharacterKey.TestGreenSlimeA1,
      );
      await this.ensureCharacterSpritesheetLoaded(characterKey);
      return this.getAssets();
    } catch (error) {
      this.loadPromise = null;
      throw error;
    }
  }

  static preloadAssets(
    characterKey: CharacterKey = CharacterKey.TestGreenSlimeA1,
  ): Promise<GameAssets> {
    return this.loadAssets(characterKey);
  }

  static getAssets(): GameAssets {
    const characterSprites: Partial<Record<CharacterKey, PIXI.Spritesheet>> =
      {};

    for (const characterKey of Object.values(CharacterKey)) {
      const spritesheet = getSpritesheet(characterKey);
      if (spritesheet) {
        characterSprites[characterKey] = spritesheet;
      }
    }

    return {
      birdSprites: getSpritesheet("bird"),
      flappyCloudSprites: getSpritesheet("flappy-cloud"),
      common16x16Sprites: getSpritesheet("common16x16"),
      common32x32Sprites: getSpritesheet("common32x32"),
      tilesetSprites: getSpritesheet("game-tileset"),
      characterSprites,
    };
  }

  private static async ensureCharacterSpritesheetLoaded(
    characterKey: CharacterKey,
  ): Promise<void> {
    if (getSpritesheet(characterKey)) {
      return;
    }

    const existingPromise = this.characterLoadPromises.get(characterKey);
    if (existingPromise) {
      await existingPromise;
      return;
    }

    const loadPromise = (async () => {
      try {
        PIXI.Assets.add({
          alias: characterKey,
          src: `/assets/game/sprites/monsters/${characterKey}.json`,
        });
      } catch {
        // 이미 등록된 alias일 수 있으므로 무시
      }

      const asset = await PIXI.Assets.load(characterKey);
      applyNearestScaleMode(asset);
    })();

    this.characterLoadPromises.set(characterKey, loadPromise);

    try {
      await loadPromise;
    } catch (error) {
      this.characterLoadPromises.delete(characterKey);
      throw error;
    }
  }
}

export default AssetLoader;
