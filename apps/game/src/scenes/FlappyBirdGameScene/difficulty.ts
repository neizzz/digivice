import type { FlappyBirdDifficultyState } from "./models";

export const FLAPPY_BIRD_TUTORIAL_SCORE_LIMIT = 5;
export const FLAPPY_BIRD_SPEED_STEP_TWO_SCORE_LIMIT = 20;
export const FLAPPY_BIRD_ENDGAME_SCORE_LIMIT = 40;

const FLAPPY_BIRD_MAX_DIFFICULTY_SCORE = 30;
const FLAPPY_BIRD_PIPE_SPAWN_INTERVAL_SCALE = 0.72;
const FLAPPY_BIRD_HIGH_SCORE_PASSAGE_EXPANSION_TILES = 1;
const FLAPPY_BIRD_DOUBLE_PIPE_PATTERN_CHANCE = 0.25;
const FLAPPY_BIRD_DOUBLE_PIPE_PATTERN_GAP_TILE_OPTIONS = [0, 1] as const;
const FLAPPY_BIRD_FAST_PIPE_SPAWN_INTERVAL_MULTIPLIER = 0.8;
const FLAPPY_BIRD_MISALIGNED_DOUBLE_PIPE_PATTERN_CHANCE = 0.5;
const FLAPPY_BIRD_MISALIGNED_DOUBLE_PIPE_PATTERN_OFFSET_TILES = 1;

export function reduceFlappyBirdPipeSpawnInterval(intervalMs: number): number {
  return Math.round(intervalMs * FLAPPY_BIRD_PIPE_SPAWN_INTERVAL_SCALE);
}

export const FLAPPY_BIRD_TUTORIAL_DIFFICULTY: FlappyBirdDifficultyState = {
  pipeSpeed: 4,
  pipeSpawnInterval: reduceFlappyBirdPipeSpawnInterval(2740),
  passageHeightMinRatio: 0.35,
  passageHeightMaxRatio: 0.45,
  passagePositionExpansionTiles: 0,
  doublePipePatternChance: 0,
  doublePipePatternGapTileOptions: [],
  misalignedDoublePipePatternChance: 0,
  misalignedDoublePipePatternOffsetTiles: 0,
};

const FLAPPY_BIRD_BASE_DIFFICULTY: FlappyBirdDifficultyState = {
  pipeSpeed: 4.6,
  pipeSpawnInterval: reduceFlappyBirdPipeSpawnInterval(2480),
  passageHeightMinRatio: 0.35,
  passageHeightMaxRatio: 0.35,
  passagePositionExpansionTiles: 0,
  doublePipePatternChance: 0,
  doublePipePatternGapTileOptions: [],
  misalignedDoublePipePatternChance: 0,
  misalignedDoublePipePatternOffsetTiles: 0,
};

const FLAPPY_BIRD_MAX_DIFFICULTY: FlappyBirdDifficultyState = {
  pipeSpeed: 5,
  pipeSpawnInterval: reduceFlappyBirdPipeSpawnInterval(2025),
  passageHeightMinRatio: 0.3,
  passageHeightMaxRatio: 0.3,
  passagePositionExpansionTiles: 0,
  doublePipePatternChance: 0,
  doublePipePatternGapTileOptions: [],
  misalignedDoublePipePatternChance: 0,
  misalignedDoublePipePatternOffsetTiles: 0,
};

const FLAPPY_BIRD_ENDGAME_DIFFICULTY: FlappyBirdDifficultyState = {
  pipeSpeed: 5.4,
  pipeSpawnInterval: reduceFlappyBirdPipeSpawnInterval(2025),
  passageHeightMinRatio: 0.28,
  passageHeightMaxRatio: 0.3,
  passagePositionExpansionTiles: 0,
  doublePipePatternChance: 0,
  doublePipePatternGapTileOptions: [],
  misalignedDoublePipePatternChance: 0,
  misalignedDoublePipePatternOffsetTiles: 0,
};

export function resolveFlappyBirdDifficultyState(
  score: number,
): FlappyBirdDifficultyState {
  const baseDifficulty = resolveBaseDifficultyState(score);
  const hasExpandedPassageRange = score >= 50;
  const hasDoublePipePattern = score >= 70;
  const hasFastPipeSpawns = score >= 90;
  const hasMisalignedDoublePipePattern = score >= 110;

  return {
    ...baseDifficulty,
    pipeSpawnInterval: hasFastPipeSpawns
      ? Math.round(
          baseDifficulty.pipeSpawnInterval *
            FLAPPY_BIRD_FAST_PIPE_SPAWN_INTERVAL_MULTIPLIER,
        )
      : baseDifficulty.pipeSpawnInterval,
    passagePositionExpansionTiles: hasExpandedPassageRange
      ? FLAPPY_BIRD_HIGH_SCORE_PASSAGE_EXPANSION_TILES
      : 0,
    doublePipePatternChance: hasDoublePipePattern
      ? FLAPPY_BIRD_DOUBLE_PIPE_PATTERN_CHANCE
      : 0,
    doublePipePatternGapTileOptions: hasDoublePipePattern
      ? FLAPPY_BIRD_DOUBLE_PIPE_PATTERN_GAP_TILE_OPTIONS
      : [],
    misalignedDoublePipePatternChance: hasMisalignedDoublePipePattern
      ? FLAPPY_BIRD_MISALIGNED_DOUBLE_PIPE_PATTERN_CHANCE
      : 0,
    misalignedDoublePipePatternOffsetTiles: hasMisalignedDoublePipePattern
      ? FLAPPY_BIRD_MISALIGNED_DOUBLE_PIPE_PATTERN_OFFSET_TILES
      : 0,
  };
}

function resolveBaseDifficultyState(score: number): FlappyBirdDifficultyState {
  if (score <= FLAPPY_BIRD_TUTORIAL_SCORE_LIMIT) {
    return FLAPPY_BIRD_TUTORIAL_DIFFICULTY;
  }

  const progress = Math.min(
    1,
    (score - FLAPPY_BIRD_TUTORIAL_SCORE_LIMIT) /
      (FLAPPY_BIRD_MAX_DIFFICULTY_SCORE - FLAPPY_BIRD_TUTORIAL_SCORE_LIMIT),
  );

  return {
    ...FLAPPY_BIRD_BASE_DIFFICULTY,
    pipeSpeed: resolvePipeSpeedForScore(score),
    pipeSpawnInterval: Math.round(
      interpolateNumber(
        FLAPPY_BIRD_BASE_DIFFICULTY.pipeSpawnInterval,
        FLAPPY_BIRD_MAX_DIFFICULTY.pipeSpawnInterval,
        progress,
      ),
    ),
    ...resolvePassageHeightRatiosForScore(score),
  };
}

function resolvePassageHeightRatiosForScore(
  score: number,
): Pick<
  FlappyBirdDifficultyState,
  "passageHeightMinRatio" | "passageHeightMaxRatio"
> {
  if (score < FLAPPY_BIRD_SPEED_STEP_TWO_SCORE_LIMIT) {
    return {
      passageHeightMinRatio: 0.35,
      passageHeightMaxRatio: 0.35,
    };
  }

  if (score < FLAPPY_BIRD_ENDGAME_SCORE_LIMIT) {
    return {
      passageHeightMinRatio: 0.3,
      passageHeightMaxRatio: 0.3,
    };
  }

  return {
    passageHeightMinRatio: FLAPPY_BIRD_ENDGAME_DIFFICULTY.passageHeightMinRatio,
    passageHeightMaxRatio: FLAPPY_BIRD_ENDGAME_DIFFICULTY.passageHeightMaxRatio,
  };
}

function resolvePipeSpeedForScore(score: number): number {
  if (score < FLAPPY_BIRD_SPEED_STEP_TWO_SCORE_LIMIT) {
    return FLAPPY_BIRD_BASE_DIFFICULTY.pipeSpeed;
  }

  if (score < FLAPPY_BIRD_ENDGAME_SCORE_LIMIT) {
    return FLAPPY_BIRD_MAX_DIFFICULTY.pipeSpeed;
  }

  return FLAPPY_BIRD_ENDGAME_DIFFICULTY.pipeSpeed;
}

function interpolateNumber(
  start: number,
  end: number,
  progress: number,
): number {
  return start + (end - start) * progress;
}
