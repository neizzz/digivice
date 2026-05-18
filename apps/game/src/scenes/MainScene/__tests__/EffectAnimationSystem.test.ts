import assert from "node:assert/strict";
import test from "node:test";
import {
  addComponent,
  addEntity,
  createWorld,
  hasComponent,
  removeComponent,
} from "bitecs";
import * as PIXI from "pixi.js";
import { MainSceneWorld } from "../world";
import { GAME_CONSTANTS } from "../config";
import {
  CharacterStatusComp,
  DestinationComp,
  EggHatchComp,
  EffectAnimationComp,
  ObjectComp,
  RandomMovementComp,
  SleepSystemComp,
  SpeedComp,
  TemporaryStatusComp,
} from "../raw-components";
import {
  CharacterStatus,
  CharacterState,
  DestinationType,
  EffectAnimationType,
  FoodState,
  ObjectType,
  SleepMode,
} from "../types";
import {
  effectAnimationSystem,
  startEffectAnimation,
} from "../systems/EffectAnimationSystem";
import {
  createTestCharacter,
  withMockedDateNow,
} from "../../../test-utils/mainSceneTestUtils";

function createMainSceneWorldForTest(): MainSceneWorld {
  const world = new MainSceneWorld({
    stage: new PIXI.Container(),
    positionBoundary: {
      x: 0,
      y: 0,
      width: 300,
      height: 300,
    },
  });

  createWorld(world, 100);

  return world;
}

test("invalid entity slot이어도 hospital 선택 시 effect animation이 크래시하지 않는다", () => {
  const world = createMainSceneWorldForTest();

  ObjectComp.type[0] = ObjectType.CHARACTER;

  assert.doesNotThrow(() => {
    (
      world as unknown as { _handleHospitalSelection: () => void }
    )._handleHospitalSelection();
  });
});

test("invalid entity slot으로 effect animation 시작을 요청해도 addComponent 예외 없이 무시된다", () => {
  const world = createMainSceneWorldForTest();

  ObjectComp.type[0] = ObjectType.CHARACTER;

  assert.doesNotThrow(() => {
    startEffectAnimation(
      world,
      0,
      null,
      0,
      EffectAnimationType.RECOVERY_SYRINGE,
    );
  });

  assert.equal(EffectAnimationComp.isActive[0], 0);
});

test("live character entity에서는 hospital 선택 시 recovery animation이 정상 시작된다", () => {
  const world = createMainSceneWorldForTest();
  const characterEid = createTestCharacter(
    world as unknown as Parameters<typeof createTestCharacter>[0],
    {
      state: CharacterState.SICK,
    },
  );

  assert.doesNotThrow(() => {
    (
      world as unknown as { _handleHospitalSelection: () => void }
    )._handleHospitalSelection();
  });

  assert.equal(EffectAnimationComp.isActive[characterEid], 1);
});

test("egg 상태에서 hospital 선택은 syringeCount를 최대 10회까지 누적한다", () => {
  const world = createMainSceneWorldForTest();
  const characterEid = createTestCharacter(
    world as unknown as Parameters<typeof createTestCharacter>[0],
    {
      state: CharacterState.EGG,
    },
  );

  for (let i = 0; i < 12; i++) {
    (
      world as unknown as { _handleHospitalSelection: () => boolean }
    )._handleHospitalSelection();
    removeComponent(world, EffectAnimationComp, characterEid);
  }

  assert.equal(EggHatchComp.syringeCount[characterEid], 10);
});

test("recovery syringe가 꽂힌 뒤부터 사라질 때까지 recovery vibration start/stop이 호출된다", () => {
  const world = createMainSceneWorldForTest();
  const characterEid = createTestCharacter(
    world as unknown as Parameters<typeof createTestCharacter>[0],
    {
      state: CharacterState.SICK,
    },
  );

  let startCount = 0;
  let stopCount = 0;
  let impactCount = 0;
  const sfxKinds: string[] = [];

  world.startRecoveryVibration = () => {
    startCount += 1;
  };
  world.stopRecoveryVibration = () => {
    stopCount += 1;
  };
  world.triggerMainSceneSfx = (kind) => {
    sfxKinds.push(kind);
  };
  world.applyPendingRecoverySyringeImpact = () => {
    impactCount += 1;
  };

  startEffectAnimation(
    world,
    characterEid,
    null,
    0,
    EffectAnimationType.RECOVERY_SYRINGE,
  );

  effectAnimationSystem({
    world,
    currentTime: 239,
    stage: null,
  });
  assert.equal(startCount, 0);
  assert.equal(impactCount, 0);
  assert.deepEqual(sfxKinds, []);

  effectAnimationSystem({
    world,
    currentTime: 240,
    stage: null,
  });
  assert.equal(startCount, 0);
  assert.equal(impactCount, 0);
  assert.deepEqual(sfxKinds, ["syringe-insert"]);

  effectAnimationSystem({
    world,
    currentTime: 300,
    stage: null,
  });
  assert.equal(startCount, 1);
  assert.equal(impactCount, 1);
  assert.deepEqual(sfxKinds, ["syringe-insert"]);

  effectAnimationSystem({
    world,
    currentTime: 1600,
    stage: null,
  });
  assert.equal(stopCount, 1);
  assert.deepEqual(sfxKinds, ["syringe-insert"]);
});

test("recovery syringe impact는 stale destination을 지우고 free roaming을 즉시 복구한다", () => {
  const world = createMainSceneWorldForTest();
  const characterEid = withMockedDateNow(0, () =>
    createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.SICK,
      },
    ),
  );

  CharacterStatusComp.statuses[characterEid][0] = CharacterStatus.SICK;
  SpeedComp.value[characterEid] = 0.1;

  const foodEid = addEntity(world);
  addComponent(world, ObjectComp, foodEid);
  ObjectComp.id[foodEid] = 10_000 + foodEid;
  ObjectComp.type[foodEid] = ObjectType.FOOD;
  ObjectComp.state[foodEid] = FoodState.TARGETED;

  addComponent(world, DestinationComp, characterEid);
  DestinationComp.type[characterEid] = DestinationType.TARGETED;
  DestinationComp.target[characterEid] = foodEid;
  DestinationComp.x[characterEid] = 120;
  DestinationComp.y[characterEid] = 90;

  removeComponent(world, RandomMovementComp, characterEid);

  assert.equal(hasComponent(world, RandomMovementComp, characterEid), false);

  withMockedDateNow(0, () => {
    (
      world as unknown as { _handleHospitalSelection: () => boolean }
    )._handleHospitalSelection();
  });

  effectAnimationSystem({
    world,
    currentTime: 300,
    stage: null,
  });

  assert.equal(ObjectComp.state[characterEid], CharacterState.IDLE);
  assert.equal(CharacterStatusComp.statuses[characterEid][0], 0);
  assert.equal(hasComponent(world, DestinationComp, characterEid), false);
  assert.equal(hasComponent(world, RandomMovementComp, characterEid), true);
  assert.equal(SpeedComp.value[characterEid], 0);
  assert.equal(ObjectComp.state[foodEid], FoodState.LANDED);
});

test("recovery syringe impact는 낮잠 중 sickness만 치료하고 수면은 유지한다", () => {
  const world = createMainSceneWorldForTest();
  const characterEid = withMockedDateNow(0, () =>
    createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.SLEEPING,
      },
    ),
  );

  CharacterStatusComp.statuses[characterEid][0] = CharacterStatus.SICK;
  SleepSystemComp.sleepMode[characterEid] = SleepMode.DAY_NAP;
  SleepSystemComp.sleepSessionStartedAt[characterEid] = 25;
  SpeedComp.value[characterEid] = 0;

  const foodEid = addEntity(world);
  addComponent(world, ObjectComp, foodEid);
  ObjectComp.id[foodEid] = 20_000 + foodEid;
  ObjectComp.type[foodEid] = ObjectType.FOOD;
  ObjectComp.state[foodEid] = FoodState.TARGETED;

  addComponent(world, DestinationComp, characterEid);
  DestinationComp.type[characterEid] = DestinationType.TARGETED;
  DestinationComp.target[characterEid] = foodEid;
  DestinationComp.x[characterEid] = 160;
  DestinationComp.y[characterEid] = 120;

  removeComponent(world, RandomMovementComp, characterEid);

  withMockedDateNow(0, () => {
    (
      world as unknown as { _handleHospitalSelection: () => boolean }
    )._handleHospitalSelection();
  });

  effectAnimationSystem({
    world,
    currentTime: 300,
    stage: null,
  });

  assert.equal(ObjectComp.state[characterEid], CharacterState.SLEEPING);
  assert.equal(CharacterStatusComp.statuses[characterEid][0], 0);
  assert.equal(SleepSystemComp.sleepMode[characterEid], SleepMode.DAY_NAP);
  assert.equal(SleepSystemComp.sleepSessionStartedAt[characterEid], 25);
  assert.equal(hasComponent(world, DestinationComp, characterEid), false);
  assert.equal(hasComponent(world, RandomMovementComp, characterEid), false);
  assert.equal(SpeedComp.value[characterEid], 0);
  assert.equal(ObjectComp.state[foodEid], FoodState.LANDED);
});

test("recovery syringe impact는 sick 회복 후 stamina가 max면 happy를 부여한다", () => {
  const world = createMainSceneWorldForTest();
  const characterEid = withMockedDateNow(10_000, () =>
    createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.SICK,
        stamina: GAME_CONSTANTS.MAX_STAMINA,
      },
    ),
  );

  CharacterStatusComp.statuses[characterEid][0] = CharacterStatus.SICK;

  withMockedDateNow(10_000, () => {
    (
      world as unknown as { _handleHospitalSelection: () => boolean }
    )._handleHospitalSelection();
  });

  withMockedDateNow(10_300, () => {
    effectAnimationSystem({
      world,
      currentTime: 10_300,
      stage: null,
    });
  });

  assert.ok(
    Array.from(CharacterStatusComp.statuses[characterEid]).includes(
      CharacterStatus.HAPPY,
    ),
  );
  assert.equal(
    TemporaryStatusComp.statusType[characterEid],
    CharacterStatus.HAPPY,
  );
  assert.equal(TemporaryStatusComp.startTime[characterEid], 10_300);
});

test("recovery syringe impact는 sick 회복 후 stamina가 max가 아니면 happy를 부여하지 않는다", () => {
  const world = createMainSceneWorldForTest();
  const characterEid = withMockedDateNow(20_000, () =>
    createTestCharacter(
      world as unknown as Parameters<typeof createTestCharacter>[0],
      {
        state: CharacterState.SICK,
        stamina: GAME_CONSTANTS.MAX_STAMINA - 0.25,
      },
    ),
  );

  CharacterStatusComp.statuses[characterEid][0] = CharacterStatus.SICK;

  withMockedDateNow(20_000, () => {
    (
      world as unknown as { _handleHospitalSelection: () => boolean }
    )._handleHospitalSelection();
  });

  withMockedDateNow(20_300, () => {
    effectAnimationSystem({
      world,
      currentTime: 20_300,
      stage: null,
    });
  });

  assert.equal(
    Array.from(CharacterStatusComp.statuses[characterEid]).includes(
      CharacterStatus.HAPPY,
    ),
    false,
  );
});
