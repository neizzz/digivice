import { defineQuery, hasComponent, addComponent } from "bitecs";
import {
  ObjectComp,
  CharacterStatusComp,
  StatusIconRenderComp,
  RenderComp,
  TemporaryStatusComp,
} from "../raw-components";
import {
  ObjectType,
  CharacterStatus,
  CharacterState,
  TextureKey,
} from "../types";
import { MainSceneWorld } from "../world";
import { evolveCharacter, canEvolve } from "./EvolutionSystem";
import { GAME_CONSTANTS } from "../config";

const characterQuery = defineQuery([
  ObjectComp,
  CharacterStatusComp,
  StatusIconRenderComp,
  RenderComp,
]);

// 이전 프레임의 상태를 추적하기 위한 Map
const previousStatusStates: Map<number, CharacterStatus[]> = new Map();

// 스테미나와 진화 게이지 타이머를 위한 Map
const staminaTimers: Map<number, number> = new Map();
const evolutionGaugeTimers: Map<number, number> = new Map();

// world 인스턴스를 저장 (addCharacterStatus에서 사용)
let _cachedWorld: MainSceneWorld | null = null;

export function characterManagerSystem(params: {
  world: MainSceneWorld;
  delta: number;
}): typeof params {
  const { world, delta } = params;
  _cachedWorld = world; // world 캐싱
  const characters = characterQuery(world);

  for (let i = 0; i < characters.length; i++) {
    const eid = characters[i];

    // 캐릭터 타입인지 확인
    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
      continue;
    }

    // EGG 상태일 때 알 텍스처로 변경
    if (ObjectComp.state[eid] === CharacterState.EGG) {
      // 알 텍스처로 설정 (EGG0 사용)
      if (RenderComp.textureKey[eid] !== TextureKey.EGG0) {
        RenderComp.textureKey[eid] = TextureKey.EGG0;
        console.log(
          `[CharacterManagerSystem] Changed texture to EGG for character ${eid}`,
        );
      }
    }
    // IDLE 상태일 때 (부화 후) 정적 텍스처 제거 (애니메이션 시스템이 처리)
    else if (
      ObjectComp.state[eid] === CharacterState.IDLE ||
      ObjectComp.state[eid] === CharacterState.MOVING
    ) {
      // 알 텍스처에서 벗어났다면 정적 텍스처를 ECS_NULL_VALUE로 설정하여 애니메이션 시스템이 처리하도록 함
      if (RenderComp.textureKey[eid] === TextureKey.EGG0) {
        RenderComp.textureKey[eid] = ECS_NULL_VALUE;
        console.log(
          `[CharacterManagerSystem] Cleared static texture for hatched character ${eid}, animation system will handle rendering`,
        );
      }
    }

    // 스테미나 및 진화 게이지 업데이트
    _updateStaminaAndEvolutionGauge(world, eid, delta);

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
        },
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
  arr2: CharacterStatus[],
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
  currentStatuses: CharacterStatus[],
): void {
  const storeIndexes = StatusIconRenderComp.storeIndexes[eid];

  if (!storeIndexes) {
    console.warn(
      `[CharacterManagerSystem] No StatusIconRenderComp found for entity ${eid}`,
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
    `[CharacterManagerSystem] Synced StatusIconRenderComp for entity ${eid}: ${currentStatuses.length} statuses`,
  );
}

export function addCharacterStatus(eid: number, status: CharacterStatus): void {
  const currentStatuses = CharacterStatusComp.statuses[eid];
  console.log(
    `[addCharacterStatus] Current statuses for entity ${eid}:`,
    Array.from(currentStatuses),
  );

  // 이미 해당 상태가 있는지 확인
  if (currentStatuses.includes(status)) {
    console.log(
      `[addCharacterStatus] Status ${status} already exists for entity ${eid}`,
    );
    return;
  }

  // 첫 번째 빈 슬롯(ECS_NULL_VALUE)에 상태 추가
  for (let i = 0; i < currentStatuses.length; i++) {
    if (currentStatuses[i] === ECS_NULL_VALUE) {
      currentStatuses[i] = status;

      // 일시적 상태인 경우 TemporaryStatusComp 직접 설정
      if (
        status === CharacterStatus.HAPPY ||
        status === CharacterStatus.DISCOVER
      ) {
        // world가 필요한 경우에만 체크
        if (_cachedWorld) {
          // TemporaryStatusComp가 없으면 추가
          if (!hasComponent(_cachedWorld, TemporaryStatusComp, eid)) {
            addComponent(_cachedWorld, TemporaryStatusComp, eid);
          }

          const currentTime = _cachedWorld.currentTime;
          TemporaryStatusComp.statusType[eid] = status;
          TemporaryStatusComp.startTime[eid] = currentTime;

          console.log(
            `[addCharacterStatus] Set temporary status ${status} for entity ${eid}, expires at ${currentTime + 3000}`,
          );
        } else {
          console.warn(
            `[addCharacterStatus] Cannot set temporary status: world not cached`,
          );
        }
      }

      console.log(
        `[addCharacterStatus] Added status ${status} to entity ${eid} at slot ${i}. New statuses:`,
        Array.from(currentStatuses),
      );
      return;
    }
  }

  console.warn(
    `[addCharacterStatus] No empty slot available for entity ${eid} to add status ${status}`,
  );
}

export function removeCharacterStatus(
  eid: number,
  status: CharacterStatus,
): void {
  const currentStatuses = CharacterStatusComp.statuses[eid];

  // 해당 상태를 찾아서 ECS_NULL_VALUE로 교체
  for (let i = 0; i < currentStatuses.length; i++) {
    if (currentStatuses[i] === status) {
      currentStatuses[i] = ECS_NULL_VALUE;
      console.log(
        `[removeCharacterStatus] Removed status ${status} from entity ${eid} at slot ${i}. New statuses:`,
        Array.from(currentStatuses),
      );
      return;
    }
  }

  console.warn(
    `[removeCharacterStatus] Status ${status} not found for entity ${eid}`,
  );
}

export function hasCharacterStatus(
  eid: number,
  status: CharacterStatus,
): boolean {
  const currentStatuses = CharacterStatusComp.statuses[eid];
  return currentStatuses.includes(status);
}

export function setCharacterStamina(eid: number, stamina: number): void {
  const clampedStamina = Math.max(
    0,
    Math.min(GAME_CONSTANTS.MAX_STAMINA, stamina),
  );
  CharacterStatusComp.stamina[eid] = clampedStamina;
  console.log(
    `[CharacterManagerSystem] Set stamina for entity ${eid}: ${clampedStamina}`,
  );
}

export function setCharacterEvolutionGauge(eid: number, gauge: number): void {
  const clampedGauge = Math.max(0, Math.min(100.0, gauge));
  CharacterStatusComp.evolutionGage[eid] = clampedGauge;
  console.log(
    `[CharacterManagerSystem] Set evolution gauge for entity ${eid}: ${clampedGauge}`,
  );
}

export function getCharacterStamina(eid: number): number {
  return CharacterStatusComp.stamina[eid] || 0;
}

export function getCharacterEvolutionGauge(eid: number): number {
  return CharacterStatusComp.evolutionGage[eid] || 0;
}

export function getRemainingStaminaDecreaseTime(eid: number): number {
  const elapsed = staminaTimers.get(eid) || 0;
  return Math.max(0, GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL - elapsed);
}

export function getRemainingEvolutionGaugeTime(eid: number): number | null {
  const currentStamina = CharacterStatusComp.stamina[eid];
  const isSick = hasCharacterStatus(eid, CharacterStatus.SICK);

  if (
    currentStamina < GAME_CONSTANTS.EVOLUTION_GAUGE_STATMINA_THRESHOLD ||
    isSick
  ) {
    return null;
  }

  const elapsed = evolutionGaugeTimers.get(eid) || 0;
  return Math.max(0, GAME_CONSTANTS.EVOLUTION_GAUGE_CHECK_INTERVAL - elapsed);
}

export function clearCharacterStatuses(eid: number): void {
  const currentStatuses = CharacterStatusComp.statuses[eid];
  // 모든 슬롯을 ECS_NULL_VALUE로 초기화 (길이는 유지)
  for (let i = 0; i < currentStatuses.length; i++) {
    currentStatuses[i] = ECS_NULL_VALUE;
  }
  console.log(
    `[clearCharacterStatuses] Cleared all statuses for entity ${eid}. New statuses:`,
    Array.from(currentStatuses),
  );
}

// 스테미나와 진화 게이지 업데이트 함수
function _updateStaminaAndEvolutionGauge(
  world: MainSceneWorld,
  eid: number,
  delta: number,
): void {
  // 스테미나 타이머 업데이트
  const currentStaminaTimer = staminaTimers.get(eid) || 0;
  const staminaDelta =
    ObjectComp.state[eid] === CharacterState.SLEEPING
      ? delta * GAME_CONSTANTS.SLEEPING_STAMINA_DECAY_MULTIPLIER
      : delta;
  const totalStaminaTime = currentStaminaTimer + staminaDelta;
  const staminaDecreaseCount = Math.floor(
    totalStaminaTime / GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL,
  );
  staminaTimers.set(
    eid,
    totalStaminaTime % GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL,
  );

  for (let i = 0; i < staminaDecreaseCount; i++) {
    decreaseStamina(eid);
  }

  // 진화 게이지 타이머 업데이트 (스테미나가 5 이상이고 SICK 상태가 아닐 때만)
  const currentStamina = CharacterStatusComp.stamina[eid];
  const isSick = hasCharacterStatus(eid, CharacterStatus.SICK);

  if (
    currentStamina >= GAME_CONSTANTS.EVOLUTION_GAUGE_STATMINA_THRESHOLD &&
    !isSick
  ) {
    const currentEvolutionTimer = evolutionGaugeTimers.get(eid) || 0;
    const totalEvolutionTime = currentEvolutionTimer + delta;
    const evolutionIncreaseCount = Math.floor(
      totalEvolutionTime / GAME_CONSTANTS.EVOLUTION_GAUGE_CHECK_INTERVAL,
    );
    evolutionGaugeTimers.set(
      eid,
      totalEvolutionTime % GAME_CONSTANTS.EVOLUTION_GAUGE_CHECK_INTERVAL,
    );

    for (let i = 0; i < evolutionIncreaseCount; i++) {
      increaseEvolutionGauge(world, eid);
    }
  } else {
    // SICK 상태일 때는 진화 게이지 타이머를 리셋 (아픈 동안은 진화하지 않음)
    evolutionGaugeTimers.set(eid, 0);
  }
}

// 스테미나 감소 함수
function decreaseStamina(eid: number): void {
  const currentStamina = CharacterStatusComp.stamina[eid];
  const newStamina = Math.max(
    0,
    currentStamina - GAME_CONSTANTS.STAMINA_DECREASE_AMOUNT,
  );
  CharacterStatusComp.stamina[eid] = newStamina;

  console.log(
    `[CharacterManagerSystem] Stamina decreased for entity ${eid}: ${currentStamina} -> ${newStamina}`,
  );
}

/**
 * 게임 시작 시 저장된 엔티티의 상태 아이콘 데이터를 검증하고 수정합니다.
 * - 만료된 임시 상태 제거
 * - statuses와 TemporaryStatusComp 동기화
 */
export function validateAndFixStatusIcons(world: MainSceneWorld): void {
  const characters = characterQuery(world);
  let fixedCount = 0;

  console.log(
    "[CharacterManagerSystem] Validating status icons for loaded entities...",
  );

  for (let i = 0; i < characters.length; i++) {
    const eid = characters[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
      continue;
    }

    const currentStatuses = CharacterStatusComp.statuses[eid];
    const now = world.currentTime;
    let statusModified = false;

    // 1. TemporaryStatusComp가 있는 경우 만료 체크
    if (hasComponent(world, TemporaryStatusComp, eid)) {
      const statusType = TemporaryStatusComp.statusType[eid];
      const startTime = TemporaryStatusComp.startTime[eid];

      if (statusType !== 0 && startTime !== 0) {
        const elapsedTime = now - startTime;

        // 3초 이상 경과한 경우 제거
        if (elapsedTime >= 3000) {
          console.log(
            `[CharacterManagerSystem] Removing expired temporary status ${statusType} from entity ${eid} (elapsed: ${elapsedTime}ms)`,
          );

          // statuses 배열에서 제거
          for (let j = 0; j < currentStatuses.length; j++) {
            if (currentStatuses[j] === statusType) {
              currentStatuses[j] = ECS_NULL_VALUE;
              statusModified = true;
              break;
            }
          }

          // TemporaryStatusComp 초기화
          TemporaryStatusComp.statusType[eid] = 0;
          TemporaryStatusComp.startTime[eid] = 0;
          fixedCount++;
        }
      }
    }

    // 2. statuses 배열에 임시 상태가 있는데 TemporaryStatusComp가 없거나 동기화 안된 경우
    const temporaryStatuses = [CharacterStatus.HAPPY, CharacterStatus.DISCOVER];

    for (let j = 0; j < currentStatuses.length; j++) {
      const status = currentStatuses[j];

      if (status !== ECS_NULL_VALUE && temporaryStatuses.includes(status)) {
        // 임시 상태가 statuses에 있는데 TemporaryStatusComp가 없는 경우
        if (!hasComponent(world, TemporaryStatusComp, eid)) {
          console.log(
            `[CharacterManagerSystem] Found orphaned temporary status ${status} in entity ${eid}, removing it`,
          );
          currentStatuses[j] = ECS_NULL_VALUE;
          statusModified = true;
          fixedCount++;
        }
        // TemporaryStatusComp는 있지만 동기화 안된 경우
        else if (TemporaryStatusComp.statusType[eid] !== status) {
          console.log(
            `[CharacterManagerSystem] Found desync temporary status ${status} in entity ${eid}, removing it`,
          );
          currentStatuses[j] = ECS_NULL_VALUE;
          statusModified = true;
          fixedCount++;
        }
      }
    }

    if (statusModified) {
      console.log(
        `[CharacterManagerSystem] Fixed statuses for entity ${eid}:`,
        Array.from(currentStatuses),
      );
    }
  }

  console.log(
    `[CharacterManagerSystem] Status validation complete. Fixed ${fixedCount} issues.`,
  );
}

// 진화 게이지 증가 함수
function increaseEvolutionGauge(world: MainSceneWorld, eid: number): void {
  const currentGauge = CharacterStatusComp.evolutionGage[eid];
  const newGauge = Math.min(100.0, currentGauge + 1.0); // 임시로 1씩 증가
  CharacterStatusComp.evolutionGage[eid] = newGauge;

  console.log(
    `[CharacterManagerSystem] Evolution gauge increased for entity ${eid}: ${currentGauge} -> ${newGauge}`,
  );

  // 진화 조건 체크 (100에 도달했을 때)
  if (canEvolve(eid)) {
    console.log(
      `[CharacterManagerSystem] Evolution conditions met for entity ${eid}!`,
    );
    // 진화 처리
    evolveCharacter(world, eid);
  }
}
