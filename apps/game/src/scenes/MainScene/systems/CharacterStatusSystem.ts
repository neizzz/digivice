import {
  defineQuery,
  hasComponent,
  addComponent,
  removeComponent,
} from "bitecs";
import {
  ObjectComp,
  CharacterStatusComp,
  VitalityComp,
  TemporaryStatusComp,
  RenderComp,
  AnimationRenderComp,
  RandomMovementComp,
  DestinationComp,
  SpeedComp,
} from "../raw-components";
import { MainSceneWorld } from "../world";
import {
  ObjectType,
  CharacterStatus,
  CharacterState,
  CharacterKeyECS,
  TextureKey,
} from "../types";
import {
  GAME_CONSTANTS,
  getUrgentDeathDelayMsByCharacterKey,
} from "../config";

// 일시적인 상태 지속 시간 (3초)
const TEMPORARY_STATUS_DURATION = 3000;

const characterQuery = defineQuery([ObjectComp, CharacterStatusComp]);
const temporaryStatusQuery = defineQuery([
  ObjectComp,
  CharacterStatusComp,
  TemporaryStatusComp,
]);
const urgentSleepTrackingByWorld = new WeakMap<
  MainSceneWorld,
  Map<number, { lastTime: number; wasSleepingUrgent: boolean }>
>();

/**
 * 캐릭터 상태에 따라 icon rendering상태 관리
 * - 스테미나에 따른 상태 변화 (unhappy, urgent, happy)
 * - urgent 상태에서 일정 시간 후 죽음
 * - 죽으면 tomb(무덤) 표시
 */
export function characterStatusSystem(params: {
  world: MainSceneWorld;
  currentTime: number;
}): typeof params {
  const { world, currentTime } = params;

  // Vitality 컴포넌트 초기화
  initializeVitality(world);

  // 잠자는 동안 urgent death countdown 정지
  pauseUrgentDeathCountdownWhileSleeping(world, currentTime);

  // 스테미나에 따른 상태 업데이트
  updateStaminaBasedStatus(world, currentTime);

  // 임시 상태 (happy) 만료 체크
  updateTemporaryStatus(world, currentTime);

  // 죽음 체크
  checkDeath(world, currentTime);

  // 다음 틱을 위한 urgent/sleep 상태 추적
  syncUrgentSleepTracking(world, currentTime);

  return params;
}

/**
 * Vitality 컴포넌트 초기화
 */
function initializeVitality(world: MainSceneWorld): void {
  const characters = characterQuery(world);

  for (let i = 0; i < characters.length; i++) {
    const eid = characters[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) continue;

    if (!hasComponent(world, VitalityComp, eid)) {
      addComponent(world, VitalityComp, eid);
      VitalityComp.urgentStartTime[eid] = 0;
      VitalityComp.deathTime[eid] = 0;
      VitalityComp.isDead[eid] = 0;
    }
  }
}

/**
 * 스테미나에 따른 상태 업데이트
 */
function updateStaminaBasedStatus(
  world: MainSceneWorld,
  currentTime: number,
): void {
  // 모든 캐릭터를 대상으로 하되, VitalityComp가 없으면 동적으로 추가
  const characters = characterQuery(world);

  for (let i = 0; i < characters.length; i++) {
    const eid = characters[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) continue;

    // VitalityComp가 없으면 추가
    if (!hasComponent(world, VitalityComp, eid)) {
      addComponent(world, VitalityComp, eid);
      VitalityComp.urgentStartTime[eid] = 0;
      VitalityComp.deathTime[eid] = 0;
      VitalityComp.isDead[eid] = 0;
      console.log(
        `[CharacterStatusSystem] Added VitalityComp to character ${eid}`,
      );
    }

    if (VitalityComp.isDead[eid]) continue;

    const stamina = CharacterStatusComp.stamina[eid];
    const currentStatuses = CharacterStatusComp.statuses[eid];

    // urgent 상태 체크 (스테미나 0)
    if (stamina === GAME_CONSTANTS.URGENT_STAMINA_THRESHOLD) {
      if (!hasCharacterStatus(currentStatuses, CharacterStatus.URGENT)) {
        // urgent 추가
        addCharacterStatus(eid, CharacterStatus.URGENT);

        // urgent 시작 시간 기록
        VitalityComp.urgentStartTime[eid] = currentTime;
        VitalityComp.deathTime[eid] =
          currentTime +
          getUrgentDeathDelayMsByCharacterKey(
            CharacterStatusComp.characterKey[eid] as CharacterKeyECS,
          );

        console.log(
          `[CharacterStatusSystem] Character ${eid} entered URGENT state. Death scheduled at ${VitalityComp.deathTime[eid]} (current: ${currentTime})`,
        );
      }
    }
    // 정상 상태 (스테미나 1이상)
    else {
      // 이전에 URGENT였는지 확인
      const wasUrgent = hasCharacterStatus(
        currentStatuses,
        CharacterStatus.URGENT,
      );

      // urgent 상태 제거
      removeCharacterStatus(eid, CharacterStatus.URGENT);

      // urgent 타이머 초기화
      VitalityComp.urgentStartTime[eid] = 0;
      VitalityComp.deathTime[eid] = 0;

      // URGENT에서 회복된 경우 이벤트 발생
      if (wasUrgent) {
        console.log(
          `[CharacterStatusSystem] Character ${eid} recovered from URGENT state (stamina: ${stamina})`,
        );
      }
    }

    // SICK 상태일 때 움직임 제한
    if (hasCharacterStatus(currentStatuses, CharacterStatus.SICK)) {
      restrictMovementForSickness(world, eid);
    }
  }
}

/**
 * 임시 상태 만료 체크
 */
function updateTemporaryStatus(
  world: MainSceneWorld,
  currentTime: number,
): void {
  const entities = temporaryStatusQuery(world);

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) continue;

    const startTime = TemporaryStatusComp.startTime[eid];
    const statusType = TemporaryStatusComp.statusType[eid];

    // 임시 상태 만료 시간 체크 (공통 임시 상태 지속 시간 사용)
    if (currentTime >= startTime + TEMPORARY_STATUS_DURATION) {
      // 상태 제거
      removeCharacterStatus(eid, statusType as CharacterStatus);

      // 임시 상태 컴포넌트 초기화
      TemporaryStatusComp.statusType[eid] = 0;
      TemporaryStatusComp.startTime[eid] = 0;
    }
  }
}

function pauseUrgentDeathCountdownWhileSleeping(
  world: MainSceneWorld,
  currentTime: number,
): void {
  const tracking = getUrgentSleepTracking(world);
  const characters = characterQuery(world);

  for (let i = 0; i < characters.length; i++) {
    const eid = characters[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) continue;
    if (!hasComponent(world, VitalityComp, eid)) continue;
    if (VitalityComp.isDead[eid]) continue;

    const previous = tracking.get(eid);
    if (!previous) {
      continue;
    }

    const elapsed = Math.max(0, currentTime - previous.lastTime);
    if (
      elapsed > 0 &&
      previous.wasSleepingUrgent &&
      VitalityComp.deathTime[eid] > 0
    ) {
      VitalityComp.deathTime[eid] += elapsed;
    }
  }
}

function syncUrgentSleepTracking(
  world: MainSceneWorld,
  currentTime: number,
): void {
  const tracking = getUrgentSleepTracking(world);
  const characters = characterQuery(world);

  for (let i = 0; i < characters.length; i++) {
    const eid = characters[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) continue;

    tracking.set(eid, {
      lastTime: currentTime,
      wasSleepingUrgent: isSleepingUrgent(world, eid),
    });
  }
}

function getUrgentSleepTracking(
  world: MainSceneWorld,
): Map<number, { lastTime: number; wasSleepingUrgent: boolean }> {
  let tracking = urgentSleepTrackingByWorld.get(world);

  if (!tracking) {
    tracking = new Map();
    urgentSleepTrackingByWorld.set(world, tracking);
  }

  return tracking;
}

function isSleepingUrgent(world: MainSceneWorld, eid: number): boolean {
  if (!hasComponent(world, VitalityComp, eid) || VitalityComp.isDead[eid]) {
    return false;
  }

  return (
    ObjectComp.state[eid] === CharacterState.SLEEPING &&
    hasCharacterStatus(CharacterStatusComp.statuses[eid], CharacterStatus.URGENT)
  );
}

/**
 * 죽음 체크
 */
function checkDeath(world: MainSceneWorld, currentTime: number): void {
  // 모든 캐릭터를 대상으로 하되, VitalityComp가 없으면 건너뛰기
  const characters = characterQuery(world);

  for (let i = 0; i < characters.length; i++) {
    const eid = characters[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) continue;

    // VitalityComp가 없으면 건너뛰기 (urgent 상태가 아니므로 죽을 필요 없음)
    if (!hasComponent(world, VitalityComp, eid)) continue;

    if (VitalityComp.isDead[eid]) continue;

    const deathTime = VitalityComp.deathTime[eid];

    // 죽을 시간이 되었는지 체크
    if (deathTime > 0 && currentTime >= deathTime) {
      console.log(
        `[CharacterStatusSystem] Character ${eid} death time reached. Current: ${currentTime}, Death time: ${deathTime}`,
      );

      // 캐릭터 죽음 처리
      killCharacter(world, eid);
    }
  }
}

/**
 * 캐릭터 죽음 처리
 */
function killCharacter(world: MainSceneWorld, eid: number): void {
  // 상태 변경
  ObjectComp.state[eid] = CharacterState.DEAD;
  VitalityComp.isDead[eid] = 1;

  // 모든 상태 제거
  const statuses = CharacterStatusComp.statuses[eid];
  for (let i = 0; i < statuses.length; i++) {
    statuses[i] = 0;
  }

  // 무덤 텍스처로 변경
  if (hasComponent(world, RenderComp, eid)) {
    const oldTextureKey = RenderComp.textureKey[eid];
    RenderComp.textureKey[eid] = TextureKey.TOMB;
    RenderComp.zIndex[eid] = ECS_NULL_VALUE; // zIndex를 0으로 리셋하여 y좌표 기반 정렬 사용
    console.log(
      `[CharacterStatusSystem] Changed character ${eid} texture from ${oldTextureKey} to TOMB (${TextureKey.TOMB}) and reset zIndex to 0`,
    );
  } else {
    console.warn(
      `[CharacterStatusSystem] Character ${eid} has no RenderComp - cannot change to tomb texture`,
    );
  }

  // 애니메이션 렌더링 컴포넌트 제거
  if (hasComponent(world, AnimationRenderComp, eid)) {
    removeComponent(world, AnimationRenderComp, eid);
    console.log(
      `[CharacterStatusSystem] Removed AnimationRenderComp for dead character ${eid}`,
    );
  }

  // 이동 관련 컴포넌트들 제거
  if (hasComponent(world, RandomMovementComp, eid)) {
    removeComponent(world, RandomMovementComp, eid);
    console.log(
      `[CharacterStatusSystem] Removed RandomMovementComp for dead character ${eid}`,
    );
  }

  if (hasComponent(world, DestinationComp, eid)) {
    removeComponent(world, DestinationComp, eid);
    console.log(
      `[CharacterStatusSystem] Removed DestinationComp for dead character ${eid}`,
    );
  }

  // 속도를 0으로 설정 (SpeedComp는 제거하지 않고 0으로 설정)
  if (hasComponent(world, SpeedComp, eid)) {
    SpeedComp.value[eid] = 0;
    console.log(
      `[CharacterStatusSystem] Set speed to 0 for dead character ${eid}`,
    );
  }

  console.log(
    `[CharacterStatusSystem] Character ${eid} has died and components have been cleaned up`,
  );
}

/**
 * 캐릭터가 특정 상태를 가지고 있는지 확인
 */
function hasCharacterStatus(
  statuses: Uint8Array,
  status: CharacterStatus,
): boolean {
  for (let i = 0; i < statuses.length; i++) {
    if (statuses[i] === status) {
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

/**
 * 캐릭터 상태 제거
 */
function removeCharacterStatus(eid: number, status: CharacterStatus): void {
  const statuses = CharacterStatusComp.statuses[eid];

  for (let i = 0; i < statuses.length; i++) {
    if (statuses[i] === status) {
      statuses[i] = 0;
      return;
    }
  }
}

/**
 * SICK 상태일 때 움직임 제한
 */
function restrictMovementForSickness(world: MainSceneWorld, eid: number): void {
  // RandomMovementComp 제거 (랜덤 이동 중단)
  if (hasComponent(world, RandomMovementComp, eid)) {
    removeComponent(world, RandomMovementComp, eid);
    console.log(
      `[CharacterStatusSystem] Removed RandomMovementComp from sick character ${eid}`,
    );
  }

  // DestinationComp 제거 (음식으로 이동하는 것도 중지)
  if (hasComponent(world, DestinationComp, eid)) {
    removeComponent(world, DestinationComp, eid);
    console.log(
      `[CharacterStatusSystem] Removed DestinationComp from sick character ${eid}`,
    );
  }

  // 속도를 0으로 설정 (아픈 동안 정지)
  if (hasComponent(world, SpeedComp, eid)) {
    SpeedComp.value[eid] = 0;
  }
}
