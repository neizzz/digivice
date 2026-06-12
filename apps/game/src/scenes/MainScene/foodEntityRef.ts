import { defineQuery, hasComponent, type IWorld } from "bitecs";
import { DestinationComp, FoodEatingComp, ObjectComp } from "./raw-components";
import { DestinationType, ObjectType } from "./types";

const objectQuery = defineQuery([ObjectComp]);

function isValidObjectId(objectId: number): boolean {
  return Number.isFinite(objectId) && objectId > 0;
}

export function isValidFoodEntityRef(world: IWorld, eid: number): boolean {
  return (
    hasComponent(world, ObjectComp, eid) &&
    ObjectComp.type[eid] === ObjectType.FOOD
  );
}

export function findFoodEntityRefByObjectId(
  world: IWorld,
  objectId: number,
): number | null {
  if (!isValidObjectId(objectId)) {
    return null;
  }

  const objectEntities = objectQuery(world);
  for (let i = 0; i < objectEntities.length; i++) {
    const eid = objectEntities[i];
    if (
      ObjectComp.type[eid] === ObjectType.FOOD &&
      ObjectComp.id[eid] === objectId
    ) {
      return eid;
    }
  }

  return null;
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

  const targetObjectId = DestinationComp.targetObjectId[characterEid];
  const targetFoodByObjectId = findFoodEntityRefByObjectId(
    world,
    targetObjectId,
  );
  if (targetFoodByObjectId !== null) {
    return targetFoodByObjectId;
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

  const targetFoodObjectId = FoodEatingComp.targetFoodObjectId[characterEid];
  const targetFoodByObjectId = findFoodEntityRefByObjectId(
    world,
    targetFoodObjectId,
  );
  if (targetFoodByObjectId !== null) {
    return targetFoodByObjectId;
  }

  const targetFoodEid = FoodEatingComp.targetFood[characterEid];
  return isValidFoodEntityRef(world, targetFoodEid) ? targetFoodEid : null;
}
