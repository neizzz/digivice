import assert from "node:assert/strict";
import test from "node:test";
import { createWorld } from "bitecs";
import * as PIXI from "pixi.js";
import { MainSceneWorld } from "../world";
import { EffectAnimationComp, ObjectComp } from "../raw-components";
import {
  CharacterState,
  EffectAnimationType,
  ObjectType,
} from "../types";
import {
  effectAnimationSystem,
  startEffectAnimation,
} from "../systems/EffectAnimationSystem";
import { createTestCharacter } from "../../../test-utils/mainSceneTestUtils";

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
    (world as unknown as { _handleHospitalSelection: () => void })
      ._handleHospitalSelection();
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
    (world as unknown as { _handleHospitalSelection: () => void })
      ._handleHospitalSelection();
  });

  assert.equal(EffectAnimationComp.isActive[characterEid], 1);
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

  world.startRecoveryVibration = () => {
    startCount += 1;
  };
  world.stopRecoveryVibration = () => {
    stopCount += 1;
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
    currentTime: 299,
    stage: null,
  });
  assert.equal(startCount, 0);

  effectAnimationSystem({
    world,
    currentTime: 300,
    stage: null,
  });
  assert.equal(startCount, 1);

  effectAnimationSystem({
    world,
    currentTime: 1600,
    stage: null,
  });
  assert.equal(stopCount, 1);
});
