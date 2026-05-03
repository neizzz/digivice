import assert from "node:assert/strict";
import test from "node:test";
import { addEntity, hasComponent } from "bitecs";
import {
  CharacterStatusComp,
  DiseaseSystemComp,
  ObjectComp,
  PositionComp,
  RandomMovementComp,
  VitalityComp,
} from "../raw-components";
import { GAME_CONSTANTS } from "../config";
import { ReentrySimulator } from "../ReentrySimulator";
import { characterManagerSystem } from "../systems/CharacterManageSystem";
import { characterStatusSystem } from "../systems/CharacterStatusSystem";
import { diseaseSystem } from "../systems/DiseaseSystem";
import { eggHatchSystem } from "../systems/EggHatchSystem";
import { commonMovementSystem } from "../systems/CommonMovementSystem";
import { randomMovementSystem } from "../systems/RandomMovementSystem";
import { animationStateSystem } from "../systems/AnimationStateSystem";
import { CharacterState, CharacterStatus } from "../types";
import {
  createTestCharacter,
  createTestWorld,
  mockLoadedSpritesheetAliases,
  setWorldTime,
  withMockedDateNow,
  withMockedDateNowAsync,
  withMockedRandomAsync,
} from "../../../test-utils/mainSceneTestUtils";

let nextEntitySeed = 0;

const MOBILE_SCREEN_WIDTH = 360;
const MOBILE_SCREEN_HEIGHT = 640;
const MOBILE_POSITION_BOUNDARY = {
  x: 14,
  y: 20,
  width: MOBILE_SCREEN_WIDTH - 28,
  height: MOBILE_SCREEN_HEIGHT - 34,
} as const;

function reserveEntityRange(
  world: ReturnType<typeof createTestWorld>,
  size = 10,
): void {
  for (let i = 0; i < nextEntitySeed; i++) {
    addEntity(world);
  }

  nextEntitySeed += size;
}

function hasStatus(eid: number, status: CharacterStatus): boolean {
  return Array.from(CharacterStatusComp.statuses[eid]).includes(status);
}

function buildReentrySimulationStep(
  simulator: ReentrySimulator,
  options?: { includeDisease?: boolean },
) {
  return (params: {
    world: ReturnType<typeof createTestWorld>;
    delta: number;
  }) => {
    const currentTime = simulator.getCurrentSimulationTime();

    setWorldTime(params.world, currentTime);

    if (options?.includeDisease) {
      diseaseSystem({
        world: params.world as any,
        currentTime,
      });
    }

    eggHatchSystem({
      world: params.world as any,
      currentTime,
    });
    characterManagerSystem({
      world: params.world as any,
      delta: params.delta,
    });
    characterStatusSystem({
      world: params.world as any,
      currentTime,
    });
    randomMovementSystem({
      world: params.world as any,
      delta: params.delta,
    });
    commonMovementSystem({
      world: params.world as any,
      delta: params.delta,
    });
    animationStateSystem({
      world: params.world as any,
      delta: params.delta,
    });
  };
}

test("ReentrySimulator는 경과 시간에 따라 현재 tick 크기 규칙을 유지한다", () => {
  const simulator = new ReentrySimulator() as ReentrySimulator & {
    _getSimulationTickSize: (elapsedTime: number) => number;
  };

  assert.equal(simulator._getSimulationTickSize(9_000), 100);
  assert.equal(simulator._getSimulationTickSize(60_000), 1_000);
  assert.equal(simulator._getSimulationTickSize(20 * 60_000), 10_000);
  assert.equal(simulator._getSimulationTickSize(2 * 60 * 60_000), 60_000);
});

test("reentry는 egg hatch, 이동, urgent death 현재 동작을 함께 반영한다", async () => {
  const world = createTestWorld({
    now: 0,
    isSimulationMode: true,
    positionBoundary: {
      x: 0,
      y: 0,
      width: 1_000,
      height: 1_000,
    },
  });
  reserveEntityRange(world);

  const eggEid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.EGG,
      stamina: 5,
      x: 50,
      y: 50,
    }),
  );

  const urgentEid = withMockedDateNow(1, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 0,
      x: 300,
      y: 50,
    }),
  );

  CharacterStatusComp.statuses[urgentEid][0] = CharacterStatus.URGENT;
  VitalityComp.urgentStartTime[urgentEid] = 0;
  VitalityComp.deathTime[urgentEid] = 5_000;

  const initialEggX = PositionComp.x[eggEid];
  const initialEggY = PositionComp.y[eggEid];
  const simulator = new ReentrySimulator();
  const runSimulationStep = buildReentrySimulationStep(simulator);

  const restoreSpritesheet = mockLoadedSpritesheetAliases([
    "green-slime_A1",
  ]);

  try {
    await withMockedRandomAsync(0, () =>
      withMockedDateNowAsync(GAME_CONSTANTS.EGG_HATCH_TIME + 55_000, async () => {
        await simulator.simulate(
          0,
          ({ world: simulationWorld, delta }) => {
            setWorldTime(simulationWorld as any, simulator.getCurrentSimulationTime());
            runSimulationStep({
              world: simulationWorld as typeof world,
              delta,
            });
          },
          world,
        );
      }),
    );
  } finally {
    restoreSpritesheet();
  }

  assert.notEqual(ObjectComp.state[eggEid], CharacterState.EGG);
  assert.notEqual(ObjectComp.state[eggEid], CharacterState.DEAD);
  assert.ok(
    ObjectComp.state[eggEid] === CharacterState.IDLE ||
      ObjectComp.state[eggEid] === CharacterState.MOVING,
  );
  assert.notEqual(PositionComp.x[eggEid], initialEggX);
  assert.equal(PositionComp.y[eggEid], initialEggY);

  assert.equal(ObjectComp.state[urgentEid], CharacterState.DEAD);
});

test("reentry는 알 부화 시간 전이면 egg 상태와 위치를 유지한다", async () => {
  const world = createTestWorld({
    now: 0,
    isSimulationMode: true,
  });
  reserveEntityRange(world);

  const eggEid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.EGG,
      stamina: 5,
      x: 70,
      y: 90,
    }),
  );

  const simulator = new ReentrySimulator();
  const runSimulationStep = buildReentrySimulationStep(simulator);

  await withMockedRandomAsync(0, () =>
    withMockedDateNowAsync(GAME_CONSTANTS.EGG_HATCH_TIME - 1_000, async () => {
      await simulator.simulate(
        0,
        ({ world: simulationWorld, delta }) => {
          runSimulationStep({
            world: simulationWorld as typeof world,
            delta,
          });
        },
        world,
      );
    }),
  );

  assert.equal(ObjectComp.state[eggEid], CharacterState.EGG);
  assert.equal(PositionComp.x[eggEid], 70);
  assert.equal(PositionComp.y[eggEid], 90);
});

test("reentry는 10초 tick 모바일 경계에서도 부화 후 위치를 갱신한다", async () => {
  const world = createTestWorld({
    now: 0,
    isSimulationMode: true,
    positionBoundary: MOBILE_POSITION_BOUNDARY,
  });
  reserveEntityRange(world);

  const initialEggX =
    MOBILE_POSITION_BOUNDARY.x + MOBILE_POSITION_BOUNDARY.width / 2;
  const initialEggY =
    MOBILE_POSITION_BOUNDARY.y + MOBILE_POSITION_BOUNDARY.height / 2;

  const eggEid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.EGG,
      stamina: 5,
      x: initialEggX,
      y: initialEggY,
    }),
  );

  const simulator = new ReentrySimulator();
  const runSimulationStep = buildReentrySimulationStep(simulator);
  const restoreSpritesheet = mockLoadedSpritesheetAliases([
    "green-slime_A1",
  ]);

  try {
    await withMockedRandomAsync(0, () =>
      withMockedDateNowAsync(
        GAME_CONSTANTS.EGG_HATCH_TIME + 10 * 60_000,
        async () => {
        await simulator.simulate(
          0,
          ({ world: simulationWorld, delta }) => {
            runSimulationStep({
              world: simulationWorld as typeof world,
              delta,
            });
          },
          world,
        );
        },
      ),
    );
  } finally {
    restoreSpritesheet();
  }

  assert.notEqual(ObjectComp.state[eggEid], CharacterState.EGG);
  assert.ok(Math.abs(PositionComp.x[eggEid] - initialEggX) > 0.001);
  assert.ok(PositionComp.x[eggEid] >= MOBILE_POSITION_BOUNDARY.x);
  assert.ok(
    PositionComp.x[eggEid] <=
      MOBILE_POSITION_BOUNDARY.x + MOBILE_POSITION_BOUNDARY.width,
  );
  assert.ok(PositionComp.y[eggEid] >= MOBILE_POSITION_BOUNDARY.y);
  assert.ok(
    PositionComp.y[eggEid] <=
      MOBILE_POSITION_BOUNDARY.y + MOBILE_POSITION_BOUNDARY.height,
  );
});

test("reentry는 deathTime 전까지 urgent 상태를 유지한 채 살아있다", async () => {
  const world = createTestWorld({
    now: 0,
    isSimulationMode: true,
  });
  reserveEntityRange(world);

  const eid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 0,
      x: 120,
      y: 140,
    }),
  );

  CharacterStatusComp.statuses[eid][0] = CharacterStatus.URGENT;
  VitalityComp.urgentStartTime[eid] = 0;
  VitalityComp.deathTime[eid] = 5_000;

  const simulator = new ReentrySimulator();
  const runSimulationStep = buildReentrySimulationStep(simulator);

  await withMockedRandomAsync(0, () =>
    withMockedDateNowAsync(4_000, async () => {
      await simulator.simulate(
        0,
        ({ world: simulationWorld, delta }) => {
          runSimulationStep({
            world: simulationWorld as typeof world,
            delta,
          });
        },
        world,
      );
    }),
  );

  assert.notEqual(ObjectComp.state[eid], CharacterState.DEAD);
  assert.equal(hasStatus(eid, CharacterStatus.URGENT), true);
  assert.equal(VitalityComp.deathTime[eid], 5_000);
});

test("reentry는 elapsed 동안 stamina가 0이 되면 urgent와 deathTime을 만든다", async () => {
  const world = createTestWorld({
    now: 0,
    isSimulationMode: true,
  });
  reserveEntityRange(world);

  const eid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: GAME_CONSTANTS.STAMINA_DECREASE_AMOUNT,
      x: 160,
      y: 200,
    }),
  );

  const simulator = new ReentrySimulator();
  const runSimulationStep = buildReentrySimulationStep(simulator);

  await withMockedRandomAsync(0, () =>
    withMockedDateNowAsync(GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL, async () => {
      await simulator.simulate(
        0,
        ({ world: simulationWorld, delta }) => {
          runSimulationStep({
            world: simulationWorld as typeof world,
            delta,
          });
        },
        world,
      );
    }),
  );

  assert.equal(CharacterStatusComp.stamina[eid], 0);
  assert.equal(hasStatus(eid, CharacterStatus.URGENT), true);
  assert.equal(
    VitalityComp.urgentStartTime[eid],
    GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL,
  );
  assert.equal(
    VitalityComp.deathTime[eid],
    GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL + GAME_CONSTANTS.DEATH_DELAY,
  );
  assert.notEqual(ObjectComp.state[eid], CharacterState.DEAD);
});

test("reentry는 disease check 시점과 확률이 맞으면 sick 상태로 바뀐다", async () => {
  const world = createTestWorld({
    now: 0,
    isSimulationMode: true,
  });
  reserveEntityRange(world);

  const eid = withMockedDateNow(0, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 5,
      x: 220,
      y: 260,
    }),
  );

  const simulator = new ReentrySimulator();
  const runSimulationStep = buildReentrySimulationStep(simulator, {
    includeDisease: true,
  });

  await withMockedRandomAsync(0, () =>
    withMockedDateNowAsync(GAME_CONSTANTS.DISEASE_CHECK_INTERVAL, async () => {
      await simulator.simulate(
        0,
        ({ world: simulationWorld, delta }) => {
          runSimulationStep({
            world: simulationWorld as typeof world,
            delta,
          });
        },
        world,
      );
    }),
  );

  assert.equal(ObjectComp.state[eid], CharacterState.SICK);
  assert.equal(hasStatus(eid, CharacterStatus.SICK), true);
  assert.equal(
    DiseaseSystemComp.sickStartTime[eid],
    GAME_CONSTANTS.DISEASE_CHECK_INTERVAL,
  );
  assert.equal(hasComponent(world, RandomMovementComp, eid), false);
});
