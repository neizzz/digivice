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

/**
 * 소화기관 시스템
 * - 소화기관 용량은 5.0
 * - 음식을 먹으면 오르는 스테미나의 0.5배만큼 소화기관 용량이 참
 * - 용량을 초과하면 일정 시간 뒤에 똥을 싸야 함
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
  currentTime: number
): void {
  console.log(
    `[DigestiveSystem] Adding digestive load - EID: ${characterEid}, staminaIncrease: ${staminaIncrease}`
  );

  if (!hasComponent(world, DigestiveSystemComp, characterEid)) {
    console.log(
      `[DigestiveSystem] Adding DigestiveSystemComp to character ${characterEid}`
    );
    addComponent(world, DigestiveSystemComp, characterEid);
    DigestiveSystemComp.capacity[characterEid] =
      GAME_CONSTANTS.DIGESTIVE_CAPACITY;
    DigestiveSystemComp.currentLoad[characterEid] = 0;
    DigestiveSystemComp.nextPoopTime[characterEid] = 0;
  }

  const digestiveComp = DigestiveSystemComp;
  const loadIncrease = staminaIncrease * GAME_CONSTANTS.DIGESTIVE_MULTIPLIER;

  const oldLoad = digestiveComp.currentLoad[characterEid];
  digestiveComp.currentLoad[characterEid] += loadIncrease;
  const newLoad = digestiveComp.currentLoad[characterEid];
  const capacity = digestiveComp.capacity[characterEid];

  console.log(
    `[DigestiveSystem] Load change: ${oldLoad} -> ${newLoad} (capacity: ${capacity})`
  );

  // 용량 초과 시 똥 싸는 시간 설정
  if (
    digestiveComp.currentLoad[characterEid] >
      digestiveComp.capacity[characterEid] &&
    digestiveComp.nextPoopTime[characterEid] === 0
  ) {
    const poopTime = currentTime + GAME_CONSTANTS.POOP_DELAY;
    digestiveComp.nextPoopTime[characterEid] = poopTime;
    console.log(
      `[DigestiveSystem] Capacity exceeded! Next poop time set to: ${poopTime} (current: ${currentTime})`
    );
  }
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
    const nextPoopTime = digestiveComp.nextPoopTime[eid];

    // 똥 싸는 시간이 설정된 캐릭터에 대해 로그
    if (nextPoopTime > 0) {
      console.log(
        `[DigestiveSystem] Character ${eid} - nextPoopTime: ${nextPoopTime}, currentTime: ${currentTime}, remaining: ${
          nextPoopTime - currentTime
        }ms`
      );
    }

    // 똥 싸는 시간이 되었는지 체크
    if (
      digestiveComp.nextPoopTime[eid] > 0 &&
      currentTime >= digestiveComp.nextPoopTime[eid]
    ) {
      console.log(`[DigestiveSystem] It's time to poop! Character ${eid}`);

      // 똥 생성
      createPoop(world, eid);

      // 소화기관 초기화
      digestiveComp.currentLoad[eid] = 0;
      digestiveComp.nextPoopTime[eid] = 0;

      console.log(
        `[DigestiveSystem] Digestive system reset for character ${eid}`
      );
    }
  }
}

/**
 * 똥 생성
 */
export function createPoop(world: MainSceneWorld, characterEid: number): void {
  console.log(
    `[DigestiveSystem] Creating poop for character EID: ${characterEid}`
  );

  if (!hasComponent(world, PositionComp, characterEid)) {
    console.warn(
      `[DigestiveSystem] Character ${characterEid} has no PositionComp`
    );
    return;
  }

  const characterX = PositionComp.x[characterEid];
  const characterY = PositionComp.y[characterEid];
  console.log(
    `[DigestiveSystem] Character position: (${characterX}, ${characterY})`
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
    Math.min(boundary.x + boundary.width, poopX)
  );
  const finalY = Math.max(
    boundary.y,
    Math.min(boundary.y + boundary.height, poopY)
  );
  console.log(`[DigestiveSystem] Final poop position: (${finalX}, ${finalY})`);
  console.log(
    `[DigestiveSystem] Boundary: x=${boundary.x}, y=${boundary.y}, width=${boundary.width}, height=${boundary.height}`
  );

  const poobEntity = createPoobEntity(world, {
    position: { x: finalX, y: finalY },
    angle: { value: 0 },
    object: { id: 0, type: ObjectType.POOB, state: 0 }, // id를 0으로 설정하여 generatePersistentNumericId가 호출되도록 함
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
} {
  const currentLoad = DigestiveSystemComp.currentLoad[characterEid] || 0;
  const capacity =
    DigestiveSystemComp.capacity[characterEid] ||
    GAME_CONSTANTS.DIGESTIVE_CAPACITY;
  const nextPoopTime = DigestiveSystemComp.nextPoopTime[characterEid] || 0;

  return {
    currentLoad,
    capacity,
    loadPercentage: (currentLoad / capacity) * 100,
    willPoop: nextPoopTime > 0,
  };
}
