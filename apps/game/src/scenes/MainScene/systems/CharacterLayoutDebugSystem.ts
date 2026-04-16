import { defineQuery, exitQuery } from "bitecs";
import * as PIXI from "pixi.js";
import { ObjectComp, PositionComp, RenderComp } from "../raw-components";
import { ObjectType } from "../types";
import type { MainSceneWorld } from "../world";
import {
  getCharacterDisplayObject,
  getCharacterWorldBounds,
} from "./CharacterDisplayBounds";

const characterQuery = defineQuery([ObjectComp, PositionComp, RenderComp]);
const characterExitQuery = exitQuery(characterQuery);

const overlayStore = new Map<number, PIXI.Graphics>();

const LAYOUT_STROKE_COLOR = 0x00e5ff;
const LAYOUT_FILL_COLOR = 0x00e5ff;
const LAYOUT_FILL_ALPHA = 0.12;
const LAYOUT_STROKE_WIDTH = 1;
const LAYOUT_Z_INDEX_OFFSET = 1;

export function characterLayoutDebugSystem(params: {
  world: MainSceneWorld;
  stage: PIXI.Container | null;
}): typeof params {
  const { world, stage } = params;

  if (!stage || !import.meta.env.DEV) {
    cleanupCharacterLayoutDebug(stage);
    return params;
  }

  const exitedEntities = characterExitQuery(world);
  for (let i = 0; i < exitedEntities.length; i++) {
    removeOverlay(exitedEntities[i]);
  }

  const entities = characterQuery(world);
  const activeCharacterEids = new Set<number>();

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
      removeOverlay(eid);
      continue;
    }

    const displayObject = getCharacterDisplayObject(eid);
    if (!displayObject) {
      removeOverlay(eid);
      continue;
    }

    const bounds = getCharacterWorldBounds(eid);
    if (bounds.width <= 0 || bounds.height <= 0) {
      removeOverlay(eid);
      continue;
    }

    const overlay = getOrCreateOverlay(eid, stage);
    activeCharacterEids.add(eid);

    overlay.clear();
    overlay
      .rect(bounds.leftX, bounds.topY, bounds.width, bounds.height)
      .fill({ color: LAYOUT_FILL_COLOR, alpha: LAYOUT_FILL_ALPHA })
      .stroke({ color: LAYOUT_STROKE_COLOR, width: LAYOUT_STROKE_WIDTH });

    const y = PositionComp.y[eid];
    const configuredZIndex = RenderComp.zIndex[eid];
    const effectiveZIndex =
      configuredZIndex === ECS_NULL_VALUE ? y : configuredZIndex;
    overlay.zIndex = effectiveZIndex + LAYOUT_Z_INDEX_OFFSET;
    overlay.visible = true;
  }

  const trackedEids = Array.from(overlayStore.keys());
  for (let i = 0; i < trackedEids.length; i++) {
    const eid = trackedEids[i];
    if (!activeCharacterEids.has(eid)) {
      removeOverlay(eid);
    }
  }

  return params;
}

export function cleanupCharacterLayoutDebug(
  _stage: PIXI.Container | null,
): void {
  overlayStore.forEach((_, eid) => {
    removeOverlay(eid);
  });
}

function getOrCreateOverlay(
  eid: number,
  stage: PIXI.Container,
): PIXI.Graphics {
  const existingOverlay = overlayStore.get(eid);
  if (existingOverlay) {
    return existingOverlay;
  }

  const overlay = new PIXI.Graphics();
  overlay.eventMode = "none";
  stage.addChild(overlay);
  overlayStore.set(eid, overlay);
  return overlay;
}

function removeOverlay(eid: number): void {
  const overlay = overlayStore.get(eid);
  if (!overlay) {
    return;
  }

  overlay.removeFromParent();
  overlay.destroy();
  overlayStore.delete(eid);
}
