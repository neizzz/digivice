import assert from "node:assert/strict";
import test from "node:test";
import { GameEngine } from "../GameEngine";

test("GameEngine는 physics step 성능 샘플을 hook으로 전달한다", () => {
  const samples: Array<{
    deltaMs: number;
    engineUpdateCostMs: number;
    syncDisplayCostMs: number;
  }> = [];

  const gameEngine = new GameEngine(320, 480, 2.5, {
    onPhysicsStep: (sample) => {
      samples.push(sample);
    },
  }) as unknown as {
    isRunning: boolean;
    pixiApp: object | null;
    physicsUpdate: (delta: number) => void;
  };

  gameEngine.isRunning = true;
  gameEngine.pixiApp = {};
  gameEngine.physicsUpdate(16.7);

  assert.equal(samples.length, 1);
  assert.ok(Math.abs((samples[0]?.deltaMs ?? 0) - 1000 / 60) < 0.01);
  assert.equal(typeof samples[0]?.engineUpdateCostMs, "number");
  assert.equal(typeof samples[0]?.syncDisplayCostMs, "number");
});

test("GameEngine는 큰 delta를 고정 스텝으로 clamp해서 처리한다", () => {
  const samples: Array<{
    deltaMs: number;
    engineUpdateCostMs: number;
    syncDisplayCostMs: number;
  }> = [];

  const gameEngine = new GameEngine(320, 480, 2.5, {
    onPhysicsStep: (sample) => {
      samples.push(sample);
    },
  }) as unknown as {
    isRunning: boolean;
    pixiApp: object | null;
    physicsUpdate: (delta: number) => void;
  };

  gameEngine.isRunning = true;
  gameEngine.pixiApp = {};
  gameEngine.physicsUpdate(50);

  assert.equal(samples.length, 1);
  assert.ok((samples[0]?.deltaMs ?? 0) <= 33.4);
  assert.equal(typeof samples[0]?.engineUpdateCostMs, "number");
  assert.equal(typeof samples[0]?.syncDisplayCostMs, "number");
});
