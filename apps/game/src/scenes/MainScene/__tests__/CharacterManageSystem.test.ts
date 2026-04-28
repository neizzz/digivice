import assert from "node:assert/strict";
import test from "node:test";
import { addEntity, hasComponent } from "bitecs";
import {
  CharacterStatusComp,
  RenderComp,
  TemporaryStatusComp,
} from "../raw-components";
import {
  applyReentryHappyStatusForFullStaminaCharacters,
  characterManagerSystem,
  getRemainingEvolutionGaugeTime,
  getRemainingStaminaDecreaseTime,
  resetCharacterManageSystemStateForTests,
} from "../systems/CharacterManageSystem";
import { GAME_CONSTANTS } from "../config";
import {
  CharacterStatus,
  CharacterState,
  TextureKey,
  getRandomEggTextureKey,
} from "../types";
import { EVOLUTION_GAUGE_CONFIG } from "../evolutionConfig";
import {
  createTestCharacter,
  createTestWorld,
  withMockedDateNow,
  withMockedRandom,
} from "../../../test-utils/mainSceneTestUtils";

test.beforeEach(() => {
  resetCharacterManageSystemStateForTests();
});

test("깨어있는 캐릭터의 스테미나는 12분마다 0.25씩 감소한다", () => {
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

  assert.equal(CharacterStatusComp.stamina[awakeEid], 4.75);
});

test("수면 중 캐릭터의 스테미나는 sleeping multiplier 기준으로 더 천천히 감소한다", () => {
  const world = createTestWorld({ now: 10_000 });

  const sleepingEid = withMockedDateNow(10_000, () =>
    createTestCharacter(world, {
      state: CharacterState.SLEEPING,
      stamina: 5,
      x: 80,
      y: 80,
    }),
  );

  characterManagerSystem({
    world: world as any,
    delta:
      GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL /
      GAME_CONSTANTS.SLEEPING_STAMINA_DECAY_MULTIPLIER,
  });

  assert.equal(CharacterStatusComp.stamina[sleepingEid], 4.75);
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

test("egg 상태 캐릭터는 스테미나와 진화 게이지가 변하지 않는다", () => {
  const world = createTestWorld({ now: 0 });

  const eggEid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.EGG,
      stamina: 5,
      x: 80,
      y: 80,
    }),
  );
  CharacterStatusComp.evolutionGage[eggEid] = 12;

  characterManagerSystem({
    world: world as any,
    delta: Math.max(
      GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL * 3,
      EVOLUTION_GAUGE_CONFIG.checkIntervalMs * 3,
    ),
  });

  assert.equal(CharacterStatusComp.stamina[eggEid], 5);
  assert.equal(CharacterStatusComp.evolutionGage[eggEid], 12);
  assert.equal(
    getRemainingStaminaDecreaseTime(eggEid),
    GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL,
  );
  assert.equal(getRemainingEvolutionGaugeTime(eggEid), null);
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

test("reentry 시 최대 스테미나 캐릭터만 happy 임시 상태를 얻는다", () => {
  const world = createTestWorld({ now: 30_000 });

  const fullStaminaEid = withMockedDateNow(30_000, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: GAME_CONSTANTS.MAX_STAMINA,
      x: 80,
      y: 80,
    }),
  );

  const partialStaminaEid = withMockedDateNow(30_001, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: GAME_CONSTANTS.MAX_STAMINA - GAME_CONSTANTS.STAMINA_DECREASE_AMOUNT,
      x: 140,
      y: 80,
    }),
  );

  const eggEid = withMockedDateNow(30_002, () =>
    createTestCharacter(world, {
      state: CharacterState.EGG,
      stamina: GAME_CONSTANTS.MAX_STAMINA,
      x: 200,
      y: 80,
    }),
  );

  applyReentryHappyStatusForFullStaminaCharacters(world as any);

  assert.ok(
    Array.from(CharacterStatusComp.statuses[fullStaminaEid]).includes(
      CharacterStatus.HAPPY,
    ),
  );
  assert.equal(hasComponent(world, TemporaryStatusComp, fullStaminaEid), true);
  assert.equal(TemporaryStatusComp.statusType[fullStaminaEid], CharacterStatus.HAPPY);
  assert.equal(TemporaryStatusComp.startTime[fullStaminaEid], 30_000);

  assert.equal(
    Array.from(CharacterStatusComp.statuses[partialStaminaEid]).includes(
      CharacterStatus.HAPPY,
    ),
    false,
  );
  assert.equal(
    Array.from(CharacterStatusComp.statuses[eggEid]).includes(CharacterStatus.HAPPY),
    false,
  );
});

test("수면 중 진화 게이지는 깨어있을 때의 1/3 속도로 오른다", () => {
  const awakeWorld = createTestWorld({ now: 0 });
  const sleepingWorld = createTestWorld({ now: 0 });

  const awakeEid = withMockedDateNow(0, () =>
    createTestCharacter(awakeWorld, {
      state: CharacterState.IDLE,
      stamina: 5,
      x: 80,
      y: 80,
    }),
  );

  addEntity(sleepingWorld);
  const sleepingEid = withMockedDateNow(0, () =>
    createTestCharacter(sleepingWorld, {
      state: CharacterState.SLEEPING,
      stamina: 5,
      x: 140,
      y: 80,
    }),
  );

  characterManagerSystem({
    world: awakeWorld as any,
    delta: EVOLUTION_GAUGE_CONFIG.checkIntervalMs,
  });
  characterManagerSystem({
    world: sleepingWorld as any,
    delta: EVOLUTION_GAUGE_CONFIG.checkIntervalMs,
  });

  const awakeGaugeAfterOneInterval =
    CharacterStatusComp.evolutionGage[awakeEid];
  assert.ok(awakeGaugeAfterOneInterval > 0);
  assert.equal(CharacterStatusComp.evolutionGage[sleepingEid], 0);
  assert.ok(
    Math.abs(
      (getRemainingEvolutionGaugeTime(sleepingEid) ?? 0) -
        EVOLUTION_GAUGE_CONFIG.checkIntervalMs * 2,
    ) < 0.000001,
  );

  characterManagerSystem({
    world: sleepingWorld as any,
    delta: EVOLUTION_GAUGE_CONFIG.checkIntervalMs * 2,
  });

  assert.ok(
    Math.abs(
      CharacterStatusComp.evolutionGage[sleepingEid] - awakeGaugeAfterOneInterval,
    ) < 0.000001,
  );
});

test("스테미나가 4 이상일 때 진화 게이지가 오른다", () => {
  const world = createTestWorld({ now: 0 });

  const eligibleEid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: EVOLUTION_GAUGE_CONFIG.staminaThreshold,
      x: 80,
      y: 80,
    }),
  );
  const ineligibleEid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: EVOLUTION_GAUGE_CONFIG.staminaThreshold - 0.01,
      x: 140,
      y: 80,
    }),
  );

  characterManagerSystem({
    world: world as any,
    delta: EVOLUTION_GAUGE_CONFIG.checkIntervalMs,
  });

  assert.ok(CharacterStatusComp.evolutionGage[eligibleEid] > 0);
  assert.equal(CharacterStatusComp.evolutionGage[ineligibleEid], 0);
  assert.equal(getRemainingEvolutionGaugeTime(ineligibleEid), null);
});

test("스테미나가 8 이상이면 진화 게이지 증가량이 10% 커진다", () => {
  const world = createTestWorld({ now: 0 });

  const normalEid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: EVOLUTION_GAUGE_CONFIG.staminaThreshold,
      x: 80,
      y: 80,
    }),
  );
  const boostedEid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: EVOLUTION_GAUGE_CONFIG.boostedStaminaThreshold,
      x: 140,
      y: 80,
    }),
  );

  characterManagerSystem({
    world: world as any,
    delta: EVOLUTION_GAUGE_CONFIG.checkIntervalMs,
  });

  const normalGauge = CharacterStatusComp.evolutionGage[normalEid];
  const boostedGauge = CharacterStatusComp.evolutionGage[boostedEid];

  assert.ok(normalGauge > 0);
  assert.ok(
    Math.abs(
      boostedGauge -
        normalGauge * EVOLUTION_GAUGE_CONFIG.boostedGaugeGainMultiplier,
    ) < 0.000001,
  );
});
