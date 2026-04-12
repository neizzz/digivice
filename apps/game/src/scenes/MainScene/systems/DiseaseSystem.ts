import {
  defineQuery,
  hasComponent,
  removeComponent,
  addComponent,
} from "bitecs";
import {
  CharacterStatusComp,
  DiseaseSystemComp,
  ObjectComp,
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
import { GAME_CONSTANTS } from "../config";

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
 * - 스테미나가 3이하일 때 질병 확률 3% 증가
 * - 똥이나 상한음식 1개당 질병확률 1% 증가
 * - sick 상태 관리
 */
export function diseaseSystem(params: {
  world: MainSceneWorld;
  currentTime: number;
}): typeof params {
  const { world, currentTime } = params;
  const shouldLog = !world.isSimulationMode;
  const entities = characterQuery(world);

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    // 캐릭터가 아니거나 죽은 상태면 건너뛰기
    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) continue;
    if (hasComponent(world, VitalityComp, eid) && VitalityComp.isDead[eid])
      continue;
    if (ObjectComp.state[eid] === CharacterState.DEAD) continue;

    const diseaseComp = DiseaseSystemComp;
    const characterComp = CharacterStatusComp;

    while (currentTime >= diseaseComp.nextCheckTime[eid]) {
      const checkTime = diseaseComp.nextCheckTime[eid];
      diseaseComp.nextCheckTime[eid] =
        checkTime + GAME_CONSTANTS.DISEASE_CHECK_INTERVAL;

      // 현재 sick 상태가 아닐 때만 질병 확률 체크
      const currentStatuses = characterComp.statuses[eid];
      const isSick = isCharacterSick(currentStatuses);

      if (!isSick) {
        const diseaseCalculation = calculateDiseaseRate(world, eid);
        const { rate: diseaseRate, breakdown } = diseaseCalculation;

        // 질병 확률 로그 출력
        if (shouldLog) {
          console.log(
            `Disease Check - Entity ${eid}: Total Rate ${(
              diseaseRate * 100
            ).toFixed(2)}%`,
            breakdown
          );
        }

        if (Math.random() < diseaseRate) {
          // 질병 발생
          if (shouldLog) {
            console.log(`Disease occurred for entity ${eid}!`);
          }
          addCharacterStatus(eid, CharacterStatus.SICK);
          diseaseComp.sickStartTime[eid] = checkTime;
          ObjectComp.state[eid] = CharacterState.SICK;

          // SICK 상태가 되면 움직임 제한
          restrictMovement(world, eid);
          break;
        }
      }
    }

    // 질병은 자동으로 치료되지 않으며, 별도의 치료 방법이 필요함

    // SICK 또는 SLEEPING 상태인 경우 움직임 제한
    const currentStatuses = characterComp.statuses[eid];
    const isSick = isCharacterSick(currentStatuses);
    const isSleeping = ObjectComp.state[eid] === CharacterState.SLEEPING;

    // 이전 상태 가져오기
    const previousState = previousStates.get(eid) || {
      isSick: false,
      isSleeping: false,
    };

    // 상태 변화 감지
    const wasRestricted = previousState.isSick || previousState.isSleeping;
    const isRestricted = isSick || isSleeping;

    if (isRestricted && !wasRestricted) {
      // 새로 제한 상태가 됨 - 움직임 제한
      restrictMovement(world, eid);
    } else if (!isRestricted && wasRestricted) {
      // 제한 상태에서 회복됨 - 움직임 복원
      restoreMovement(world, eid);
    }

    // 현재 상태 저장
    previousStates.set(eid, { isSick, isSleeping });
  }

  return params;
}

/**
 * 움직임 제한 - SICK 또는 SLEEPING 상태일 때 움직임 컴포넌트 제거
 */
function restrictMovement(world: MainSceneWorld, eid: number): void {
  // RandomMovementComp 제거
  if (hasComponent(world, RandomMovementComp, eid)) {
    removeComponent(world, RandomMovementComp, eid);
    console.log(
      `[DiseaseSystem] Removed RandomMovementComp from entity ${eid} (restricted movement)`
    );
  }

  // DestinationComp 제거 (음식으로 이동하는 것도 중지)
  if (hasComponent(world, DestinationComp, eid)) {
    removeComponent(world, DestinationComp, eid);
    console.log(
      `[DiseaseSystem] Removed DestinationComp from entity ${eid} (restricted movement)`
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
        `[DiseaseSystem] Restored RandomMovementComp for entity ${eid} (movement restored)`
      );
    }
  }
}

/**
 * 질병 확률 계산 (상세 로그 포함)
 */
export function calculateDiseaseRate(
  world: MainSceneWorld,
  eid: number
): {
  rate: number;
  breakdown: {
    base: number;
    lowStamina: number;
    poopBonus: number;
    staleFood: number;
    stamina: number;
    poopCount: number;
    staleFoodCount: number;
  };
} {
  let diseaseRate = GAME_CONSTANTS.BASE_DISEASE_RATE;
  const breakdown = {
    base: GAME_CONSTANTS.BASE_DISEASE_RATE,
    lowStamina: 0,
    poopBonus: 0,
    staleFood: 0,
    stamina: CharacterStatusComp.stamina[eid],
    poopCount: 0,
    staleFoodCount: 0,
  };

  // 스테미나가 3이하일 때 3% 추가
  const stamina = CharacterStatusComp.stamina[eid];
  if (stamina <= 3) {
    const bonus = GAME_CONSTANTS.LOW_STAMINA_DISEASE_BONUS;
    diseaseRate += bonus;
    breakdown.lowStamina = bonus;
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
    const staleFoodBonus =
      staleCount * GAME_CONSTANTS.STALE_FOOD_DISEASE_RATE;
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
  objectType: ObjectType
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
