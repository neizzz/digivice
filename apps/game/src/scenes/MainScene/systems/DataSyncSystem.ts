// ECS 데이터를 MainSceneWorld에 주기적으로 동기화하는 시스템
import { defineQuery, enterQuery, exitQuery, Query } from "bitecs";
import { ObjectComp } from "../raw-components";
import { MainSceneWorld, SavedEntity, MainSceneWorldData } from "../world";
import { convertECSEntityToSavedEntity } from "../entityDataHelpers";
import { cloneDeep } from "../../../utils/common";

const THIS_CONFIG = {
  SAVE_INTERVAL: 1000,
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
  const entityId = savedEntity.components.object?.id;
  const existingIndex = worldData.entities.findIndex(
    (entity: SavedEntity) => entity.components.object?.id === entityId
  );

  if (existingIndex !== -1) {
    console.warn(
      `[DataSyncSystem] Entity ID ${entityId}가 이미 존재. 초기화 도중에는 이미 존재할 수 있음.`
    );
  } else {
    // 새 엔티티 추가
    worldData.entities.push(savedEntity);
  }
}

function updateEntityData(
  worldData: MainSceneWorldData,
  savedEntity: SavedEntity
): void {
  const entityId = savedEntity.components.object?.id;
  const existingIndex = worldData.entities.findIndex(
    (entity: SavedEntity) => entity.components.object?.id === entityId
  );
  if (existingIndex === -1) {
    throw new Error(
      `[DataSyncSystem] Entity ID ${entityId}가 존재하지 않습니다. 업데이트할 수 없습니다.`
    );
  }
  worldData.entities[existingIndex] = savedEntity;
}

function removeEntityData(
  worldData: MainSceneWorldData,
  entityId: number
): boolean {
  const index = worldData.entities.findIndex(
    (entity: SavedEntity) => entity.components.object?.id === entityId
  );

  if (index !== -1) {
    worldData.entities.splice(index, 1);
    return true;
  }

  return false;
}

export function dataSyncSystem(params: {
  world: MainSceneWorld;
  delta: number;
}): typeof params {
  const { world: mainSceneWorld } = params;
  const worldData = mainSceneWorld.getInMemoryData();

  if (
    Date.now() - worldData.world_metadata.last_saved <
    THIS_CONFIG.SAVE_INTERVAL
  ) {
    // 마지막 저장 이후 saveInterval이 지나지 않았다면 동기화하지 않음
    return params;
  }

  const newWorldData = cloneDeep(worldData);

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

  // 모든 엔티티를 MainSceneWorld에 동기화
  // const allEntities = allEntitiesQuery(mainSceneWorld);
  // for (const eid of allEntities) {
  //   const savedEntity = convertECSEntityToSavedEntity(mainSceneWorld, eid);
  //   updateEntityData(newWorldData, savedEntity);
  // }

  newWorldData.world_metadata.last_saved = Date.now();
  mainSceneWorld.setData(newWorldData);
  return params;
}

/**
 * 모든 엔티티를 강제로 동기화 (초기화용)
 */
// export function forceFullDataSync(
//   mainSceneWorld: MainSceneWorld,
//   worldData: MainSceneWorldData,
//   query: Query = allEntitiesQuery
// ): MainSceneWorldData {
//   const entities = query(mainSceneWorld);

//   for (const eid of entities) {
//     const savedEntity = convertECSEntityToSavedEntity(mainSceneWorld, eid);
//     addEntityData(worldData, savedEntity);
//   }

//   return worldData;
// }
