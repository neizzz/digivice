import assert from "node:assert/strict";
import test from "node:test";
import * as PIXI from "pixi.js";
import { AssetLoader } from "../utils/AssetLoader";
import { CharacterKey } from "../types/Character";

test("AssetLoader.getAssets는 캐시에 없는 캐릭터 alias를 조회하지 않는다", () => {
  const originalHas = PIXI.Cache.has.bind(PIXI.Cache);
  const originalGet = PIXI.Cache.get.bind(PIXI.Cache);
  const hasCalls: string[] = [];
  const getCalls: string[] = [];
  const loadedAliases = new Set<string>([
    "bird",
    "flappy-cloud",
    "common16x16",
    "common32x32",
    "game-tileset",
    CharacterKey.TestGreenSlimeA1,
  ]);
  const fakeSpritesheet = Object.create(PIXI.Spritesheet.prototype);

  (PIXI.Cache as unknown as { has: (key: string) => boolean }).has = (
    key: string,
  ) => {
    hasCalls.push(key);
    return loadedAliases.has(key);
  };

  (PIXI.Cache as unknown as { get: (key: string) => unknown }).get = (
    key: string,
  ) => {
    getCalls.push(key);
    return fakeSpritesheet;
  };

  try {
    const assets = AssetLoader.getAssets();

    assert.ok(assets.birdSprites instanceof PIXI.Spritesheet);
    assert.ok(
      assets.characterSprites[CharacterKey.TestGreenSlimeA1] instanceof
        PIXI.Spritesheet,
    );
    assert.equal(
      assets.characterSprites[CharacterKey.TestGreenSlimeC1],
      undefined,
    );
    assert.equal(
      assets.characterSprites[CharacterKey.TestGreenSlimeC2],
      undefined,
    );
    assert.ok(hasCalls.includes(CharacterKey.TestGreenSlimeC1));
    assert.ok(hasCalls.includes(CharacterKey.TestGreenSlimeC2));
    assert.equal(getCalls.includes(CharacterKey.TestGreenSlimeC1), false);
    assert.equal(getCalls.includes(CharacterKey.TestGreenSlimeC2), false);
  } finally {
    (PIXI.Cache as unknown as { has: typeof originalHas }).has = originalHas;
    (PIXI.Cache as unknown as { get: typeof originalGet }).get = originalGet;
  }
});
