import { defineQuery } from "bitecs";
import {
  ObjectComp,
  CharacterStatusComp,
  StatusIconRenderComp,
} from "../raw-components";
import { ObjectType, CharacterStatus } from "../types";
import { MainSceneWorld } from "../world";
import { startTemporaryStatus } from "./StatusIconRenderSystem";

const characterQuery = defineQuery([
  ObjectComp,
  CharacterStatusComp,
  StatusIconRenderComp,
]);

// 이전 프레임의 상태를 추적하기 위한 Map
const previousStatusStates: Map<number, CharacterStatus[]> = new Map();

export function characterManagerSystem(params: {
  world: MainSceneWorld;
  delta: number;
}): typeof params {
  const { world } = params;
  const characters = characterQuery(world);

  for (let i = 0; i < characters.length; i++) {
    const eid = characters[i];

    // 캐릭터 타입인지 확인
    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
      continue;
    }

    // 현재 캐릭터의 상태와 진화 정보 가져오기
    const statusArray = CharacterStatusComp.statuses[eid];

    // 현재 상태들을 배열로 변환 (ECS_NULL_VALUE 제외)
    const currentStatuses: CharacterStatus[] = [];
    for (let j = 0; j < statusArray.length; j++) {
      if (statusArray[j] !== ECS_NULL_VALUE) {
        currentStatuses.push(statusArray[j]);
      }
    }

    // 이전 상태와 비교
    const previousStatuses = previousStatusStates.get(eid) || [];
    const statusesChanged = !arraysEqual(previousStatuses, currentStatuses);

    if (statusesChanged) {
      console.log(
        `[CharacterManagerSystem] Status changed for entity ${eid}:`,
        {
          previous: previousStatuses,
          current: currentStatuses,
        }
      );

      // StatusIconRenderComp 동기화
      syncStatusIconRenderComp(eid, currentStatuses);

      // 이전 상태 업데이트
      previousStatusStates.set(eid, [...currentStatuses]);
    }
  }

  return params;
}

// 두 배열이 같은지 비교하는 헬퍼 함수
function arraysEqual(
  arr1: CharacterStatus[],
  arr2: CharacterStatus[]
): boolean {
  if (arr1.length !== arr2.length) return false;

  // 정렬된 배열로 비교 (순서 무관)
  const sorted1 = [...arr1].sort();
  const sorted2 = [...arr2].sort();

  for (let i = 0; i < sorted1.length; i++) {
    if (sorted1[i] !== sorted2[i]) return false;
  }

  return true;
}

// StatusIconRenderComp를 CharacterStatusComp와 동기화
function syncStatusIconRenderComp(
  eid: number,
  currentStatuses: CharacterStatus[]
): void {
  const storeIndexes = StatusIconRenderComp.storeIndexes[eid];

  if (!storeIndexes) {
    console.warn(
      `[CharacterManagerSystem] No StatusIconRenderComp found for entity ${eid}`
    );
    return;
  }

  // 기존 storeIndexes 초기화
  for (let i = 0; i < storeIndexes.length; i++) {
    storeIndexes[i] = ECS_NULL_VALUE;
  }

  // visibleCount 업데이트
  StatusIconRenderComp.visibleCount[eid] = currentStatuses.length;

  console.log(
    `[CharacterManagerSystem] Synced StatusIconRenderComp for entity ${eid}: ${currentStatuses.length} statuses`
  );
}

export function addCharacterStatus(eid: number, status: CharacterStatus): void {
  const currentStatuses = CharacterStatusComp.statuses[eid];
  console.log(
    `[addCharacterStatus] Current statuses for entity ${eid}:`,
    Array.from(currentStatuses)
  );

  // 이미 해당 상태가 있는지 확인
  if (currentStatuses.includes(status)) {
    console.log(
      `[addCharacterStatus] Status ${status} already exists for entity ${eid}`
    );
    return;
  }

  // 첫 번째 빈 슬롯(ECS_NULL_VALUE)에 상태 추가
  for (let i = 0; i < currentStatuses.length; i++) {
    if (currentStatuses[i] === ECS_NULL_VALUE) {
      currentStatuses[i] = status;

      // 일시적 상태인 경우 타이머 시작
      if (
        status === CharacterStatus.HAPPY ||
        status === CharacterStatus.DISCOVER
      ) {
        startTemporaryStatus(eid, status);
      }

      console.log(
        `[addCharacterStatus] Added status ${status} to entity ${eid} at slot ${i}. New statuses:`,
        Array.from(currentStatuses)
      );
      return;
    }
  }

  console.warn(
    `[addCharacterStatus] No empty slot available for entity ${eid} to add status ${status}`
  );
}

export function removeCharacterStatus(
  eid: number,
  status: CharacterStatus
): void {
  const currentStatuses = CharacterStatusComp.statuses[eid];

  // 해당 상태를 찾아서 ECS_NULL_VALUE로 교체
  for (let i = 0; i < currentStatuses.length; i++) {
    if (currentStatuses[i] === status) {
      currentStatuses[i] = ECS_NULL_VALUE;
      console.log(
        `[removeCharacterStatus] Removed status ${status} from entity ${eid} at slot ${i}. New statuses:`,
        Array.from(currentStatuses)
      );
      return;
    }
  }

  console.warn(
    `[removeCharacterStatus] Status ${status} not found for entity ${eid}`
  );
}

export function hasCharacterStatus(
  eid: number,
  status: CharacterStatus
): boolean {
  const currentStatuses = CharacterStatusComp.statuses[eid];
  return currentStatuses.includes(status);
}

export function clearCharacterStatuses(eid: number): void {
  const currentStatuses = CharacterStatusComp.statuses[eid];
  // 모든 슬롯을 ECS_NULL_VALUE로 초기화 (길이는 유지)
  for (let i = 0; i < currentStatuses.length; i++) {
    currentStatuses[i] = ECS_NULL_VALUE;
  }
  console.log(
    `[clearCharacterStatuses] Cleared all statuses for entity ${eid}. New statuses:`,
    Array.from(currentStatuses)
  );
}
