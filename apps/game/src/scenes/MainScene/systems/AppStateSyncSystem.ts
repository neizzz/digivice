import { defineQuery, hasComponent, addComponent, addEntity } from "bitecs";
import {
  ObjectComp,
  CharacterStatusComp,
  AppStateComp,
  DigestiveSystemComp,
  DiseaseSystemComp,
  FreshnessTimerComp,
  VitalityComp,
} from "../raw-components";
import { MainSceneWorld } from "../world";
import { ObjectType } from "../types";
import { GAME_CONSTANTS } from "../config";

const characterQuery = defineQuery([ObjectComp, CharacterStatusComp]);
const foodQuery = defineQuery([ObjectComp, FreshnessTimerComp]);
const appStateQuery = defineQuery([AppStateComp]);

/**
 * 앱 상태 동기화 시스템
 * - 앱을 껐다 키거나, 홈버튼으로 나갔다가 재진입했을 때
 *   그 시간동안의 상태 반영
 */
export function appStateSyncSystem(params: {
  world: MainSceneWorld;
  currentTime: number;
  isAppResuming?: boolean; // 앱이 재개되는 중인지
}): typeof params {
  const { world, currentTime, isAppResuming = false } = params;

  // 앱 상태 컴포넌트 초기화
  initializeAppState(world, currentTime);

  // 앱이 재개되는 경우에만 시간 동기화 실행
  if (isAppResuming) {
    syncTimeBasedProgress(world, currentTime);
  }

  // 현재 시간 업데이트
  updateLastActiveTime(world, currentTime);

  return params;
}

/**
 * 앱 상태 컴포넌트 초기화
 */
function initializeAppState(world: MainSceneWorld, currentTime: number): void {
  // 전역 앱 상태 엔티티가 없으면 생성
  const appEntities = appStateQuery(world);

  if (appEntities.length === 0) {
    const eid = addEntity(world);
    addComponent(world, AppStateComp, eid);
    AppStateComp.lastActiveTime[eid] = currentTime;
    AppStateComp.isFirstLoad[eid] = 1;
  }
}

/**
 * 시간 기반 진행사항 동기화
 */
function syncTimeBasedProgress(
  world: MainSceneWorld,
  currentTime: number
): void {
  const appEntities = appStateQuery(world);

  if (appEntities.length === 0) return;

  const appEid = appEntities[0];
  const lastActiveTime = AppStateComp.lastActiveTime[appEid];
  const isFirstLoad = AppStateComp.isFirstLoad[appEid];

  // 첫 로드가 아니고, 마지막 활성 시간이 있는 경우에만 동기화
  if (isFirstLoad === 0 && lastActiveTime > 0) {
    const timeElapsed = currentTime - lastActiveTime;

    // 너무 오래된 시간은 무시 (1일 이상)
    if (timeElapsed > 24 * 60 * 60 * 1000) {
      return;
    }

    // 캐릭터 상태 동기화
    syncCharacterProgress(world, currentTime, timeElapsed);

    // 음식 신선도 동기화
    syncFoodFreshness(world, currentTime, timeElapsed);
  }

  // 첫 로드 플래그 해제
  AppStateComp.isFirstLoad[appEid] = 0;
}

/**
 * 캐릭터 진행사항 동기화
 */
function syncCharacterProgress(
  world: MainSceneWorld,
  currentTime: number,
  timeElapsed: number
): void {
  const characters = characterQuery(world);

  for (let i = 0; i < characters.length; i++) {
    const eid = characters[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) continue;

    // 스테미나 감소 (시간당 1씩 감소)
    const staminaDecrease = Math.floor(timeElapsed / (60 * 60 * 1000)); // 1시간마다 1씩
    if (staminaDecrease > 0) {
      const currentStamina = CharacterStatusComp.stamina[eid];
      const newStamina = Math.max(0, currentStamina - staminaDecrease);
      CharacterStatusComp.stamina[eid] = newStamina;
    }

    // 질병 시스템 동기화
    syncDiseaseSystem(world, eid, currentTime, timeElapsed);

    // 소화기관 동기화
    syncDigestiveSystem(world, eid, currentTime, timeElapsed);

    // 생존 상태 동기화
    syncVitalitySystem(world, eid, currentTime, timeElapsed);
  }
}

/**
 * 질병 시스템 동기화
 */
function syncDiseaseSystem(
  world: MainSceneWorld,
  eid: number,
  currentTime: number,
  timeElapsed: number
): void {
  if (!hasComponent(world, DiseaseSystemComp, eid)) {
    addComponent(world, DiseaseSystemComp, eid);
    DiseaseSystemComp.nextCheckTime[eid] =
      currentTime + GAME_CONSTANTS.DISEASE_CHECK_INTERVAL;
    DiseaseSystemComp.checkInterval[eid] =
      GAME_CONSTANTS.DISEASE_CHECK_INTERVAL;
    DiseaseSystemComp.sickStartTime[eid] = 0;
  }

  // 질병 체크 시간 조정
  const missedChecks = Math.floor(
    timeElapsed / GAME_CONSTANTS.DISEASE_CHECK_INTERVAL
  );
  if (missedChecks > 0) {
    // 놓친 체크 횟수만큼 즉시 체크하도록 시간 조정
    DiseaseSystemComp.nextCheckTime[eid] = currentTime;
  }
}

/**
 * 소화기관 동기화
 */
function syncDigestiveSystem(
  world: MainSceneWorld,
  eid: number,
  currentTime: number,
  timeElapsed: number
): void {
  if (!hasComponent(world, DigestiveSystemComp, eid)) {
    addComponent(world, DigestiveSystemComp, eid);
    DigestiveSystemComp.capacity[eid] = GAME_CONSTANTS.DIGESTIVE_CAPACITY;
    DigestiveSystemComp.currentLoad[eid] = 0;
    DigestiveSystemComp.nextPoopTime[eid] = 0;
  }

  // 소화기관 내용물 자연 감소 (시간당 0.5씩)
  const digestiveDecrease = (timeElapsed / (60 * 60 * 1000)) * 0.5;
  if (digestiveDecrease > 0) {
    const currentLoad = DigestiveSystemComp.currentLoad[eid];
    const newLoad = Math.max(0, currentLoad - digestiveDecrease);
    DigestiveSystemComp.currentLoad[eid] = newLoad;

    // 소화기관이 비어있으면 똥 타이머 초기화
    if (newLoad === 0) {
      DigestiveSystemComp.nextPoopTime[eid] = 0;
    }
  }
}

/**
 * 생존 상태 동기화
 */
function syncVitalitySystem(
  world: MainSceneWorld,
  eid: number,
  currentTime: number,
  timeElapsed: number
): void {
  if (!hasComponent(world, VitalityComp, eid)) {
    addComponent(world, VitalityComp, eid);
    VitalityComp.urgentStartTime[eid] = 0;
    VitalityComp.deathTime[eid] = 0;
    VitalityComp.isDead[eid] = 0;
  }

  // urgent 상태였다면 죽음 시간 재계산
  const urgentStartTime = VitalityComp.urgentStartTime[eid];
  if (urgentStartTime > 0) {
    const urgentDuration = currentTime - urgentStartTime;
    if (urgentDuration >= GAME_CONSTANTS.DEATH_DELAY) {
      // 죽음 시간이 지났다면 즉시 죽음 처리
      VitalityComp.deathTime[eid] = currentTime;
    } else {
      // 아직 죽음 시간이 안 됐다면 남은 시간 계산
      VitalityComp.deathTime[eid] =
        urgentStartTime + GAME_CONSTANTS.DEATH_DELAY;
    }
  }
}

/**
 * 음식 신선도 동기화
 */
function syncFoodFreshness(
  world: MainSceneWorld,
  currentTime: number,
  timeElapsed: number
): void {
  const foods = foodQuery(world);

  for (let i = 0; i < foods.length; i++) {
    const eid = foods[i];

    if (ObjectComp.type[eid] !== ObjectType.FOOD) continue;

    // 생성 시간을 과거로 조정하여 신선도 변화 반영
    const originalCreatedTime = FreshnessTimerComp.createdTime[eid];
    FreshnessTimerComp.createdTime[eid] = originalCreatedTime - timeElapsed;
  }
}

/**
 * 마지막 활성 시간 업데이트
 */
function updateLastActiveTime(
  world: MainSceneWorld,
  currentTime: number
): void {
  const appEntities = appStateQuery(world);

  if (appEntities.length > 0) {
    const appEid = appEntities[0];
    AppStateComp.lastActiveTime[appEid] = currentTime;
  }
}

/**
 * 앱이 비활성화될 때 호출하는 함수
 */
export function onAppPause(world: MainSceneWorld, currentTime: number): void {
  updateLastActiveTime(world, currentTime);
}

/**
 * 앱이 다시 활성화될 때 호출하는 함수
 */
export function onAppResume(world: MainSceneWorld, currentTime: number): void {
  appStateSyncSystem({ world, currentTime, isAppResuming: true });
}
