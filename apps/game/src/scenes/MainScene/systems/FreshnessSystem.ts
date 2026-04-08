import { defineQuery, hasComponent, addComponent } from "bitecs";
import {
  ObjectComp,
  FreshnessComp,
  FreshnessTimerComp,
  FoodEatingComp,
  DestinationComp,
  SparkleEffectComp,
} from "../raw-components";
import { MainSceneWorld } from "../world";
import { ObjectType, Freshness, FoodState } from "../types";
import { GAME_CONSTANTS } from "../config";

const foodQuery = defineQuery([ObjectComp, FreshnessComp]);
const foodWithTimerQuery = defineQuery([
  ObjectComp,
  FreshnessComp,
  FreshnessTimerComp,
]);

/**
 * 음식 신선도 시스템
 * - 시간이 지날수록 FRESH -> NORMAL -> STALE으로 변화
 * - 캐릭터가 먹고 있는 음식은 신선도가 변하지 않음
 * - 캐릭터가 다가가는 도중 STALE이 되면 타게팅 취소
 * - 신선한 음식은 SparkleEffect 적용
 */
export function freshnessSystem(params: {
  world: MainSceneWorld;
  currentTime: number;
}): typeof params {
  const { world, currentTime } = params;

  // 기존 음식들의 타이머 초기화 (타이머가 없는 음식들)
  initializeFreshnessTimes(world, currentTime);

  // 신선도 업데이트
  updateFreshness(world, currentTime);

  // 신선한 음식에 SparkleEffect 적용
  applySparkleToFreshFood(world, currentTime);

  // 타게팅된 음식이 상한 경우 타게팅 취소
  cancelTargetingForStalFood(world);

  return params;
}

/**
 * 타이머가 없는 음식들에 타이머 추가
 */
function initializeFreshnessTimes(
  world: MainSceneWorld,
  currentTime: number
): void {
  const foodEntities = foodQuery(world);

  for (let i = 0; i < foodEntities.length; i++) {
    const eid = foodEntities[i];

    if (ObjectComp.type[eid] !== ObjectType.FOOD) continue;

    // 타이머가 없는 음식에 타이머 추가
    if (!hasComponent(world, FreshnessTimerComp, eid)) {
      addComponent(world, FreshnessTimerComp, eid);
      FreshnessTimerComp.createdTime[eid] = currentTime;
      FreshnessTimerComp.normalTime[eid] = GAME_CONSTANTS.FRESH_TO_NORMAL_TIME;
      FreshnessTimerComp.staleTime[eid] = GAME_CONSTANTS.NORMAL_TO_STALE_TIME;
      FreshnessTimerComp.isBeingEaten[eid] = 0;
    }
  }
}

/**
 * 신선도 업데이트
 */
function updateFreshness(world: MainSceneWorld, currentTime: number): void {
  const entities = foodWithTimerQuery(world);

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    if (ObjectComp.type[eid] !== ObjectType.FOOD) continue;

    const timerComp = FreshnessTimerComp;
    const freshnessComp = FreshnessComp;

    // 먹히고 있는 음식은 신선도가 변하지 않음
    const isBeingEaten = isBeingEatenByCharacter(world, eid);
    timerComp.isBeingEaten[eid] = isBeingEaten ? 1 : 0;

    if (isBeingEaten) continue;

    const createdTime = timerComp.createdTime[eid];
    const elapsedTime = currentTime - createdTime;

    const currentFreshness = freshnessComp.freshness[eid];

    // FRESH -> NORMAL
    if (
      currentFreshness === Freshness.FRESH &&
      elapsedTime >= timerComp.normalTime[eid]
    ) {
      freshnessComp.freshness[eid] = Freshness.NORMAL;
    }

    // NORMAL -> STALE
    if (
      currentFreshness === Freshness.NORMAL &&
      elapsedTime >= timerComp.normalTime[eid] + timerComp.staleTime[eid]
    ) {
      freshnessComp.freshness[eid] = Freshness.STALE;

      // 상한 음식은 타겟 대상에서 제외
      ObjectComp.state[eid] = FoodState.LANDED; // 타겟팅 상태 해제
    }
  }
}

/**
 * 음식이 캐릭터에게 먹히고 있는지 확인
 */
function isBeingEatenByCharacter(
  world: MainSceneWorld,
  foodEid: number
): boolean {
  const characterQuery = defineQuery([ObjectComp, FoodEatingComp]);
  const characters = characterQuery(world);

  for (let i = 0; i < characters.length; i++) {
    const eid = characters[i];
    if (
      ObjectComp.type[eid] === ObjectType.CHARACTER &&
      FoodEatingComp.targetFood[eid] === foodEid &&
      FoodEatingComp.isActive[eid] === 1
    ) {
      return true;
    }
  }

  return false;
}

/**
 * 상한 음식에 대한 타게팅 취소
 */
function cancelTargetingForStalFood(world: MainSceneWorld): void {
  const characterQuery = defineQuery([ObjectComp, DestinationComp]);
  const characters = characterQuery(world);

  for (let i = 0; i < characters.length; i++) {
    const eid = characters[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) continue;

    const targetEid = DestinationComp.target[eid];

    // 타겟이 있고, 타겟이 음식인 경우
    if (
      targetEid &&
      hasComponent(world, ObjectComp, targetEid) &&
      ObjectComp.type[targetEid] === ObjectType.FOOD
    ) {
      // 타겟 음식이 상한 상태인지 확인
      if (
        hasComponent(world, FreshnessComp, targetEid) &&
        FreshnessComp.freshness[targetEid] === Freshness.STALE
      ) {
        // 타게팅 취소
        DestinationComp.target[eid] = 0;
        DestinationComp.type[eid] = 0; // DestinationType.NULL

        // 음식 상태도 초기화
        ObjectComp.state[targetEid] = FoodState.LANDED;
      }
    }
  }
}

/**
 * 음식의 현재 신선도에 따른 스테미나 증가량 계산
 */
export function getStaminaBonusFromFreshness(freshness: Freshness): number {
  switch (freshness) {
    case Freshness.FRESH:
      return GAME_CONSTANTS.FRESH_STAMINA_BONUS;
    case Freshness.NORMAL:
      return GAME_CONSTANTS.NORMAL_STAMINA_BONUS;
    case Freshness.STALE:
      return 0; // 상한 음식은 먹을 수 없음
    default:
      return 0;
  }
}

/**
 * 음식이 먹을 수 있는 상태인지 확인 (상하지 않은)
 */
export function isFoodEdible(freshness: Freshness): boolean {
  return freshness === Freshness.FRESH || freshness === Freshness.NORMAL;
}

/**
 * 신선한 음식에 SparkleEffect 적용
 */
function applySparkleToFreshFood(
  world: MainSceneWorld,
  currentTime: number,
): void {
  const foods = foodQuery(world);

  for (let i = 0; i < foods.length; i++) {
    const eid = foods[i];

    if (ObjectComp.type[eid] !== ObjectType.FOOD) continue;
    if (!hasComponent(world, FreshnessComp, eid)) continue;

    const freshness = FreshnessComp.freshness[eid];
    const hasSparkle = hasComponent(world, SparkleEffectComp, eid);

    // 신선한 음식에는 SparkleEffect 추가
    if (freshness === Freshness.FRESH && !hasSparkle) {
      addComponent(world, SparkleEffectComp, eid);
      SparkleEffectComp.isActive[eid] = 1;
      SparkleEffectComp.sparkleCount[eid] = 0;
      SparkleEffectComp.nextSpawnTime[eid] = currentTime + 500; // 0.5초 후 첫 반짝임
      SparkleEffectComp.spawnInterval[eid] = 800; // 0.8초마다 반짝임
      console.log(`[FreshnessSystem] Added SparkleEffect to fresh food ${eid}`);
    }
    // 신선하지 않은 음식에서는 SparkleEffect 제거
    else if (freshness !== Freshness.FRESH && hasSparkle) {
      SparkleEffectComp.isActive[eid] = 0; // SparkleEffectSystem에서 제거 처리
      console.log(
        `[FreshnessSystem] Deactivated SparkleEffect for non-fresh food ${eid}`
      );
    }
  }
}
