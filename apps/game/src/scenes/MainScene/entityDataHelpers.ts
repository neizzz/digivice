// ECS 엔티티와 SavedEntity 간의 변환 헬퍼 함수들
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
} from "./raw-components";
import type { SavedEntity, EntityComponents } from "./world";
import { CharacterKey, CharacterStatus } from "./types";

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
}

export function findSavedEntityById(
  entities: SavedEntity[],
  id: number
): SavedEntity | undefined {
  return entities.find((entity) => entity.components.object?.id === id);
}

export function filterSavedEntitiesByType(
  entities: SavedEntity[],
  type: number
): SavedEntity[] {
  return entities.filter((entity) => entity.components.object?.type === type);
}
