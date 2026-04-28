import assert from "node:assert/strict";
import test from "node:test";
import { addComponent, addEntity } from "bitecs";
import * as PIXI from "pixi.js";
import { AnimationKey } from "../types";
import { shouldTriggerEatingBiteVibration } from "../systems/AnimationRenderSystem";
import { renderCommonAttributes } from "../systems/RenderSystem";
import { ObjectComp, PositionComp, RenderComp } from "../raw-components";
import { CharacterState, ObjectType, TextureKey } from "../types";
import { createTestCharacter, createTestWorld } from "../../../test-utils/mainSceneTestUtils";

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

test("캐릭터 렌더 좌표는 픽셀 그리드에 맞춰 반올림된다", () => {
  const world = createTestWorld({ now: 0 });
  const eid = createTestCharacter(world, {
    state: CharacterState.IDLE,
    x: 80,
    y: 120,
  });
  const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);

  PositionComp.x[eid] = 80.5;
  PositionComp.y[eid] = 120.4;

  renderCommonAttributes(eid, sprite, world as any);

  assert.equal(sprite.position.x, 81);
  assert.equal(sprite.position.y, 120);
  assert.equal(sprite.zIndex, 120);
});

test("비캐릭터 렌더 좌표는 기존처럼 소수 좌표를 유지한다", () => {
  const world = createTestWorld({ now: 0 });
  const eid = addEntity(world);
  const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);

  addComponent(world, ObjectComp, eid);
  ObjectComp.type[eid] = ObjectType.FOOD;
  ObjectComp.state[eid] = CharacterState.IDLE;

  addComponent(world, PositionComp, eid);
  PositionComp.x[eid] = 10.25;
  PositionComp.y[eid] = 20.75;

  addComponent(world, RenderComp, eid);
  RenderComp.textureKey[eid] = TextureKey.FOOD1;
  RenderComp.scale[eid] = 1;
  RenderComp.zIndex[eid] = ECS_NULL_VALUE;

  renderCommonAttributes(eid, sprite, world as any);

  assert.equal(sprite.position.x, 10.25);
  assert.equal(sprite.position.y, 20.75);
  assert.equal(sprite.zIndex, 20.75);
});
