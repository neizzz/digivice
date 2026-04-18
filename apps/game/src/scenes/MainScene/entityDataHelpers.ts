import { hasComponent, IWorld, addComponent } from "bitecs";
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
  FreshnessTimerComp,
} from "./raw-components";
import type { SavedEntity, EntityComponents } from "./world";
import {
  AnimationKey,
  CharacterKeyECS as CharacterKey,
  CharacterState,
  CharacterStatus,
  ObjectType,
  SleepMode,
  SleepReason,
  SpritesheetKey,
} from "./types";
import { GAME_CONSTANTS } from "./config";

/**
 * ECS 엔티티를 SavedEntity로 변환
 */
export function convertECSEntityToSavedEntity(
  world: IWorld,
  eid: number
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
        CharacterStatusComp.statuses[eid]
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
      freshness: FreshnessComp.freshness[eid],
    };
  }
  if (hasComponent(world, DestinationComp, eid)) {
    components.destination = {
      type: DestinationComp.type[eid],
      target: DestinationComp.target[eid],
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
      storeIndex: RenderComp.storeIndex[eid],
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
  if (hasComponent(world, EggHatchComp, eid)) {
    components.eggHatch = {
      hatchTime: EggHatchComp.hatchTime[eid],
      isReadyToHatch: EggHatchComp.isReadyToHatch[eid] === 1,
    };
  }
  if (hasComponent(world, DigestiveSystemComp, eid)) {
    components.digestiveSystem = {
      capacity: DigestiveSystemComp.capacity[eid],
      currentLoad: DigestiveSystemComp.currentLoad[eid],
      nextPoopTime: DigestiveSystemComp.nextPoopTime[eid],
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
      pendingSleepReason:
        SleepSystemComp.pendingSleepReason[eid] as SleepReason,
      pendingWakeReason:
        SleepSystemComp.pendingWakeReason[eid] as SleepReason,
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

  return { components };
}

export function applySavedEntityToECS(
  world: IWorld,
  eid: number,
  savedEntity: SavedEntity
): void {
  const { components } = savedEntity;

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
      components.characterStatus.statuses
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
    RenderComp.storeIndex[eid] = components.render.storeIndex;
    RenderComp.textureKey[eid] = components.render.textureKey;
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
      components.statusIconRender.storeIndexes
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
    FreshnessComp.freshness[eid] = components.freshness.freshness;
  }

  if (components.destination) {
    if (!hasComponent(world, DestinationComp, eid)) {
      addComponent(world, DestinationComp, eid);
    }
    DestinationComp.type[eid] = components.destination.type;
    DestinationComp.target[eid] = components.destination.target;
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
      const diffFromNow = components.randomMovement.nextChange - Date.now();
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

  if (components.eggHatch) {
    if (!hasComponent(world, EggHatchComp, eid)) {
      addComponent(world, EggHatchComp, eid);
    }
    EggHatchComp.hatchTime[eid] = components.eggHatch.hatchTime;
    EggHatchComp.isReadyToHatch[eid] = components.eggHatch.isReadyToHatch
      ? 1
      : 0;
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

export function repairCharacterEntityRuntimeComponents(
  world: IWorld,
  eid: number,
  now = Date.now()
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
      ECS_CHARACTER_STATUS_LENGTH
    ).fill(ECS_NULL_VALUE);
    StatusIconRenderComp.visibleCount[eid] = 0;
    repaired.push("StatusIconRenderComp");
  }

  if (!hasComponent(world, DigestiveSystemComp, eid)) {
    addComponent(world, DigestiveSystemComp, eid);
    DigestiveSystemComp.capacity[eid] = GAME_CONSTANTS.DIGESTIVE_CAPACITY;
    DigestiveSystemComp.currentLoad[eid] = 0;
    DigestiveSystemComp.nextPoopTime[eid] = 0;
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
    repaired.push("TemporaryStatusComp");
  }

  if (!hasComponent(world, EggHatchComp, eid)) {
    addComponent(world, EggHatchComp, eid);
    EggHatchComp.hatchTime[eid] =
      state === CharacterState.EGG ? now + GAME_CONSTANTS.EGG_HATCH_TIME : 0;
    EggHatchComp.isReadyToHatch[eid] = 0;
    repaired.push("EggHatchComp");
  }

  if (
    needsAnimation &&
    hasComponent(world, CharacterStatusComp, eid) &&
    !hasComponent(world, AnimationRenderComp, eid)
  ) {
    addComponent(world, AnimationRenderComp, eid);
    AnimationRenderComp.storeIndex[eid] = ECS_NULL_VALUE;
    AnimationRenderComp.spritesheetKey[eid] =
      CharacterStatusComp.characterKey[eid] || SpritesheetKey.TestGreenSlimeA1;
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
