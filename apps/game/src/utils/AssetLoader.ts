import * as PIXI from "pixi.js";
import { CharacterKey } from "../types/Character";

export type GameAssets = {
  birdSprites?: PIXI.Spritesheet;
  common16x16Sprites?: PIXI.Spritesheet;
  common32x32Sprites?: PIXI.Spritesheet;
  tilesetSprites?: PIXI.Spritesheet;
  characterSprites: Partial<Record<CharacterKey, PIXI.Spritesheet>>;
};

type AssetDefinition = {
  alias: string;
  src: string;
};

const ASSET_DEFINITIONS: AssetDefinition[] = [
function applyNearestScaleMode(asset: unknown): void {
  if (asset instanceof PIXI.Texture) {
    asset.source.scaleMode = "nearest";
    return;
  }

  if (asset instanceof PIXI.Spritesheet) {
    asset.textureSource.scaleMode = "nearest";
  }
}

  {
    alias: "bird",
    src: "/assets/game/sprites/bird.json",
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
  {
    alias: CharacterKey.TestGreenSlimeA1,
    src: "/assets/game/sprites/monsters/green-slime_A1.json",
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
  private static loadPromise: Promise<GameAssets> | null = null;

  static async loadAssets(): Promise<GameAssets> {
    if (this.loadPromise) {
      return this.loadPromise;
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

      return this.getAssets();
    })();

    try {
      return await this.loadPromise;
    } catch (error) {
      this.loadPromise = null;
      throw error;
    }
  }

  static preloadAssets(): Promise<GameAssets> {
    return this.loadAssets();
  }

  static getAssets(): GameAssets {
    return {
      birdSprites: getSpritesheet("bird"),
      common16x16Sprites: getSpritesheet("common16x16"),
      common32x32Sprites: getSpritesheet("common32x32"),
      tilesetSprites: getSpritesheet("game-tileset"),
      characterSprites: {
        [CharacterKey.TestGreenSlimeA1]: getSpritesheet(
          CharacterKey.TestGreenSlimeA1,
        ),
      },
    };
  }
}

export default AssetLoader;
