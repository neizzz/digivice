type StoredObjectComponent = {
  id?: number;
  type?: number;
  state?: number;
};

type StoredCharacterStatusComponent = {
  characterKey?: number;
  stamina?: number;
  evolutionGage?: number;
  evolutionPhase?: number;
  statuses?: number[];
};

type StoredPositionComponent = {
  x?: number;
  y?: number;
};

type StoredAngleComponent = {
  value?: number;
};

type StoredSpeedComponent = {
  value?: number;
};

type StoredRenderComponent = {
  storeIndex?: number;
  textureKey?: number;
  scale?: number;
  zIndex?: number;
};

type StoredAnimationRenderComponent = {
  storeIndex?: number;
  spritesheetKey?: number;
  animationKey?: number;
  isPlaying?: boolean;
  loop?: boolean;
  speed?: number;
};

type StoredRandomMovementComponent = {
  minIdleTime?: number;
  maxIdleTime?: number;
  minMoveTime?: number;
  maxMoveTime?: number;
  nextChange?: number;
};

type StoredStatusIconRenderComponent = {
  storeIndexes?: number[];
  visibleCount?: number;
};

type StoredDigestiveSystemComponent = {
  capacity?: number;
  currentLoad?: number;
  nextPoopTime?: number;
};

type StoredDiseaseSystemComponent = {
  nextCheckTime?: number;
  sickStartTime?: number;
};

type StoredSleepSystemComponent = {
  fatigue?: number;
  nextSleepTime?: number;
  nextWakeTime?: number;
  nextNapCheckTime?: number;
  nextNightWakeCheckTime?: number;
  sleepMode?: number;
  pendingSleepReason?: number;
  pendingWakeReason?: number;
  sleepSessionStartedAt?: number;
};

type StoredVitalityComponent = {
  urgentStartTime?: number;
  deathTime?: number;
  isDead?: boolean;
};

type StoredTemporaryStatusComponent = {
  statusType?: number;
  startTime?: number;
};

type StoredEggHatchComponent = {
  hatchTime?: number;
  isReadyToHatch?: boolean;
};

type StoredEntityComponents = {
  object?: StoredObjectComponent;
  characterStatus?: StoredCharacterStatusComponent;
  position?: StoredPositionComponent;
  angle?: StoredAngleComponent;
  speed?: StoredSpeedComponent;
  render?: StoredRenderComponent;
  animationRender?: StoredAnimationRenderComponent;
  randomMovement?: StoredRandomMovementComponent;
  statusIconRender?: StoredStatusIconRenderComponent;
  digestiveSystem?: StoredDigestiveSystemComponent;
  diseaseSystem?: StoredDiseaseSystemComponent;
  sleepSystem?: StoredSleepSystemComponent;
  vitality?: StoredVitalityComponent;
  temporaryStatus?: StoredTemporaryStatusComponent;
  eggHatch?: StoredEggHatchComponent;
};

type StoredEntity = {
  components?: StoredEntityComponents;
};

export type StoredWorldData = {
  world_metadata?: {
    name?: string;
    monster_name?: string;
    last_ecs_saved?: number;
    version?: string;
    app_state?: {
      last_active_time?: number;
      is_first_load?: boolean;
    };
  };
  entities?: StoredEntity[];
};

export type SanitizeStoredWorldDataResult = {
  action: "playable" | "setup_required" | "reset_required";
  sanitizedData: StoredWorldData | null;
  changed: boolean;
  resetReason?: string;
};

const ECS_NULL_VALUE = 0;
const CHARACTER_OBJECT_TYPE = 1;
const FOOD_OBJECT_TYPE = 3;
const POOB_OBJECT_TYPE = 4;
const PILL_OBJECT_TYPE = 5;

const CHARACTER_STATE = {
  EGG: 0,
  IDLE: 1,
  MOVING: 2,
  SLEEPING: 3,
  SICK: 4,
  EATING: 5,
  DEAD: 6,
} as const;

const DEFAULTS = {
  VERSION: "1.0.0",
  CHARACTER_KEY: 1,
  SPRITESHEET_KEY: 1,
  ANIMATION_KEY_IDLE: 1,
  TEXTURE_KEY_EGG0: 500,
  STATUS_SLOT_COUNT: 4,
  DIGESTIVE_CAPACITY: 5,
  DISEASE_CHECK_INTERVAL: 10_000,
  EGG_HATCH_TIME: 5_000,
  DAY_NAP_CHECK_INTERVAL: 20 * 60 * 1000,
  FATIGUE_DEFAULT: 35,
  RANDOM_MOVEMENT: {
    minIdleTime: 2_000,
    maxIdleTime: 8_000,
    minMoveTime: 1_000,
    maxMoveTime: 8_000,
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeStatuses(statuses: unknown): number[] {
  if (!Array.isArray(statuses)) {
    return new Array(DEFAULTS.STATUS_SLOT_COUNT).fill(ECS_NULL_VALUE);
  }

  const sanitized = statuses
    .map((status) => toFiniteNumber(status) ?? ECS_NULL_VALUE)
    .slice(0, DEFAULTS.STATUS_SLOT_COUNT);

  while (sanitized.length < DEFAULTS.STATUS_SLOT_COUNT) {
    sanitized.push(ECS_NULL_VALUE);
  }

  return sanitized;
}

function needsAnimationRender(state: number): boolean {
  return (
    state !== CHARACTER_STATE.EGG &&
    state !== CHARACTER_STATE.DEAD
  );
}

function needsRandomMovement(state: number): boolean {
  return (
    state === CHARACTER_STATE.IDLE ||
    state === CHARACTER_STATE.MOVING
  );
}

function sanitizeWorldMetadata(
  metadata: StoredWorldData["world_metadata"],
  now: number,
): NonNullable<StoredWorldData["world_metadata"]> {
  return {
    name:
      typeof metadata?.name === "string" && metadata.name.trim()
        ? metadata.name.trim()
        : "MainScene",
    monster_name:
      typeof metadata?.monster_name === "string" && metadata.monster_name.trim()
        ? metadata.monster_name.trim()
        : undefined,
    last_ecs_saved: toFiniteNumber(metadata?.last_ecs_saved) ?? now,
    version:
      typeof metadata?.version === "string" && metadata.version.trim()
        ? metadata.version
        : DEFAULTS.VERSION,
    app_state: {
      last_active_time:
        toFiniteNumber(metadata?.app_state?.last_active_time) ?? now,
      is_first_load:
        typeof metadata?.app_state?.is_first_load === "boolean"
          ? metadata.app_state.is_first_load
          : false,
    },
  };
}

function sanitizeCharacterEntity(
  components: StoredEntityComponents,
  now: number,
): StoredEntityComponents | null {
  const objectId = toFiniteNumber(components.object?.id);
  if (!objectId || objectId <= 0) {
    return null;
  }

  const state =
    toFiniteNumber(components.object?.state) ?? CHARACTER_STATE.EGG;

  const characterKey =
    toFiniteNumber(components.characterStatus?.characterKey) ??
    DEFAULTS.CHARACTER_KEY;

  const sanitized: StoredEntityComponents = {
    object: {
      id: objectId,
      type: CHARACTER_OBJECT_TYPE,
      state,
    },
    characterStatus: {
      characterKey,
      stamina: toFiniteNumber(components.characterStatus?.stamina) ?? 5,
      evolutionGage:
        toFiniteNumber(components.characterStatus?.evolutionGage) ?? 0,
      evolutionPhase:
        toFiniteNumber(components.characterStatus?.evolutionPhase) ?? 1,
      statuses: sanitizeStatuses(components.characterStatus?.statuses),
    },
    position: {
      x: toFiniteNumber(components.position?.x) ?? 0,
      y: toFiniteNumber(components.position?.y) ?? 0,
    },
    angle: {
      value: toFiniteNumber(components.angle?.value) ?? 0,
    },
    speed: {
      value: toFiniteNumber(components.speed?.value) ?? 0,
    },
    render: {
      storeIndex: ECS_NULL_VALUE,
      textureKey:
        toFiniteNumber(components.render?.textureKey) ??
        (state === CHARACTER_STATE.EGG ? DEFAULTS.TEXTURE_KEY_EGG0 : ECS_NULL_VALUE),
      scale: toFiniteNumber(components.render?.scale) ?? 3,
      zIndex: toFiniteNumber(components.render?.zIndex) ?? ECS_NULL_VALUE,
    },
    statusIconRender: {
      storeIndexes:
        Array.isArray(components.statusIconRender?.storeIndexes)
          ? components.statusIconRender.storeIndexes
              .map((value) => toFiniteNumber(value) ?? ECS_NULL_VALUE)
              .slice(0, DEFAULTS.STATUS_SLOT_COUNT)
          : new Array(DEFAULTS.STATUS_SLOT_COUNT).fill(ECS_NULL_VALUE),
      visibleCount:
        toFiniteNumber(components.statusIconRender?.visibleCount) ??
        ECS_NULL_VALUE,
    },
    digestiveSystem: {
      capacity:
        toFiniteNumber(components.digestiveSystem?.capacity) ??
        DEFAULTS.DIGESTIVE_CAPACITY,
      currentLoad:
        toFiniteNumber(components.digestiveSystem?.currentLoad) ?? 0,
      nextPoopTime:
        toFiniteNumber(components.digestiveSystem?.nextPoopTime) ?? 0,
    },
    diseaseSystem: {
      nextCheckTime:
        toFiniteNumber(components.diseaseSystem?.nextCheckTime) ??
        now + DEFAULTS.DISEASE_CHECK_INTERVAL,
      sickStartTime:
        toFiniteNumber(components.diseaseSystem?.sickStartTime) ?? 0,
    },
    sleepSystem: {
      fatigue:
        toFiniteNumber(components.sleepSystem?.fatigue) ??
        DEFAULTS.FATIGUE_DEFAULT,
      nextSleepTime:
        toFiniteNumber(components.sleepSystem?.nextSleepTime) ?? 0,
      nextWakeTime:
        toFiniteNumber(components.sleepSystem?.nextWakeTime) ?? 0,
      nextNapCheckTime:
        toFiniteNumber(components.sleepSystem?.nextNapCheckTime) ??
        now + DEFAULTS.DAY_NAP_CHECK_INTERVAL,
      nextNightWakeCheckTime:
        toFiniteNumber(components.sleepSystem?.nextNightWakeCheckTime) ?? 0,
      sleepMode:
        toFiniteNumber(components.sleepSystem?.sleepMode) ??
        (state === CHARACTER_STATE.SLEEPING ? 1 : 0),
      pendingSleepReason:
        toFiniteNumber(components.sleepSystem?.pendingSleepReason) ?? 0,
      pendingWakeReason:
        toFiniteNumber(components.sleepSystem?.pendingWakeReason) ?? 0,
      sleepSessionStartedAt:
        toFiniteNumber(components.sleepSystem?.sleepSessionStartedAt) ?? 0,
    },
    vitality: {
      urgentStartTime:
        toFiniteNumber(components.vitality?.urgentStartTime) ?? 0,
      deathTime: toFiniteNumber(components.vitality?.deathTime) ?? 0,
      isDead: toBoolean(
        components.vitality?.isDead,
        state === CHARACTER_STATE.DEAD,
      ),
    },
    temporaryStatus: {
      statusType:
        toFiniteNumber(components.temporaryStatus?.statusType) ?? ECS_NULL_VALUE,
      startTime:
        toFiniteNumber(components.temporaryStatus?.startTime) ?? 0,
    },
    eggHatch: {
      hatchTime:
        toFiniteNumber(components.eggHatch?.hatchTime) ??
        (state === CHARACTER_STATE.EGG
          ? now + DEFAULTS.EGG_HATCH_TIME
          : 0),
      isReadyToHatch: toBoolean(
        components.eggHatch?.isReadyToHatch,
        false,
      ),
    },
  };

  const statusIconSlots = sanitized.statusIconRender?.storeIndexes;
  if (statusIconSlots && statusIconSlots.length < DEFAULTS.STATUS_SLOT_COUNT) {
    while (statusIconSlots.length < DEFAULTS.STATUS_SLOT_COUNT) {
      statusIconSlots.push(ECS_NULL_VALUE);
    }
  }

  if (needsAnimationRender(state)) {
    sanitized.animationRender = {
      storeIndex: ECS_NULL_VALUE,
      spritesheetKey:
        toFiniteNumber(components.animationRender?.spritesheetKey) ??
        characterKey ??
        DEFAULTS.SPRITESHEET_KEY,
      animationKey:
        toFiniteNumber(components.animationRender?.animationKey) ??
        DEFAULTS.ANIMATION_KEY_IDLE,
      isPlaying: toBoolean(components.animationRender?.isPlaying, true),
      loop: toBoolean(components.animationRender?.loop, true),
      speed: toFiniteNumber(components.animationRender?.speed) ?? 0.04,
    };
  }

  if (needsRandomMovement(state)) {
    const minIdle =
      toFiniteNumber(components.randomMovement?.minIdleTime) ??
      DEFAULTS.RANDOM_MOVEMENT.minIdleTime;
    const maxIdle = Math.max(
      minIdle,
      toFiniteNumber(components.randomMovement?.maxIdleTime) ??
        DEFAULTS.RANDOM_MOVEMENT.maxIdleTime,
    );
    const minMove =
      toFiniteNumber(components.randomMovement?.minMoveTime) ??
      DEFAULTS.RANDOM_MOVEMENT.minMoveTime;
    const maxMove = Math.max(
      minMove,
      toFiniteNumber(components.randomMovement?.maxMoveTime) ??
        DEFAULTS.RANDOM_MOVEMENT.maxMoveTime,
    );

    sanitized.randomMovement = {
      minIdleTime: minIdle,
      maxIdleTime: maxIdle,
      minMoveTime: minMove,
      maxMoveTime: maxMove,
      nextChange:
        toFiniteNumber(components.randomMovement?.nextChange) ??
        now + 1000,
    };
  }

  return sanitized;
}

function sanitizeNonCharacterEntity(
  components: StoredEntityComponents,
): StoredEntityComponents | null {
  const objectId = toFiniteNumber(components.object?.id);
  const objectType = toFiniteNumber(components.object?.type);
  const objectState = toFiniteNumber(components.object?.state) ?? ECS_NULL_VALUE;

  if (!objectId || objectId <= 0) {
    return null;
  }

  if (
    objectType !== FOOD_OBJECT_TYPE &&
    objectType !== POOB_OBJECT_TYPE &&
    objectType !== PILL_OBJECT_TYPE
  ) {
    return null;
  }

  if (!isRecord(components.position) || !isRecord(components.render)) {
    return null;
  }

  const positionX = toFiniteNumber(components.position.x);
  const positionY = toFiniteNumber(components.position.y);
  const textureKey = toFiniteNumber(components.render.textureKey);
  const scale = toFiniteNumber(components.render.scale);

  if (
    positionX === null ||
    positionY === null ||
    textureKey === null ||
    scale === null
  ) {
    return null;
  }

  return {
    ...components,
    object: {
      id: objectId,
      type: objectType,
      state: objectState,
    },
    position: {
      x: positionX,
      y: positionY,
    },
    render: {
      storeIndex: ECS_NULL_VALUE,
      textureKey,
      scale,
      zIndex: toFiniteNumber(components.render?.zIndex) ?? ECS_NULL_VALUE,
    },
  };
}

export function sanitizeStoredWorldData(
  savedData: unknown,
): SanitizeStoredWorldDataResult {
  if (!savedData) {
    return {
      action: "setup_required",
      sanitizedData: null,
      changed: false,
    };
  }

  if (!isRecord(savedData)) {
    return {
      action: "reset_required",
      sanitizedData: null,
      changed: false,
      resetReason:
        "기존 게임 데이터 형식이 올바르지 않아 새로 시작해야 합니다.",
    };
  }

  const now = Date.now();
  const worldData = savedData as StoredWorldData;
  const sanitizedMetadata = sanitizeWorldMetadata(worldData.world_metadata, now);
  const rawEntities = Array.isArray(worldData.entities) ? worldData.entities : [];
  const sanitizedEntities: StoredEntity[] = [];
  const seenObjectIds = new Set<number>();
  let sawCharacterCandidate = false;

  for (const entity of rawEntities) {
    if (!isRecord(entity) || !isRecord(entity.components)) {
      continue;
    }

    const components = entity.components as StoredEntityComponents;
    const rawObjectType = toFiniteNumber(components.object?.type);
    const looksLikeCharacter =
      rawObjectType === CHARACTER_OBJECT_TYPE || !!components.characterStatus;

    if (looksLikeCharacter) {
      sawCharacterCandidate = true;
    }

    const sanitizedComponents = looksLikeCharacter
      ? sanitizeCharacterEntity(components, now)
      : sanitizeNonCharacterEntity(components);

    if (!sanitizedComponents?.object?.id) {
      continue;
    }

    if (seenObjectIds.has(sanitizedComponents.object.id)) {
      continue;
    }

    seenObjectIds.add(sanitizedComponents.object.id);
    sanitizedEntities.push({ components: sanitizedComponents });
  }

  const sanitizedData: StoredWorldData = {
    world_metadata: sanitizedMetadata,
    entities: sanitizedEntities,
  };

  const changed =
    JSON.stringify(worldData) !== JSON.stringify(sanitizedData);

  const playableCharacterCount = sanitizedEntities.filter((entity) => {
    return entity.components?.object?.type === CHARACTER_OBJECT_TYPE;
  }).length;

  const hasMonsterName = !!sanitizedMetadata.monster_name?.trim();

  if (playableCharacterCount === 0) {
    const hadAnySavedShape =
      rawEntities.length > 0 ||
      !!worldData.world_metadata?.monster_name ||
      !!worldData.world_metadata?.name;

    if (hadAnySavedShape) {
      return {
        action: "reset_required",
        sanitizedData,
        changed,
        resetReason:
          "기존 게임 데이터가 손상되어 캐릭터를 복구할 수 없습니다.",
      };
    }

    return {
      action: "setup_required",
      sanitizedData,
      changed,
    };
  }

  if (!hasMonsterName) {
    return {
      action: sawCharacterCandidate ? "reset_required" : "setup_required",
      sanitizedData,
      changed,
      resetReason: sawCharacterCandidate
        ? "기존 게임 데이터에 필수 이름 정보가 없어 새로 시작해야 합니다."
        : undefined,
    };
  }

  return {
    action: "playable",
    sanitizedData,
    changed,
  };
}
