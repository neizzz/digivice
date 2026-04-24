import { defineQuery, hasComponent, addComponent } from "bitecs";
import {
  ObjectComp,
  CharacterStatusComp,
  DigestiveSystemComp,
  PositionComp,
  VitalityComp,
  AngleComp,
} from "../raw-components";
import { MainSceneWorld } from "../world";
import { ObjectType, CharacterState } from "../types";
import { createPoobEntity } from "../entityFactory";
import { GAME_CONSTANTS } from "../config";

const characterQuery = defineQuery([ObjectComp, CharacterStatusComp]);
const characterWithDigestiveQuery = defineQuery([
  ObjectComp,
  CharacterStatusComp,
  DigestiveSystemComp,
]);

const NORMAL_POOP_SCALE_RANGE = {
  min: 2.8,
  max: 3.6,
} as const;

const SMALL_POOP_SCALE_RANGE = {
  min: 2.0,
  max: 2.4,
} as const;

/**
 * 소화기관 시스템
 * - 소화기관 용량은 5.0
 * - 식사 시 digestive load가 증가함
 * - 용량을 초과하면 일정 시간 뒤에 일반 똥을 쌈
 * - 용량을 넘지 않은 load가 8시간 유지되면 작은 똥으로 비움
 */
export function digestiveSystem(params: {
  world: MainSceneWorld;
  currentTime: number;
}): typeof params {
  const { world, currentTime } = params;

  // 소화기관 컴포넌트가 없는 캐릭터들에게 추가
  initializeDigestiveSystem(world);

  // 똥 싸는 시간 체크
  checkPoopTime(world, currentTime);

  return params;
}

/**
 * 소화기관 컴포넌트 초기화
 */
function initializeDigestiveSystem(world: MainSceneWorld): void {
  const characters = characterQuery(world);

  for (let i = 0; i < characters.length; i++) {
    const eid = characters[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) continue;
    if (hasComponent(world, VitalityComp, eid) && VitalityComp.isDead[eid])
      continue;

    if (!hasComponent(world, DigestiveSystemComp, eid)) {
      addComponent(world, DigestiveSystemComp, eid);
      DigestiveSystemComp.capacity[eid] = GAME_CONSTANTS.DIGESTIVE_CAPACITY;
      DigestiveSystemComp.currentLoad[eid] = 0;
      DigestiveSystemComp.nextPoopTime[eid] = 0;
      DigestiveSystemComp.nextSmallPoopTime[eid] = 0;
    }
  }
}

/**
 * 음식 섭취 후 소화기관 용량 증가
 */
export function addToDigestiveLoad(
  world: MainSceneWorld,
  characterEid: number,
  staminaIncrease: number,
  currentTime: number,
): void {
  console.log(
    `[DigestiveSystem] Adding digestive load - EID: ${characterEid}, staminaIncrease: ${staminaIncrease}`,
  );

  const loadIncrease = staminaIncrease * GAME_CONSTANTS.DIGESTIVE_MULTIPLIER;
  addDigestiveLoadAmount(world, characterEid, loadIncrease, currentTime);
}

export function addDigestiveLoadAmount(
  world: MainSceneWorld,
  characterEid: number,
  loadAmount: number,
  currentTime: number,
): void {
  if (!hasComponent(world, DigestiveSystemComp, characterEid)) {
    console.log(
      `[DigestiveSystem] Adding DigestiveSystemComp to character ${characterEid}`,
    );
    addComponent(world, DigestiveSystemComp, characterEid);
    DigestiveSystemComp.capacity[characterEid] =
      GAME_CONSTANTS.DIGESTIVE_CAPACITY;
    DigestiveSystemComp.currentLoad[characterEid] = 0;
    DigestiveSystemComp.nextPoopTime[characterEid] = 0;
    DigestiveSystemComp.nextSmallPoopTime[characterEid] = 0;
  }

  const digestiveComp = DigestiveSystemComp;
  const oldLoad = digestiveComp.currentLoad[characterEid];
  digestiveComp.currentLoad[characterEid] = calculateNextDigestiveLoad({
    currentLoad: oldLoad,
    capacity: digestiveComp.capacity[characterEid],
    loadAmount,
  });
  const newLoad = digestiveComp.currentLoad[characterEid];
  const capacity = digestiveComp.capacity[characterEid];

  console.log(
    `[DigestiveSystem] Load change: ${oldLoad} -> ${newLoad} (capacity: ${capacity})`,
  );

  syncDigestiveTimers(digestiveComp, characterEid, currentTime);
}

function calculateNextDigestiveLoad(params: {
  currentLoad: number;
  capacity: number;
  loadAmount: number;
}): number {
  const { currentLoad, capacity, loadAmount } = params;

  if (loadAmount <= 0) {
    return currentLoad + loadAmount;
  }

  const remainingCapacity = Math.max(0, capacity - currentLoad);
  const regularAppliedLoad = Math.min(loadAmount, remainingCapacity);
  const overflowAppliedLoad = loadAmount - regularAppliedLoad;

  return (
    currentLoad + regularAppliedLoad + overflowAppliedLoad * 2
  );
}

function scheduleNextPoop(
  digestiveComp: typeof DigestiveSystemComp,
  characterEid: number,
  currentTime: number,
): void {
  const poopTime = currentTime + GAME_CONSTANTS.POOP_DELAY;
  digestiveComp.nextPoopTime[characterEid] = poopTime;

  console.log(
    `[DigestiveSystem] Capacity exceeded! Next poop time set to: ${poopTime} (current: ${currentTime})`,
  );
}

function scheduleNextSmallPoop(
  digestiveComp: typeof DigestiveSystemComp,
  characterEid: number,
  currentTime: number,
): void {
  const poopTime = currentTime + GAME_CONSTANTS.DIGESTIVE_SMALL_POOP_DELAY;
  digestiveComp.nextSmallPoopTime[characterEid] = poopTime;

  console.log(
    `[DigestiveSystem] Under-capacity load retained. Next small poop time set to: ${poopTime} (current: ${currentTime})`,
  );
}

function clearDigestiveTimers(
  digestiveComp: typeof DigestiveSystemComp,
  characterEid: number,
): void {
  digestiveComp.nextPoopTime[characterEid] = 0;
  digestiveComp.nextSmallPoopTime[characterEid] = 0;
}

function syncDigestiveTimers(
  digestiveComp: typeof DigestiveSystemComp,
  characterEid: number,
  currentTime: number,
): void {
  const currentLoad = digestiveComp.currentLoad[characterEid];
  const capacity = digestiveComp.capacity[characterEid];

  if (currentLoad <= 0) {
    clearDigestiveTimers(digestiveComp, characterEid);
    return;
  }

  if (currentLoad > capacity) {
    digestiveComp.nextSmallPoopTime[characterEid] = 0;
    if (digestiveComp.nextPoopTime[characterEid] === 0) {
      scheduleNextPoop(digestiveComp, characterEid, currentTime);
    }
    return;
  }

  digestiveComp.nextPoopTime[characterEid] = 0;
  if (digestiveComp.nextSmallPoopTime[characterEid] === 0) {
    scheduleNextSmallPoop(digestiveComp, characterEid, currentTime);
  }
}

function processPoop(
  digestiveComp: typeof DigestiveSystemComp,
  characterEid: number,
  currentTime: number,
): void {
  const capacity = digestiveComp.capacity[characterEid];
  const previousLoad = digestiveComp.currentLoad[characterEid];
  const remainingLoad = Math.max(0, previousLoad - capacity);

  digestiveComp.currentLoad[characterEid] = remainingLoad;
  syncDigestiveTimers(digestiveComp, characterEid, currentTime);

  console.log(
    `[DigestiveSystem] Digestive load reduced for character ${characterEid}: ${previousLoad} -> ${remainingLoad}`,
  );
}

function processSmallPoop(
  digestiveComp: typeof DigestiveSystemComp,
  characterEid: number,
): void {
  const previousLoad = digestiveComp.currentLoad[characterEid];
  digestiveComp.currentLoad[characterEid] = 0;
  clearDigestiveTimers(digestiveComp, characterEid);

  console.log(
    `[DigestiveSystem] Small poop cleared digestive load for character ${characterEid}: ${previousLoad} -> 0`,
  );
}

/**
 * 똥 싸는 시간 체크
 */
function checkPoopTime(world: MainSceneWorld, currentTime: number): void {
  const characters = characterWithDigestiveQuery(world);

  for (let i = 0; i < characters.length; i++) {
    const eid = characters[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) continue;
    if (hasComponent(world, VitalityComp, eid) && VitalityComp.isDead[eid])
      continue;
    if (ObjectComp.state[eid] === CharacterState.DEAD) continue;

    const digestiveComp = DigestiveSystemComp;
    syncDigestiveTimers(digestiveComp, eid, currentTime);

    // 똥 싸는 시간이 되었는지 체크
    if (
      digestiveComp.nextPoopTime[eid] > 0 &&
      currentTime >= digestiveComp.nextPoopTime[eid]
    ) {
      console.log(`[DigestiveSystem] It's time to poop! Character ${eid}`);

      // 똥 생성
      createPoop(world, eid);

      // 소화기관은 전체 초기화하지 않고 용량만큼만 감소
      processPoop(digestiveComp, eid, currentTime);
      continue;
    }

    if (
      digestiveComp.nextSmallPoopTime[eid] > 0 &&
      currentTime >= digestiveComp.nextSmallPoopTime[eid]
    ) {
      console.log(
        `[DigestiveSystem] It's time to create a small poop! Character ${eid}`,
      );

      createPoop(world, eid, { isSmall: true });
      processSmallPoop(digestiveComp, eid);
    }
  }
}

/**
 * 똥 생성
 */
export function createPoop(
  world: MainSceneWorld,
  characterEid: number,
  options?: { isSmall?: boolean },
): void {
  console.log(
    `[DigestiveSystem] Creating poop for character EID: ${characterEid}`,
  );

  if (!hasComponent(world, PositionComp, characterEid)) {
    console.warn(
      `[DigestiveSystem] Character ${characterEid} has no PositionComp`,
    );
    return;
  }

  const characterX = PositionComp.x[characterEid];
  const characterY = PositionComp.y[characterEid];
  console.log(
    `[DigestiveSystem] Character position: (${characterX}, ${characterY})`,
  );

  // 캐릭터의 각도 정보 가져오기 (바라보는 방향)
  let angle = 0; // 기본값 (오른쪽 방향)
  if (hasComponent(world, AngleComp, characterEid)) {
    angle = AngleComp.value[characterEid];
  }
  console.log(`[DigestiveSystem] Character angle: ${angle}`);

  // 캐릭터가 바라보는 방향의 반대(뒤쪽)로 똥 생성
  // 캐릭터 뒤쪽으로 20-30픽셀 정도 떨어진 위치
  const distance = 25; // 캐릭터로부터의 거리
  const behindAngle = angle + Math.PI; // 180도 반대 방향

  const poopX = characterX + Math.cos(behindAngle) * distance;
  const poopY = characterY + Math.sin(behindAngle) * distance;
  console.log(`[DigestiveSystem] Initial poop position: (${poopX}, ${poopY})`);

  // 경계 체크
  const boundary = world.positionBoundary;
  const finalX = Math.max(
    boundary.x,
    Math.min(boundary.x + boundary.width, poopX),
  );
  const finalY = Math.max(
    boundary.y,
    Math.min(boundary.y + boundary.height, poopY),
  );
  console.log(`[DigestiveSystem] Final poop position: (${finalX}, ${finalY})`);
  console.log(
    `[DigestiveSystem] Boundary: x=${boundary.x}, y=${boundary.y}, width=${boundary.width}, height=${boundary.height}`,
  );

  const poopScaleRange = options?.isSmall
    ? SMALL_POOP_SCALE_RANGE
    : NORMAL_POOP_SCALE_RANGE;
  const poopScale =
    poopScaleRange.min +
    Math.random() * (poopScaleRange.max - poopScaleRange.min);

  const poobEntity = createPoobEntity(world, {
    position: { x: finalX, y: finalY },
    angle: { value: 0 },
    object: { id: 0, type: ObjectType.POOB, state: 0 }, // id를 0으로 설정하여 generatePersistentNumericId가 호출되도록 함
    render: { storeIndex: 0, textureKey: 0, scale: poopScale, zIndex: 0 },
  });

  console.log(`[DigestiveSystem] Created poop entity with EID: ${poobEntity}`);
}

/**
 * 소화기관 현재 상태 조회
 */
export function getDigestiveStatus(characterEid: number): {
  currentLoad: number;
  capacity: number;
  loadPercentage: number;
  willPoop: boolean;
  willSmallPoop: boolean;
} {
  const currentLoad = DigestiveSystemComp.currentLoad[characterEid] || 0;
  const capacity =
    DigestiveSystemComp.capacity[characterEid] ||
    GAME_CONSTANTS.DIGESTIVE_CAPACITY;
  const nextPoopTime = DigestiveSystemComp.nextPoopTime[characterEid] || 0;
  const nextSmallPoopTime =
    DigestiveSystemComp.nextSmallPoopTime[characterEid] || 0;

  return {
    currentLoad,
    capacity,
    loadPercentage: (currentLoad / capacity) * 100,
    willPoop: nextPoopTime > 0,
    willSmallPoop: nextSmallPoopTime > 0,
  };
}
