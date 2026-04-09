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
    src: "/assets/game/sprites/monsters/test-green-slime_A1.json",
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
  static async loadAssets(): Promise<GameAssets> {
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

        await PIXI.Assets.load(alias);
      }),
    );

    return this.getAssets();
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
