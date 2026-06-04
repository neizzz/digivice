export type HomeWidgetSyncWorldDataLike = {
  world_metadata?: {
    last_ecs_saved?: number | null;
  } | null;
  entities?: Array<{
    components?: {
      object?: {
        type?: number | null;
        state?: number | null;
      } | null;
    } | null;
  } | null> | null;
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

const CHARACTER_OBJECT_TYPE = 1;
const EGG_CHARACTER_STATE = 0;

function readMainCharacterState(
  worldData: HomeWidgetSyncWorldDataLike | undefined,
): number | null {
  const entities = worldData?.entities;
  if (!Array.isArray(entities)) {
    return null;
  }

  for (const entity of entities) {
    const object = entity?.components?.object;
    if (object?.type !== CHARACTER_OBJECT_TYPE) {
      continue;
    }

    const state = object.state;
    if (typeof state === "number" && Number.isFinite(state)) {
      return state;
    }
  }

  return null;
}

export function selectHomeWidgetSyncWorldData(params: {
  storedWorldData: HomeWidgetSyncWorldDataLike | undefined;
  inMemoryWorldData: HomeWidgetSyncWorldDataLike | undefined;
}): HomeWidgetSyncWorldDataSelection {
  const storedWorldData = params.storedWorldData ?? null;
  const inMemoryWorldData = params.inMemoryWorldData ?? null;
  const storedLastEcsSaved = readLastEcsSaved(storedWorldData);
  const inMemoryLastEcsSaved = readLastEcsSaved(inMemoryWorldData);
  const storedMainCharacterState = readMainCharacterState(storedWorldData);
  const inMemoryMainCharacterState = readMainCharacterState(inMemoryWorldData);

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

  const shouldPreferStoredCompletedHatch =
    storedMainCharacterState !== null &&
    storedMainCharacterState !== EGG_CHARACTER_STATE &&
    inMemoryMainCharacterState === EGG_CHARACTER_STATE;

  const shouldUseInMemory =
    !shouldPreferStoredCompletedHatch &&
    inMemoryLastEcsSaved !== null &&
    (storedLastEcsSaved === null || inMemoryLastEcsSaved > storedLastEcsSaved);

  return {
    selectedWorldData: shouldUseInMemory ? inMemoryWorldData : storedWorldData,
    source: shouldUseInMemory ? "in_memory" : "stored",
    storedLastEcsSaved,
    inMemoryLastEcsSaved,
  };
}
