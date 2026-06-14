import {
  hasComponent,
  IWorld,
  addComponent,
  defineQuery,
  removeComponent,
} from "bitecs";
import {
  ObjectComp,
  PositionComp,
  AngleComp,
  RenderComp,
  SpeedComp,
  FreshnessComp,
  DestinationComp,
  RandomMovementComp,
  CharacterStatusComp,
  AnimationRenderComp,
  StatusIconRenderComp,
  ThrowAnimationComp,
  EggHatchComp,
  DigestiveSystemComp,
  DiseaseSystemComp,
  SleepSystemComp,
  VitalityComp,
  TemporaryStatusComp,
  MutationRiskComp,
  DirtyExposureComp,
  FreshnessTimerComp,
  FoodEatingComp,
  FoodMaskComp,
} from "./raw-components";
import type { SavedEntity, EntityComponents } from "./world";
import {
  AnimationKey,
  CharacterKeyECS as CharacterKey,
  CharacterState,
  CharacterStatus,
  DestinationType,
  Freshness,
  FoodState,
  ObjectType,
  SleepMode,
  SleepReason,
  SpritesheetKey,
  TextureKey,
  isEggTextureKey,
} from "./types";
import {
  createEggHatchSchedule,
  GAME_CONSTANTS,
  resolveEggHatchTiming,
} from "./config";
import {
  findFoodEntityRefByObjectId,
  getFoodEatingEntityRef,
  getTargetedFoodEntityRef,
  isValidFoodEntityRef,
} from "./foodEntityRef";
import { resolveWorldCurrentTime } from "./worldTime";

function normalizeSavedFreshness(freshness: Freshness): Freshness {
  return freshness === Freshness.FRESH ? Freshness.NORMAL : freshness;
}

function normalizeEggSyringeCount(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.min(10, Math.floor(value));
}

function normalizePendingEggHatchCharacterKey(
  value: number | undefined,
): CharacterKey {
  switch (value) {
    case CharacterKey.GreenSlimeA1:
    case CharacterKey.SoilSlimeA1:
    case CharacterKey.SkullSlimeA1:
      return value;
    default:
      return CharacterKey.NULL;
  }
}

function resolveEggHatchComponentForState(params: {
  currentTime: number;
  state: number;
  hatchTime?: number;
  hatchDurationMs?: number;
}): {
  hatchTime: number;
  hatchDurationMs: number;
} {
  if (params.state !== CharacterState.EGG) {
    return {
      hatchTime: 0,
      hatchDurationMs: 0,
    };
  }

  const resolved = resolveEggHatchTiming({
    currentTime: params.currentTime,
    hatchTime: params.hatchTime,
    hatchDurationMs: params.hatchDurationMs,
  });

  return {
    hatchTime: resolved.hatchTime,
    hatchDurationMs: resolved.hatchDurationMs,
  };
}

function shouldClearStaticEggTextureForState(
  state: number | undefined,
  textureKey: number,
): boolean {
  return (
    state !== CharacterState.EGG &&
    state !== CharacterState.DEAD &&
    isEggTextureKey(textureKey)
  );
}

function isStableObjectId(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function findFoodEntityByState(
  world: IWorld,
  objectEntities: readonly number[],
  state: FoodState,
  excludedFoodIds = new Set<number>(),
): number | null {
  for (let i = 0; i < objectEntities.length; i++) {
    const candidateEid = objectEntities[i];
    if (
      !excludedFoodIds.has(candidateEid) &&
      ObjectComp.type[candidateEid] === ObjectType.FOOD &&
      ObjectComp.state[candidateEid] === state &&
      isValidFoodEntityRef(world, candidateEid)
    ) {
      return candidateEid;
    }
  }

  return null;
}

function resolveEatingFoodForLoadedCharacter(
  world: IWorld,
  objectEntities: readonly number[],
  characterEid: number,
  excludedFoodIds = new Set<number>(),
): number | null {
  if (!hasComponent(world, FoodEatingComp, characterEid)) {
    return null;
  }

  const foodByObjectId = findFoodEntityRefByObjectId(
    world,
    FoodEatingComp.targetFoodObjectId[characterEid],
  );
  if (foodByObjectId !== null && !excludedFoodIds.has(foodByObjectId)) {
    return foodByObjectId;
  }

  const foodBeingIntaken = findFoodEntityByState(
    world,
    objectEntities,
    FoodState.BEING_INTAKEN,
    excludedFoodIds,
  );
  if (foodBeingIntaken !== null) {
    return foodBeingIntaken;
  }

  const foodByRuntimeRef = getFoodEatingEntityRef(world, characterEid);
  return foodByRuntimeRef !== null && !excludedFoodIds.has(foodByRuntimeRef)
    ? foodByRuntimeRef
    : null;
}

function resolveTargetedFoodForLoadedCharacter(
  world: IWorld,
  objectEntities: readonly number[],
  characterEid: number,
  excludedFoodIds = new Set<number>(),
): number | null {
  if (
    !hasComponent(world, DestinationComp, characterEid) ||
    DestinationComp.type[characterEid] !== DestinationType.TARGETED
  ) {
    return null;
  }

  const foodByObjectId = findFoodEntityRefByObjectId(
    world,
    DestinationComp.targetObjectId[characterEid],
  );
  if (foodByObjectId !== null && !excludedFoodIds.has(foodByObjectId)) {
    return foodByObjectId;
  }

  const targetedFood = findFoodEntityByState(
    world,
    objectEntities,
    FoodState.TARGETED,
    excludedFoodIds,
  );
  if (targetedFood !== null) {
    return targetedFood;
  }

  const foodByRuntimeRef = getTargetedFoodEntityRef(world, characterEid);
  return foodByRuntimeRef !== null && !excludedFoodIds.has(foodByRuntimeRef)
    ? foodByRuntimeRef
    : null;
}

/**
 * ECS 엔티티를 SavedEntity로 변환
 */
export function convertECSEntityToSavedEntity(
  world: IWorld,
  eid: number,
): SavedEntity {
  const components: EntityComponents = {};

  if (hasComponent(world, ObjectComp, eid)) {
    components.object = {
      id: ObjectComp.id[eid],
      type: ObjectComp.type[eid],
      state: ObjectComp.state[eid],
    };
  }
  if (hasComponent(world, CharacterStatusComp, eid)) {
    components.characterStatus = {
      characterKey: CharacterStatusComp.characterKey[eid] as CharacterKey,
      stamina: CharacterStatusComp.stamina[eid],
      evolutionGage: CharacterStatusComp.evolutionGage[eid],
      evolutionPhase: CharacterStatusComp.evolutionPhase[eid],
      statuses: Array.from(
        CharacterStatusComp.statuses[eid],
      ) as CharacterStatus[],
    };
  }
  if (hasComponent(world, PositionComp, eid)) {
    components.position = {
      x: PositionComp.x[eid],
      y: PositionComp.y[eid],
    };
  }
  if (hasComponent(world, AngleComp, eid)) {
    components.angle = {
      value: AngleComp.value[eid],
    };
  }
  if (hasComponent(world, SpeedComp, eid)) {
    components.speed = {
      value: SpeedComp.value[eid],
    };
  }
  if (hasComponent(world, FreshnessComp, eid)) {
    components.freshness = {
      freshness: normalizeSavedFreshness(FreshnessComp.freshness[eid]),
    };
  }
  if (hasComponent(world, DestinationComp, eid)) {
    const targetFoodEid = getTargetedFoodEntityRef(world, eid);
    const targetObjectId =
      targetFoodEid !== null
        ? ObjectComp.id[targetFoodEid]
        : DestinationComp.targetObjectId[eid];
    components.destination = {
      type: DestinationComp.type[eid],
      target: DestinationComp.target[eid],
      ...(isStableObjectId(targetObjectId) ? { targetObjectId } : {}),
      x: DestinationComp.x[eid],
      y: DestinationComp.y[eid],
    };
  }
  if (hasComponent(world, RandomMovementComp, eid)) {
    components.randomMovement = {
      minIdleTime: RandomMovementComp.minIdleTime[eid],
      maxIdleTime: RandomMovementComp.maxIdleTime[eid],
      minMoveTime: RandomMovementComp.minMoveTime[eid],
      maxMoveTime: RandomMovementComp.maxMoveTime[eid],
      nextChange: RandomMovementComp.nextChange[eid],
    };
  }
  if (hasComponent(world, RenderComp, eid)) {
    components.render = {
      storeIndex: ECS_NULL_VALUE,
      textureKey: RenderComp.textureKey[eid],
      scale: RenderComp.scale[eid],
      zIndex: RenderComp.zIndex[eid],
    };
  }
  if (hasComponent(world, AnimationRenderComp, eid)) {
    components.animationRender = {
      storeIndex: AnimationRenderComp.storeIndex[eid],
      spritesheetKey: AnimationRenderComp.spritesheetKey[eid],
      animationKey: AnimationRenderComp.animationKey[eid],
      isPlaying: AnimationRenderComp.isPlaying[eid] === 1,
      loop: AnimationRenderComp.loop[eid] === 1,
      speed: +AnimationRenderComp.speed[eid].toFixed(2),
    };
  }
  if (hasComponent(world, StatusIconRenderComp, eid)) {
    components.statusIconRender = {
      storeIndexes: Array.from(StatusIconRenderComp.storeIndexes[eid]),
      visibleCount: StatusIconRenderComp.visibleCount[eid],
    };
  }
  if (hasComponent(world, ThrowAnimationComp, eid)) {
    components.throwAnimation = {
      initialPosition: {
        x: ThrowAnimationComp.initialX[eid],
        y: ThrowAnimationComp.initialY[eid],
      },
      finalPosition: {
        x: ThrowAnimationComp.finalX[eid],
        y: ThrowAnimationComp.finalY[eid],
      },
      initialScale: 0, // 이제 시스템에서 관리하므로 기본값
      finalScale: 0, // 이제 시스템에서 관리하므로 기본값
      duration: 0, // 이제 시스템에서 관리하므로 기본값
      elapsedTime: ThrowAnimationComp.elapsedTime[eid],
      isActive: ThrowAnimationComp.isActive[eid] === 1,
      maxHeight: 0, // 이제 시스템에서 관리하므로 기본값
    };
  }
  if (hasComponent(world, FoodEatingComp, eid)) {
    const targetFoodEid = getFoodEatingEntityRef(world, eid);
    const targetFoodObjectId =
      targetFoodEid !== null
        ? ObjectComp.id[targetFoodEid]
        : FoodEatingComp.targetFoodObjectId[eid];
    components.foodEating = {
      targetFood: FoodEatingComp.targetFood[eid],
      ...(isStableObjectId(targetFoodObjectId)
        ? { targetFoodObjectId }
        : {}),
      progress: FoodEatingComp.progress[eid],
      duration: FoodEatingComp.duration[eid],
      elapsedTime: FoodEatingComp.elapsedTime[eid],
      isActive: FoodEatingComp.isActive[eid] === 1,
    };
  }
  if (hasComponent(world, FoodMaskComp, eid)) {
    components.foodMask = {
      maskStoreIndex: FoodMaskComp.maskStoreIndex[eid],
      progress: FoodMaskComp.progress[eid],
      isInitialized: FoodMaskComp.isInitialized[eid] === 1,
    };
  }
  if (hasComponent(world, EggHatchComp, eid)) {
    components.eggHatch = {
      hatchTime: EggHatchComp.hatchTime[eid],
      hatchDurationMs: EggHatchComp.hatchDurationMs[eid],
      isReadyToHatch: EggHatchComp.isReadyToHatch[eid] === 1,
      syringeCount: normalizeEggSyringeCount(EggHatchComp.syringeCount[eid]),
      pendingCharacterKey: normalizePendingEggHatchCharacterKey(
        EggHatchComp.pendingCharacterKey[eid],
      ),
    };
  }
  if (hasComponent(world, MutationRiskComp, eid)) {
    components.mutationRisk = {
      unnecessaryInjectionStacks:
        MutationRiskComp.unnecessaryInjectionStacks[eid],
      dirtyExposureStacks: MutationRiskComp.dirtyExposureStacks[eid],
      lastInjectionDetoxTime: MutationRiskComp.lastInjectionDetoxTime[eid],
      lastDirtyDetoxTime: MutationRiskComp.lastDirtyDetoxTime[eid],
    };
  }
  if (hasComponent(world, DigestiveSystemComp, eid)) {
    components.digestiveSystem = {
      capacity: DigestiveSystemComp.capacity[eid],
      currentLoad: DigestiveSystemComp.currentLoad[eid],
      nextPoopTime: DigestiveSystemComp.nextPoopTime[eid],
      nextSmallPoopTime: DigestiveSystemComp.nextSmallPoopTime[eid],
    };
  }
  if (hasComponent(world, DiseaseSystemComp, eid)) {
    components.diseaseSystem = {
      nextCheckTime: DiseaseSystemComp.nextCheckTime[eid],
      sickStartTime: DiseaseSystemComp.sickStartTime[eid],
    };
  }
  if (hasComponent(world, SleepSystemComp, eid)) {
    components.sleepSystem = {
      fatigue: +SleepSystemComp.fatigue[eid].toFixed(2),
      nextSleepTime: SleepSystemComp.nextSleepTime[eid],
      nextWakeTime: SleepSystemComp.nextWakeTime[eid],
      nextNapCheckTime: SleepSystemComp.nextNapCheckTime[eid],
      nextNightWakeCheckTime: SleepSystemComp.nextNightWakeCheckTime[eid],
      sleepMode: SleepSystemComp.sleepMode[eid] as SleepMode,
      interruptedSleepMode: SleepSystemComp.interruptedSleepMode[
        eid
      ] as SleepMode,
      pendingSleepReason: SleepSystemComp.pendingSleepReason[
        eid
      ] as SleepReason,
      pendingWakeReason: SleepSystemComp.pendingWakeReason[eid] as SleepReason,
      sleepSessionStartedAt: SleepSystemComp.sleepSessionStartedAt[eid],
    };
  }
  if (hasComponent(world, VitalityComp, eid)) {
    components.vitality = {
      urgentStartTime: VitalityComp.urgentStartTime[eid],
      deathTime: VitalityComp.deathTime[eid],
      isDead: VitalityComp.isDead[eid] === 1,
    };
  }
  if (hasComponent(world, TemporaryStatusComp, eid)) {
    components.temporaryStatus = {
      statusType: TemporaryStatusComp.statusType[eid],
      startTime: TemporaryStatusComp.startTime[eid],
      lastHappyStatusTime: TemporaryStatusComp.lastHappyStatusTime[eid],
    };
  }
  if (hasComponent(world, FreshnessTimerComp, eid)) {
    components.freshnessTimer = {
      createdTime: FreshnessTimerComp.createdTime[eid],
      normalTime: FreshnessTimerComp.normalTime[eid],
      staleTime: FreshnessTimerComp.staleTime[eid],
      isBeingEaten: FreshnessTimerComp.isBeingEaten[eid] === 1,
    };
  }
  if (hasComponent(world, DirtyExposureComp, eid)) {
    components.dirtyExposure = {
      stackCount: DirtyExposureComp.stackCount[eid],
      accumulatedExposureMs: DirtyExposureComp.accumulatedExposureMs[eid],
      lastUpdatedTime: DirtyExposureComp.lastUpdatedTime[eid],
    };
  }

  return { components };
}

export function applySavedEntityToECS(
  world: IWorld,
  eid: number,
  savedEntity: SavedEntity,
): void {
  const { components } = savedEntity;
  const currentTime = resolveWorldCurrentTime(world);

  if (components.object) {
    if (!hasComponent(world, ObjectComp, eid)) {
      addComponent(world, ObjectComp, eid);
    }
    ObjectComp.id[eid] = components.object.id;
    ObjectComp.type[eid] = components.object.type;
    ObjectComp.state[eid] = components.object.state;
  }

  if (components.characterStatus) {
    if (!hasComponent(world, CharacterStatusComp, eid)) {
      addComponent(world, CharacterStatusComp, eid);
    }
    CharacterStatusComp.characterKey[eid] =
      components.characterStatus.characterKey;
    CharacterStatusComp.stamina[eid] = components.characterStatus.stamina;
    CharacterStatusComp.evolutionGage[eid] =
      components.characterStatus.evolutionGage;
    CharacterStatusComp.evolutionPhase[eid] =
      components.characterStatus.evolutionPhase;
    CharacterStatusComp.statuses[eid] = new Uint8Array(
      components.characterStatus.statuses,
    );
  }

  if (components.position) {
    if (!hasComponent(world, PositionComp, eid)) {
      addComponent(world, PositionComp, eid);
    }
    PositionComp.x[eid] = components.position.x;
    PositionComp.y[eid] = components.position.y;
  }

  if (components.angle) {
    if (!hasComponent(world, AngleComp, eid)) {
      addComponent(world, AngleComp, eid);
    }
    AngleComp.value[eid] = components.angle.value;
  }

  if (components.render) {
    if (!hasComponent(world, RenderComp, eid)) {
      addComponent(world, RenderComp, eid);
    }
    const state = hasComponent(world, ObjectComp, eid)
      ? ObjectComp.state[eid]
      : components.object?.state;
    RenderComp.storeIndex[eid] = ECS_NULL_VALUE;
    RenderComp.textureKey[eid] = shouldClearStaticEggTextureForState(
      state,
      components.render.textureKey,
    )
      ? TextureKey.NULL
      : components.render.textureKey;
    RenderComp.scale[eid] = components.render.scale;
    RenderComp.zIndex[eid] = components.render.zIndex;
  }

  if (components.animationRender) {
    if (!hasComponent(world, AnimationRenderComp, eid)) {
      addComponent(world, AnimationRenderComp, eid);
    }
    AnimationRenderComp.storeIndex[eid] = components.animationRender.storeIndex;
    AnimationRenderComp.spritesheetKey[eid] =
      components.animationRender.spritesheetKey;
    AnimationRenderComp.animationKey[eid] =
      components.animationRender.animationKey;
    AnimationRenderComp.isPlaying[eid] = +components.animationRender.isPlaying;
    AnimationRenderComp.loop[eid] = +components.animationRender.loop;
    AnimationRenderComp.speed[eid] = components.animationRender.speed;
  }

  if (components.statusIconRender) {
    if (!hasComponent(world, StatusIconRenderComp, eid)) {
      addComponent(world, StatusIconRenderComp, eid);
    }
    StatusIconRenderComp.storeIndexes[eid] = new Uint8Array(
      components.statusIconRender.storeIndexes,
    );
    StatusIconRenderComp.visibleCount[eid] =
      components.statusIconRender.visibleCount;
  }

  if (components.speed) {
    if (!hasComponent(world, SpeedComp, eid)) {
      addComponent(world, SpeedComp, eid);
    }
    SpeedComp.value[eid] = components.speed.value;
  }

  if (components.freshness) {
    if (!hasComponent(world, FreshnessComp, eid)) {
      addComponent(world, FreshnessComp, eid);
    }
    FreshnessComp.freshness[eid] = normalizeSavedFreshness(
      components.freshness.freshness,
    );
  }

  if (components.destination) {
    if (!hasComponent(world, DestinationComp, eid)) {
      addComponent(world, DestinationComp, eid);
    }
    DestinationComp.type[eid] = components.destination.type;
    DestinationComp.target[eid] = components.destination.target;
    DestinationComp.targetObjectId[eid] =
      components.destination.targetObjectId ?? 0;
    DestinationComp.x[eid] = components.destination.x;
    DestinationComp.y[eid] = components.destination.y;
  }

  if (components.randomMovement) {
    if (!hasComponent(world, RandomMovementComp, eid)) {
      addComponent(world, RandomMovementComp, eid);
    }
    RandomMovementComp.minIdleTime[eid] = components.randomMovement.minIdleTime;
    RandomMovementComp.maxIdleTime[eid] = components.randomMovement.maxIdleTime;
    RandomMovementComp.minMoveTime[eid] = components.randomMovement.minMoveTime;
    RandomMovementComp.maxMoveTime[eid] = components.randomMovement.maxMoveTime;
    if (components.randomMovement?.nextChange) {
      const diffFromNow = components.randomMovement.nextChange - currentTime;
      RandomMovementComp.nextChange[eid] =
        diffFromNow < 3000
          ? components.randomMovement.nextChange
          : ECS_NULL_VALUE;
    } else {
      RandomMovementComp.nextChange[eid] = ECS_NULL_VALUE;
    }
  }

  if (components.throwAnimation) {
    if (!hasComponent(world, ThrowAnimationComp, eid)) {
      addComponent(world, ThrowAnimationComp, eid);
    }
    ThrowAnimationComp.initialX[eid] =
      components.throwAnimation.initialPosition.x;
    ThrowAnimationComp.initialY[eid] =
      components.throwAnimation.initialPosition.y;
    ThrowAnimationComp.finalX[eid] = components.throwAnimation.finalPosition.x;
    ThrowAnimationComp.finalY[eid] = components.throwAnimation.finalPosition.y;
    ThrowAnimationComp.elapsedTime[eid] = components.throwAnimation.elapsedTime;
    ThrowAnimationComp.isActive[eid] = components.throwAnimation.isActive
      ? 1
      : 0;
  }

  if (components.foodEating) {
    if (!hasComponent(world, FoodEatingComp, eid)) {
      addComponent(world, FoodEatingComp, eid);
    }
    FoodEatingComp.targetFood[eid] = components.foodEating.targetFood;
    FoodEatingComp.targetFoodObjectId[eid] =
      components.foodEating.targetFoodObjectId ?? 0;
    FoodEatingComp.progress[eid] = components.foodEating.progress;
    FoodEatingComp.duration[eid] = components.foodEating.duration;
    FoodEatingComp.elapsedTime[eid] = components.foodEating.elapsedTime;
    FoodEatingComp.isActive[eid] = components.foodEating.isActive ? 1 : 0;
  }

  if (components.foodMask) {
    if (!hasComponent(world, FoodMaskComp, eid)) {
      addComponent(world, FoodMaskComp, eid);
    }
    FoodMaskComp.maskStoreIndex[eid] = components.foodMask.maskStoreIndex;
    FoodMaskComp.progress[eid] = components.foodMask.progress;
    FoodMaskComp.isInitialized[eid] = components.foodMask.isInitialized ? 1 : 0;
  }

  if (components.eggHatch) {
    if (!hasComponent(world, EggHatchComp, eid)) {
      addComponent(world, EggHatchComp, eid);
    }
    const resolvedEggHatch = resolveEggHatchComponentForState({
      currentTime,
      state: ObjectComp.state[eid],
      hatchTime: components.eggHatch.hatchTime,
      hatchDurationMs: components.eggHatch.hatchDurationMs,
    });
    EggHatchComp.hatchTime[eid] = resolvedEggHatch.hatchTime;
    EggHatchComp.hatchDurationMs[eid] = resolvedEggHatch.hatchDurationMs;
    EggHatchComp.isReadyToHatch[eid] = components.eggHatch.isReadyToHatch
      ? 1
      : 0;
    EggHatchComp.syringeCount[eid] = normalizeEggSyringeCount(
      components.eggHatch.syringeCount,
    );
    EggHatchComp.pendingCharacterKey[eid] =
      ObjectComp.state[eid] === CharacterState.EGG
        ? normalizePendingEggHatchCharacterKey(
            components.eggHatch.pendingCharacterKey,
          )
        : CharacterKey.NULL;
  }

  if (components.mutationRisk) {
    if (!hasComponent(world, MutationRiskComp, eid)) {
      addComponent(world, MutationRiskComp, eid);
    }
    MutationRiskComp.unnecessaryInjectionStacks[eid] = Math.min(
      10,
      Math.max(
        0,
        Math.floor(components.mutationRisk.unnecessaryInjectionStacks ?? 0),
      ),
    );
    MutationRiskComp.dirtyExposureStacks[eid] = Math.min(
      65_535,
      Math.max(0, Math.floor(components.mutationRisk.dirtyExposureStacks ?? 0)),
    );
    MutationRiskComp.lastInjectionDetoxTime[eid] =
      components.mutationRisk.lastInjectionDetoxTime ?? 0;
    MutationRiskComp.lastDirtyDetoxTime[eid] =
      components.mutationRisk.lastDirtyDetoxTime ?? 0;
  }

  if (components.digestiveSystem) {
    if (!hasComponent(world, DigestiveSystemComp, eid)) {
      addComponent(world, DigestiveSystemComp, eid);
    }
    DigestiveSystemComp.capacity[eid] = components.digestiveSystem.capacity;
    DigestiveSystemComp.currentLoad[eid] =
      components.digestiveSystem.currentLoad;
    DigestiveSystemComp.nextPoopTime[eid] =
      components.digestiveSystem.nextPoopTime;
    DigestiveSystemComp.nextSmallPoopTime[eid] =
      components.digestiveSystem.nextSmallPoopTime ?? 0;
  }

  if (components.diseaseSystem) {
    if (!hasComponent(world, DiseaseSystemComp, eid)) {
      addComponent(world, DiseaseSystemComp, eid);
    }
    DiseaseSystemComp.nextCheckTime[eid] =
      components.diseaseSystem.nextCheckTime;
    DiseaseSystemComp.sickStartTime[eid] =
      components.diseaseSystem.sickStartTime;
  }

  if (components.sleepSystem) {
    if (!hasComponent(world, SleepSystemComp, eid)) {
      addComponent(world, SleepSystemComp, eid);
    }
    SleepSystemComp.fatigue[eid] = components.sleepSystem.fatigue;
    SleepSystemComp.nextSleepTime[eid] = components.sleepSystem.nextSleepTime;
    SleepSystemComp.nextWakeTime[eid] = components.sleepSystem.nextWakeTime;
    SleepSystemComp.nextNapCheckTime[eid] =
      components.sleepSystem.nextNapCheckTime;
    SleepSystemComp.nextNightWakeCheckTime[eid] =
      components.sleepSystem.nextNightWakeCheckTime;
    SleepSystemComp.sleepMode[eid] = components.sleepSystem.sleepMode;
    SleepSystemComp.interruptedSleepMode[eid] =
      components.sleepSystem.interruptedSleepMode ?? SleepMode.AWAKE;
    SleepSystemComp.pendingSleepReason[eid] =
      components.sleepSystem.pendingSleepReason;
    SleepSystemComp.pendingWakeReason[eid] =
      components.sleepSystem.pendingWakeReason;
    SleepSystemComp.sleepSessionStartedAt[eid] =
      components.sleepSystem.sleepSessionStartedAt;
  }

  if (components.vitality) {
    if (!hasComponent(world, VitalityComp, eid)) {
      addComponent(world, VitalityComp, eid);
    }
    VitalityComp.urgentStartTime[eid] = components.vitality.urgentStartTime;
    VitalityComp.deathTime[eid] = components.vitality.deathTime;
    VitalityComp.isDead[eid] = components.vitality.isDead ? 1 : 0;
  }

  if (components.temporaryStatus) {
    if (!hasComponent(world, TemporaryStatusComp, eid)) {
      addComponent(world, TemporaryStatusComp, eid);
    }
    TemporaryStatusComp.statusType[eid] = components.temporaryStatus.statusType;
    TemporaryStatusComp.startTime[eid] = components.temporaryStatus.startTime;
    TemporaryStatusComp.lastHappyStatusTime[eid] =
      components.temporaryStatus.lastHappyStatusTime ?? 0;
  }

  if (components.freshnessTimer) {
    if (!hasComponent(world, FreshnessTimerComp, eid)) {
      addComponent(world, FreshnessTimerComp, eid);
    }
    FreshnessTimerComp.createdTime[eid] = components.freshnessTimer.createdTime;
    FreshnessTimerComp.normalTime[eid] = components.freshnessTimer.normalTime;
    FreshnessTimerComp.staleTime[eid] = components.freshnessTimer.staleTime;
    FreshnessTimerComp.isBeingEaten[eid] = components.freshnessTimer
      .isBeingEaten
      ? 1
      : 0;
  }

  if (components.dirtyExposure) {
    if (!hasComponent(world, DirtyExposureComp, eid)) {
      addComponent(world, DirtyExposureComp, eid);
    }
    DirtyExposureComp.stackCount[eid] = Math.min(
      10,
      Math.max(0, Math.floor(components.dirtyExposure.stackCount ?? 0)),
    );
    DirtyExposureComp.accumulatedExposureMs[eid] = Math.max(
      0,
      components.dirtyExposure.accumulatedExposureMs ?? 0,
    );
    DirtyExposureComp.lastUpdatedTime[eid] =
      components.dirtyExposure.lastUpdatedTime ?? 0;
  }
}

function ensureRandomMovementDefaults(eid: number, now: number): void {
  const hasInvalidRange =
    RandomMovementComp.minIdleTime[eid] <= 0 ||
    RandomMovementComp.maxIdleTime[eid] < RandomMovementComp.minIdleTime[eid] ||
    RandomMovementComp.minMoveTime[eid] <= 0 ||
    RandomMovementComp.maxMoveTime[eid] < RandomMovementComp.minMoveTime[eid];

  if (hasInvalidRange) {
    RandomMovementComp.minIdleTime[eid] = 2000;
    RandomMovementComp.maxIdleTime[eid] = 8000;
    RandomMovementComp.minMoveTime[eid] = 1000;
    RandomMovementComp.maxMoveTime[eid] = 8000;
  }

  const nextChange = RandomMovementComp.nextChange[eid];
  if (!nextChange || nextChange <= 0) {
    RandomMovementComp.nextChange[eid] = now + 1000 + Math.random() * 2000;
  }
}

export function restoreCharacterFreeRoamingState(
  world: IWorld,
  eid: number,
  options: {
    now?: number;
    idleDelayMs?: number;
  } = {},
): boolean {
  if (!clearCharacterDestinationAndStop(world, eid)) {
    return false;
  }

  const now = options.now ?? Date.now();
  const idleDelayMs = options.idleDelayMs ?? 1000;

  ObjectComp.state[eid] = CharacterState.IDLE;

  if (!hasComponent(world, RandomMovementComp, eid)) {
    addComponent(world, RandomMovementComp, eid);
  }

  RandomMovementComp.minIdleTime[eid] = 1000;
  RandomMovementComp.maxIdleTime[eid] = 3000;
  RandomMovementComp.minMoveTime[eid] = 2000;
  RandomMovementComp.maxMoveTime[eid] = 4000;
  RandomMovementComp.nextChange[eid] = now + idleDelayMs + Math.random() * 1000;

  return true;
}

export function clearCharacterDestinationAndStop(
  world: IWorld,
  eid: number,
): boolean {
  if (
    !hasComponent(world, ObjectComp, eid) ||
    ObjectComp.type[eid] !== ObjectType.CHARACTER
  ) {
    return false;
  }

  if (hasComponent(world, DestinationComp, eid)) {
    const targetFoodEid = getTargetedFoodEntityRef(world, eid);

    if (
      targetFoodEid !== null &&
      ObjectComp.state[targetFoodEid] === FoodState.TARGETED
    ) {
      ObjectComp.state[targetFoodEid] = FoodState.LANDED;
    }

    removeComponent(world, DestinationComp, eid);
  }

  if (!hasComponent(world, SpeedComp, eid)) {
    addComponent(world, SpeedComp, eid);
  }
  SpeedComp.value[eid] = 0;

  return true;
}

export function repairCharacterEntityRuntimeComponents(
  world: IWorld,
  eid: number,
  now = Date.now(),
): string[] {
  if (
    !hasComponent(world, ObjectComp, eid) ||
    ObjectComp.type[eid] !== ObjectType.CHARACTER
  ) {
    return [];
  }

  const repaired: string[] = [];
  const state = ObjectComp.state[eid] as CharacterState;
  const needsAnimation =
    state !== CharacterState.EGG && state !== CharacterState.DEAD;
  const needsRandomMovement =
    state === CharacterState.IDLE || state === CharacterState.MOVING;

  if (
    hasComponent(world, RenderComp, eid) &&
    shouldClearStaticEggTextureForState(state, RenderComp.textureKey[eid])
  ) {
    RenderComp.textureKey[eid] = TextureKey.NULL;
    RenderComp.storeIndex[eid] = ECS_NULL_VALUE;
    repaired.push("RenderComp.textureKey");
  }

  if (!hasComponent(world, SpeedComp, eid)) {
    addComponent(world, SpeedComp, eid);
    SpeedComp.value[eid] = 0;
    repaired.push("SpeedComp");
  }

  if (!hasComponent(world, DestinationComp, eid)) {
    addComponent(world, DestinationComp, eid);
    DestinationComp.type[eid] = ECS_NULL_VALUE;
    DestinationComp.target[eid] = ECS_NULL_VALUE;
    DestinationComp.x[eid] = ECS_NULL_VALUE;
    DestinationComp.y[eid] = ECS_NULL_VALUE;
    repaired.push("DestinationComp");
  }

  if (!hasComponent(world, StatusIconRenderComp, eid)) {
    addComponent(world, StatusIconRenderComp, eid);
    StatusIconRenderComp.storeIndexes[eid] = new Uint8Array(
      ECS_CHARACTER_STATUS_LENGTH,
    ).fill(ECS_NULL_VALUE);
    StatusIconRenderComp.visibleCount[eid] = 0;
    repaired.push("StatusIconRenderComp");
  }

  if (!hasComponent(world, DigestiveSystemComp, eid)) {
    addComponent(world, DigestiveSystemComp, eid);
    DigestiveSystemComp.capacity[eid] = GAME_CONSTANTS.DIGESTIVE_CAPACITY;
    DigestiveSystemComp.currentLoad[eid] = 0;
    DigestiveSystemComp.nextPoopTime[eid] = 0;
    DigestiveSystemComp.nextSmallPoopTime[eid] = 0;
    repaired.push("DigestiveSystemComp");
  }

  if (!hasComponent(world, DiseaseSystemComp, eid)) {
    addComponent(world, DiseaseSystemComp, eid);
    DiseaseSystemComp.nextCheckTime[eid] =
      now + GAME_CONSTANTS.DISEASE_CHECK_INTERVAL;
    DiseaseSystemComp.sickStartTime[eid] = 0;
    repaired.push("DiseaseSystemComp");
  }

  if (!hasComponent(world, SleepSystemComp, eid)) {
    addComponent(world, SleepSystemComp, eid);
    SleepSystemComp.fatigue[eid] = GAME_CONSTANTS.FATIGUE_DEFAULT;
    SleepSystemComp.nextSleepTime[eid] = 0;
    SleepSystemComp.nextWakeTime[eid] = 0;
    SleepSystemComp.nextNapCheckTime[eid] =
      now + GAME_CONSTANTS.DAY_NAP_CHECK_INTERVAL;
    SleepSystemComp.nextNightWakeCheckTime[eid] = 0;
    SleepSystemComp.sleepMode[eid] =
      state === CharacterState.SLEEPING
        ? SleepMode.NIGHT_SLEEP
        : SleepMode.AWAKE;
    SleepSystemComp.pendingSleepReason[eid] = SleepReason.NONE;
    SleepSystemComp.pendingWakeReason[eid] = SleepReason.NONE;
    SleepSystemComp.sleepSessionStartedAt[eid] =
      state === CharacterState.SLEEPING ? now : 0;
    repaired.push("SleepSystemComp");
  }

  if (!hasComponent(world, VitalityComp, eid)) {
    addComponent(world, VitalityComp, eid);
    VitalityComp.urgentStartTime[eid] = 0;
    VitalityComp.deathTime[eid] = 0;
    VitalityComp.isDead[eid] = state === CharacterState.DEAD ? 1 : 0;
    repaired.push("VitalityComp");
  }

  if (!hasComponent(world, TemporaryStatusComp, eid)) {
    addComponent(world, TemporaryStatusComp, eid);
    TemporaryStatusComp.statusType[eid] = ECS_NULL_VALUE;
    TemporaryStatusComp.startTime[eid] = 0;
    TemporaryStatusComp.lastHappyStatusTime[eid] = 0;
    repaired.push("TemporaryStatusComp");
  }

  if (!hasComponent(world, EggHatchComp, eid)) {
    addComponent(world, EggHatchComp, eid);
    if (state === CharacterState.EGG) {
      const { hatchTime, hatchDurationMs } = createEggHatchSchedule(now);
      EggHatchComp.hatchTime[eid] = hatchTime;
      EggHatchComp.hatchDurationMs[eid] = hatchDurationMs;
    } else {
      EggHatchComp.hatchTime[eid] = 0;
      EggHatchComp.hatchDurationMs[eid] = 0;
    }
    EggHatchComp.isReadyToHatch[eid] = 0;
    EggHatchComp.syringeCount[eid] = 0;
    EggHatchComp.pendingCharacterKey[eid] = CharacterKey.NULL;
    repaired.push("EggHatchComp");
  } else if (state === CharacterState.EGG) {
    const resolvedEggHatch = resolveEggHatchComponentForState({
      currentTime: now,
      state,
      hatchTime: EggHatchComp.hatchTime[eid],
      hatchDurationMs: EggHatchComp.hatchDurationMs[eid],
    });
    EggHatchComp.hatchTime[eid] = resolvedEggHatch.hatchTime;
    EggHatchComp.hatchDurationMs[eid] = resolvedEggHatch.hatchDurationMs;
    EggHatchComp.syringeCount[eid] = normalizeEggSyringeCount(
      EggHatchComp.syringeCount[eid],
    );
    EggHatchComp.pendingCharacterKey[eid] = normalizePendingEggHatchCharacterKey(
      EggHatchComp.pendingCharacterKey[eid],
    );
  } else {
    EggHatchComp.pendingCharacterKey[eid] = CharacterKey.NULL;
  }

  if (!hasComponent(world, MutationRiskComp, eid)) {
    addComponent(world, MutationRiskComp, eid);
    MutationRiskComp.unnecessaryInjectionStacks[eid] = 0;
    MutationRiskComp.dirtyExposureStacks[eid] = 0;
    MutationRiskComp.lastInjectionDetoxTime[eid] = now;
    MutationRiskComp.lastDirtyDetoxTime[eid] = now;
    repaired.push("MutationRiskComp");
  }

  if (
    needsAnimation &&
    hasComponent(world, CharacterStatusComp, eid) &&
    !hasComponent(world, AnimationRenderComp, eid)
  ) {
    addComponent(world, AnimationRenderComp, eid);
    AnimationRenderComp.storeIndex[eid] = ECS_NULL_VALUE;
    AnimationRenderComp.spritesheetKey[eid] =
      CharacterStatusComp.characterKey[eid] || SpritesheetKey.GreenSlimeA1;
    AnimationRenderComp.animationKey[eid] = AnimationKey.IDLE;
    AnimationRenderComp.isPlaying[eid] = 1;
    AnimationRenderComp.loop[eid] = 1;
    AnimationRenderComp.speed[eid] = 0.04;
    repaired.push("AnimationRenderComp");
  }

  if (needsRandomMovement) {
    if (!hasComponent(world, RandomMovementComp, eid)) {
      addComponent(world, RandomMovementComp, eid);
      repaired.push("RandomMovementComp");
    }

    ensureRandomMovementDefaults(eid, now);
  }

  return repaired;
}

export function repairLoadedFoodInteractionState(
  world: IWorld,
  now = Date.now(),
): {
  repairedCharacters: number[];
  repairedFoods: number[];
} {
  const objectEntities = defineQuery([ObjectComp])(world);
  const targetedFoodIds = new Set<number>();
  const eatingFoodIds = new Set<number>();

  for (let i = 0; i < objectEntities.length; i++) {
    const eid = objectEntities[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
      continue;
    }

    const targetedFoodEid = resolveTargetedFoodForLoadedCharacter(
      world,
      objectEntities,
      eid,
      targetedFoodIds,
    );
    if (targetedFoodEid !== null) {
      DestinationComp.target[eid] = targetedFoodEid;
      DestinationComp.targetObjectId[eid] = ObjectComp.id[targetedFoodEid];
      targetedFoodIds.add(targetedFoodEid);
    }

    if (
      hasComponent(world, FoodEatingComp, eid) &&
      FoodEatingComp.isActive[eid] === 1
    ) {
      const eatingFoodEid = resolveEatingFoodForLoadedCharacter(
        world,
        objectEntities,
        eid,
        eatingFoodIds,
      );
      if (eatingFoodEid !== null) {
        FoodEatingComp.targetFood[eid] = eatingFoodEid;
        FoodEatingComp.targetFoodObjectId[eid] = ObjectComp.id[eatingFoodEid];
        eatingFoodIds.add(eatingFoodEid);
      }
    }
  }

  const repairedCharacters: number[] = [];
  const repairedFoods: number[] = [];

  for (let i = 0; i < objectEntities.length; i++) {
    const eid = objectEntities[i];
    const objectType = ObjectComp.type[eid];

    if (objectType === ObjectType.CHARACTER) {
      if (
        ObjectComp.state[eid] === CharacterState.EATING &&
        hasComponent(world, FoodEatingComp, eid) &&
        getFoodEatingEntityRef(world, eid) === null
      ) {
        removeComponent(world, FoodEatingComp, eid);
      }

      if (
        ObjectComp.state[eid] === CharacterState.EATING &&
        !hasComponent(world, FoodEatingComp, eid)
      ) {
        const fallbackFoodEid = objectEntities.find((candidateEid) => {
          return (
            ObjectComp.type[candidateEid] === ObjectType.FOOD &&
            ObjectComp.state[candidateEid] === FoodState.BEING_INTAKEN &&
            !eatingFoodIds.has(candidateEid)
          );
        });

        if (fallbackFoodEid !== undefined) {
          const progress = hasComponent(world, FoodMaskComp, fallbackFoodEid)
            ? FoodMaskComp.progress[fallbackFoodEid]
            : 0;
          const duration = 3200;

          addComponent(world, FoodEatingComp, eid);
          FoodEatingComp.targetFood[eid] = fallbackFoodEid;
          FoodEatingComp.targetFoodObjectId[eid] =
            ObjectComp.id[fallbackFoodEid];
          FoodEatingComp.progress[eid] = Math.min(1, Math.max(0, progress));
          FoodEatingComp.duration[eid] = duration;
          FoodEatingComp.elapsedTime[eid] =
            FoodEatingComp.progress[eid] * duration;
          FoodEatingComp.isActive[eid] = 1;

          if (!hasComponent(world, FoodMaskComp, fallbackFoodEid)) {
            addComponent(world, FoodMaskComp, fallbackFoodEid);
            FoodMaskComp.maskStoreIndex[fallbackFoodEid] = ECS_NULL_VALUE;
            FoodMaskComp.progress[fallbackFoodEid] =
              FoodEatingComp.progress[eid];
            FoodMaskComp.isInitialized[fallbackFoodEid] = 0;
          }

          if (hasComponent(world, FreshnessTimerComp, fallbackFoodEid)) {
            FreshnessTimerComp.isBeingEaten[fallbackFoodEid] = 1;
          }

          eatingFoodIds.add(fallbackFoodEid);
          repairedCharacters.push(eid);
          continue;
        }
      }

      const hasOrphanedEatingState =
        ObjectComp.state[eid] === CharacterState.EATING &&
        !hasComponent(world, FoodEatingComp, eid);

      if (!hasOrphanedEatingState) {
        continue;
      }

      if (hasComponent(world, DestinationComp, eid)) {
        removeComponent(world, DestinationComp, eid);
      }

      ObjectComp.state[eid] = CharacterState.IDLE;

      if (!hasComponent(world, SpeedComp, eid)) {
        addComponent(world, SpeedComp, eid);
      }
      SpeedComp.value[eid] = 0;

      if (!hasComponent(world, RandomMovementComp, eid)) {
        addComponent(world, RandomMovementComp, eid);
      }
      ensureRandomMovementDefaults(eid, now);

      repairedCharacters.push(eid);
      continue;
    }

    if (objectType !== ObjectType.FOOD) {
      continue;
    }

    const isOrphanedTargetedFood =
      ObjectComp.state[eid] === FoodState.TARGETED && !targetedFoodIds.has(eid);
    const isOrphanedEatingFood =
      ObjectComp.state[eid] === FoodState.BEING_INTAKEN &&
      !eatingFoodIds.has(eid);

    if (!isOrphanedTargetedFood && !isOrphanedEatingFood) {
      continue;
    }

    ObjectComp.state[eid] = FoodState.LANDED;

    if (hasComponent(world, FreshnessTimerComp, eid)) {
      FreshnessTimerComp.isBeingEaten[eid] = 0;
    }

    repairedFoods.push(eid);
  }

  return {
    repairedCharacters,
    repairedFoods,
  };
}
