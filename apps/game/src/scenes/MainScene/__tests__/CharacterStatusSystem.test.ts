import assert from "node:assert/strict";
import test from "node:test";
import { hasComponent } from "bitecs";
import {
  AnimationRenderComp,
  CharacterStatusComp,
  ObjectComp,
  RenderComp,
  SpeedComp,
  VitalityComp,
} from "../raw-components";
import { characterStatusSystem } from "../systems/CharacterStatusSystem";
import { GAME_CONSTANTS } from "../config";
import { CharacterState, CharacterStatus, TextureKey } from "../types";
import {
  createTestCharacter,
  createTestWorld,
  withMockedDateNow,
} from "../../../test-utils/mainSceneTestUtils";

test("스테미나 0은 URGENT와 deathTime을 만들고 deathTime을 넘기면 tomb 상태가 된다", () => {
  const world = createTestWorld({ now: 5_000 });
  const eid = withMockedDateNow(5_000, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 5,
    }),
  );

  CharacterStatusComp.stamina[eid] = 0;

  characterStatusSystem({
    world: world as any,
    currentTime: 5_000,
  });

  assert.ok(Array.from(CharacterStatusComp.statuses[eid]).includes(CharacterStatus.URGENT));
  assert.equal(VitalityComp.urgentStartTime[eid], 5_000);
  assert.equal(VitalityComp.deathTime[eid], 5_000 + GAME_CONSTANTS.DEATH_DELAY);

  characterStatusSystem({
    world: world as any,
    currentTime: 5_000 + GAME_CONSTANTS.DEATH_DELAY,
  });

  assert.equal(ObjectComp.state[eid], CharacterState.DEAD);
  assert.equal(VitalityComp.isDead[eid], 1);
  assert.equal(RenderComp.textureKey[eid], TextureKey.TOMB);
  assert.equal(SpeedComp.value[eid], 0);
  assert.equal(hasComponent(world, AnimationRenderComp, eid), false);
});
