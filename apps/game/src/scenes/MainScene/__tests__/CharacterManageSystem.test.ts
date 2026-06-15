import assert from "node:assert/strict";
import test from "node:test";
import { addEntity, hasComponent } from "bitecs";
import {
  CharacterStatusComp,
  ObjectComp,
  RenderComp,
  TemporaryStatusComp,
} from "../raw-components";
import {
  applyHappyStatusForFullStaminaCharacterIfEligible,
  applyReentryHappyStatusForFullStaminaCharacters,
  clearTemporaryStatuses,
  characterManagerSystem,
  getRemainingEvolutionGaugeTime,
  getRemainingStaminaDecreaseTime,
  removeCharacterStatus,
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
  setWorldTime,
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

test("초록색 스테미나 영역에서는 30% 빠르게 감소한다", () => {
  const world = createTestWorld({ now: 10_000 });

  const greenEid = withMockedDateNow(10_000, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: GAME_CONSTANTS.BOOSTED_STAMINA_THRESHOLD,
      x: 80,
      y: 80,
    }),
  );

  characterManagerSystem({
    world: world as any,
    delta:
      GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL /
      GAME_CONSTANTS.HIGH_STAMINA_DECAY_MULTIPLIER,
  });

  assert.equal(
    CharacterStatusComp.stamina[greenEid],
    GAME_CONSTANTS.BOOSTED_STAMINA_THRESHOLD -
      GAME_CONSTANTS.STAMINA_DECREASE_AMOUNT,
  );
});

test("빨간색 스테미나 영역에서는 30% 느리게 감소한다", () => {
  const world = createTestWorld({ now: 10_000 });

  const redStamina =
    GAME_CONSTANTS.UNHAPPY_STAMINA_THRESHOLD -
    GAME_CONSTANTS.STAMINA_DECREASE_AMOUNT;
  const redEid = withMockedDateNow(10_000, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: redStamina,
      x: 80,
      y: 80,
    }),
  );

  characterManagerSystem({
    world: world as any,
    delta: GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL,
  });

  assert.equal(CharacterStatusComp.stamina[redEid], redStamina);

  characterManagerSystem({
    world: world as any,
    delta:
      GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL /
        GAME_CONSTANTS.LOW_STAMINA_DECAY_MULTIPLIER -
      GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL,
  });

  assert.equal(
    CharacterStatusComp.stamina[redEid],
    redStamina - GAME_CONSTANTS.STAMINA_DECREASE_AMOUNT,
  );
});

test("수면 중 캐릭터의 스테미나는 sleeping multiplier 기준으로 더 천천히 감소한다", () => {
  const world = createTestWorld({ now: 10_000 });
  assert.equal(GAME_CONSTANTS.SLEEPING_STAMINA_DECAY_MULTIPLIER, 0.2);

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
      stamina:
        GAME_CONSTANTS.MAX_STAMINA - GAME_CONSTANTS.STAMINA_DECREASE_AMOUNT,
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

  const sickEid = withMockedDateNow(30_003, () =>
    createTestCharacter(world, {
      state: CharacterState.SICK,
      stamina: GAME_CONSTANTS.MAX_STAMINA,
      x: 260,
      y: 80,
    }),
  );

  const sleepingEid = withMockedDateNow(30_004, () =>
    createTestCharacter(world, {
      state: CharacterState.SLEEPING,
      stamina: GAME_CONSTANTS.MAX_STAMINA,
      x: 320,
      y: 80,
    }),
  );

  CharacterStatusComp.statuses[sickEid][0] = CharacterStatus.SICK;

  applyReentryHappyStatusForFullStaminaCharacters(world as any);

  assert.ok(
    Array.from(CharacterStatusComp.statuses[fullStaminaEid]).includes(
      CharacterStatus.HAPPY,
    ),
  );
  assert.equal(hasComponent(world, TemporaryStatusComp, fullStaminaEid), true);
  assert.equal(
    TemporaryStatusComp.statusType[fullStaminaEid],
    CharacterStatus.HAPPY,
  );
  assert.equal(TemporaryStatusComp.startTime[fullStaminaEid], 30_000);
  assert.equal(
    TemporaryStatusComp.lastHappyStatusTime[fullStaminaEid],
    30_000,
  );

  assert.equal(
    Array.from(CharacterStatusComp.statuses[partialStaminaEid]).includes(
      CharacterStatus.HAPPY,
    ),
    false,
  );
  assert.equal(
    Array.from(CharacterStatusComp.statuses[eggEid]).includes(
      CharacterStatus.HAPPY,
    ),
    false,
  );
  assert.equal(
    Array.from(CharacterStatusComp.statuses[sickEid]).includes(
      CharacterStatus.HAPPY,
    ),
    false,
  );
  assert.equal(
    Array.from(CharacterStatusComp.statuses[sleepingEid]).includes(
      CharacterStatus.HAPPY,
    ),
    false,
  );
});

test("happy 임시 상태는 캐릭터별 10분 쿨다운이 지나야 다시 발동한다", () => {
  const world = createTestWorld({ now: 100_000 });
  const eid = withMockedDateNow(100_000, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: GAME_CONSTANTS.MAX_STAMINA,
      x: 80,
      y: 80,
    }),
  );

  assert.equal(
    applyHappyStatusForFullStaminaCharacterIfEligible(world as any, eid),
    true,
  );
  assert.ok(
    Array.from(CharacterStatusComp.statuses[eid]).includes(
      CharacterStatus.HAPPY,
    ),
  );
  assert.equal(TemporaryStatusComp.startTime[eid], 100_000);
  assert.equal(TemporaryStatusComp.lastHappyStatusTime[eid], 100_000);

  assert.equal(clearTemporaryStatuses(world as any, eid), true);
  assert.equal(
    Array.from(CharacterStatusComp.statuses[eid]).includes(
      CharacterStatus.HAPPY,
    ),
    false,
  );
  assert.equal(TemporaryStatusComp.lastHappyStatusTime[eid], 100_000);

  setWorldTime(
    world,
    100_000 + GAME_CONSTANTS.HAPPY_EMOTION_COOLDOWN_MS - 1,
  );

  assert.equal(
    applyHappyStatusForFullStaminaCharacterIfEligible(world as any, eid),
    false,
  );
  assert.equal(
    Array.from(CharacterStatusComp.statuses[eid]).includes(
      CharacterStatus.HAPPY,
    ),
    false,
  );
  assert.equal(TemporaryStatusComp.lastHappyStatusTime[eid], 100_000);

  setWorldTime(world, 100_000 + GAME_CONSTANTS.HAPPY_EMOTION_COOLDOWN_MS);

  assert.equal(
    applyHappyStatusForFullStaminaCharacterIfEligible(world as any, eid),
    true,
  );
  assert.ok(
    Array.from(CharacterStatusComp.statuses[eid]).includes(
      CharacterStatus.HAPPY,
    ),
  );
  assert.equal(
    TemporaryStatusComp.startTime[eid],
    100_000 + GAME_CONSTANTS.HAPPY_EMOTION_COOLDOWN_MS,
  );
  assert.equal(
    TemporaryStatusComp.lastHappyStatusTime[eid],
    100_000 + GAME_CONSTANTS.HAPPY_EMOTION_COOLDOWN_MS,
  );
});

test("clearTemporaryStatuses는 happy/discover와 TemporaryStatusComp를 함께 비운다", () => {
  const world = createTestWorld({ now: 10_000 });
  const eid = withMockedDateNow(10_000, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: GAME_CONSTANTS.MAX_STAMINA,
      x: 80,
      y: 80,
    }),
  );

  CharacterStatusComp.statuses[eid][0] = CharacterStatus.HAPPY;
  CharacterStatusComp.statuses[eid][1] = CharacterStatus.DISCOVER;

  assert.equal(hasComponent(world, TemporaryStatusComp, eid), true);
  TemporaryStatusComp.statusType[eid] = CharacterStatus.DISCOVER;
  TemporaryStatusComp.startTime[eid] = 10_000;
  TemporaryStatusComp.lastHappyStatusTime[eid] = 9_000;

  assert.equal(clearTemporaryStatuses(world as any, eid), true);
  assert.deepEqual(Array.from(CharacterStatusComp.statuses[eid]), [0, 0, 0, 0]);
  assert.equal(TemporaryStatusComp.statusType[eid], 0);
  assert.equal(TemporaryStatusComp.startTime[eid], 0);
  assert.equal(TemporaryStatusComp.lastHappyStatusTime[eid], 9_000);
});

test("수면 중 진화 게이지는 깨어있을 때와 같은 속도로 오른다", () => {
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
  assert.ok(
    Math.abs(
      CharacterStatusComp.evolutionGage[sleepingEid] -
        awakeGaugeAfterOneInterval,
    ) < 0.000001,
  );
  assert.equal(
    getRemainingEvolutionGaugeTime(sleepingEid),
    EVOLUTION_GAUGE_CONFIG.checkIntervalMs,
  );
});

test("스테미나가 3 이상일 때 진화 게이지가 오른다", () => {
  const world = createTestWorld({ now: 0 });
  assert.equal(EVOLUTION_GAUGE_CONFIG.staminaThreshold, 3);

  const eligibleEid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 3,
      x: 80,
      y: 80,
    }),
  );
  const ineligibleEid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 2.99,
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

test("sick 상태에서는 진화 게이지가 멈추고 회복 후 다시 오른다", () => {
  const world = createTestWorld({ now: 0 });
  const eid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: EVOLUTION_GAUGE_CONFIG.boostedStaminaThreshold,
      x: 80,
      y: 80,
    }),
  );

  CharacterStatusComp.statuses[eid][0] = CharacterStatus.SICK;

  characterManagerSystem({
    world: world as any,
    delta: EVOLUTION_GAUGE_CONFIG.checkIntervalMs,
  });

  assert.equal(CharacterStatusComp.evolutionGage[eid], 0);
  assert.equal(getRemainingEvolutionGaugeTime(eid), null);

  removeCharacterStatus(eid, CharacterStatus.SICK);
  ObjectComp.state[eid] = CharacterState.IDLE;

  characterManagerSystem({
    world: world as any,
    delta: EVOLUTION_GAUGE_CONFIG.checkIntervalMs,
  });

  assert.ok(CharacterStatusComp.evolutionGage[eid] > 0);
});

test("스테미나가 7 이상이면 진화 게이지 증가량이 20% 커진다", () => {
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
