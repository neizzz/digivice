export type NearMissBonusTier = 0 | 1 | 2;

const FLAPPY_BIRD_NEAR_MISS_OUTER_CLEARANCE_RATIO = 0.25;
const FLAPPY_BIRD_NEAR_MISS_INNER_CLEARANCE_RATIO = 0.125;
const FLAPPY_BIRD_NEAR_MISS_OUTER_MIN_CLEARANCE_PX = 6;
const FLAPPY_BIRD_NEAR_MISS_INNER_MIN_CLEARANCE_PX = 3;

export function resolveNearMissBonusTier(options: {
  playerHeight: number;
  trackedClearance: number;
  currentClearance: number;
}): NearMissBonusTier {
  const effectiveClearance = Number.isFinite(options.trackedClearance)
    ? options.trackedClearance
    : options.currentClearance;

  if (!Number.isFinite(effectiveClearance)) {
    return 0;
  }

  const thresholds = resolveNearMissThresholds(options.playerHeight);

  if (effectiveClearance <= thresholds.innerThreshold) {
    return 2;
  }

  if (effectiveClearance <= thresholds.outerThreshold) {
    return 1;
  }

  return 0;
}

export function resolveNearMissThresholds(playerHeight: number): {
  outerThreshold: number;
  innerThreshold: number;
} {
  return {
    outerThreshold: Math.max(
      FLAPPY_BIRD_NEAR_MISS_OUTER_MIN_CLEARANCE_PX,
      Math.round(playerHeight * FLAPPY_BIRD_NEAR_MISS_OUTER_CLEARANCE_RATIO),
    ),
    innerThreshold: Math.max(
      FLAPPY_BIRD_NEAR_MISS_INNER_MIN_CLEARANCE_PX,
      Math.round(playerHeight * FLAPPY_BIRD_NEAR_MISS_INNER_CLEARANCE_RATIO),
    ),
  };
}
