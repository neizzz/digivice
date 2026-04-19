import assert from "node:assert/strict";
import test from "node:test";
import { AnimationKey } from "../types";
import { shouldTriggerEatingBiteVibration } from "../systems/AnimationRenderSystem";

test("eating 애니메이션은 bite 프레임으로 진입할 때만 진동을 트리거한다", () => {
  assert.equal(
    shouldTriggerEatingBiteVibration({
      animationKey: AnimationKey.EATING,
      currentFrameIndex: 0,
      previousFrameIndex: undefined,
    }),
    false,
  );

  assert.equal(
    shouldTriggerEatingBiteVibration({
      animationKey: AnimationKey.EATING,
      currentFrameIndex: 1,
      previousFrameIndex: 0,
    }),
    true,
  );

  assert.equal(
    shouldTriggerEatingBiteVibration({
      animationKey: AnimationKey.EATING,
      currentFrameIndex: 1,
      previousFrameIndex: 1,
    }),
    false,
  );

  assert.equal(
    shouldTriggerEatingBiteVibration({
      animationKey: AnimationKey.EATING,
      currentFrameIndex: 0,
      previousFrameIndex: 1,
    }),
    false,
  );
});

test("eating 외 애니메이션은 동일 프레임 전환이어도 진동을 트리거하지 않는다", () => {
  assert.equal(
    shouldTriggerEatingBiteVibration({
      animationKey: AnimationKey.IDLE,
      currentFrameIndex: 1,
      previousFrameIndex: 0,
    }),
    false,
  );
});
