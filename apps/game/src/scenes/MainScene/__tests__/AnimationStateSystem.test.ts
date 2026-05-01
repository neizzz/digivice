import assert from "node:assert/strict";
import test from "node:test";
import {
  AnimationRenderComp,
  CharacterStatusComp,
  ObjectComp,
} from "../raw-components";
import { GAME_CONSTANTS } from "../config";
import { animationStateSystem } from "../systems/AnimationStateSystem";
import { AnimationKey, CharacterState, CharacterStatus } from "../types";
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

test("urgent 상태 캐릭터 애니메이션은 현재 상태 속도에서 20% 감속된다", () => {
  const world = createTestWorld({ now: 2_000 });
  const eid = withMockedDateNow(2_000, () =>
    createTestCharacter(world, {
      state: CharacterState.MOVING,
      stamina: 5,
    }),
  );

  CharacterStatusComp.statuses[eid][0] = CharacterStatus.URGENT;
  animationStateSystem({ world: world as any, delta: 0 });

  assert.equal(AnimationRenderComp.animationKey[eid], AnimationKey.WALKING);
  assert.ok(
    Math.abs(
      AnimationRenderComp.speed[eid] -
        0.04 * GAME_CONSTANTS.URGENT_SPEED_MULTIPLIER,
    ) < 0.000001,
  );
});
