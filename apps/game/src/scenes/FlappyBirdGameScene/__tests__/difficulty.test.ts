import assert from "node:assert/strict";
import test from "node:test";
import {
  FLAPPY_BIRD_TUTORIAL_DIFFICULTY,
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

test("49점 이하에서는 고득점 파이프 modifier가 비활성화된다", () => {
  const difficulty = resolveFlappyBirdDifficultyState(49);

  assert.equal(difficulty.passagePositionExpansionTiles, 0);
  assert.equal(difficulty.doublePipePatternChance, 0);
  assert.deepEqual(difficulty.doublePipePatternGapTileOptions, []);
  assert.equal(difficulty.misalignedDoublePipePatternChance, 0);
  assert.equal(difficulty.misalignedDoublePipePatternOffsetTiles, 0);
});

test("50점 이상에서는 통로 위치 범위가 1타일 확장된다", () => {
  const difficulty = resolveFlappyBirdDifficultyState(50);

  assert.equal(difficulty.passagePositionExpansionTiles, 1);
});

test("70점 이상에서는 2연속 파이프 패턴이 25% 확률로 활성화된다", () => {
  const difficulty = resolveFlappyBirdDifficultyState(70);

  assert.equal(difficulty.doublePipePatternChance, 0.25);
  assert.deepEqual(difficulty.doublePipePatternGapTileOptions, [0, 1]);
});

test("90점 이상에서는 같은 점수대 기본 간격 대비 파이프 생성 간격이 20% 감소한다", () => {
  const difficulty89 = resolveFlappyBirdDifficultyState(89);
  const difficulty90 = resolveFlappyBirdDifficultyState(90);

  assert.equal(
    difficulty90.pipeSpawnInterval,
    Math.round(difficulty89.pipeSpawnInterval * 0.8),
  );
});

test("110점 이상에서는 어긋난 2연속 파이프 패턴 설정이 추가된다", () => {
  const difficulty = resolveFlappyBirdDifficultyState(110);

  assert.equal(difficulty.doublePipePatternChance, 0.25);
  assert.equal(difficulty.misalignedDoublePipePatternChance, 0.5);
  assert.equal(difficulty.misalignedDoublePipePatternOffsetTiles, 1);
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
