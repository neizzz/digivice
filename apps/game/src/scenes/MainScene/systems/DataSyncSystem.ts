// ECS 데이터를 MainSceneWorld에 주기적으로 동기화하는 시스템
import { defineQuery, enterQuery, exitQuery, Query } from "bitecs";
import { ObjectComp } from "../raw-components";
import { MainSceneWorld, SavedEntity, MainSceneWorldData } from "../world";
import { convertECSEntityToSavedEntity } from "../entityDataHelpers";
import { cloneDeep } from "../../../utils/common";

const THIS_CONFIG = {
  saveInterval: 500,
} as const;

// TODO: dirty flag를 사용하여 성능 개선
// ECS 쿼리: ObjectComp을 가진 모든 엔티티
const allEntitiesQuery = defineQuery([ObjectComp]);
const enteredEntitiesQuery = enterQuery(allEntitiesQuery);
const exitedEntitiesQuery = exitQuery(allEntitiesQuery);

function addEntityData(
  worldData: MainSceneWorldData,
  savedEntity: SavedEntity
): void {
  const entityId = savedEntity.components.objectComponent?.id;
  if (!entityId) {
    console.warn(
      "[DataSyncSystem] SavedEntity에 ObjectComponent ID가 없습니다."
    );
    return;
  }

  const existingIndex = worldData.entities.findIndex(
    (entity: SavedEntity) => entity.components.objectComponent?.id === entityId
  );

  if (existingIndex !== -1) {
    // 기존 엔티티 업데이트
    worldData.entities[existingIndex] = savedEntity;
  } else {
    // 새 엔티티 추가
    worldData.entities.push(savedEntity);
  }

  worldData.world_metadata.last_saved = Date.now();
}

function removeEntityData(
  worldData: MainSceneWorldData,
  entityId: number
): boolean {
  const index = worldData.entities.findIndex(
    (entity: SavedEntity) => entity.components.objectComponent?.id === entityId
  );

  if (index !== -1) {
    worldData.entities.splice(index, 1);
    worldData.world_metadata.last_saved = Date.now();
    return true;
  }

  return false;
}

/**
 * 간단한 데이터 동기화 시스템
 * enterQuery와 exitQuery를 사용하여 변화된 엔티티만 동기화
 */
export function dataSyncSystem(mainSceneWorld: MainSceneWorld): MainSceneWorld {
  const worldData = mainSceneWorld.getWorldData();

  if (
    Date.now() - worldData.world_metadata.last_saved <
    THIS_CONFIG.saveInterval
  ) {
    // 마지막 저장 이후 saveInterval이 지나지 않았다면 동기화하지 않음
    return mainSceneWorld;
  }

  const newWorldData = cloneDeep(worldData);

  newWorldData.world_metadata.last_saved = Date.now();

  // 새로 추가된 엔티티들을 MainSceneWorld에 동기화
  const enteredEntities = enteredEntitiesQuery(mainSceneWorld);
  for (const eid of enteredEntities) {
    const savedEntity = convertECSEntityToSavedEntity(mainSceneWorld, eid);
    addEntityData(newWorldData, savedEntity);
  }

  // 제거된 엔티티들을 MainSceneWorld에서 삭제
  const exitedEntities = exitedEntitiesQuery(mainSceneWorld);
  for (const eid of exitedEntities) {
    // ECS 엔티티 ID가 아닌 ObjectComponent의 ID를 사용해야 함
    const objectId = ObjectComp.id[eid];
    removeEntityData(newWorldData, objectId);
  }

  mainSceneWorld.setWorldData(newWorldData);

  return mainSceneWorld;
}

/**
 * 모든 엔티티를 강제로 동기화 (초기화용)
 */
export function forceFullDataSync(
  mainSceneWorld: MainSceneWorld,
  worldData: MainSceneWorldData,
  query: Query = allEntitiesQuery
): MainSceneWorldData {
  const entities = query(mainSceneWorld);

  for (const eid of entities) {
    const savedEntity = convertECSEntityToSavedEntity(mainSceneWorld, eid);
    addEntityData(worldData, savedEntity);
  }

  return worldData;
}
