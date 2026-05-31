export type HomeWidgetSyncWorldDataLike = {
  world_metadata?: {
    last_ecs_saved?: number | null;
  } | null;
} | null;

export type HomeWidgetSyncWorldDataSource = "stored" | "in_memory";

export type HomeWidgetSyncWorldDataSelection = {
  selectedWorldData: HomeWidgetSyncWorldDataLike;
  source: HomeWidgetSyncWorldDataSource | null;
  storedLastEcsSaved: number | null;
  inMemoryLastEcsSaved: number | null;
};

function readLastEcsSaved(
  worldData: HomeWidgetSyncWorldDataLike | undefined,
): number | null {
  const lastEcsSaved = worldData?.world_metadata?.last_ecs_saved;
  return typeof lastEcsSaved === "number" && Number.isFinite(lastEcsSaved)
    ? lastEcsSaved
    : null;
}

export function selectHomeWidgetSyncWorldData(params: {
  storedWorldData: HomeWidgetSyncWorldDataLike | undefined;
  inMemoryWorldData: HomeWidgetSyncWorldDataLike | undefined;
}): HomeWidgetSyncWorldDataSelection {
  const storedWorldData = params.storedWorldData ?? null;
  const inMemoryWorldData = params.inMemoryWorldData ?? null;
  const storedLastEcsSaved = readLastEcsSaved(storedWorldData);
  const inMemoryLastEcsSaved = readLastEcsSaved(inMemoryWorldData);

  if (!storedWorldData && !inMemoryWorldData) {
    return {
      selectedWorldData: null,
      source: null,
      storedLastEcsSaved,
      inMemoryLastEcsSaved,
    };
  }

  if (!storedWorldData) {
    return {
      selectedWorldData: inMemoryWorldData,
      source: "in_memory",
      storedLastEcsSaved,
      inMemoryLastEcsSaved,
    };
  }

  if (!inMemoryWorldData) {
    return {
      selectedWorldData: storedWorldData,
      source: "stored",
      storedLastEcsSaved,
      inMemoryLastEcsSaved,
    };
  }

  const shouldUseInMemory =
    inMemoryLastEcsSaved !== null &&
    (storedLastEcsSaved === null || inMemoryLastEcsSaved > storedLastEcsSaved);

  return {
    selectedWorldData: shouldUseInMemory ? inMemoryWorldData : storedWorldData,
    source: shouldUseInMemory ? "in_memory" : "stored",
    storedLastEcsSaved,
    inMemoryLastEcsSaved,
  };
}
