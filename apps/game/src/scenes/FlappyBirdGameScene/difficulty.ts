import type { FlappyBirdDifficultyState } from "./models";

export const FLAPPY_BIRD_TUTORIAL_SCORE_LIMIT = 3;
export const FLAPPY_BIRD_SPEED_STEP_TWO_START_SCORE = 11;
export const FLAPPY_BIRD_MAX_BASIC_DIFFICULTY_SCORE = 20;
export const FLAPPY_BIRD_ENDGAME_START_SCORE = 31;
export const FLAPPY_BIRD_EXPANDED_PASSAGE_START_SCORE = 41;
export const FLAPPY_BIRD_DOUBLE_PIPE_START_SCORE = 61;
export const FLAPPY_BIRD_FINAL_STAGE_START_SCORE = 81;

const FLAPPY_BIRD_FIRST_BASIC_SCORE = FLAPPY_BIRD_TUTORIAL_SCORE_LIMIT + 1;
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
  const hasExpandedPassageRange =
    score >= FLAPPY_BIRD_EXPANDED_PASSAGE_START_SCORE;
  const hasDoublePipePattern = score >= FLAPPY_BIRD_DOUBLE_PIPE_START_SCORE;
  const isFinalStage = score >= FLAPPY_BIRD_FINAL_STAGE_START_SCORE;

  return {
    ...baseDifficulty,
    pipeSpawnInterval: isFinalStage
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
    misalignedDoublePipePatternChance: isFinalStage
      ? FLAPPY_BIRD_MISALIGNED_DOUBLE_PIPE_PATTERN_CHANCE
      : 0,
    misalignedDoublePipePatternOffsetTiles: isFinalStage
      ? FLAPPY_BIRD_MISALIGNED_DOUBLE_PIPE_PATTERN_OFFSET_TILES
      : 0,
  };
}

function resolveBaseDifficultyState(score: number): FlappyBirdDifficultyState {
  if (score <= FLAPPY_BIRD_TUTORIAL_SCORE_LIMIT) {
    return FLAPPY_BIRD_TUTORIAL_DIFFICULTY;
  }

  if (score < FLAPPY_BIRD_ENDGAME_START_SCORE) {
    return {
      ...FLAPPY_BIRD_BASE_DIFFICULTY,
      pipeSpeed: resolvePipeSpeedForScore(score),
      pipeSpawnInterval: resolvePipeSpawnIntervalForScore(score),
      ...resolvePassageHeightRatiosForScore(score),
    };
  }

  return FLAPPY_BIRD_ENDGAME_DIFFICULTY;
}

function resolvePipeSpawnIntervalForScore(score: number): number {
  if (score > FLAPPY_BIRD_MAX_BASIC_DIFFICULTY_SCORE) {
    return FLAPPY_BIRD_MAX_DIFFICULTY.pipeSpawnInterval;
  }

  return Math.round(
    interpolateNumber(
      FLAPPY_BIRD_BASE_DIFFICULTY.pipeSpawnInterval,
      FLAPPY_BIRD_MAX_DIFFICULTY.pipeSpawnInterval,
      resolveRangeProgress(
        score,
        FLAPPY_BIRD_FIRST_BASIC_SCORE,
        FLAPPY_BIRD_MAX_BASIC_DIFFICULTY_SCORE,
      ),
    ),
  );
}

function resolvePassageHeightRatiosForScore(
  score: number,
): Pick<
  FlappyBirdDifficultyState,
  "passageHeightMinRatio" | "passageHeightMaxRatio"
> {
  if (score < FLAPPY_BIRD_SPEED_STEP_TWO_START_SCORE) {
    return {
      passageHeightMinRatio: FLAPPY_BIRD_BASE_DIFFICULTY.passageHeightMinRatio,
      passageHeightMaxRatio: FLAPPY_BIRD_BASE_DIFFICULTY.passageHeightMaxRatio,
    };
  }

  if (score < FLAPPY_BIRD_ENDGAME_START_SCORE) {
    return {
      passageHeightMinRatio: FLAPPY_BIRD_MAX_DIFFICULTY.passageHeightMinRatio,
      passageHeightMaxRatio: FLAPPY_BIRD_MAX_DIFFICULTY.passageHeightMaxRatio,
    };
  }

  return {
    passageHeightMinRatio: FLAPPY_BIRD_ENDGAME_DIFFICULTY.passageHeightMinRatio,
    passageHeightMaxRatio: FLAPPY_BIRD_ENDGAME_DIFFICULTY.passageHeightMaxRatio,
  };
}

function resolvePipeSpeedForScore(score: number): number {
  if (score < FLAPPY_BIRD_SPEED_STEP_TWO_START_SCORE) {
    return FLAPPY_BIRD_BASE_DIFFICULTY.pipeSpeed;
  }

  if (score < FLAPPY_BIRD_ENDGAME_START_SCORE) {
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

function resolveRangeProgress(
  value: number,
  rangeStart: number,
  rangeEnd: number,
): number {
  if (rangeEnd <= rangeStart) {
    return 1;
  }

  return Math.min(1, Math.max(0, (value - rangeStart) / (rangeEnd - rangeStart)));
}
