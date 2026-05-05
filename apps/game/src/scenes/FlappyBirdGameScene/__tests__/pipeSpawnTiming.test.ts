import assert from "node:assert/strict";
import test from "node:test";
import * as Matter from "matter-js";
import { PipeManager } from "../gameLogic";

function createPipeManager(spawnInterval = 100): PipeManager {
  return new PipeManager(
    {
      screen: {
        width: 360,
        height: 640,
      },
    } as any,
    {} as any,
    4,
    spawnInterval,
    100,
  );
}

function createPlayerBody(): Matter.Body {
  return Matter.Bodies.rectangle(80, 200, 40, 40, { isStatic: true });
}

test("게임 시작 직후 첫 업데이트에서는 첫 pipe가 즉시 생성된다", () => {
  const manager = createPipeManager(100) as any;
  const playerBody = createPlayerBody();

  manager.createPipePattern = () => 1;

  const stats = manager.update(playerBody, () => {}, 16);

  assert.equal(stats.spawned, 1);
});

test("settings pause처럼 업데이트가 멈춘 시간은 pipe 생성 간격에 누적되지 않는다", () => {
  const manager = createPipeManager(100) as any;
  const playerBody = createPlayerBody();

  manager.createPipePattern = () => 1;

  manager.update(playerBody, () => {}, 16);

  // settings 레이어가 떠 있는 동안에는 update가 호출되지 않으므로
  // 긴 wall-clock 공백이 있어도 복귀 첫 프레임에서 바로 spawn되면 안 된다.
  const resumeStats = manager.update(playerBody, () => {}, 16);
  assert.equal(resumeStats.spawned, 0);

  let accumulatedSpawned = 0;
  for (let i = 0; i < 5; i += 1) {
    accumulatedSpawned += manager.update(playerBody, () => {}, 16).spawned;
  }
  assert.equal(accumulatedSpawned, 0);

  const nextSpawnStats = manager.update(playerBody, () => {}, 16);
  assert.equal(nextSpawnStats.spawned, 1);
});
