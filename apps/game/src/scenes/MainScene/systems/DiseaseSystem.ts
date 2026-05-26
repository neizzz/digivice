import {
  defineQuery,
  hasComponent,
  removeComponent,
  addComponent,
} from "bitecs";
import {
  CharacterStatusComp,
  DiseaseSystemComp,
  FoodEatingComp,
  ObjectComp,
  SleepSystemComp,
  VitalityComp,
  RandomMovementComp,
  DestinationComp,
  FreshnessComp,
} from "../raw-components";
import { MainSceneWorld } from "../world";
import {
  ObjectType,
  CharacterStatus,
  CharacterState,
  Freshness,
  FoodState,
} from "../types";
import {
  GAME_CONSTANTS,
  getFatigueDiseaseBonus,
  getLowStaminaDiseaseBonus,
  getStaminaFatigueAwakeGainMultiplier,
} from "../config";
import {
  clearActiveEatingState,
  releaseTargetedFoodForCharacter,
} from "./FoodEatingSystem";
import { getTargetedFoodEntityRef } from "../foodEntityRef";

const characterQuery = defineQuery([
  ObjectComp,
  CharacterStatusComp,
  DiseaseSystemComp,
]);

// 이전 프레임의 상태를 추적하기 위한 Map
const previousStates: Map<number, { isSick: boolean; isSleeping: boolean }> =
  new Map();

/**
 * 질병 시스템
 * - 일정 시간마다 질병 확률 체크
 * - 낮은 스테미나와 높은 피로도가 질병 확률을 단계적으로 높임
 * - 똥이나 상한음식은 추가 질병 확률 보정으로 누적됨
 * - sick 상태 관리
 */
export function diseaseSystem(params: {
  world: MainSceneWorld;
  currentTime: number;
  entryStatusSuppression?: {
    suppressSick?: boolean;
  };
}): typeof params {
  const { world, currentTime, entryStatusSuppression } = params;
  const shouldLog = !world.isSimulationMode;
  const suppressSick = entryStatusSuppression?.suppressSick === true;
  const entities = characterQuery(world);

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    // 캐릭터가 아니거나 죽은 상태면 건너뛰기
    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) continue;
    if (hasComponent(world, VitalityComp, eid) && VitalityComp.isDead[eid])
      continue;
    if (ObjectComp.state[eid] === CharacterState.DEAD) continue;

    if (ObjectComp.state[eid] === CharacterState.EGG) {
      advanceDiseaseCheckTimeForEgg(eid, currentTime);
      clearEggDiseaseState(eid);
      previousStates.set(eid, { isSick: false, isSleeping: false });
      continue;
    }

    const diseaseComp = DiseaseSystemComp;
    const characterComp = CharacterStatusComp;
    const isSleeping = ObjectComp.state[eid] === CharacterState.SLEEPING;
    const effectiveCheckInterval =
      GAME_CONSTANTS.DISEASE_CHECK_INTERVAL *
      (isSleeping ? 1 / GAME_CONSTANTS.SLEEPING_DISEASE_RATE_MULTIPLIER : 1);

    while (currentTime >= diseaseComp.nextCheckTime[eid]) {
      const checkTime = diseaseComp.nextCheckTime[eid];
      diseaseComp.nextCheckTime[eid] = checkTime + effectiveCheckInterval;

      // 현재 sick 상태가 아닐 때만 질병 확률 체크
      const currentStatuses = characterComp.statuses[eid];
      const isSick = isCharacterSick(currentStatuses);

      if (!isSick) {
        if (isDiseaseCheckBlockedByFoodInteraction(world, eid)) {
          continue;
        }

        const diseaseCalculation = calculateDiseaseRate(world, eid);
        const { rate: diseaseRate, breakdown } = diseaseCalculation;

        // 질병 확률 로그 출력
        if (shouldLog) {
          console.log(
            `Disease Check - Entity ${eid}: Total Rate ${(
              diseaseRate * 100
            ).toFixed(2)}%`,
            breakdown,
          );
        }

        if (Math.random() < diseaseRate) {
          if (suppressSick) {
            continue;
          }

          // 질병 발생
          if (shouldLog) {
            console.log(`Disease occurred for entity ${eid}!`);
          }
          addCharacterStatus(eid, CharacterStatus.SICK);
          diseaseComp.sickStartTime[eid] = checkTime;
          if (!isSleeping) {
            ObjectComp.state[eid] = CharacterState.SICK;
          }

          // SICK 상태가 되면 움직임 제한
          restrictMovement(world, eid);
          break;
        }
      }
    }

    // SICK 또는 SLEEPING 상태인 경우 움직임 제한
    const currentStatuses = characterComp.statuses[eid];
    const isSick = isCharacterSick(currentStatuses);
    const isSleepingNow = ObjectComp.state[eid] === CharacterState.SLEEPING;

    // 이전 상태 가져오기
    const previousState = previousStates.get(eid) || {
      isSick: false,
      isSleeping: false,
    };

    // 상태 변화 감지
    const wasRestricted = previousState.isSick || previousState.isSleeping;
    const isRestricted = isSick || isSleepingNow;

    if (isRestricted && !wasRestricted) {
      // 새로 제한 상태가 됨 - 움직임 제한
      restrictMovement(world, eid);
    } else if (!isRestricted && wasRestricted) {
      // 제한 상태에서 회복됨 - 움직임 복원
      restoreMovement(world, eid);
    }

    // 현재 상태 저장
    previousStates.set(eid, { isSick, isSleeping: isSleepingNow });
  }

  return params;
}

function advanceDiseaseCheckTimeForEgg(eid: number, currentTime: number): void {
  const interval = GAME_CONSTANTS.DISEASE_CHECK_INTERVAL;
  if (interval <= 0) {
    return;
  }

  if (DiseaseSystemComp.nextCheckTime[eid] <= 0) {
    DiseaseSystemComp.nextCheckTime[eid] = currentTime + interval;
    return;
  }

  while (currentTime >= DiseaseSystemComp.nextCheckTime[eid]) {
    DiseaseSystemComp.nextCheckTime[eid] += interval;
  }
}

function clearEggDiseaseState(eid: number): void {
  removeCharacterStatus(eid, CharacterStatus.SICK);
  DiseaseSystemComp.sickStartTime[eid] = 0;
}

function isDiseaseCheckBlockedByFoodInteraction(
  world: MainSceneWorld,
  eid: number,
): boolean {
  if (
    hasComponent(world, FoodEatingComp, eid) &&
    FoodEatingComp.isActive[eid] === 1
  ) {
    return true;
  }

  return getTargetedFoodEntityRef(world, eid) !== null;
}

/**
 * 움직임 제한 - SICK 또는 SLEEPING 상태일 때 움직임 컴포넌트 제거
 */
function restrictMovement(world: MainSceneWorld, eid: number): void {
  if (clearActiveEatingState(world, eid)) {
    console.log(
      `[DiseaseSystem] Canceled active eating for entity ${eid} (restricted movement)`,
    );
  }

  releaseTargetedFoodForCharacter(world, eid);

  // RandomMovementComp 제거
  if (hasComponent(world, RandomMovementComp, eid)) {
    removeComponent(world, RandomMovementComp, eid);
    console.log(
      `[DiseaseSystem] Removed RandomMovementComp from entity ${eid} (restricted movement)`,
    );
  }

  // DestinationComp 제거 (음식으로 이동하는 것도 중지)
  if (hasComponent(world, DestinationComp, eid)) {
    removeComponent(world, DestinationComp, eid);
    console.log(
      `[DiseaseSystem] Removed DestinationComp from entity ${eid} (restricted movement)`,
    );
  }
}

/**
 * 움직임 복원 - SICK 또는 SLEEPING 상태에서 회복될 때 움직임 컴포넌트 추가
 */
function restoreMovement(world: MainSceneWorld, eid: number): void {
  // EGG나 DEAD 상태가 아니고, 아직 RandomMovementComp가 없다면 추가
  const state = ObjectComp.state[eid];
  if (state !== CharacterState.EGG && state !== CharacterState.DEAD) {
    if (!hasComponent(world, RandomMovementComp, eid)) {
      addComponent(world, RandomMovementComp, eid);
      // 기본값들 설정 (entityFactory의 기본값과 동일)
      RandomMovementComp.minIdleTime[eid] = 3000;
      RandomMovementComp.maxIdleTime[eid] = 6000;
      RandomMovementComp.minMoveTime[eid] = 2000;
      RandomMovementComp.maxMoveTime[eid] = 4000;
      RandomMovementComp.nextChange[eid] = world.currentTime + 1000;
      console.log(
        `[DiseaseSystem] Restored RandomMovementComp for entity ${eid} (movement restored)`,
      );
    }
  }
}

/**
 * 질병 확률 계산 (상세 로그 포함)
 */
export function calculateDiseaseRate(
  world: MainSceneWorld,
  eid: number,
): {
  rate: number;
  breakdown: {
    base: number;
    lowStaminaBonus: number;
    fatigueBonus: number;
    poopBonus: number;
    staleFood: number;
    stamina: number;
    fatigue: number;
    poopCount: number;
    staleFoodCount: number;
    staminaFatigueMultiplier: number;
  };
} {
  let diseaseRate = GAME_CONSTANTS.BASE_DISEASE_RATE;
  const stamina = CharacterStatusComp.stamina[eid];
  const fatigue = hasComponent(world, SleepSystemComp, eid)
    ? SleepSystemComp.fatigue[eid]
    : GAME_CONSTANTS.FATIGUE_DEFAULT;
  const breakdown = {
    base: GAME_CONSTANTS.BASE_DISEASE_RATE,
    lowStaminaBonus: 0,
    fatigueBonus: 0,
    poopBonus: 0,
    staleFood: 0,
    stamina,
    fatigue,
    poopCount: 0,
    staleFoodCount: 0,
    staminaFatigueMultiplier: getStaminaFatigueAwakeGainMultiplier(stamina),
  };

  const lowStaminaBonus = getLowStaminaDiseaseBonus(stamina);
  if (lowStaminaBonus > 0) {
    diseaseRate += lowStaminaBonus;
    breakdown.lowStaminaBonus = lowStaminaBonus;
  }

  const fatigueBonus = getFatigueDiseaseBonus(fatigue);
  if (fatigueBonus > 0) {
    diseaseRate += fatigueBonus;
    breakdown.fatigueBonus = fatigueBonus;
  }

  // 똥 개수 계산
  const poopCount = countObjectsInWorld(world, ObjectType.POOB);
  breakdown.poopCount = poopCount;
  if (poopCount > 0) {
    const poopBonus = poopCount * GAME_CONSTANTS.POOP_DISEASE_RATE;
    diseaseRate += poopBonus;
    breakdown.poopBonus = poopBonus;
  }

  const staleCount = countStaleFoodInWorld(world);
  breakdown.staleFoodCount = staleCount;
  if (staleCount > 0) {
    const staleFoodBonus = staleCount * GAME_CONSTANTS.STALE_FOOD_DISEASE_RATE;
    diseaseRate += staleFoodBonus;
    breakdown.staleFood = staleFoodBonus;
  }

  return {
    rate: Math.min(diseaseRate, 1.0), // 최대 100%
    breakdown,
  };
}

function countStaleFoodInWorld(world: MainSceneWorld): number {
  const objectQuery = defineQuery([ObjectComp, FreshnessComp]);
  const entities = objectQuery(world);
  let count = 0;

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    if (ObjectComp.type[eid] !== ObjectType.FOOD) {
      continue;
    }

    if (FreshnessComp.freshness[eid] !== Freshness.STALE) {
      continue;
    }

    if (ObjectComp.state[eid] === FoodState.BEING_THROWING) {
      continue;
    }

    count++;
  }

  return count;
}

/**
 * 월드에서 특정 타입의 오브젝트 개수 계산
 */
function countObjectsInWorld(
  world: MainSceneWorld,
  objectType: ObjectType,
): number {
  const objectQuery = defineQuery([ObjectComp]);
  const entities = objectQuery(world);
  let count = 0;

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    if (ObjectComp.type[eid] === objectType) {
      count++;
    }
  }

  return count;
}

/**
 * 캐릭터가 sick 상태인지 확인
 */
function isCharacterSick(statuses: Uint8Array): boolean {
  for (let i = 0; i < statuses.length; i++) {
    if (statuses[i] === CharacterStatus.SICK) {
      return true;
    }
  }
  return false;
}

/**
 * 캐릭터 상태 추가
 */
function addCharacterStatus(eid: number, status: CharacterStatus): void {
  const statuses = CharacterStatusComp.statuses[eid];

  // 이미 존재하는지 확인
  for (let i = 0; i < statuses.length; i++) {
    if (statuses[i] === status) {
      return; // 이미 존재함
    }
  }

  // 빈 슬롯 찾아서 추가
  for (let i = 0; i < statuses.length; i++) {
    if (statuses[i] === 0) {
      statuses[i] = status;
      return;
    }
  }
}

function removeCharacterStatus(eid: number, status: CharacterStatus): void {
  const statuses = CharacterStatusComp.statuses[eid];

  for (let i = 0; i < statuses.length; i++) {
    if (statuses[i] === status) {
      statuses[i] = 0;
      return;
    }
  }
}
