import assert from "node:assert/strict";
import test from "node:test";
import { addComponent } from "bitecs";
import {
  CharacterStatusComp,
  ObjectComp,
  RandomMovementComp,
  SpeedComp,
} from "../raw-components";
import { GAME_CONSTANTS } from "../config";
import { getCharacterStats } from "../characterStats";
import { randomMovementSystem } from "../systems/RandomMovementSystem";
import { CharacterState } from "../types";
import {
  createTestCharacter,
  createTestWorld,
  withMockedDateNow,
  withMockedRandom,
} from "../../../test-utils/mainSceneTestUtils";

test("urgent 상태 캐릭터는 랜덤 이동 시작 시 20% 감속된 속도를 사용한다", () => {
  const world = createTestWorld({ now: 1_000 });
  const eid = withMockedDateNow(1_000, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 0,
    }),
  );
  const expectedSpeed =
    getCharacterStats(CharacterStatusComp.characterKey[eid]).speed *
    GAME_CONSTANTS.URGENT_SPEED_MULTIPLIER;

  addComponent(world, RandomMovementComp, eid);
  RandomMovementComp.minIdleTime[eid] = 1_000;
  RandomMovementComp.maxIdleTime[eid] = 1_000;
  RandomMovementComp.minMoveTime[eid] = 2_000;
  RandomMovementComp.maxMoveTime[eid] = 2_000;
  RandomMovementComp.nextChange[eid] = world.currentTime;

  withMockedRandom(0, () => {
    randomMovementSystem({
      world: world as any,
      delta: 16,
    });
  });

  assert.equal(ObjectComp.state[eid], CharacterState.MOVING);
  assert.ok(Math.abs(SpeedComp.value[eid] - expectedSpeed) < 0.000001);
});
