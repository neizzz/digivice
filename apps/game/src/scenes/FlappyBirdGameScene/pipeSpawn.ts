import type { FlappyBirdDifficultyState } from "./models";

const DEFAULT_MIN_PIPE_HEIGHT_TILES = 2;
const DEFAULT_MIN_EXPANDED_PIPE_HEIGHT_TILES = 1;

export interface PipeSpawnPlanItem {
  xOffsetTiles: number;
  passageHeight: number;
  topPipeHeight: number;
  bottomPipeHeight: number;
}

export interface PipeSpawnPlan {
  items: PipeSpawnPlanItem[];
  isDoublePattern: boolean;
  isMisalignedDoublePattern: boolean;
}

export interface PipeSpawnPlanOptions
  extends Pick<
    FlappyBirdDifficultyState,
    | "passageHeightMinRatio"
    | "passageHeightMaxRatio"
    | "passagePositionExpansionTiles"
    | "doublePipePatternChance"
    | "doublePipePatternGapTileOptions"
    | "misalignedDoublePipePatternChance"
    | "misalignedDoublePipePatternOffsetTiles"
  > {
  tileSize: number;
  availableHeight: number;
}

export function buildPipeSpawnPlan(
  options: PipeSpawnPlanOptions,
  random: () => number = Math.random,
): PipeSpawnPlan {
  const geometry = resolvePipeGeometry(options, random);
  const baseItem: PipeSpawnPlanItem = {
    xOffsetTiles: 0,
    passageHeight: geometry.passageHeight,
    topPipeHeight: geometry.topPipeHeight,
    bottomPipeHeight: geometry.bottomPipeHeight,
  };

  if (
    options.doublePipePatternChance <= 0 ||
    options.doublePipePatternGapTileOptions.length === 0 ||
    random() >= options.doublePipePatternChance
  ) {
    return {
      items: [baseItem],
      isDoublePattern: false,
      isMisalignedDoublePattern: false,
    };
  }

  const gapTiles =
    options.doublePipePatternGapTileOptions[
      Math.floor(random() * options.doublePipePatternGapTileOptions.length)
    ] ?? 0;
  const secondItem: PipeSpawnPlanItem = {
    xOffsetTiles: 1 + gapTiles,
    passageHeight: geometry.passageHeight,
    topPipeHeight: geometry.topPipeHeight,
    bottomPipeHeight: geometry.bottomPipeHeight,
  };

  const shouldAttemptMisalignedPattern =
    options.misalignedDoublePipePatternChance > 0 &&
    options.misalignedDoublePipePatternOffsetTiles > 0 &&
    random() < options.misalignedDoublePipePatternChance;

  if (!shouldAttemptMisalignedPattern) {
    return {
      items: [baseItem, secondItem],
      isDoublePattern: true,
      isMisalignedDoublePattern: false,
    };
  }

  const misalignedTopPipeHeight = resolveMisalignedTopPipeHeight(
    geometry.topPipeHeight,
    geometry.topPipeHeightMin,
    geometry.topPipeHeightMax,
    options.tileSize * options.misalignedDoublePipePatternOffsetTiles,
    random(),
  );

  const isMisalignedDoublePattern =
    misalignedTopPipeHeight !== geometry.topPipeHeight;

  return {
    items: [
      baseItem,
      {
        ...secondItem,
        topPipeHeight: misalignedTopPipeHeight,
        bottomPipeHeight:
          options.availableHeight -
          misalignedTopPipeHeight -
          geometry.passageHeight,
      },
    ],
    isDoublePattern: true,
    isMisalignedDoublePattern,
  };
}

type PipeGeometry = {
  passageHeight: number;
  topPipeHeight: number;
  bottomPipeHeight: number;
  topPipeHeightMin: number;
  topPipeHeightMax: number;
};

function resolvePipeGeometry(
  options: PipeSpawnPlanOptions,
  random: () => number,
): PipeGeometry {
  const passageHeight = resolvePassageHeight(options, random());
  const topPipeHeightRange = resolveTopPipeHeightRange(options, passageHeight);
  const topPipeHeight =
    options.passagePositionExpansionTiles > 0
      ? resolveExpandedTopPipeHeight(
          topPipeHeightRange,
          options.tileSize,
          random(),
        )
      : resolveLegacyTopPipeHeight(
          options.availableHeight,
          passageHeight,
          options.tileSize,
          random(),
        );

  return {
    passageHeight,
    topPipeHeight,
    bottomPipeHeight: options.availableHeight - topPipeHeight - passageHeight,
    topPipeHeightMin: topPipeHeightRange.min,
    topPipeHeightMax: topPipeHeightRange.max,
  };
}

function resolvePassageHeight(
  options: PipeSpawnPlanOptions,
  roll: number,
): number {
  const minPipeHeight = options.tileSize * DEFAULT_MIN_PIPE_HEIGHT_TILES;
  const maxAvailablePassageHeight = Math.max(
    minPipeHeight,
    options.availableHeight - minPipeHeight * 2,
  );
  const minPassageHeight = Math.min(
    maxAvailablePassageHeight,
    Math.max(
      minPipeHeight,
      options.availableHeight * options.passageHeightMinRatio,
    ),
  );
  const maxPassageHeight = Math.max(
    minPassageHeight,
    Math.min(
      maxAvailablePassageHeight,
      Math.max(
        minPassageHeight,
        options.availableHeight * options.passageHeightMaxRatio,
      ),
    ),
  );
  let passageHeight =
    minPassageHeight + clampRandom(roll) * (maxPassageHeight - minPassageHeight);

  passageHeight = Math.ceil(passageHeight / options.tileSize) * options.tileSize;

  return passageHeight;
}

function resolveTopPipeHeightRange(
  options: PipeSpawnPlanOptions,
  passageHeight: number,
): { min: number; max: number } {
  const tileSize = options.tileSize;
  const minPipeHeight = tileSize * DEFAULT_MIN_PIPE_HEIGHT_TILES;
  const minExpandedPipeHeight =
    tileSize * DEFAULT_MIN_EXPANDED_PIPE_HEIGHT_TILES;
  const legacyMaxTopPipeHeight = resolveLegacyMaxTopPipeHeight(
    options.availableHeight,
    passageHeight,
    tileSize,
  );
  const expansion = Math.max(0, options.passagePositionExpansionTiles) * tileSize;
  const min = Math.max(minExpandedPipeHeight, minPipeHeight - expansion);
  const maxAllowedTopPipeHeight = Math.max(
    min,
    Math.floor(
      (options.availableHeight - passageHeight - minExpandedPipeHeight) /
        tileSize,
    ) * tileSize,
  );

  return {
    min,
    max: Math.min(maxAllowedTopPipeHeight, legacyMaxTopPipeHeight + expansion),
  };
}

function resolveLegacyTopPipeHeight(
  availableHeight: number,
  passageHeight: number,
  tileSize: number,
  roll: number,
): number {
  const minPipeHeight = tileSize * DEFAULT_MIN_PIPE_HEIGHT_TILES;

  return Math.max(
    minPipeHeight,
    Math.floor(
      (clampRandom(roll) *
        (availableHeight - passageHeight - minPipeHeight * 2)) /
        tileSize,
    ) * tileSize,
  );
}

function resolveLegacyMaxTopPipeHeight(
  availableHeight: number,
  passageHeight: number,
  tileSize: number,
): number {
  const minPipeHeight = tileSize * DEFAULT_MIN_PIPE_HEIGHT_TILES;
  const topPipeHeightSpan = availableHeight - passageHeight - minPipeHeight * 2;
  const maxLegacyBucket =
    Math.max(0, Math.ceil(topPipeHeightSpan / tileSize) - 1) * tileSize;

  return Math.max(minPipeHeight, maxLegacyBucket);
}

function resolveExpandedTopPipeHeight(
  range: { min: number; max: number },
  tileSize: number,
  roll: number,
): number {
  const totalSteps = Math.max(0, Math.round((range.max - range.min) / tileSize));

  return range.min + Math.floor(clampRandom(roll) * (totalSteps + 1)) * tileSize;
}

function resolveMisalignedTopPipeHeight(
  originalTopPipeHeight: number,
  minTopPipeHeight: number,
  maxTopPipeHeight: number,
  offsetPx: number,
  directionRoll: number,
): number {
  const candidateDirections =
    clampRandom(directionRoll) < 0.5 ? [1, -1] : [-1, 1];

  for (const direction of candidateDirections) {
    const candidate = Math.max(
      minTopPipeHeight,
      Math.min(
        maxTopPipeHeight,
        originalTopPipeHeight + direction * offsetPx,
      ),
    );

    if (candidate !== originalTopPipeHeight) {
      return candidate;
    }
  }

  return originalTopPipeHeight;
}

function clampRandom(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(0.999999, Math.max(0, value));
}
