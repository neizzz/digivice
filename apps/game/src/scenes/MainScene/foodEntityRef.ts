import { hasComponent, type IWorld } from "bitecs";
import { DestinationComp, FoodEatingComp, ObjectComp } from "./raw-components";
import { DestinationType, ObjectType } from "./types";

export function isValidFoodEntityRef(world: IWorld, eid: number): boolean {
  return (
    hasComponent(world, ObjectComp, eid) &&
    ObjectComp.type[eid] === ObjectType.FOOD
  );
}

export function getTargetedFoodEntityRef(
  world: IWorld,
  characterEid: number,
): number | null {
  if (
    !hasComponent(world, DestinationComp, characterEid) ||
    DestinationComp.type[characterEid] !== DestinationType.TARGETED
  ) {
    return null;
  }

  const targetFoodEid = DestinationComp.target[characterEid];
  return isValidFoodEntityRef(world, targetFoodEid) ? targetFoodEid : null;
}

export function getFoodEatingEntityRef(
  world: IWorld,
  characterEid: number,
): number | null {
  if (!hasComponent(world, FoodEatingComp, characterEid)) {
    return null;
  }

  const targetFoodEid = FoodEatingComp.targetFood[characterEid];
  return isValidFoodEntityRef(world, targetFoodEid) ? targetFoodEid : null;
}
