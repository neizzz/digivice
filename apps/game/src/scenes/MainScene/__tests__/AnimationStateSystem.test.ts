import assert from "node:assert/strict";
import test from "node:test";
import { AnimationRenderComp, ObjectComp } from "../raw-components";
import { animationStateSystem } from "../systems/AnimationStateSystem";
import { AnimationKey, CharacterState } from "../types";
import {
  createTestCharacter,
  createTestWorld,
  withMockedDateNow,
} from "../../../test-utils/mainSceneTestUtils";

test("비수면 상태 애니메이션은 현재 기본 매핑과 속도를 유지한다", () => {
  const world = createTestWorld({ now: 1_000 });
  const eid = withMockedDateNow(1_000, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 5,
    }),
  );

  ObjectComp.state[eid] = CharacterState.MOVING;
  animationStateSystem({ world: world as any, delta: 0 });

  assert.equal(AnimationRenderComp.animationKey[eid], AnimationKey.WALKING);
  assert.ok(Math.abs(AnimationRenderComp.speed[eid] - 0.04) < 0.000001);

  ObjectComp.state[eid] = CharacterState.IDLE;
  animationStateSystem({ world: world as any, delta: 0 });

  assert.equal(AnimationRenderComp.animationKey[eid], AnimationKey.IDLE);
  assert.ok(Math.abs(AnimationRenderComp.speed[eid] - 0.03) < 0.000001);
});
