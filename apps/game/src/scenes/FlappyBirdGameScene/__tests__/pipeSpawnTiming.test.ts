import assert from "node:assert/strict";
import test from "node:test";
import * as Matter from "matter-js";
import * as PIXI from "pixi.js";
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
  let spawned = 0;

  manager.createPipePattern = () => {
    spawned += 1;
  };

  manager.update(playerBody, () => {}, 16);

  assert.equal(spawned, 1);
});

test("settings pause처럼 업데이트가 멈춘 시간은 pipe 생성 간격에 누적되지 않는다", () => {
  const manager = createPipeManager(100) as any;
  const playerBody = createPlayerBody();
  let spawned = 0;

  manager.createPipePattern = () => {
    spawned += 1;
  };

  manager.update(playerBody, () => {}, 16);

  // settings 레이어가 떠 있는 동안에는 update가 호출되지 않으므로
  // 긴 wall-clock 공백이 있어도 복귀 첫 프레임에서 바로 spawn되면 안 된다.
  const spawnedAfterFirstFrame = spawned;
  manager.update(playerBody, () => {}, 16);
  assert.equal(spawned - spawnedAfterFirstFrame, 0);

  const spawnedBeforeAccumulation = spawned;
  for (let i = 0; i < 5; i += 1) {
    manager.update(playerBody, () => {}, 16);
  }
  assert.equal(spawned - spawnedBeforeAccumulation, 0);

  const spawnedBeforeNextFrame = spawned;
  manager.update(playerBody, () => {}, 16);
  assert.equal(spawned - spawnedBeforeNextFrame, 1);
});

test("pipe 이동은 50ms delta를 3 frame scale로 그대로 적용한다", () => {
  const manager = createPipeManager(100) as any;
  const playerBody = createPlayerBody();
  const topBody = Matter.Bodies.rectangle(240, 80, 40, 80, {
    isStatic: true,
  });
  const bottomBody = Matter.Bodies.rectangle(240, 320, 40, 80, {
    isStatic: true,
  });
  const top = new PIXI.Container();
  const bottom = new PIXI.Container();

  manager.physicsManager = {
    translateBody: (body: Matter.Body, vector: Matter.Vector) => {
      Matter.Body.translate(body, vector);
    },
    removeFromEngine: () => undefined,
  };
  manager.pipesPairs = [
    {
      top,
      bottom,
      topBody,
      bottomBody,
      passed: false,
      minTopClearance: Number.POSITIVE_INFINITY,
      minBottomClearance: Number.POSITIVE_INFINITY,
    },
  ];

  const initialTopX = topBody.position.x;
  const initialBottomX = bottomBody.position.x;

  manager.movePipes(playerBody, () => undefined, 50);

  assert.ok(Math.abs(topBody.position.x - (initialTopX - 12)) < 1e-9);
  assert.ok(Math.abs(bottomBody.position.x - (initialBottomX - 12)) < 1e-9);
});

test("pipe prewarm은 target count만큼 distinct pair를 준비하고 무한 루프에 빠지지 않는다", () => {
  const manager = createPipeManager(100) as any;

  let createdPairs = 0;

  manager.resolvePipeAssetsContext = () => ({
    tileSize: 32,
    pipeBodyTexture: {},
    pipeEndTexture: {},
  });
  manager.createManagedPipePair = () => {
    createdPairs += 1;

    return {
      top: {},
      bottom: {},
      topBody: {},
      bottomBody: {},
      passed: false,
      minTopClearance: Number.POSITIVE_INFINITY,
      minBottomClearance: Number.POSITIVE_INFINITY,
    };
  };
  manager.configurePipePair = () => {};
  manager.resetPairTracking = () => {};

  manager.prewarmPipePairs(2);

  assert.equal(createdPairs, 2);
  assert.equal(manager.getActivePairCount(), 0);
  assert.equal(manager.pipePool.length, 2);
});

test("pipe 충돌 body는 좌우 1px씩, 높이는 1px 줄인 크기로 생성된다", () => {
  const manager = createPipeManager(100) as any;

  manager.physicsManager = {
    createRectangleBody: (
      x: number,
      y: number,
      width: number,
      height: number,
      options: Matter.IBodyDefinition,
    ) => Matter.Bodies.rectangle(x, y, width, height, options),
  };

  const body = manager.createPipeBody({
    width: 32,
    height: 32,
    x: 100,
    y: 200,
  });

  assert.equal(body.__flappyPipeWidth, 30);
  assert.equal(body.__flappyPipeHeight, 31);
});
