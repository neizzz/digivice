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

  // ObjectComponent (필수)
  if (hasComponent(world, ObjectComp, eid)) {
    components.objectComponent = {
      id: ObjectComp.id[eid],
      type: ObjectComp.type[eid],
      state: ObjectComp.state[eid],
    };
  }

  // PositionComponent
  if (hasComponent(world, PositionComp, eid)) {
    components.positionComponent = {
      x: PositionComp.x[eid],
      y: PositionComp.y[eid],
    };
  }

  // AngleComponent
  if (hasComponent(world, AngleComp, eid)) {
    components.angleComponent = {
      value: AngleComp.value[eid],
    };
  }

  // RenderComponent
  if (hasComponent(world, RenderComp, eid)) {
    components.renderComponent = {
      spriteRefIndex: RenderComp.spriteRefIndex[eid],
      textureKey: RenderComp.textureKey[eid],
      zIndex: RenderComp.zIndex[eid],
    };
  }

  // SpeedComponent
  if (hasComponent(world, SpeedComp, eid)) {
    components.speedComponent = {
      value: SpeedComp.value[eid],
    };
  }

  // FreshnessComponent
  if (hasComponent(world, FreshnessComp, eid)) {
    components.freshnessComponent = {
      freshness: FreshnessComp.freshness[eid],
    };
  }

  // DestinationComponent
  if (hasComponent(world, DestinationComp, eid)) {
    components.destinationComponent = {
      type: DestinationComp.type[eid],
      destX: DestinationComp.destX[eid],
      destY: DestinationComp.destY[eid],
    };
  }

  // RandomMovementComponent
  if (hasComponent(world, RandomMovementComp, eid)) {
    components.randomMovementComponent = {
      minIdleTime: RandomMovementComp.minIdleTime[eid],
      maxIdleTime: RandomMovementComp.maxIdleTime[eid],
      minMoveTime: RandomMovementComp.minMoveTime[eid],
      maxMoveTime: RandomMovementComp.maxMoveTime[eid],
      nextChange: RandomMovementComp.nextChange[eid],
    };
  }

  return { components };
}

/**
 * SavedEntity를 ECS 엔티티에 적용
 */
export function applySavedEntityToECS(
  world: IWorld,
  eid: number,
  savedEntity: SavedEntity
): void {
  const { components } = savedEntity;

  // ObjectComponent - 컴포넌트가 없으면 추가
  if (components.objectComponent) {
    if (!hasComponent(world, ObjectComp, eid)) {
      addComponent(world, ObjectComp, eid);
    }
    ObjectComp.id[eid] = components.objectComponent.id;
    ObjectComp.type[eid] = components.objectComponent.type;
    ObjectComp.state[eid] = components.objectComponent.state;
  }

  // PositionComponent
  if (components.positionComponent) {
    if (!hasComponent(world, PositionComp, eid)) {
      addComponent(world, PositionComp, eid);
    }
    PositionComp.x[eid] = components.positionComponent.x;
    PositionComp.y[eid] = components.positionComponent.y;
  }

  // AngleComponent
  if (components.angleComponent) {
    if (!hasComponent(world, AngleComp, eid)) {
      addComponent(world, AngleComp, eid);
    }
    AngleComp.value[eid] = components.angleComponent.value;
  }

  // RenderComponent
  if (components.renderComponent) {
    if (!hasComponent(world, RenderComp, eid)) {
      addComponent(world, RenderComp, eid);
    }
    RenderComp.spriteRefIndex[eid] = components.renderComponent.spriteRefIndex;
    RenderComp.textureKey[eid] = components.renderComponent.textureKey;
    RenderComp.zIndex[eid] = components.renderComponent.zIndex;
  }

  // SpeedComponent
  if (components.speedComponent) {
    if (!hasComponent(world, SpeedComp, eid)) {
      addComponent(world, SpeedComp, eid);
    }
    SpeedComp.value[eid] = components.speedComponent.value;
  }

  // FreshnessComponent
  if (components.freshnessComponent) {
    if (!hasComponent(world, FreshnessComp, eid)) {
      addComponent(world, FreshnessComp, eid);
    }
    FreshnessComp.freshness[eid] = components.freshnessComponent.freshness;
  }

  // DestinationComponent
  if (components.destinationComponent) {
    if (!hasComponent(world, DestinationComp, eid)) {
      addComponent(world, DestinationComp, eid);
    }
    DestinationComp.type[eid] = components.destinationComponent.type;
    DestinationComp.destX[eid] = components.destinationComponent.destX;
    DestinationComp.destY[eid] = components.destinationComponent.destY;
  }

  // RandomMovementComponent
  if (components.randomMovementComponent) {
    if (!hasComponent(world, RandomMovementComp, eid)) {
      addComponent(world, RandomMovementComp, eid);
    }
    RandomMovementComp.minIdleTime[eid] =
      components.randomMovementComponent.minIdleTime;
    RandomMovementComp.maxIdleTime[eid] =
      components.randomMovementComponent.maxIdleTime;
    RandomMovementComp.minMoveTime[eid] =
      components.randomMovementComponent.minMoveTime;
    RandomMovementComp.maxMoveTime[eid] =
      components.randomMovementComponent.maxMoveTime;
    RandomMovementComp.nextChange[eid] =
      components.randomMovementComponent.nextChange;
  }
}

/**
 * ID로 SavedEntity 찾기
 */
export function findSavedEntityById(
  entities: SavedEntity[],
  id: number
): SavedEntity | undefined {
  return entities.find(
    (entity) => entity.components.objectComponent?.id === id
  );
}

/**
 * 타입별 SavedEntity 필터링
 */
export function filterSavedEntitiesByType(
  entities: SavedEntity[],
  type: number
): SavedEntity[] {
  return entities.filter(
    (entity) => entity.components.objectComponent?.type === type
  );
}
