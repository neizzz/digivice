import { defineQuery, exitQuery, hasComponent } from "bitecs";
import * as PIXI from "pixi.js";
import {
  FreshnessComp,
  ObjectComp,
  PositionComp,
  RenderComp,
} from "../raw-components";
import { MainSceneWorld } from "../world";
import { Freshness, ObjectType } from "../types";

const positionedObjectQuery = defineQuery([ObjectComp, PositionComp]);
const positionedObjectExitQuery = exitQuery(positionedObjectQuery);

const STALE_FOOD_SMELL_LINE_COUNT = 3;
const STALE_FOOD_SMELL_COLOR = 0xc58cff;
const POOB_SMELL_COLOR = 0xa66a2f;
const STALE_FOOD_SMELL_PIXEL_SIZE = 2;
const STALE_FOOD_SMELL_BLOCK_COUNT = 7;
const STALE_FOOD_SMELL_BLOCK_GAP = STALE_FOOD_SMELL_PIXEL_SIZE;
const STALE_FOOD_SMELL_BLOCK_HEIGHT = STALE_FOOD_SMELL_PIXEL_SIZE + 1;
const STALE_FOOD_SMELL_SPACING = 8;
const STALE_FOOD_SMELL_Z_INDEX_OFFSET = 24;
const STALE_FOOD_SMELL_STEP_PATTERN = [-1, -1, 0, 0, 1, 1, 0, 0];

type StaleFoodSmellVisual = {
  container: PIXI.Container;
  graphics: PIXI.Graphics;
  phaseOffset: number;
};

type SmellConfig = {
  color: number;
  yOffset: number;
  zIndex: number;
};

const entityStaleFoodSmellVisuals: Map<number, StaleFoodSmellVisual> =
  new Map();

/**
 * fresh sparkle 효과는 제거하고, stale food/poob 냄새선만 유지한다.
 */
export function sparkleEffectSystem(params: {
  world: MainSceneWorld;
  currentTime: number;
}): typeof params {
  const { world, currentTime } = params;

  updateDirtyObjectSmellEffects(world, currentTime);

  return params;
}

function updateDirtyObjectSmellEffects(
  world: MainSceneWorld,
  currentTime: number,
): void {
  const exitedObjects = positionedObjectExitQuery(world);
  for (let i = 0; i < exitedObjects.length; i++) {
    removeStaleFoodSmellEffect(exitedObjects[i]);
  }

  const objects = positionedObjectQuery(world);
  for (let i = 0; i < objects.length; i++) {
    const eid = objects[i];
    const smellConfig = getSmellConfig(world, eid);

    if (!smellConfig) {
      removeStaleFoodSmellEffect(eid);
      continue;
    }

    createOrUpdateStaleFoodSmellEffect(world, eid, currentTime, smellConfig);
  }

  entityStaleFoodSmellVisuals.forEach((_visual, eid) => {
    if (
      !hasComponent(world, ObjectComp, eid) ||
      !hasComponent(world, PositionComp, eid) ||
      !getSmellConfig(world, eid)
    ) {
      removeStaleFoodSmellEffect(eid);
    }
  });
}

function createOrUpdateStaleFoodSmellEffect(
  world: MainSceneWorld,
  eid: number,
  currentTime: number,
  smellConfig: SmellConfig,
): void {
  let visual = entityStaleFoodSmellVisuals.get(eid);

  if (!visual) {
    const container = new PIXI.Container();
    const graphics = new PIXI.Graphics();

    container.eventMode = "none";
    container.addChild(graphics);
    world.stage.addChild(container);
    world.stage.sortableChildren = true;

    visual = {
      container,
      graphics,
      phaseOffset: Math.random() * Math.PI * 2,
    };
    entityStaleFoodSmellVisuals.set(eid, visual);
  }

  visual.container.position.set(
    Math.round(PositionComp.x[eid]),
    Math.round(PositionComp.y[eid] + smellConfig.yOffset),
  );
  visual.container.zIndex = smellConfig.zIndex;
  visual.container.visible = true;

  drawStaleFoodSmellLines(
    visual.graphics,
    currentTime,
    visual.phaseOffset,
    smellConfig.color,
  );
}

function getSmellConfig(world: MainSceneWorld, eid: number): SmellConfig | null {
  if (ObjectComp.type[eid] === ObjectType.FOOD) {
    if (
      !hasComponent(world, FreshnessComp, eid) ||
      FreshnessComp.freshness[eid] !== Freshness.STALE
    ) {
      return null;
    }

    return {
      color: STALE_FOOD_SMELL_COLOR,
      yOffset: getStaleFoodSmellYOffset(world, eid),
      zIndex: getFoodEffectZIndex(world, eid),
    };
  }

  if (ObjectComp.type[eid] === ObjectType.POOB) {
    return {
      color: POOB_SMELL_COLOR,
      yOffset: getStaleFoodSmellYOffset(world, eid),
      zIndex: getFoodEffectZIndex(world, eid),
    };
  }

  return null;
}

function getStaleFoodSmellYOffset(world: MainSceneWorld, eid: number): number {
  const scale =
    hasComponent(world, RenderComp, eid) &&
    Number.isFinite(RenderComp.scale[eid]) &&
    RenderComp.scale[eid] > 0
      ? RenderComp.scale[eid]
      : 1;

  return -(4 * scale + 5);
}

function getFoodEffectZIndex(world: MainSceneWorld, eid: number): number {
  if (!hasComponent(world, RenderComp, eid)) {
    return Math.floor(PositionComp.y[eid]) + STALE_FOOD_SMELL_Z_INDEX_OFFSET;
  }

  const configuredZIndex = RenderComp.zIndex[eid];
  const foodZIndex =
    configuredZIndex === undefined || configuredZIndex === ECS_NULL_VALUE
      ? Math.floor(PositionComp.y[eid])
      : configuredZIndex;

  return foodZIndex + STALE_FOOD_SMELL_Z_INDEX_OFFSET;
}

function drawStaleFoodSmellLines(
  graphics: PIXI.Graphics,
  currentTime: number,
  phaseOffset: number,
  color: number,
): void {
  graphics.clear();

  const frameOffsetBase = Math.floor(currentTime / 260 + phaseOffset);
  const verticalNudge = frameOffsetBase % 2;

  for (let i = 0; i < STALE_FOOD_SMELL_LINE_COUNT; i++) {
    const normalizedIndex = i - (STALE_FOOD_SMELL_LINE_COUNT - 1) / 2;
    const baseX = normalizedIndex * STALE_FOOD_SMELL_SPACING;
    const frameOffset = frameOffsetBase % STALE_FOOD_SMELL_STEP_PATTERN.length;

    for (let block = 0; block < STALE_FOOD_SMELL_BLOCK_COUNT; block++) {
      const patternIndex =
        (block + frameOffset) % STALE_FOOD_SMELL_STEP_PATTERN.length;
      const x =
        baseX +
        STALE_FOOD_SMELL_STEP_PATTERN[patternIndex] *
          STALE_FOOD_SMELL_PIXEL_SIZE;
      const y = -(block * STALE_FOOD_SMELL_BLOCK_GAP + verticalNudge);
      const progress = block / (STALE_FOOD_SMELL_BLOCK_COUNT - 1);
      const alpha = 0.9 - progress * 0.34;

      graphics
        .rect(
          Math.round(x - STALE_FOOD_SMELL_PIXEL_SIZE / 2),
          Math.round(y),
          STALE_FOOD_SMELL_PIXEL_SIZE,
          STALE_FOOD_SMELL_BLOCK_HEIGHT,
        )
        .fill({
          color,
          alpha,
        });
    }
  }
}

function removeStaleFoodSmellEffect(eid: number): void {
  const visual = entityStaleFoodSmellVisuals.get(eid);
  if (!visual) {
    return;
  }

  if (visual.container.parent) {
    visual.container.parent.removeChild(visual.container);
  }
  visual.container.destroy({ children: true });
  entityStaleFoodSmellVisuals.delete(eid);
}
