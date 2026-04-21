import assert from "node:assert/strict";
import test from "node:test";
import { CharacterStatusComp, RenderComp } from "../raw-components";
import { characterManagerSystem } from "../systems/CharacterManageSystem";
import { GAME_CONSTANTS } from "../config";
import {
  CharacterState,
  TextureKey,
  getRandomEggTextureKey,
} from "../types";
import {
  createTestCharacter,
  createTestWorld,
  withMockedDateNow,
  withMockedRandom,
} from "../../../test-utils/mainSceneTestUtils";

test("깨어있는 캐릭터의 스테미나는 현재 interval 기준으로 감소한다", () => {
  const world = createTestWorld({ now: 10_000 });

  const awakeEid = withMockedDateNow(10_000, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 5,
      x: 80,
      y: 80,
    }),
  );

  characterManagerSystem({
    world: world as any,
    delta: GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL,
  });

  assert.equal(CharacterStatusComp.stamina[awakeEid], 4);
});

test("egg 상태 캐릭터는 처음 한 번 랜덤 egg 텍스처를 배정받는다", () => {
  const world = createTestWorld({ now: 0 });

  const eggEid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.EGG,
      x: 80,
      y: 80,
    }),
  );

  RenderComp.textureKey[eggEid] = TextureKey.NULL;

  withMockedRandom(0.5, () => {
    characterManagerSystem({
      world: world as any,
      delta: 16,
    });
  });

  assert.equal(RenderComp.textureKey[eggEid], getRandomEggTextureKey(0.5));
});

test("부화한 캐릭터는 어떤 egg 텍스처를 쓰고 있었든 정적 egg 텍스처를 제거한다", () => {
  const world = createTestWorld({ now: 0 });

  const hatchedEid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      x: 80,
      y: 80,
    }),
  );

  RenderComp.textureKey[hatchedEid] = TextureKey.EGG15;

  characterManagerSystem({
    world: world as any,
    delta: 16,
  });

  assert.equal(RenderComp.textureKey[hatchedEid], TextureKey.NULL);
});
