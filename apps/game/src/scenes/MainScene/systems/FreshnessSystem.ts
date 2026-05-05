import { addComponent, defineQuery, hasComponent } from "bitecs";
import {
  DestinationComp,
  FoodEatingComp,
  FreshnessComp,
  FreshnessTimerComp,
  ObjectComp,
} from "../raw-components";
import { GAME_CONSTANTS } from "../config";
import { MainSceneWorld } from "../world";
import { FoodState, Freshness, ObjectType } from "../types";

const foodQuery = defineQuery([ObjectComp, FreshnessComp]);
const foodWithTimerQuery = defineQuery([
  ObjectComp,
  FreshnessComp,
  FreshnessTimerComp,
]);

/**
 * 음식 신선도 시스템
 * - 새 음식은 NORMAL로 시작하고 총 edible lifetime 이후 STALE이 된다.
 * - 캐릭터가 먹고 있는 음식은 신선도가 변하지 않음
 * - 캐릭터가 다가가는 도중 STALE이 되면 타게팅 취소
 */
export function freshnessSystem(params: {
  world: MainSceneWorld;
  currentTime: number;
}): typeof params {
  const { world, currentTime } = params;

  normalizeLegacyFreshFood(world);
  initializeFreshnessTimes(world, currentTime);
  updateFreshness(world, currentTime);
  cancelTargetingForStalFood(world);

  return params;
}

function normalizeLegacyFreshFood(world: MainSceneWorld): void {
  const foodEntities = foodQuery(world);

  for (let i = 0; i < foodEntities.length; i++) {
    const eid = foodEntities[i];

    if (ObjectComp.type[eid] !== ObjectType.FOOD) continue;

    if (FreshnessComp.freshness[eid] === Freshness.FRESH) {
      FreshnessComp.freshness[eid] = Freshness.NORMAL;
    }
  }
}

/**
 * 타이머가 없는 음식들에 타이머 추가
 */
function initializeFreshnessTimes(
  world: MainSceneWorld,
  currentTime: number,
): void {
  const foodEntities = foodQuery(world);

  for (let i = 0; i < foodEntities.length; i++) {
    const eid = foodEntities[i];

    if (ObjectComp.type[eid] !== ObjectType.FOOD) continue;

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

    const isBeingEaten = isBeingEatenByCharacter(world, eid);
    timerComp.isBeingEaten[eid] = isBeingEaten ? 1 : 0;

    if (isBeingEaten) continue;

    let currentFreshness = freshnessComp.freshness[eid];
    if (currentFreshness === Freshness.FRESH) {
      currentFreshness = Freshness.NORMAL;
      freshnessComp.freshness[eid] = currentFreshness;
    }

    if (
      currentFreshness === Freshness.STALE &&
      ObjectComp.state[eid] !== FoodState.BEING_THROWING &&
      ObjectComp.state[eid] !== FoodState.LANDED
    ) {
      ObjectComp.state[eid] = FoodState.LANDED;
      continue;
    }

    const elapsedTime = currentTime - timerComp.createdTime[eid];
    const totalEdibleTime = timerComp.normalTime[eid] + timerComp.staleTime[eid];

    if (elapsedTime >= totalEdibleTime) {
      freshnessComp.freshness[eid] = Freshness.STALE;
      ObjectComp.state[eid] = FoodState.LANDED;
    }
  }
}

/**
 * 음식이 캐릭터에게 먹히고 있는지 확인
 */
function isBeingEatenByCharacter(
  world: MainSceneWorld,
  foodEid: number,
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

    if (
      targetEid &&
      hasComponent(world, ObjectComp, targetEid) &&
      ObjectComp.type[targetEid] === ObjectType.FOOD &&
      hasComponent(world, FreshnessComp, targetEid) &&
      FreshnessComp.freshness[targetEid] === Freshness.STALE
    ) {
      DestinationComp.target[eid] = 0;
      DestinationComp.type[eid] = 0;
      ObjectComp.state[targetEid] = FoodState.LANDED;
    }
  }
}

/**
 * 음식이 먹을 수 있는 상태인지 확인 (상하지 않은)
 */
export function isFoodEdible(freshness: Freshness): boolean {
  return freshness !== Freshness.STALE;
}
