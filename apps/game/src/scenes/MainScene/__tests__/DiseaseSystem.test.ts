import assert from "node:assert/strict";
import test from "node:test";
import { hasComponent } from "bitecs";
import {
  CharacterStatusComp,
  DestinationComp,
  ObjectComp,
  RandomMovementComp,
} from "../raw-components";
import { diseaseSystem } from "../systems/DiseaseSystem";
import { CharacterState, CharacterStatus } from "../types";
import {
  createTestCharacter,
  createTestWorld,
  withMockedDateNow,
} from "../../../test-utils/mainSceneTestUtils";

test("sick 상태는 현재 movement restriction을 걸고 회복되면 복원한다", () => {
  const world = createTestWorld({ now: 20_000 });
  const eid = withMockedDateNow(20_000, () =>
    createTestCharacter(world, {
      state: CharacterState.SICK,
      stamina: 5,
    }),
  );

  CharacterStatusComp.statuses[eid][0] = CharacterStatus.SICK;

  diseaseSystem({
    world: world as any,
    currentTime: 20_000,
  });

  assert.equal(hasComponent(world, RandomMovementComp, eid), false);
  assert.equal(hasComponent(world, DestinationComp, eid), false);

  CharacterStatusComp.statuses[eid][0] = ECS_NULL_VALUE;
  ObjectComp.state[eid] = CharacterState.IDLE;

  diseaseSystem({
    world: world as any,
    currentTime: 20_001,
  });

  assert.equal(hasComponent(world, RandomMovementComp, eid), true);
});
