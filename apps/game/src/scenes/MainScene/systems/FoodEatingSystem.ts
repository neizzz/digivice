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
  RenderComp,
} from "../raw-components";
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

const characterQuery = defineQuery([
  ObjectComp,
  CharacterStatusComp,
  PositionComp,
]);

const foodQuery = defineQuery([ObjectComp, PositionComp]);

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
const MAX_STAMINA = 10; // 최대 스태미나
const EATING_ARRIVAL_THRESHOLD = 5; // 목적지 도달 판정 거리

// 캐릭터가 음식에 접근할 때의 오프셋 (음식 위치에서 살짝 벗어난 위치)
const EATING_OFFSET_DISTANCE = 20; // 음식으로부터의 거리 (좌우)
const EATING_OFFSET_Y = -8; // 음식에서 살짝 위쪽에 위치

export function foodEatingSystem(params: {
  world: MainSceneWorld;
  delta: number;
}): typeof params {
  const { world, delta } = params;

  // 1. 음식을 먹고 있는 캐릭터들의 진행도 업데이트
  updateEatingProgress(world, delta);

  // 2. 음식으로 이동 중인 캐릭터들 처리
  updateMovingToFood(world, delta);

  // 3. 음식을 찾아서 먹으러 가는 로직
  findAndEatFood(world);

  return params;
}

/**
 * 음식을 먹고 있는 캐릭터들의 진행도 업데이트
 */
function updateEatingProgress(world: MainSceneWorld, delta: number): void {
  const eatingCharacters = eatingCharacterQuery(world);

  for (let i = 0; i < eatingCharacters.length; i++) {
    const eid = eatingCharacters[i];

    if (!FoodEatingComp.isActive[eid]) continue;

    // 경과 시간 업데이트
    FoodEatingComp.elapsedTime[eid] += delta;

    // 진행도 계산 (0.0 ~ 1.0)
    const progress = Math.min(
      FoodEatingComp.elapsedTime[eid] / FoodEatingComp.duration[eid],
      1.0
    );
    FoodEatingComp.progress[eid] = progress;

    // 음식에 마스킹 진행도 적용
    const targetFoodEid = FoodEatingComp.targetFood[eid];
    if (hasComponent(world, FoodMaskComp, targetFoodEid)) {
      FoodMaskComp.progress[targetFoodEid] = progress;
    }

    // 음식 먹기 완료
    if (progress >= 1.0) {
      completeEating(world, eid, targetFoodEid);
    }
  }
}

/**
 * 음식으로 이동 중인 캐릭터들 처리
 */
function updateMovingToFood(world: MainSceneWorld, delta: number): void {
  const movingCharacters = movingToFoodQuery(world);

  for (let i = 0; i < movingCharacters.length; i++) {
    const eid = movingCharacters[i];

    // 캐릭터 타입인지 확인
    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) continue;

    // MOVING 상태이고 DestinationType이 TARGETED인지 확인
    if (ObjectComp.state[eid] !== CharacterState.MOVING) continue;
    if (DestinationComp.type[eid] !== DestinationType.TARGETED) continue;

    const targetFoodEid = DestinationComp.target[eid];
    const targetX = DestinationComp.x[eid];
    const targetY = DestinationComp.y[eid];

    const currentX = PositionComp.x[eid];
    const currentY = PositionComp.y[eid];

    // 목적지까지의 거리 계산
    const distance = Math.sqrt(
      Math.pow(targetX - currentX, 2) + Math.pow(targetY - currentY, 2)
    );

    // 목적지에 도달했는지 확인 (음식을 먹을 수 있는 거리)
    if (distance <= EATING_ARRIVAL_THRESHOLD) {
      console.log(
        `[FoodEatingSystem] Character ${eid} reached food ${targetFoodEid}`
      );
      startEating(world, eid, targetFoodEid);
      continue;
    }

    // 이동 계산
    let speed = SpeedComp.value[eid];

    // 속도가 잘못된 경우 캐릭터별 속도로 복구
    if (!speed || speed === ECS_NULL_VALUE || speed <= 0) {
      const characterKey = CharacterStatusComp.characterKey[eid];
      const characterStats = getCharacterStats(characterKey);
      speed = characterStats.speed;
      SpeedComp.value[eid] = speed;
      console.warn(
        `[FoodEatingSystem] Character ${eid} had invalid speed, restored to ${speed} based on character type`
      );
    }

    const directionX = targetX - currentX;
    const directionY = targetY - currentY;

    // 정규화된 방향 벡터
    const length = Math.sqrt(directionX * directionX + directionY * directionY);
    if (length > 0) {
      const normalizedX = directionX / length;
      const normalizedY = directionY / length;

      // 이동 거리 계산 (픽셀/밀리초 * 델타시간)
      const moveDistance = speed * delta;

      // 목적지를 넘어서지 않도록 제한
      const actualMoveDistance = Math.min(moveDistance, distance);

      // 새로운 위치 계산
      const newX = currentX + normalizedX * actualMoveDistance;
      const newY = currentY + normalizedY * actualMoveDistance;

      // 위치 업데이트
      PositionComp.x[eid] = newX;
      PositionComp.y[eid] = newY;

      // 각도 업데이트 (이동 방향으로)
      const angle = Math.atan2(normalizedY, normalizedX);
      if (hasComponent(world, AngleComp, eid)) {
        AngleComp.value[eid] = angle;
      } else {
        addComponent(world, AngleComp, eid);
        AngleComp.value[eid] = angle;
      }
    }
  }
}

/**
 * 음식 먹기 완료
 */
function completeEating(
  world: MainSceneWorld,
  characterEid: number,
  foodEid: number
): void {
  console.log(
    `[FoodEatingSystem] Character ${characterEid} completed eating food ${foodEid}`
  );

  // 캐릭터 스태미나 증가
  const currentStamina = CharacterStatusComp.stamina[characterEid];
  CharacterStatusComp.stamina[characterEid] = Math.min(
    currentStamina + 2,
    MAX_STAMINA
  );

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
      Date.now() + 2000 + Math.random() * 1000;
    console.log(
      `[FoodEatingSystem] Added RandomMovementComp back to character ${characterEid} with idle delay`
    );
  }

  // 음식의 FoodMaskComp 제거
  if (hasComponent(world, FoodMaskComp, foodEid)) {
    removeComponent(world, FoodMaskComp, foodEid);
  }

  // 음식 엔티티 완전 삭제
  removeEntity(world, foodEid);
  console.log(`[FoodEatingSystem] Removed food entity ${foodEid}`);

  // FoodEatingComp 제거
  removeComponent(world, FoodEatingComp, characterEid);

  // 캐릭터 z-index를 원래대로 복원
  if (hasComponent(world, RenderComp, characterEid)) {
    RenderComp.zIndex[characterEid] = 1; // 기본 z-index로 복원
  }

  console.log(
    `[FoodEatingSystem] Character stamina increased to ${CharacterStatusComp.stamina[characterEid]}`
  );
}

/**
 * 캐릭터가 음식을 찾아서 먹으러 가는 로직
 */
function findAndEatFood(world: MainSceneWorld): void {
  const characters = characterQuery(world);
  const foods = foodQuery(world);

  for (let i = 0; i < characters.length; i++) {
    const characterEid = characters[i];

    // 캐릭터 타입인지 확인
    if (ObjectComp.type[characterEid] !== ObjectType.CHARACTER) continue;

    // 이미 음식을 먹고 있는지 확인
    if (hasComponent(world, FoodEatingComp, characterEid)) continue;

    // 이미 음식으로 이동 중인지 확인 (순간이동 방지)
    if (hasComponent(world, DestinationComp, characterEid)) continue;

    // 캐릭터가 IDLE 상태인지 확인 (음식을 찾을 수 있는 상태)
    const characterState = ObjectComp.state[characterEid];
    if (characterState !== CharacterState.IDLE) continue;

    // 스태미나가 꽉 차있지 않은지 확인
    const stamina = CharacterStatusComp.stamina[characterEid];
    if (stamina >= MAX_STAMINA) continue;

    // 가장 가까운 LANDED 상태의 음식 찾기
    const nearestFood = findNearestFood(world, characterEid, foods);
    if (!nearestFood) continue;

    const { foodEid, distance } = nearestFood;

    // 이미 목적지 근처에 있다면 바로 음식 먹기 시작
    if (distance <= EATING_ARRIVAL_THRESHOLD) {
      startEating(world, characterEid, foodEid);
    } else {
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
  foods: number[]
): { foodEid: number; distance: number } | null {
  const characterX = PositionComp.x[characterEid];
  const characterY = PositionComp.y[characterEid];

  let nearestFood: { foodEid: number; distance: number } | null = null;
  let minDistance = Infinity;

  for (let j = 0; j < foods.length; j++) {
    const foodEid = foods[j];

    // 음식 타입인지 확인
    if (ObjectComp.type[foodEid] !== ObjectType.FOOD) continue;

    // LANDED 상태인지 확인
    if (ObjectComp.state[foodEid] !== FoodState.LANDED) continue;

    const foodX = PositionComp.x[foodEid];
    const foodY = PositionComp.y[foodEid];

    const distance = Math.sqrt(
      Math.pow(characterX - foodX, 2) + Math.pow(characterY - foodY, 2)
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
  foodEid: number
): void {
  const characterX = PositionComp.x[characterEid];
  const characterY = PositionComp.y[characterEid];
  const foodX = PositionComp.x[foodEid];
  const foodY = PositionComp.y[foodEid];

  // 캐릭터가 음식의 어느 쪽에서 접근하는지 계산
  const approachDirectionX = characterX - foodX;
  const approachDirectionY = characterY - foodY;

  // 접근 방향에 따라 오프셋 결정
  // 왼쪽에서 접근하면 오른쪽에, 오른쪽에서 접근하면 왼쪽에 위치
  let offsetX =
    approachDirectionX > 0 ? EATING_OFFSET_DISTANCE : -EATING_OFFSET_DISTANCE;

  // Y 오프셋도 접근 방향에 따라 조정 (더 자연스러운 위치)
  let offsetY = EATING_OFFSET_Y;

  // 위에서 접근하는 경우 아래쪽에, 아래에서 접근하는 경우 위쪽에 위치
  if (Math.abs(approachDirectionY) > Math.abs(approachDirectionX)) {
    offsetY = approachDirectionY < 0 ? 8 : -16; // 위에서 오면 아래쪽, 아래에서 오면 위쪽
    offsetX = offsetX * 0.5; // X 오프셋을 줄여서 더 자연스럽게
  }

  // 목적지를 음식 위치에서 살짝 오프셋된 위치로 설정
  const targetX = foodX + offsetX;
  const targetY = foodY + offsetY;

  console.log(
    `[FoodEatingSystem] Character ${characterEid} moving to food ${foodEid} at (${foodX}, ${foodY}) -> target (${targetX}, ${targetY}) (approach from ${
      approachDirectionX < 0 ? "left" : "right"
    }, ${approachDirectionY < 0 ? "top" : "bottom"})`
  );

  // 음식을 TARGETED 상태로 변경 (다른 캐릭터가 동시에 타겟팅하지 않도록)
  ObjectComp.state[foodEid] = FoodState.TARGETED;

  // RandomMovementComp 제거 (랜덤 이동 중단)
  if (hasComponent(world, RandomMovementComp, characterEid)) {
    removeComponent(world, RandomMovementComp, characterEid);
    console.log(
      `[FoodEatingSystem] Removed RandomMovementComp from character ${characterEid}`
    );
  }

  // DestinationComp 추가 (이동 시스템에서 처리)
  if (!hasComponent(world, DestinationComp, characterEid)) {
    addComponent(world, DestinationComp, characterEid);
  }

  DestinationComp.type[characterEid] = DestinationType.TARGETED;
  DestinationComp.target[characterEid] = foodEid;
  DestinationComp.x[characterEid] = Math.round(targetX);
  DestinationComp.y[characterEid] = Math.round(targetY);

  // SpeedComp 확인 및 설정 (캐릭터의 기본 속도 사용)
  if (!hasComponent(world, SpeedComp, characterEid)) {
    addComponent(world, SpeedComp, characterEid);
  }
  // 항상 캐릭터의 고유 속도로 설정
  const characterKey = CharacterStatusComp.characterKey[characterEid];
  const characterStats = getCharacterStats(characterKey);
  SpeedComp.value[characterEid] = characterStats.speed;

  // 캐릭터 상태를 MOVING으로 변경
  ObjectComp.state[characterEid] = CharacterState.MOVING;
}

/**
 * 음식 먹기 시작
 */
function startEating(
  world: MainSceneWorld,
  characterEid: number,
  foodEid: number
): void {
  console.log(
    `[FoodEatingSystem] Character ${characterEid} started eating food ${foodEid}`
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
      `[FoodEatingSystem] Removed RandomMovementComp from eating character ${characterEid}`
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

  // 캐릭터가 음식 위에 보이도록 z-index 조정
  if (hasComponent(world, RenderComp, characterEid)) {
    RenderComp.zIndex[characterEid] = 10; // 음식보다 높은 z-index
  }
}
