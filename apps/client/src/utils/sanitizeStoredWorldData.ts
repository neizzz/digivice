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
  nextSmallPoopTime?: number;
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

type StoredSunTimesPayload = {
  sunriseAt?: string;
  sunsetAt?: string;
  date?: string;
  timezone?: string;
  timezoneOffsetMinutes?: number;
  fetchedAt?: string;
  locationSource?: "device" | "fallback";
  hasLocationPermission?: boolean;
};

type StoredMainSceneAdMenu = "feed" | "clean" | "hospital" | "mini_game";

type StoredMainSceneAdState = {
  menu_use_count?: number;
  pending?: {
    menu?: StoredMainSceneAdMenu;
    queued_at?: number;
    cooldown_ms?: number;
    threshold?: number;
    deep_night?: boolean;
  };
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
      use_local_time?: boolean;
      cached_sun_times?: StoredSunTimesPayload;
      main_scene_ad?: StoredMainSceneAdState;
    };
  };
  entities?: StoredEntity[];
};

export type SanitizeStoredWorldDataResult = {
  action: "playable" | "setup_required" | "reset_required";
  sanitizedData: StoredWorldData | null;
  changed: boolean;
  resetReason?: string;
  diagnostics: {
    summary: string;
    issues: string[];
    rawEntityCount: number;
    sanitizedEntityCount: number;
    playableCharacterCount: number;
    skippedEntityCount: number;
    duplicateObjectIdCount: number;
    repairedCharacterEntityCount: number;
    repairedNonCharacterEntityCount: number;
    sawCharacterCandidate: boolean;
    hasMonsterName: boolean;
    hadAnySavedShape: boolean;
  };
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
  EGG_HATCH_MIN_TIME: 15 * 60 * 1_000,
  EGG_HATCH_MODE_TIME: 30 * 60 * 1_000,
  EGG_HATCH_MAX_TIME: 45 * 60 * 1_000,
  DAY_NAP_CHECK_INTERVAL: 20 * 60 * 1000,
  FATIGUE_DEFAULT: 35,
  RANDOM_MOVEMENT: {
    minIdleTime: 2_000,
    maxIdleTime: 8_000,
    minMoveTime: 1_000,
    maxMoveTime: 8_000,
  },
} as const;

function getEggHatchDelayMs(randomValue: number = Math.random()): number {
  const min = DEFAULTS.EGG_HATCH_MIN_TIME;
  const mode = DEFAULTS.EGG_HATCH_MODE_TIME;
  const max = DEFAULTS.EGG_HATCH_MAX_TIME;

  if (max <= min) {
    return min;
  }

  const clampedRandom = Math.max(0, Math.min(1, randomValue));
  const pivot = (mode - min) / (max - min);

  if (clampedRandom <= pivot) {
    return Math.round(
      min + Math.sqrt(clampedRandom * (max - min) * (mode - min)),
    );
  }

  return Math.round(
    max - Math.sqrt((1 - clampedRandom) * (max - min) * (max - mode)),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function toNonNegativeInteger(value: unknown, fallback = 0): number {
  const numericValue = toFiniteNumber(value);
  if (numericValue === null || numericValue < 0) {
    return fallback;
  }

  return Math.floor(numericValue);
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
  const cachedSunTimes = sanitizeCachedSunTimes(
    metadata?.app_state?.cached_sun_times,
  );
  const mainSceneAd = sanitizeMainSceneAdState(
    metadata?.app_state?.main_scene_ad,
  );

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
      use_local_time:
        typeof metadata?.app_state?.use_local_time === "boolean"
          ? metadata.app_state.use_local_time
          : true,
      cached_sun_times: cachedSunTimes,
      main_scene_ad: mainSceneAd,
    },
  };
}

function sanitizeMainSceneAdState(
  adState: StoredMainSceneAdState | undefined,
): StoredMainSceneAdState {
  const sanitized: StoredMainSceneAdState = {
    menu_use_count: toNonNegativeInteger(adState?.menu_use_count),
  };
  const pending = sanitizeMainSceneAdPendingReservation(adState?.pending);

  if (pending) {
    sanitized.pending = pending;
  }

  return sanitized;
}

function sanitizeMainSceneAdPendingReservation(
  pending: StoredMainSceneAdState["pending"] | undefined,
): StoredMainSceneAdState["pending"] | undefined {
  if (!pending || !isMainSceneAdMenu(pending.menu)) {
    return undefined;
  }

  const queuedAt = toFiniteNumber(pending.queued_at);
  const cooldownMs = toFiniteNumber(pending.cooldown_ms);
  const threshold = toFiniteNumber(pending.threshold);

  if (
    queuedAt === null ||
    queuedAt <= 0 ||
    cooldownMs === null ||
    cooldownMs <= 0 ||
    threshold === null ||
    threshold <= 0 ||
    typeof pending.deep_night !== "boolean"
  ) {
    return undefined;
  }

  return {
    menu: pending.menu,
    queued_at: queuedAt,
    cooldown_ms: cooldownMs,
    threshold: Math.floor(threshold),
    deep_night: pending.deep_night,
  };
}

function isMainSceneAdMenu(value: unknown): value is StoredMainSceneAdMenu {
  return (
    value === "feed" ||
    value === "clean" ||
    value === "hospital" ||
    value === "mini_game"
  );
}

function sanitizeCachedSunTimes(
  sunTimes: StoredSunTimesPayload | undefined,
): StoredSunTimesPayload | undefined {
  if (
    typeof sunTimes?.sunriseAt !== "string" ||
    typeof sunTimes.sunsetAt !== "string" ||
    typeof sunTimes.date !== "string" ||
    typeof sunTimes.timezone !== "string" ||
    typeof sunTimes.timezoneOffsetMinutes !== "number" ||
    typeof sunTimes.fetchedAt !== "string" ||
    (sunTimes.locationSource !== "device" &&
      sunTimes.locationSource !== "fallback") ||
    typeof sunTimes.hasLocationPermission !== "boolean"
  ) {
    return undefined;
  }

  return {
    sunriseAt: sunTimes.sunriseAt,
    sunsetAt: sunTimes.sunsetAt,
    date: sunTimes.date,
    timezone: sunTimes.timezone,
    timezoneOffsetMinutes: sunTimes.timezoneOffsetMinutes,
    fetchedAt: sunTimes.fetchedAt,
    locationSource: sunTimes.locationSource,
    hasLocationPermission: sunTimes.hasLocationPermission,
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
      nextSmallPoopTime:
        toFiniteNumber(components.digestiveSystem?.nextSmallPoopTime) ?? 0,
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
          ? now + getEggHatchDelayMs()
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
      diagnostics: {
        summary: "No saved game data was found.",
        issues: ["savedData was nullish, so setup is required."],
        rawEntityCount: 0,
        sanitizedEntityCount: 0,
        playableCharacterCount: 0,
        skippedEntityCount: 0,
        duplicateObjectIdCount: 0,
        repairedCharacterEntityCount: 0,
        repairedNonCharacterEntityCount: 0,
        sawCharacterCandidate: false,
        hasMonsterName: false,
        hadAnySavedShape: false,
      },
    };
  }

  if (!isRecord(savedData)) {
    return {
      action: "reset_required",
      sanitizedData: null,
      changed: false,
      resetReason:
        "The existing game data format is invalid and must be reset.",
      diagnostics: {
        summary: "Saved game data root shape is invalid.",
        issues: [
          `savedData root is not an object (type=${typeof savedData}).`,
        ],
        rawEntityCount: 0,
        sanitizedEntityCount: 0,
        playableCharacterCount: 0,
        skippedEntityCount: 0,
        duplicateObjectIdCount: 0,
        repairedCharacterEntityCount: 0,
        repairedNonCharacterEntityCount: 0,
        sawCharacterCandidate: false,
        hasMonsterName: false,
        hadAnySavedShape: false,
      },
    };
  }

  const now = Date.now();
  const worldData = savedData as StoredWorldData;
  const sanitizedMetadata = sanitizeWorldMetadata(worldData.world_metadata, now);
  const rawEntities = Array.isArray(worldData.entities) ? worldData.entities : [];
  const sanitizedEntities: StoredEntity[] = [];
  const seenObjectIds = new Set<number>();
  const issues: string[] = [];
  let sawCharacterCandidate = false;
  let skippedEntityCount = 0;
  let duplicateObjectIdCount = 0;
  let repairedCharacterEntityCount = 0;
  let repairedNonCharacterEntityCount = 0;

  if (!Array.isArray(worldData.entities) && worldData.entities !== undefined) {
    issues.push("worldData.entities was not an array and was treated as empty.");
  }

  if (sanitizedMetadata.name !== worldData.world_metadata?.name) {
    issues.push(
      `world_metadata.name was normalized to "${sanitizedMetadata.name}".`,
    );
  }

  if (!sanitizedMetadata.monster_name) {
    issues.push("world_metadata.monster_name is missing after sanitization.");
  }

  if (sanitizedMetadata.version !== worldData.world_metadata?.version) {
    issues.push(
      `world_metadata.version was normalized to "${sanitizedMetadata.version}".`,
    );
  }

  rawEntities.forEach((entity, index) => {
    if (!isRecord(entity) || !isRecord(entity.components)) {
      skippedEntityCount += 1;
      issues.push(
        `entity[${index}] was skipped because it was missing a valid components object.`,
      );
      return;
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
      skippedEntityCount += 1;

      if (looksLikeCharacter) {
        issues.push(
          `entity[${index}] looked like a character but could not be recovered (missing valid object.id or required fields).`,
        );
      } else {
        issues.push(
          `entity[${index}] was skipped because its non-character payload was invalid or unsupported.`,
        );
      }

      return;
    }

    if (seenObjectIds.has(sanitizedComponents.object.id)) {
      duplicateObjectIdCount += 1;
      issues.push(
        `entity[${index}] was dropped because object.id=${sanitizedComponents.object.id} was duplicated.`,
      );
      return;
    }

    seenObjectIds.add(sanitizedComponents.object.id);

    if (looksLikeCharacter) {
      if (JSON.stringify(components) !== JSON.stringify(sanitizedComponents)) {
        repairedCharacterEntityCount += 1;
      }
    } else if (JSON.stringify(components) !== JSON.stringify(sanitizedComponents)) {
      repairedNonCharacterEntityCount += 1;
    }

    sanitizedEntities.push({ components: sanitizedComponents });
  });

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
  const hadAnySavedShape =
    rawEntities.length > 0 ||
    !!worldData.world_metadata?.monster_name ||
    !!worldData.world_metadata?.name;

  const diagnosticsBase = {
    issues,
    rawEntityCount: rawEntities.length,
    sanitizedEntityCount: sanitizedEntities.length,
    playableCharacterCount,
    skippedEntityCount,
    duplicateObjectIdCount,
    repairedCharacterEntityCount,
    repairedNonCharacterEntityCount,
    sawCharacterCandidate,
    hasMonsterName,
    hadAnySavedShape,
  };

  if (playableCharacterCount === 0) {
    if (hadAnySavedShape) {
      const resetReason = [
        "Character recovery failed during saved game validation.",
        `rawEntities=${rawEntities.length}`,
        `sanitizedEntities=${sanitizedEntities.length}`,
        `skippedEntities=${skippedEntityCount}`,
        `duplicateObjectIds=${duplicateObjectIdCount}`,
        `sawCharacterCandidate=${sawCharacterCandidate}`,
        issues.length > 0 ? `issues=${issues.slice(0, 5).join(" | ")}` : "",
      ]
        .filter(Boolean)
        .join(" ");

      return {
        action: "reset_required",
        sanitizedData,
        changed,
        resetReason,
        diagnostics: {
          ...diagnosticsBase,
          summary:
            "Saved game data had shape, but no playable character could be recovered.",
        },
      };
    }

    return {
      action: "setup_required",
      sanitizedData,
      changed,
      diagnostics: {
        ...diagnosticsBase,
        summary: "No playable character data exists, so setup is required.",
      },
    };
  }

  if (!hasMonsterName) {
    const resetReason = sawCharacterCandidate
      ? [
          "Saved game data contained a character candidate but no valid monster name.",
          `rawEntities=${rawEntities.length}`,
          `sanitizedEntities=${sanitizedEntities.length}`,
          `issues=${issues.slice(0, 5).join(" | ")}`,
        ]
          .filter(Boolean)
          .join(" ")
      : undefined;

    return {
      action: sawCharacterCandidate ? "reset_required" : "setup_required",
      sanitizedData,
      changed,
      resetReason,
      diagnostics: {
        ...diagnosticsBase,
        summary: sawCharacterCandidate
          ? "Character data exists but the required monster name is missing."
          : "Monster name is missing, so setup is required.",
      },
    };
  }

  return {
    action: "playable",
    sanitizedData,
    changed,
    diagnostics: {
      ...diagnosticsBase,
      summary: changed
        ? "Saved game data was repaired and is playable."
        : "Saved game data is playable without repair.",
    },
  };
}
