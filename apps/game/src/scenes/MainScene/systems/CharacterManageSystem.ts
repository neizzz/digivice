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
  getRandomEggTextureKey,
  isEggTextureKey,
} from "../types";
import { MainSceneWorld } from "../world";
import { evolveCharacter, canEvolve, getMaxEvolutionGauge } from "./EvolutionSystem";
import { GAME_CONSTANTS, getStaminaDecayRateMultiplier } from "../config";
import {
  EVOLUTION_GAUGE_CONFIG,
  getEvolutionGaugeIncreaseAmountForEntity,
} from "../evolutionConfig";

const characterQuery = defineQuery([
  ObjectComp,
  CharacterStatusComp,
  StatusIconRenderComp,
  RenderComp,
]);
const reentryHappyCharacterQuery = defineQuery([ObjectComp, CharacterStatusComp]);

// 이전 프레임의 상태를 추적하기 위한 Map
const previousStatusStates: Map<number, CharacterStatus[]> = new Map();

// 스테미나와 진화 게이지 타이머를 위한 Map
const staminaTimers: Map<number, number> = new Map();
const evolutionGaugeTimers: Map<number, number> = new Map();
const TIMER_EPSILON_MS = 0.000001;
const TEMPORARY_STATUSES = [CharacterStatus.HAPPY, CharacterStatus.DISCOVER];
const debugLog = (..._args: unknown[]): void => {};

export function resetCharacterManageSystemStateForTests(): void {
  staminaTimers.clear();
  evolutionGaugeTimers.clear();
}

function getElapsedIntervalProgress(
  totalElapsedTime: number,
  interval: number,
): { count: number; remainder: number } {
  if (interval <= 0) {
    return { count: 0, remainder: 0 };
  }

  const count = Math.floor((totalElapsedTime + TIMER_EPSILON_MS) / interval);
  const remainder = Math.max(0, totalElapsedTime - count * interval);

  return {
    count,
    remainder: remainder < TIMER_EPSILON_MS ? 0 : remainder,
  };
}

// world 인스턴스를 저장 (addCharacterStatus에서 사용)
let _cachedWorld: MainSceneWorld | null = null;

function isTemporaryStatus(status: CharacterStatus): boolean {
  return TEMPORARY_STATUSES.includes(status);
}

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
      if (!isEggTextureKey(RenderComp.textureKey[eid])) {
        RenderComp.textureKey[eid] = getRandomEggTextureKey();
        debugLog(
          `[CharacterManagerSystem] Assigned random egg texture ${RenderComp.textureKey[eid]} for character ${eid}`,
        );
      }
    }
    // IDLE 상태일 때 (부화 후) 정적 텍스처 제거 (애니메이션 시스템이 처리)
    else if (
      ObjectComp.state[eid] === CharacterState.IDLE ||
      ObjectComp.state[eid] === CharacterState.MOVING
    ) {
      // 알 텍스처에서 벗어났다면 정적 텍스처를 ECS_NULL_VALUE로 설정하여 애니메이션 시스템이 처리하도록 함
      if (isEggTextureKey(RenderComp.textureKey[eid])) {
        RenderComp.textureKey[eid] = ECS_NULL_VALUE;
        debugLog(
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
      debugLog(
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

  debugLog(
    `[CharacterManagerSystem] Synced StatusIconRenderComp for entity ${eid}: ${currentStatuses.length} statuses`,
  );
}

export function addCharacterStatus(
  eid: number,
  status: CharacterStatus,
  world: MainSceneWorld | null = _cachedWorld,
): boolean {
  const currentStatuses = CharacterStatusComp.statuses[eid];
  const currentTime = world?.currentTime ?? Date.now();
  debugLog(
    `[addCharacterStatus] Current statuses for entity ${eid}:`,
    Array.from(currentStatuses),
  );

  if (
    isTemporaryStatus(status) &&
    ObjectComp.state[eid] === CharacterState.SLEEPING
  ) {
    debugLog(
      `[addCharacterStatus] Skipped temporary status ${status} for sleeping entity ${eid}`,
    );
    return false;
  }

  // 이미 해당 상태가 있는지 확인
  if (currentStatuses.includes(status)) {
    debugLog(
      `[addCharacterStatus] Status ${status} already exists for entity ${eid}`,
    );
    return false;
  }

  if (status === CharacterStatus.HAPPY) {
    const lastHappyStatusTime = TemporaryStatusComp.lastHappyStatusTime[eid];
    const elapsedSinceLastHappy = currentTime - lastHappyStatusTime;

    if (
      lastHappyStatusTime > 0 &&
      elapsedSinceLastHappy < GAME_CONSTANTS.HAPPY_EMOTION_COOLDOWN_MS
    ) {
      debugLog(
        `[addCharacterStatus] Skipped happy status for entity ${eid} due to cooldown (${elapsedSinceLastHappy}/${GAME_CONSTANTS.HAPPY_EMOTION_COOLDOWN_MS}ms)`,
      );
      return false;
    }
  }

  // 첫 번째 빈 슬롯(ECS_NULL_VALUE)에 상태 추가
  for (let i = 0; i < currentStatuses.length; i++) {
    if (currentStatuses[i] === ECS_NULL_VALUE) {
      currentStatuses[i] = status;

      // 일시적 상태인 경우 TemporaryStatusComp 직접 설정
      if (isTemporaryStatus(status)) {
        if (
          world &&
          hasComponent(world, ObjectComp, eid) &&
          !hasComponent(world, TemporaryStatusComp, eid)
        ) {
          addComponent(world, TemporaryStatusComp, eid);
        }

        TemporaryStatusComp.statusType[eid] = status;
        TemporaryStatusComp.startTime[eid] = currentTime;
        if (status === CharacterStatus.HAPPY) {
          TemporaryStatusComp.lastHappyStatusTime[eid] = currentTime;
        }

        debugLog(
          `[addCharacterStatus] Set temporary status ${status} for entity ${eid}, expires at ${currentTime + 3000}`,
        );
      }

      debugLog(
        `[addCharacterStatus] Added status ${status} to entity ${eid} at slot ${i}. New statuses:`,
        Array.from(currentStatuses),
      );
      return true;
    }
  }

  console.warn(
    `[addCharacterStatus] No empty slot available for entity ${eid} to add status ${status}`,
  );
  return false;
}

export function applyReentryHappyStatusForFullStaminaCharacters(
  world: MainSceneWorld,
): void {
  _cachedWorld = world;

  const characters = reentryHappyCharacterQuery(world);

  for (let i = 0; i < characters.length; i++) {
    const eid = characters[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
      continue;
    }

    if (
      ObjectComp.state[eid] === CharacterState.EGG ||
      ObjectComp.state[eid] === CharacterState.DEAD
    ) {
      continue;
    }

    applyHappyStatusForFullStaminaCharacterIfEligible(world, eid);
  }
}

export function applyHappyStatusForFullStaminaCharacterIfEligible(
  world: MainSceneWorld,
  eid: number,
): boolean {
  _cachedWorld = world;

  if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
    return false;
  }

  if (
    ObjectComp.state[eid] === CharacterState.EGG ||
    ObjectComp.state[eid] === CharacterState.DEAD ||
    ObjectComp.state[eid] === CharacterState.SICK ||
    ObjectComp.state[eid] === CharacterState.SLEEPING
  ) {
    return false;
  }

  if (CharacterStatusComp.stamina[eid] < GAME_CONSTANTS.MAX_STAMINA) {
    return false;
  }

  if (hasCharacterStatus(eid, CharacterStatus.SICK)) {
    return false;
  }

  return addCharacterStatus(eid, CharacterStatus.HAPPY, world);
}

export function clearTemporaryStatuses(
  world: MainSceneWorld,
  eid: number,
): boolean {
  _cachedWorld = world;

  if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
    return false;
  }

  let cleared = false;
  const currentStatuses = CharacterStatusComp.statuses[eid];

  for (let i = 0; i < currentStatuses.length; i++) {
    if (isTemporaryStatus(currentStatuses[i] as CharacterStatus)) {
      currentStatuses[i] = ECS_NULL_VALUE;
      cleared = true;
    }
  }

  if (hasComponent(world, TemporaryStatusComp, eid)) {
    const temporaryStatusType = TemporaryStatusComp.statusType[eid];
    if (isTemporaryStatus(temporaryStatusType as CharacterStatus)) {
      TemporaryStatusComp.statusType[eid] = ECS_NULL_VALUE;
      TemporaryStatusComp.startTime[eid] = 0;
      cleared = true;
    }
  }

  if (cleared) {
    debugLog(
      `[clearTemporaryStatuses] Cleared temporary statuses for entity ${eid}. New statuses:`,
      Array.from(currentStatuses),
    );
  }

  return cleared;
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
      debugLog(
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
  debugLog(
    `[CharacterManagerSystem] Set stamina for entity ${eid}: ${clampedStamina}`,
  );
}

export function setCharacterEvolutionGauge(eid: number, gauge: number): void {
  const clampedGauge = Math.max(0, Math.min(getMaxEvolutionGauge(), gauge));
  CharacterStatusComp.evolutionGage[eid] = clampedGauge;
  debugLog(
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
  const multiplier = getCurrentStaminaTimerMultiplier(eid);

  if (multiplier <= 0) {
    return Math.max(0, GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL - elapsed);
  }

  return (
    Math.max(0, GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL - elapsed) /
    multiplier
  );
}

export function getRemainingEvolutionGaugeTime(eid: number): number | null {
  const currentStamina = CharacterStatusComp.stamina[eid];
  const currentState = ObjectComp.state[eid] as CharacterState;
  const isSick =
    currentState === CharacterState.SICK ||
    hasCharacterStatus(eid, CharacterStatus.SICK);

  if (
    currentState === CharacterState.EGG ||
    currentStamina < EVOLUTION_GAUGE_CONFIG.staminaThreshold ||
    isSick
  ) {
    return null;
  }

  const elapsed = evolutionGaugeTimers.get(eid) || 0;
  const progressMultiplier =
    currentState === CharacterState.SLEEPING
      ? EVOLUTION_GAUGE_CONFIG.sleepingGaugeTimeProgressMultiplier
      : 1;
  const remainingProgressTime = Math.max(
    0,
    EVOLUTION_GAUGE_CONFIG.checkIntervalMs - elapsed,
  );

  if (progressMultiplier <= 0) {
    return null;
  }

  return Math.max(0, remainingProgressTime / progressMultiplier);
}

export function clearCharacterStatuses(eid: number): void {
  const currentStatuses = CharacterStatusComp.statuses[eid];
  // 모든 슬롯을 ECS_NULL_VALUE로 초기화 (길이는 유지)
  for (let i = 0; i < currentStatuses.length; i++) {
    currentStatuses[i] = ECS_NULL_VALUE;
  }
  debugLog(
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
  if (ObjectComp.state[eid] === CharacterState.EGG) {
    staminaTimers.set(eid, 0);
    evolutionGaugeTimers.set(eid, 0);
    return;
  }

  updateStaminaTimer(eid, delta);

  // 진화 게이지 타이머 업데이트 (스테미나가 설정 임계치 이상이고 SICK 상태가 아닐 때만)
  const currentStamina = CharacterStatusComp.stamina[eid];
  const isSick =
    ObjectComp.state[eid] === CharacterState.SICK ||
    hasCharacterStatus(eid, CharacterStatus.SICK);

  if (
    currentStamina >= EVOLUTION_GAUGE_CONFIG.staminaThreshold &&
    !isSick
  ) {
    const currentEvolutionTimer = evolutionGaugeTimers.get(eid) || 0;
    const evolutionDelta =
      ObjectComp.state[eid] === CharacterState.SLEEPING
        ? delta * EVOLUTION_GAUGE_CONFIG.sleepingGaugeTimeProgressMultiplier
        : delta;
    const totalEvolutionTime = currentEvolutionTimer + evolutionDelta;
    const evolutionProgress = getElapsedIntervalProgress(
      totalEvolutionTime,
      EVOLUTION_GAUGE_CONFIG.checkIntervalMs,
    );
    const evolutionIncreaseCount = evolutionProgress.count;
    evolutionGaugeTimers.set(eid, evolutionProgress.remainder);

    for (let i = 0; i < evolutionIncreaseCount; i++) {
      increaseEvolutionGauge(world, eid);
    }
  } else {
    // SICK 상태일 때는 진화 게이지 타이머를 리셋 (아픈 동안은 진화하지 않음)
    evolutionGaugeTimers.set(eid, 0);
  }
}

// 스테미나 감소 함수
function getCurrentStaminaTimerMultiplier(eid: number): number {
  const sleepMultiplier =
    ObjectComp.state[eid] === CharacterState.SLEEPING
      ? GAME_CONSTANTS.SLEEPING_STAMINA_DECAY_MULTIPLIER
      : 1;

  return (
    sleepMultiplier *
    getStaminaDecayRateMultiplier(CharacterStatusComp.stamina[eid])
  );
}

function updateStaminaTimer(eid: number, delta: number): void {
  if (delta <= 0) {
    return;
  }

  let remainingDelta = delta;
  let staminaTimer = staminaTimers.get(eid) || 0;

  while (remainingDelta > TIMER_EPSILON_MS) {
    const multiplier = getCurrentStaminaTimerMultiplier(eid);

    if (multiplier <= 0) {
      break;
    }

    const remainingEffectiveTime = Math.max(
      0,
      GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL - staminaTimer,
    );
    const timeUntilDecrease = remainingEffectiveTime / multiplier;

    if (remainingDelta + TIMER_EPSILON_MS < timeUntilDecrease) {
      staminaTimer += remainingDelta * multiplier;
      remainingDelta = 0;
      break;
    }

    staminaTimer = 0;
    remainingDelta = Math.max(0, remainingDelta - timeUntilDecrease);
    decreaseStamina(eid);

    if (CharacterStatusComp.stamina[eid] <= 0) {
      break;
    }
  }

  staminaTimers.set(eid, staminaTimer < TIMER_EPSILON_MS ? 0 : staminaTimer);
}

function decreaseStamina(eid: number): void {
  const currentStamina = CharacterStatusComp.stamina[eid];
  const newStamina = Math.max(
    0,
    currentStamina - GAME_CONSTANTS.STAMINA_DECREASE_AMOUNT,
  );
  CharacterStatusComp.stamina[eid] = newStamina;

  debugLog(
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

  debugLog(
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

    if (
      ObjectComp.state[eid] === CharacterState.SLEEPING &&
      clearTemporaryStatuses(world, eid)
    ) {
      statusModified = true;
      fixedCount++;
    }

    // 1. TemporaryStatusComp가 있는 경우 만료 체크
    if (hasComponent(world, TemporaryStatusComp, eid)) {
      const statusType = TemporaryStatusComp.statusType[eid];
      const startTime = TemporaryStatusComp.startTime[eid];

      if (statusType !== 0 && startTime !== 0) {
        const elapsedTime = now - startTime;

        // 3초 이상 경과한 경우 제거
        if (elapsedTime >= 3000) {
          debugLog(
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
    for (let j = 0; j < currentStatuses.length; j++) {
      const status = currentStatuses[j];

      if (
        status !== ECS_NULL_VALUE &&
        isTemporaryStatus(status as CharacterStatus)
      ) {
        // 임시 상태가 statuses에 있는데 TemporaryStatusComp가 없는 경우
        if (!hasComponent(world, TemporaryStatusComp, eid)) {
          debugLog(
            `[CharacterManagerSystem] Found orphaned temporary status ${status} in entity ${eid}, removing it`,
          );
          currentStatuses[j] = ECS_NULL_VALUE;
          statusModified = true;
          fixedCount++;
        }
        // TemporaryStatusComp는 있지만 동기화 안된 경우
        else if (TemporaryStatusComp.statusType[eid] !== status) {
          debugLog(
            `[CharacterManagerSystem] Found desync temporary status ${status} in entity ${eid}, removing it`,
          );
          currentStatuses[j] = ECS_NULL_VALUE;
          statusModified = true;
          fixedCount++;
        }
      }
    }

    if (statusModified) {
      debugLog(
        `[CharacterManagerSystem] Fixed statuses for entity ${eid}:`,
        Array.from(currentStatuses),
      );
    }
  }

  debugLog(
    `[CharacterManagerSystem] Status validation complete. Fixed ${fixedCount} issues.`,
  );
}

// 진화 게이지 증가 함수
function increaseEvolutionGauge(world: MainSceneWorld, eid: number): void {
  const currentGauge = CharacterStatusComp.evolutionGage[eid];
  const currentCharacterKey = CharacterStatusComp.characterKey[eid];
  const baseGaugeIncreaseAmount = getEvolutionGaugeIncreaseAmountForEntity({
    characterKey: currentCharacterKey,
    objectId: ObjectComp.id[eid],
  });
  const currentStamina = CharacterStatusComp.stamina[eid];
  const gaugeIncreaseAmount =
    currentStamina >= EVOLUTION_GAUGE_CONFIG.boostedStaminaThreshold
      ? baseGaugeIncreaseAmount *
        EVOLUTION_GAUGE_CONFIG.boostedGaugeGainMultiplier
      : baseGaugeIncreaseAmount;
  const newGauge = Math.min(
    getMaxEvolutionGauge(),
    currentGauge + gaugeIncreaseAmount,
  );
  CharacterStatusComp.evolutionGage[eid] = newGauge;

  debugLog(
    `[CharacterManagerSystem] Evolution gauge increased for entity ${eid}: ${currentGauge} -> ${newGauge} (gain=${gaugeIncreaseAmount})`,
  );

  if (canEvolve(eid)) {
    debugLog(
      `[CharacterManagerSystem] Evolution conditions met for entity ${eid}!`,
    );
    evolveCharacter(world, eid);
  }
}
