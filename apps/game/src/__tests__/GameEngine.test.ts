import assert from "node:assert/strict";
import test from "node:test";
import * as Matter from "matter-js";
import { GameEngine } from "../GameEngine";

test("GameEngine는 120Hz tick delta를 누락하지 않고 물리에 적용한다", () => {
  const appliedDeltas: number[] = [];
  const originalUpdate = Matter.Engine.update;
  Matter.Engine.update = ((engine: Matter.Engine, delta?: number) => {
    appliedDeltas.push(delta ?? 0);
    return engine;
  }) as typeof Matter.Engine.update;

  try {
    const gameEngine = new GameEngine(320, 480, 2.5) as unknown as {
      isRunning: boolean;
      pixiApp: object | null;
      physicsUpdate: (delta: number) => void;
    };

    gameEngine.isRunning = true;
    gameEngine.pixiApp = {};
    gameEngine.physicsUpdate(1000 / 120);

    assert.equal(appliedDeltas.length, 1);
    assert.ok(Math.abs((appliedDeltas[0] ?? 0) - 1000 / 120) < 0.01);
  } finally {
    Matter.Engine.update = originalUpdate;
  }
});

test("GameEngine는 큰 delta도 한 번의 물리 update에 그대로 전달한다", () => {
  const appliedDeltas: number[] = [];
  const originalUpdate = Matter.Engine.update;
  Matter.Engine.update = ((engine: Matter.Engine, delta?: number) => {
    appliedDeltas.push(delta ?? 0);
    return engine;
  }) as typeof Matter.Engine.update;

  try {
    const gameEngine = new GameEngine(320, 480, 2.5) as unknown as {
      isRunning: boolean;
      pixiApp: object | null;
      physicsUpdate: (delta: number) => void;
    };

    gameEngine.isRunning = true;
    gameEngine.pixiApp = {};
    gameEngine.physicsUpdate(50);

    assert.deepEqual(appliedDeltas, [50]);
  } finally {
    Matter.Engine.update = originalUpdate;
  }
});
