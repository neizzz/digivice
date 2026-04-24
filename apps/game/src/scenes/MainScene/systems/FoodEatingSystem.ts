import {
  defineQuery,
  hasComponent,
  addComponent,
  removeComponent,
  removeEntity,
} from "bitecs";
import {
  ObjectComp,
  CharacterStatusComp,
  PositionComp,
  AngleComp,
  FoodEatingComp,
  FoodMaskComp,
  DestinationComp,
  SpeedComp,
  RandomMovementComp,
  FreshnessComp,
  RenderComp,
} from "../raw-components";
import { GAME_CONSTANTS } from "../config";
import {
  ObjectType,
  CharacterState,
  FoodState,
  DestinationType,
  CharacterStatus,
} from "../types";
import { MainSceneWorld } from "../world";
import { getCharacterStats } from "../characterStats";
import { addCharacterStatus } from "./CharacterManageSystem";
import { getStaminaBonusFromFreshness, isFoodEdible } from "./FreshnessSystem";
import { addDigestiveLoadAmount } from "./DigestiveSystem";
import { moveTowardsTarget } from "../utils/movementUtils";
import { getCharacterWorldBounds } from "./CharacterDisplayBounds";
import { getSpriteStore } from "./RenderSystem";

const characterQuery = defineQuery([
  ObjectComp,
  CharacterStatusComp,
  PositionComp,
]);

const foodQuery = defineQuery([ObjectComp, PositionComp, FreshnessComp]);

const eatingCharacterQuery = defineQuery([
  ObjectComp,
  CharacterStatusComp,
  PositionComp,
  FoodEatingComp,
]);

const movingToFoodQuery = defineQuery([
  ObjectComp,
  CharacterStatusComp,
  PositionComp,
  DestinationComp,
]);

// 음식 먹기 관련 상수
const FOOD_EATING_DURATION = 3200; // 음식을 먹는데 걸리는 시간 (ms)
const EATING_ARRIVAL_THRESHOLD = 20; // 목적지 도달 판정 거리 (slowdown 구간 전에 도착하도록)
const FOOD_CHARACTER_BOUNDARY_OVERLAP_PX = 10; // 식사 중 캐릭터와 음식 경계가 겹치는 정도
const FALLBACK_FOOD_SOURCE_SIZE = 16;

type WorldBounds = {
  leftX: number;
  rightX: number;
  topY: number;
  bottomY: number;
  width: number;
  height: number;
};

export function foodEatingSystem(params: {
  world: MainSceneWorld;
  delta: number;
  currentTime?: number;
}): typeof params {
  const { world, delta, currentTime } = params;
  const resolvedCurrentTime = currentTime ?? world.currentTime;

  // 1. 음식을 먹고 있는 캐릭터들의 진행도 업데이트
  updateEatingProgress(world, delta, resolvedCurrentTime);

  // 2. 음식으로 이동 중인 캐릭터들 처리
  updateMovingToFood(world, delta);

  // 3. 음식을 찾아서 먹으러 가는 로직
  findAndEatFood(world);

  return params;
}

export function releaseTargetedFoodForCharacter(
  world: MainSceneWorld,
  characterEid: number,
): void {
  if (!hasComponent(world, DestinationComp, characterEid)) {
    return;
  }

  const targetFoodEid = DestinationComp.target[characterEid];
  if (targetFoodEid === 0) {
    return;
  }

  if (
    !hasComponent(world, ObjectComp, targetFoodEid) ||
    ObjectComp.type[targetFoodEid] !== ObjectType.FOOD
  ) {
    return;
  }

  if (ObjectComp.state[targetFoodEid] !== FoodState.TARGETED) {
    return;
  }

  ObjectComp.state[targetFoodEid] = FoodState.LANDED;
  console.log(
    `[FoodEatingSystem] Released orphaned targeted food ${targetFoodEid} for character ${characterEid}`,
  );
}

/**
 * 음식을 먹고 있는 캐릭터들의 진행도 업데이트
 */
function updateEatingProgress(
  world: MainSceneWorld,
  delta: number,
  currentTime: number,
): void {
  const eatingCharacters = eatingCharacterQuery(world);

  for (let i = 0; i < eatingCharacters.length; i++) {
    const eid = eatingCharacters[i];

    if (!FoodEatingComp.isActive[eid]) continue;

    // 경과 시간 업데이트
    FoodEatingComp.elapsedTime[eid] += delta;

    // 진행도 계산 (0.0 ~ 1.0)
    const progress = Math.min(
      FoodEatingComp.elapsedTime[eid] / FoodEatingComp.duration[eid],
      1.0,
    );
    FoodEatingComp.progress[eid] = progress;

    // 음식에 마스킹 진행도 적용
    const targetFoodEid = FoodEatingComp.targetFood[eid];
    if (hasComponent(world, FoodMaskComp, targetFoodEid)) {
      FoodMaskComp.progress[targetFoodEid] = progress;
    }

    // 음식 먹기 완료
    if (progress >= 1.0) {
      completeEating(world, eid, targetFoodEid, currentTime);
    }
  }
}

/**
 * 음식으로 이동 중인 캐릭터들 처리 (이동 + 도착 판정)
 */
function updateMovingToFood(world: MainSceneWorld, delta: number): void {
  const movingCharacters = movingToFoodQuery(world);

  for (let i = 0; i < movingCharacters.length; i++) {
    const eid = movingCharacters[i];

    // 캐릭터 타입인지 확인
    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) continue;

    // DestinationType이 TARGETED인지 확인
    if (DestinationComp.type[eid] !== DestinationType.TARGETED) continue;

    const targetFoodEid = DestinationComp.target[eid];

    // target이 0인지 확인 (잘못된 상태)
    if (targetFoodEid === 0) {
      console.warn(
        `[FoodEatingSystem] Character ${eid} has DestinationComp but target is 0 (NULL), removing DestinationComp`,
      );
      restoreFreeRoamingState(world, eid, 1000);
      continue;
    }

    const hasValidTargetFood =
      hasComponent(world, ObjectComp, targetFoodEid) &&
      ObjectComp.type[targetFoodEid] === ObjectType.FOOD;

    if (!hasValidTargetFood) {
      console.warn(
        `[FoodEatingSystem] Character ${eid} lost target food ${targetFoodEid}, restoring free roaming state`,
      );
      restoreFreeRoamingState(world, eid, 1000);
      continue;
    }

    if (
      hasComponent(world, FreshnessComp, targetFoodEid) &&
      !isFoodEdible(FreshnessComp.freshness[targetFoodEid])
    ) {
      console.log(
        `[FoodEatingSystem] Character ${eid} target food ${targetFoodEid} became stale before arrival, restoring free roaming state`,
      );
      releaseTargetedFoodForCharacter(world, eid);
      restoreFreeRoamingState(world, eid, 1000);
      continue;
    }

    // 유틸 함수를 사용하여 이동 처리 + 도착 판정
    const { distance, hasArrived } = moveTowardsTarget(
      world,
      eid,
      delta,
      EATING_ARRIVAL_THRESHOLD,
    );

    if (hasArrived) {
      console.log(
        `[FoodEatingSystem] Character ${eid} reached food ${targetFoodEid} at distance ${distance.toFixed(
          2,
        )}`,
      );
      snapCharacterToEatingPose(eid, targetFoodEid);
      startEating(world, eid, targetFoodEid);
      continue;
    }
  }
}

/**
 * 음식 먹기 완료
 */
function completeEating(
  world: MainSceneWorld,
  characterEid: number,
  foodEid: number,
  currentTime: number,
): void {
  console.log(
    `[FoodEatingSystem] Character ${characterEid} completed eating food ${foodEid}`,
  );

  // 음식의 신선도 확인
  let staminaBonus = 2; // 기본값
  if (hasComponent(world, FreshnessComp, foodEid)) {
    const freshness = FreshnessComp.freshness[foodEid];

    // 상한 음식은 먹을 수 없음
    if (!isFoodEdible(freshness)) {
      console.log(`[FoodEatingSystem] Food ${foodEid} is stale, cannot eat`);
      cancelEating(world, characterEid);
      return;
    }

    staminaBonus = getStaminaBonusFromFreshness(freshness);
  }

  // 캐릭터 스태미나 증가
  const currentStamina = CharacterStatusComp.stamina[characterEid];
  const newStamina = Math.min(
    currentStamina + staminaBonus,
    GAME_CONSTANTS.MAX_STAMINA,
  );
  CharacterStatusComp.stamina[characterEid] = newStamina;

  // 음식 신선도와 무관하게 식사 1회당 고정 소화 부하를 추가한다.
  addDigestiveLoadAmount(
    world,
    characterEid,
    GAME_CONSTANTS.DIGESTIVE_LOAD_PER_MEAL,
    currentTime,
  );

  // 스테미나가 10보다 작았는데 10이 되었을 때만 임시 happy 상태 추가
  if (
    currentStamina < GAME_CONSTANTS.MAX_STAMINA &&
    newStamina >= GAME_CONSTANTS.MAX_STAMINA
  ) {
    console.log(
      `[FoodEatingSystem] Character ${characterEid} stamina increased from ${currentStamina} to ${newStamina}, adding happy status`,
    );
    addCharacterStatus(characterEid, CharacterStatus.HAPPY);
  }

  // 캐릭터 상태를 IDLE로 변경
  ObjectComp.state[characterEid] = CharacterState.IDLE;

  // SpeedComp를 0으로 설정 (idle 상태로 시작)
  if (hasComponent(world, SpeedComp, characterEid)) {
    SpeedComp.value[characterEid] = 0; // idle 상태로 시작
  }

  // RandomMovementComp 다시 추가 (랜덤 이동 재개)
  if (!hasComponent(world, RandomMovementComp, characterEid)) {
    addComponent(world, RandomMovementComp, characterEid);
    // 기본값으로 설정 (time 관련 속성은 characterStats에서 제거됨)
    RandomMovementComp.minIdleTime[characterEid] = 1000;
    RandomMovementComp.maxIdleTime[characterEid] = 3000;
    RandomMovementComp.minMoveTime[characterEid] = 2000;
    RandomMovementComp.maxMoveTime[characterEid] = 4000;
    // 음식을 먹은 후 2-3초 정도 idle 상태를 유지하도록 설정
    RandomMovementComp.nextChange[characterEid] =
      world.currentTime + 2000 + Math.random() * 1000;
    console.log(
      `[FoodEatingSystem] Added RandomMovementComp back to character ${characterEid} with idle delay`,
    );
  }

  // 음식의 FoodMaskComp 제거
  if (hasComponent(world, FoodMaskComp, foodEid)) {
    removeComponent(world, FoodMaskComp, foodEid);
  }

  // 음식 엔티티 완전 삭제
  world.handleFoodConsumedForAd(foodEid);
  removeEntity(world, foodEid);
  console.log(`[FoodEatingSystem] Removed food entity ${foodEid}`);

  // FoodEatingComp 제거
  removeComponent(world, FoodEatingComp, characterEid);

  console.log(
    `[FoodEatingSystem] Character stamina increased to ${CharacterStatusComp.stamina[characterEid]}`,
  );
}

/**
 * 캐릭터가 음식을 찾아서 먹으러 가는 로직
 */
function findAndEatFood(world: MainSceneWorld): void {
  // 디버그 모드: 음식 쫒기 비활성화
  // if (DEBUG_DISABLE_FOOD_CHASE) {
  //   return;
  // }

  const characters = characterQuery(world);
  const foods = foodQuery(world);

  for (let i = 0; i < characters.length; i++) {
    const characterEid = characters[i];

    // 캐릭터 타입인지 확인
    if (ObjectComp.type[characterEid] !== ObjectType.CHARACTER) {
      // console.log(
      //   `[FoodEatingSystem] Entity ${characterEid} is not a character (type: ${ObjectComp.type[characterEid]})`
      // );
      continue;
    }

    // 이미 음식을 먹고 있는지 확인
    if (hasComponent(world, FoodEatingComp, characterEid)) {
      // console.log(
      //   `[FoodEatingSystem] Character ${characterEid} is already eating`
      // );
      continue;
    }

    // 이미 음식으로 이동 중인지 확인 (순간이동 방지)
    if (
      hasComponent(world, DestinationComp, characterEid) &&
      DestinationComp.target[characterEid] !== 0
    ) {
      // console.log(
      //   `[FoodEatingSystem] Character ${characterEid} is already moving to food target ${DestinationComp.target[characterEid]}`
      // );
      continue;
    }

    // 캐릭터가 자유 이동 상태인지 확인한다.
    // 랜덤 이동 중(MOVING + RandomMovementComp)이라면 음식 발견 시 즉시 추적을 시작할 수 있다.
    const characterState = ObjectComp.state[characterEid];
    const canTrackFoodWhileFreeRoaming =
      characterState === CharacterState.IDLE ||
      (characterState === CharacterState.MOVING &&
        hasComponent(world, RandomMovementComp, characterEid));

    if (!canTrackFoodWhileFreeRoaming) {
      continue;
    }

    // 스태미나가 꽉 차있지 않은지 확인
    const stamina = CharacterStatusComp.stamina[characterEid];
    if (stamina >= GAME_CONSTANTS.MAX_STAMINA) {
      // console.log(
      //   `[FoodEatingSystem] Character ${characterEid} has full stamina (${stamina}/${GAME_CONSTANTS.MAX_STAMINA})`
      // );
      continue;
    }

    // 가장 가까운 LANDED 상태의 음식 찾기
    const nearestFood = findNearestFood(world, characterEid, foods);
    if (!nearestFood) {
      continue;
    }

    const { foodEid, distance } = nearestFood;
    console.log(
      `[FoodEatingSystem] Found nearest food ${foodEid} at distance ${distance.toFixed(
        2,
      )} for character ${characterEid}`,
    );

    // 이미 목적지 근처에 있다면 바로 음식 먹기 시작
    if (distance <= EATING_ARRIVAL_THRESHOLD) {
      console.log(
        `[FoodEatingSystem] Character ${characterEid} is close enough to food ${foodEid}, starting to eat`,
      );
      snapCharacterToEatingPose(characterEid, foodEid);
      startEating(world, characterEid, foodEid);
    } else {
      console.log(
        `[FoodEatingSystem] Character ${characterEid} moving to food ${foodEid}`,
      );
      addCharacterStatus(characterEid, CharacterStatus.DISCOVER);
      moveToFood(world, characterEid, foodEid);
    }
  }
}

/**
 * 가장 가까운 LANDED 상태의 음식 찾기
 */
function findNearestFood(
  _world: MainSceneWorld,
  characterEid: number,
  foods: number[],
): { foodEid: number; distance: number } | null {
  const characterX = PositionComp.x[characterEid];
  const characterY = PositionComp.y[characterEid];

  let nearestFood: { foodEid: number; distance: number } | null = null;
  let minDistance = Infinity;
  let landedFoodCount = 0;

  for (let j = 0; j < foods.length; j++) {
    const foodEid = foods[j];

    // 음식 타입인지 확인
    if (ObjectComp.type[foodEid] !== ObjectType.FOOD) {
      continue;
    }

    // LANDED 상태인지 확인
    if (ObjectComp.state[foodEid] !== FoodState.LANDED) {
      continue;
    }

    if (
      hasComponent(_world, FreshnessComp, foodEid) &&
      !isFoodEdible(FreshnessComp.freshness[foodEid])
    ) {
      continue;
    }

    landedFoodCount++;
    const foodX = PositionComp.x[foodEid];
    const foodY = PositionComp.y[foodEid];

    const distance = Math.sqrt(
      Math.pow(characterX - foodX, 2) + Math.pow(characterY - foodY, 2),
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestFood = { foodEid, distance: minDistance };
    }
  }

  return nearestFood;
}

/**
 * 음식으로 이동
 */
function moveToFood(
  world: MainSceneWorld,
  characterEid: number,
  foodEid: number,
): void {
  const characterX = PositionComp.x[characterEid];
  const characterY = PositionComp.y[characterEid];
  const foodX = PositionComp.x[foodEid];
  const foodY = PositionComp.y[foodEid];
  const target = getEatingPoseTarget(characterEid, foodEid);
  const targetX = Math.round(target.x);
  const targetY = Math.round(target.y);

  console.log(
    `[FoodEatingSystem] Character ${characterEid} moving to food ${foodEid} at (${foodX}, ${foodY}) -> eating pose (${targetX}, ${targetY}) from (${characterX}, ${characterY})`,
  );

  // 음식을 TARGETED 상태로 변경 (다른 캐릭터가 동시에 타겟팅하지 않도록)
  ObjectComp.state[foodEid] = FoodState.TARGETED;

  // RandomMovementComp 제거 (랜덤 이동 중단)
  if (hasComponent(world, RandomMovementComp, characterEid)) {
    removeComponent(world, RandomMovementComp, characterEid);
    console.log(
      `[FoodEatingSystem] Removed RandomMovementComp from character ${characterEid}`,
    );
  }

  // DestinationComp 추가 (이동 시스템에서 처리)
  if (!hasComponent(world, DestinationComp, characterEid)) {
    addComponent(world, DestinationComp, characterEid);
  }

  DestinationComp.type[characterEid] = DestinationType.TARGETED;
  DestinationComp.target[characterEid] = foodEid;
  DestinationComp.x[characterEid] = targetX;
  DestinationComp.y[characterEid] = targetY;

  console.log(
    `[FoodEatingSystem] DestinationComp set for character ${characterEid}:`,
    {
      type: DestinationComp.type[characterEid],
      target: DestinationComp.target[characterEid],
      x: DestinationComp.x[characterEid],
      y: DestinationComp.y[characterEid],
      foodEid: foodEid,
    },
  );

  // SpeedComp 확인 및 설정 (캐릭터의 고유 속도로 한 번만 설정)
  if (!hasComponent(world, SpeedComp, characterEid)) {
    addComponent(world, SpeedComp, characterEid);
  }

  // 현재 속도가 0이거나 없는 경우에만 캐릭터 고유 속도로 설정
  if (!SpeedComp.value[characterEid] || SpeedComp.value[characterEid] <= 0) {
    const characterKey = CharacterStatusComp.characterKey[characterEid];
    const characterStats = getCharacterStats(characterKey);
    SpeedComp.value[characterEid] = characterStats.speed;
    console.log(
      `[FoodEatingSystem] Set character ${characterEid} speed to ${characterStats.speed} based on character type`,
    );
  }

  // 캐릭터 상태를 MOVING으로 변경
  ObjectComp.state[characterEid] = CharacterState.MOVING;
}

function getEatingPoseTarget(
  characterEid: number,
  foodEid: number,
): { x: number; y: number } {
  const characterBounds = getCharacterWorldBounds(characterEid);
  const foodBounds = getFoodWorldBounds(foodEid);
  const characterBottomOffset =
    characterBounds.bottomY - PositionComp.y[characterEid];

  return {
    x: PositionComp.x[foodEid],
    y:
      foodBounds.topY +
      FOOD_CHARACTER_BOUNDARY_OVERLAP_PX -
      characterBottomOffset,
  };
}

function snapCharacterToEatingPose(
  characterEid: number,
  foodEid: number,
): void {
  const target = getEatingPoseTarget(characterEid, foodEid);
  PositionComp.x[characterEid] = Math.round(target.x);
  PositionComp.y[characterEid] = Math.round(target.y);
}

function getFoodWorldBounds(foodEid: number): WorldBounds {
  const centerX = PositionComp.x[foodEid];
  const centerY = PositionComp.y[foodEid];
  const foodSprite = getSpriteStore().get(foodEid);
  const fallbackSize = getFoodFallbackSize(foodEid);
  const width =
    foodSprite && Number.isFinite(foodSprite.width) && foodSprite.width > 0
      ? Math.abs(Number(foodSprite.width))
      : fallbackSize;
  const height =
    foodSprite && Number.isFinite(foodSprite.height) && foodSprite.height > 0
      ? Math.abs(Number(foodSprite.height))
      : fallbackSize;
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  return {
    leftX: centerX - halfWidth,
    rightX: centerX + halfWidth,
    topY: centerY - halfHeight,
    bottomY: centerY + halfHeight,
    width,
    height,
  };
}

function getFoodFallbackSize(foodEid: number): number {
  const scale = RenderComp.scale[foodEid];
  const resolvedScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return FALLBACK_FOOD_SOURCE_SIZE * resolvedScale;
}

/**
 * 음식 먹기 시작
 */
function startEating(
  world: MainSceneWorld,
  characterEid: number,
  foodEid: number,
): void {
  if (
    hasComponent(world, FreshnessComp, foodEid) &&
    !isFoodEdible(FreshnessComp.freshness[foodEid])
  ) {
    console.log(
      `[FoodEatingSystem] Prevented character ${characterEid} from eating stale food ${foodEid}`,
    );
    releaseTargetedFoodForCharacter(world, characterEid);
    restoreFreeRoamingState(world, characterEid, 1000);
    return;
  }

  console.log(
    `[FoodEatingSystem] Character ${characterEid} started eating food ${foodEid}`,
  );

  if (!hasComponent(world, AngleComp, characterEid)) {
    addComponent(world, AngleComp, characterEid);
  }

  const characterX = PositionComp.x[characterEid];
  const characterY = PositionComp.y[characterEid];
  const foodX = PositionComp.x[foodEid];
  const foodY = PositionComp.y[foodEid];
  AngleComp.value[characterEid] = Math.atan2(
    foodY - characterY,
    foodX - characterX,
  );

  // FoodEatingComp 추가
  if (!hasComponent(world, FoodEatingComp, characterEid)) {
    addComponent(world, FoodEatingComp, characterEid);
  }

  FoodEatingComp.targetFood[characterEid] = foodEid;
  FoodEatingComp.progress[characterEid] = 0.0;
  FoodEatingComp.duration[characterEid] = FOOD_EATING_DURATION;
  FoodEatingComp.elapsedTime[characterEid] = 0.0;
  FoodEatingComp.isActive[characterEid] = 1;

  // 음식에 FoodMaskComp 추가
  if (!hasComponent(world, FoodMaskComp, foodEid)) {
    addComponent(world, FoodMaskComp, foodEid);
  }

  FoodMaskComp.progress[foodEid] = 0.0;
  FoodMaskComp.isInitialized[foodEid] = 0;
  FoodMaskComp.maskStoreIndex[foodEid] = ECS_NULL_VALUE;

  // 캐릭터와 음식 상태 변경
  ObjectComp.state[characterEid] = CharacterState.EATING;
  ObjectComp.state[foodEid] = FoodState.BEING_INTAKEN;

  // RandomMovementComp 제거 (음식 먹는 동안 랜덤 이동 중단)
  if (hasComponent(world, RandomMovementComp, characterEid)) {
    removeComponent(world, RandomMovementComp, characterEid);
    console.log(
      `[FoodEatingSystem] Removed RandomMovementComp from eating character ${characterEid}`,
    );
  }

  // DestinationComp 제거 (이동 중단)
  if (hasComponent(world, DestinationComp, characterEid)) {
    removeComponent(world, DestinationComp, characterEid);
  }

  // SpeedComp 초기화 (음식 먹는 동안 정지)
  if (hasComponent(world, SpeedComp, characterEid)) {
    SpeedComp.value[characterEid] = 0;
  }
}

/**
 * 음식 먹기 취소
 */
function cancelEating(world: MainSceneWorld, characterEid: number): void {
  console.log(
    `[FoodEatingSystem] Canceled eating for character ${characterEid}`,
  );

  // 캐릭터 상태를 IDLE로 변경
  ObjectComp.state[characterEid] = CharacterState.IDLE;

  // SpeedComp를 0으로 설정
  if (hasComponent(world, SpeedComp, characterEid)) {
    SpeedComp.value[characterEid] = 0;
  }

  // RandomMovementComp 다시 추가
  if (!hasComponent(world, RandomMovementComp, characterEid)) {
    addComponent(world, RandomMovementComp, characterEid);
    RandomMovementComp.minIdleTime[characterEid] = 1000;
    RandomMovementComp.maxIdleTime[characterEid] = 3000;
    RandomMovementComp.minMoveTime[characterEid] = 2000;
    RandomMovementComp.maxMoveTime[characterEid] = 4000;
    RandomMovementComp.nextChange[characterEid] = world.currentTime + 1000;
  }

  // FoodEatingComp 제거
  if (hasComponent(world, FoodEatingComp, characterEid)) {
    removeComponent(world, FoodEatingComp, characterEid);
  }
}

function restoreFreeRoamingState(
  world: MainSceneWorld,
  characterEid: number,
  idleDelayMs: number,
): void {
  releaseTargetedFoodForCharacter(world, characterEid);

  if (hasComponent(world, DestinationComp, characterEid)) {
    removeComponent(world, DestinationComp, characterEid);
  }

  ObjectComp.state[characterEid] = CharacterState.IDLE;

  if (!hasComponent(world, SpeedComp, characterEid)) {
    addComponent(world, SpeedComp, characterEid);
  }
  SpeedComp.value[characterEid] = 0;

  if (!hasComponent(world, RandomMovementComp, characterEid)) {
    addComponent(world, RandomMovementComp, characterEid);
  }

  RandomMovementComp.minIdleTime[characterEid] = 1000;
  RandomMovementComp.maxIdleTime[characterEid] = 3000;
  RandomMovementComp.minMoveTime[characterEid] = 2000;
  RandomMovementComp.maxMoveTime[characterEid] = 4000;
  RandomMovementComp.nextChange[characterEid] =
    world.currentTime + idleDelayMs + Math.random() * 1000;

  console.log(
    `[FoodEatingSystem] Restored free roaming state for character ${characterEid}`,
  );
}

/**
 * 참고: addTemporaryHappyStatus()는 제거되었습니다.
 * CharacterManageSystem.addCharacterStatus()를 사용하세요.
 * 이 함수는 자동으로 임시 상태 처리를 포함합니다.
 */
