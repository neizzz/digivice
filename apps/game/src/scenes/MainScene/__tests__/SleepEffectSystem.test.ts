import assert from "node:assert/strict";
import test from "node:test";
import * as PIXI from "pixi.js";
import { sleepEffectSystem } from "../systems/SleepEffectSystem";
import { CharacterState } from "../types";
import { MainSceneWorld } from "../world";
import {
  createTestCharacter,
  createTestWorld,
  type TestWorld,
} from "../../../test-utils/mainSceneTestUtils";

type SleepEffectTestWorld = TestWorld & {
  stage: PIXI.Container;
  isSleepDebugEffectEnabled: () => boolean;
};

function createSleepEffectWorld(now = 0): SleepEffectTestWorld {
  const world = createTestWorld({ now }) as SleepEffectTestWorld;

  world.stage = new PIXI.Container();
  world.isSleepDebugEffectEnabled = () => true;

  return world;
}

test("sleepEffectSystem은 수면 아이콘 렌더링을 StatusIconRenderSystem에 위임하므로 별도 컨테이너를 만들지 않는다", () => {
  const world = createSleepEffectWorld();

  createTestCharacter(world, {
    state: CharacterState.SLEEPING,
    x: 120,
    y: 100,
  });

  sleepEffectSystem({
    world: world as unknown as MainSceneWorld,
    delta: 16,
    stage: world.stage,
  });

  assert.equal(world.stage.children.length, 0);
});

test("sleepEffectSystem은 stage가 없어도 안전하게 no-op으로 동작한다", () => {
  const world = createSleepEffectWorld();

  createTestCharacter(world, {
    state: CharacterState.SLEEPING,
    x: 120,
    y: 100,
  });

  assert.doesNotThrow(() => {
    sleepEffectSystem({
      world: world as unknown as MainSceneWorld,
      delta: 16,
      stage: null,
    });
  });
});
