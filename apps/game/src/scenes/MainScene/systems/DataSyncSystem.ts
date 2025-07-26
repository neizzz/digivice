// ECS 데이터를 MainSceneWorld에 주기적으로 동기화하는 시스템
import { defineQuery } from "bitecs";
import { ObjectComp } from "../raw-components";
import { MainSceneWorld } from "../world";
import { convertECSEntityToSavedEntity } from "../entityDataHelpers";
import { cloneDeep } from "../../../utils/common";

const THIS_CONFIG = {
  SAVE_INTERVAL: 1000,
} as const;

// TODO: dirty flag를 사용하여 성능 개선
// ECS 쿼리: ObjectComp을 가진 모든 엔티티
const allEntitiesQuery = defineQuery([ObjectComp]);

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

  // 모든 활성 엔티티를 동기화 (기존 엔티티들도 포함)
  const allEntities = allEntitiesQuery(mainSceneWorld);

  // 기존 entities 배열을 비우고 모든 활성 엔티티로 다시 채움
  newWorldData.entities = [];

  for (const eid of allEntities) {
    const savedEntity = convertECSEntityToSavedEntity(mainSceneWorld, eid);
    newWorldData.entities.push(savedEntity);
  }

  console.log(
    `[DataSyncSystem] 동기화된 엔티티 수: ${newWorldData.entities.length}`
  );

  // 제거된 엔티티들은 allEntitiesQuery에 포함되지 않으므로 자동으로 제외됨

  // TODO: 성능 개선을 위해 dirty flag 시스템 도입 필요
  // 현재는 새로 추가된 엔티티와 삭제된 엔티티만 처리
  // 기존 엔티티의 업데이트는 별도 시스템에서 처리하거나 dirty flag로 관리

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
