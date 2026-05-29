import assert from "node:assert/strict";
import test from "node:test";
import {
  FLAPPY_BIRD_FINAL_STAGE_START_SCORE,
  FLAPPY_BIRD_TUTORIAL_DIFFICULTY,
  reduceFlappyBirdPipeSpawnInterval,
  resolveFlappyBirdDifficultyState,
} from "../difficulty";
import { buildPipeSpawnPlan } from "../pipeSpawn";

function createRandomSequence(values: number[]): () => number {
  let index = 0;

  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

type DifficultyExpectation = {
  pipeSpeed: number;
  pipeSpawnInterval: number;
  passageHeightMinRatio: number;
  passageHeightMaxRatio: number;
  passagePositionExpansionTiles: number;
  doublePipePatternChance: number;
  misalignedDoublePipePatternChance: number;
  misalignedDoublePipePatternOffsetTiles: number;
  doublePipePatternGapTileOptions?: readonly number[];
};

const BASE_PIPE_SPAWN_INTERVAL = reduceFlappyBirdPipeSpawnInterval(2480);
const MAX_PIPE_SPAWN_INTERVAL = reduceFlappyBirdPipeSpawnInterval(2025);
const FINAL_STAGE_PIPE_SPAWN_INTERVAL = Math.round(MAX_PIPE_SPAWN_INTERVAL * 0.8);

function resolveBasicSpawnInterval(score: number): number {
  if (score <= 3) {
    return FLAPPY_BIRD_TUTORIAL_DIFFICULTY.pipeSpawnInterval;
  }

  if (score >= 21) {
    return MAX_PIPE_SPAWN_INTERVAL;
  }

  const progress = (score - 4) / (20 - 4);
  return Math.round(
    BASE_PIPE_SPAWN_INTERVAL +
      (MAX_PIPE_SPAWN_INTERVAL - BASE_PIPE_SPAWN_INTERVAL) * progress,
  );
}

function assertDifficulty(score: number, expectation: DifficultyExpectation): void {
  const difficulty = resolveFlappyBirdDifficultyState(score);

  assert.equal(difficulty.pipeSpeed, expectation.pipeSpeed, `score=${score} pipeSpeed`);
  assert.equal(
    difficulty.pipeSpawnInterval,
    expectation.pipeSpawnInterval,
    `score=${score} pipeSpawnInterval`,
  );
  assert.equal(
    difficulty.passageHeightMinRatio,
    expectation.passageHeightMinRatio,
    `score=${score} passageHeightMinRatio`,
  );
  assert.equal(
    difficulty.passageHeightMaxRatio,
    expectation.passageHeightMaxRatio,
    `score=${score} passageHeightMaxRatio`,
  );
  assert.equal(
    difficulty.passagePositionExpansionTiles,
    expectation.passagePositionExpansionTiles,
    `score=${score} passagePositionExpansionTiles`,
  );
  assert.equal(
    difficulty.doublePipePatternChance,
    expectation.doublePipePatternChance,
    `score=${score} doublePipePatternChance`,
  );
  assert.deepEqual(
    difficulty.doublePipePatternGapTileOptions,
    expectation.doublePipePatternGapTileOptions ??
      (expectation.doublePipePatternChance > 0 ? [0, 1] : []),
    `score=${score} doublePipePatternGapTileOptions`,
  );
  assert.equal(
    difficulty.misalignedDoublePipePatternChance,
    expectation.misalignedDoublePipePatternChance,
    `score=${score} misalignedDoublePipePatternChance`,
  );
  assert.equal(
    difficulty.misalignedDoublePipePatternOffsetTiles,
    expectation.misalignedDoublePipePatternOffsetTiles,
    `score=${score} misalignedDoublePipePatternOffsetTiles`,
  );
}

test("난이도 score 경계값이 새 단계 배치를 따른다", () => {
  const cases: Array<[number, DifficultyExpectation]> = [
    [
      3,
      {
        pipeSpeed: 4,
        pipeSpawnInterval: FLAPPY_BIRD_TUTORIAL_DIFFICULTY.pipeSpawnInterval,
        passageHeightMinRatio: 0.35,
        passageHeightMaxRatio: 0.45,
        passagePositionExpansionTiles: 0,
        doublePipePatternChance: 0,
        misalignedDoublePipePatternChance: 0,
        misalignedDoublePipePatternOffsetTiles: 0,
      },
    ],
    [
      4,
      {
        pipeSpeed: 4.6,
        pipeSpawnInterval: resolveBasicSpawnInterval(4),
        passageHeightMinRatio: 0.35,
        passageHeightMaxRatio: 0.35,
        passagePositionExpansionTiles: 0,
        doublePipePatternChance: 0,
        misalignedDoublePipePatternChance: 0,
        misalignedDoublePipePatternOffsetTiles: 0,
      },
    ],
    [
      10,
      {
        pipeSpeed: 4.6,
        pipeSpawnInterval: resolveBasicSpawnInterval(10),
        passageHeightMinRatio: 0.35,
        passageHeightMaxRatio: 0.35,
        passagePositionExpansionTiles: 0,
        doublePipePatternChance: 0,
        misalignedDoublePipePatternChance: 0,
        misalignedDoublePipePatternOffsetTiles: 0,
      },
    ],
    [
      11,
      {
        pipeSpeed: 5,
        pipeSpawnInterval: resolveBasicSpawnInterval(11),
        passageHeightMinRatio: 0.3,
        passageHeightMaxRatio: 0.3,
        passagePositionExpansionTiles: 0,
        doublePipePatternChance: 0,
        misalignedDoublePipePatternChance: 0,
        misalignedDoublePipePatternOffsetTiles: 0,
      },
    ],
    [
      20,
      {
        pipeSpeed: 5,
        pipeSpawnInterval: resolveBasicSpawnInterval(20),
        passageHeightMinRatio: 0.3,
        passageHeightMaxRatio: 0.3,
        passagePositionExpansionTiles: 0,
        doublePipePatternChance: 0,
        misalignedDoublePipePatternChance: 0,
        misalignedDoublePipePatternOffsetTiles: 0,
      },
    ],
    [
      21,
      {
        pipeSpeed: 5,
        pipeSpawnInterval: MAX_PIPE_SPAWN_INTERVAL,
        passageHeightMinRatio: 0.3,
        passageHeightMaxRatio: 0.3,
        passagePositionExpansionTiles: 0,
        doublePipePatternChance: 0,
        misalignedDoublePipePatternChance: 0,
        misalignedDoublePipePatternOffsetTiles: 0,
      },
    ],
    [
      30,
      {
        pipeSpeed: 5,
        pipeSpawnInterval: MAX_PIPE_SPAWN_INTERVAL,
        passageHeightMinRatio: 0.3,
        passageHeightMaxRatio: 0.3,
        passagePositionExpansionTiles: 0,
        doublePipePatternChance: 0,
        misalignedDoublePipePatternChance: 0,
        misalignedDoublePipePatternOffsetTiles: 0,
      },
    ],
    [
      31,
      {
        pipeSpeed: 5.4,
        pipeSpawnInterval: MAX_PIPE_SPAWN_INTERVAL,
        passageHeightMinRatio: 0.28,
        passageHeightMaxRatio: 0.3,
        passagePositionExpansionTiles: 0,
        doublePipePatternChance: 0,
        misalignedDoublePipePatternChance: 0,
        misalignedDoublePipePatternOffsetTiles: 0,
      },
    ],
    [
      40,
      {
        pipeSpeed: 5.4,
        pipeSpawnInterval: MAX_PIPE_SPAWN_INTERVAL,
        passageHeightMinRatio: 0.28,
        passageHeightMaxRatio: 0.3,
        passagePositionExpansionTiles: 0,
        doublePipePatternChance: 0,
        misalignedDoublePipePatternChance: 0,
        misalignedDoublePipePatternOffsetTiles: 0,
      },
    ],
    [
      41,
      {
        pipeSpeed: 5.4,
        pipeSpawnInterval: MAX_PIPE_SPAWN_INTERVAL,
        passageHeightMinRatio: 0.28,
        passageHeightMaxRatio: 0.3,
        passagePositionExpansionTiles: 1,
        doublePipePatternChance: 0,
        misalignedDoublePipePatternChance: 0,
        misalignedDoublePipePatternOffsetTiles: 0,
      },
    ],
    [
      60,
      {
        pipeSpeed: 5.4,
        pipeSpawnInterval: MAX_PIPE_SPAWN_INTERVAL,
        passageHeightMinRatio: 0.28,
        passageHeightMaxRatio: 0.3,
        passagePositionExpansionTiles: 1,
        doublePipePatternChance: 0,
        misalignedDoublePipePatternChance: 0,
        misalignedDoublePipePatternOffsetTiles: 0,
      },
    ],
    [
      61,
      {
        pipeSpeed: 5.4,
        pipeSpawnInterval: MAX_PIPE_SPAWN_INTERVAL,
        passageHeightMinRatio: 0.28,
        passageHeightMaxRatio: 0.3,
        passagePositionExpansionTiles: 1,
        doublePipePatternChance: 0.25,
        misalignedDoublePipePatternChance: 0,
        misalignedDoublePipePatternOffsetTiles: 0,
      },
    ],
    [
      80,
      {
        pipeSpeed: 5.4,
        pipeSpawnInterval: MAX_PIPE_SPAWN_INTERVAL,
        passageHeightMinRatio: 0.28,
        passageHeightMaxRatio: 0.3,
        passagePositionExpansionTiles: 1,
        doublePipePatternChance: 0.25,
        misalignedDoublePipePatternChance: 0,
        misalignedDoublePipePatternOffsetTiles: 0,
      },
    ],
    [
      81,
      {
        pipeSpeed: 5.4,
        pipeSpawnInterval: FINAL_STAGE_PIPE_SPAWN_INTERVAL,
        passageHeightMinRatio: 0.28,
        passageHeightMaxRatio: 0.3,
        passagePositionExpansionTiles: 1,
        doublePipePatternChance: 0.25,
        misalignedDoublePipePatternChance: 0.5,
        misalignedDoublePipePatternOffsetTiles: 1,
      },
    ],
  ];

  for (const [score, expectation] of cases) {
    assertDifficulty(score, expectation);
  }
});

test("81점 이후에도 최종 난이도 단계가 그대로 유지된다", () => {
  const finalStageDifficulty = resolveFlappyBirdDifficultyState(
    FLAPPY_BIRD_FINAL_STAGE_START_SCORE,
  );
  const laterDifficulty = resolveFlappyBirdDifficultyState(120);

  assert.deepEqual(laterDifficulty, finalStageDifficulty);
});

test("튜토리얼 난이도는 기존 단일 파이프 세팅을 유지한다", () => {
  assert.equal(FLAPPY_BIRD_TUTORIAL_DIFFICULTY.pipeSpeed, 4);
  assert.equal(FLAPPY_BIRD_TUTORIAL_DIFFICULTY.doublePipePatternChance, 0);
});

test("통로 위치 확장이 켜지면 상단 파이프 최소 높이가 1타일까지 내려갈 수 있다", () => {
  const basePlan = buildPipeSpawnPlan(
    {
      tileSize: 10,
      availableHeight: 200,
      passageHeightMinRatio: 0.35,
      passageHeightMaxRatio: 0.35,
      passagePositionExpansionTiles: 0,
      doublePipePatternChance: 0,
      doublePipePatternGapTileOptions: [],
      misalignedDoublePipePatternChance: 0,
      misalignedDoublePipePatternOffsetTiles: 0,
    },
    createRandomSequence([0, 0]),
  );
  const expandedPlan = buildPipeSpawnPlan(
    {
      tileSize: 10,
      availableHeight: 200,
      passageHeightMinRatio: 0.35,
      passageHeightMaxRatio: 0.35,
      passagePositionExpansionTiles: 1,
      doublePipePatternChance: 0,
      doublePipePatternGapTileOptions: [],
      misalignedDoublePipePatternChance: 0,
      misalignedDoublePipePatternOffsetTiles: 0,
    },
    createRandomSequence([0, 0]),
  );

  assert.equal(basePlan.items[0]?.topPipeHeight, 20);
  assert.equal(expandedPlan.items[0]?.topPipeHeight, 10);
});

test("aligned 2연속 파이프 패턴은 같은 통로 높이와 위치를 공유한다", () => {
  const plan = buildPipeSpawnPlan(
    {
      tileSize: 10,
      availableHeight: 200,
      passageHeightMinRatio: 0.35,
      passageHeightMaxRatio: 0.35,
      passagePositionExpansionTiles: 1,
      doublePipePatternChance: 1,
      doublePipePatternGapTileOptions: [0],
      misalignedDoublePipePatternChance: 0,
      misalignedDoublePipePatternOffsetTiles: 0,
    },
    createRandomSequence([0, 0.4, 0, 0]),
  );

  assert.equal(plan.isDoublePattern, true);
  assert.equal(plan.isMisalignedDoublePattern, false);
  assert.equal(plan.items.length, 2);
  assert.equal(plan.items[0]?.passageHeight, plan.items[1]?.passageHeight);
  assert.equal(plan.items[0]?.topPipeHeight, plan.items[1]?.topPipeHeight);
  assert.equal(plan.items[1]?.xOffsetTiles, 1);
});

test("misaligned 2연속 파이프 패턴은 같은 통로 높이를 유지하면서 1타일만 어긋난다", () => {
  const plan = buildPipeSpawnPlan(
    {
      tileSize: 10,
      availableHeight: 200,
      passageHeightMinRatio: 0.35,
      passageHeightMaxRatio: 0.35,
      passagePositionExpansionTiles: 1,
      doublePipePatternChance: 1,
      doublePipePatternGapTileOptions: [1],
      misalignedDoublePipePatternChance: 1,
      misalignedDoublePipePatternOffsetTiles: 1,
    },
    createRandomSequence([0, 0.5, 0, 0, 0, 0.2]),
  );

  assert.equal(plan.isDoublePattern, true);
  assert.equal(plan.isMisalignedDoublePattern, true);
  assert.equal(plan.items.length, 2);
  assert.equal(plan.items[0]?.passageHeight, plan.items[1]?.passageHeight);
  assert.equal(
    Math.abs(
      (plan.items[0]?.topPipeHeight ?? 0) - (plan.items[1]?.topPipeHeight ?? 0),
    ),
    10,
  );
  assert.equal(plan.items[1]?.xOffsetTiles, 2);
});
