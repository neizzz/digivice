export type WeightedCandidate = {
  weight: number;
};

export function resolveWeightedCandidate<T extends WeightedCandidate>(
  candidates: readonly T[],
  randomValue: number = Math.random(),
): T | null {
  if (candidates.length === 0) {
    return null;
  }

  const totalWeight = candidates.reduce(
    (sum, candidate) => sum + candidate.weight,
    0,
  );

  if (totalWeight <= 0) {
    return null;
  }

  const normalizedRandom = Math.min(Math.max(randomValue, 0), 0.999999);
  const roll = normalizedRandom * totalWeight;
  let accumulatedWeight = 0;

  for (const candidate of candidates) {
    accumulatedWeight += candidate.weight;
    if (roll < accumulatedWeight) {
      return candidate;
    }
  }

  return candidates[candidates.length - 1] ?? null;
}
