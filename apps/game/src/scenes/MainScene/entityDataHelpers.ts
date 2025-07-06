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
} from "./raw-components";
import type { SavedEntity, EntityComponents } from "./world";

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

  if (hasComponent(world, RenderComp, eid)) {
    components.render = {
      spriteRefIndex: RenderComp.spriteRefIndex[eid],
      textureKey: RenderComp.textureKey[eid],
      zIndex: RenderComp.zIndex[eid],
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
    RenderComp.spriteRefIndex[eid] = components.render.spriteRefIndex;
    RenderComp.textureKey[eid] = components.render.textureKey;
    RenderComp.zIndex[eid] = components.render.zIndex;
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
    RandomMovementComp.nextChange[eid] = components.randomMovement.nextChange;
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
