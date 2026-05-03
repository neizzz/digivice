import { defineQuery, exitQuery } from "bitecs";
import * as PIXI from "pixi.js";
import { GAME_CONSTANTS } from "../config";
import {
  CharacterStatusComp,
  ObjectComp,
  PositionComp,
  RenderComp,
} from "../raw-components";
import { ObjectType, TextureKey } from "../types";
import { MainSceneWorld } from "../world";
import { getCharacterWorldBounds } from "./CharacterDisplayBounds";

const STAMINA_GAUGE_HEIGHT = 6;
const STAMINA_GAUGE_MIN_WIDTH = 24;
const STAMINA_GAUGE_MAX_WIDTH = 40;
const STAMINA_GAUGE_WIDTH_RATIO = 0.85;
const STAMINA_GAUGE_Y_OFFSET = 10;
const STAMINA_GAUGE_MIN_Y_MARGIN = 4;

const STAMINA_GAUGE_TRACK_COLOR = 0x211d18;
const STAMINA_GAUGE_TRACK_ALPHA = 0.55;
const STAMINA_GAUGE_BORDER_COLOR = 0xf3ead7;
const STAMINA_GAUGE_BORDER_ALPHA = 0.65;
const STAMINA_GAUGE_LOW_COLOR = 0xe2554b;
const STAMINA_GAUGE_MID_COLOR = 0xf2a33a;
const STAMINA_GAUGE_HIGH_COLOR = 0x58b86b;

const entityGaugeStore = new Map<number, PIXI.Graphics>();

const staminaGaugeQuery = defineQuery([
  ObjectComp,
  PositionComp,
  CharacterStatusComp,
  RenderComp,
]);

const staminaGaugeExitQuery = exitQuery(staminaGaugeQuery);

function getEffectiveCharacterZIndex(eid: number): number {
  const configuredZIndex = RenderComp.zIndex[eid];
  return configuredZIndex === ECS_NULL_VALUE
    ? PositionComp.y[eid]
    : configuredZIndex;
}

function getStaminaGaugeMinY(world: MainSceneWorld): number {
  return (
    world.positionBoundary.y +
    STAMINA_GAUGE_HEIGHT / 2 +
    STAMINA_GAUGE_MIN_Y_MARGIN
  );
}

export function clampStaminaGaugeY(
  world: MainSceneWorld,
  preferredY: number,
): number {
  return Math.max(preferredY, getStaminaGaugeMinY(world));
}

export function getStaminaGaugeFillRatio(stamina: number): number {
  return Math.max(0, Math.min(1, stamina / GAME_CONSTANTS.MAX_STAMINA));
}

export function getStaminaGaugeFillColor(stamina: number): number {
  if (stamina < GAME_CONSTANTS.UNHAPPY_STAMINA_THRESHOLD) {
    return STAMINA_GAUGE_LOW_COLOR;
  }

  if (stamina < GAME_CONSTANTS.BOOSTED_STAMINA_THRESHOLD) {
    return STAMINA_GAUGE_MID_COLOR;
  }

  return STAMINA_GAUGE_HIGH_COLOR;
}

function getStaminaGaugeWidth(boundsWidth: number): number {
  const preferredWidth = boundsWidth * STAMINA_GAUGE_WIDTH_RATIO;
  return Math.max(
    STAMINA_GAUGE_MIN_WIDTH,
    Math.min(STAMINA_GAUGE_MAX_WIDTH, preferredWidth),
  );
}

function getOrCreateGauge(
  eid: number,
  stage: PIXI.Container,
): PIXI.Graphics {
  const existingGauge = entityGaugeStore.get(eid);
  if (existingGauge) {
    return existingGauge;
  }

  const gauge = new PIXI.Graphics();
  gauge.eventMode = "none";
  stage.addChild(gauge);
  entityGaugeStore.set(eid, gauge);
  return gauge;
}

function removeGauge(eid: number): void {
  const gauge = entityGaugeStore.get(eid);
  if (!gauge) {
    return;
  }

  gauge.removeFromParent();
  gauge.destroy();
  entityGaugeStore.delete(eid);
}

export function cleanupStaminaGaugeRenderState(): void {
  entityGaugeStore.forEach((gauge) => {
    gauge.removeFromParent();
    gauge.destroy();
  });
  entityGaugeStore.clear();
}

export function staminaGaugeRenderSystem(params: {
  world: MainSceneWorld;
  delta: number;
}): typeof params {
  const { world } = params;
  const exitedEntities = staminaGaugeExitQuery(world);

  for (let i = 0; i < exitedEntities.length; i++) {
    removeGauge(exitedEntities[i]);
  }

  const entities = staminaGaugeQuery(world);
  const activeGaugeEntities = new Set<number>();

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
      removeGauge(eid);
      continue;
    }

    if (RenderComp.textureKey[eid] === TextureKey.TOMB) {
      removeGauge(eid);
      continue;
    }

    const bounds = getCharacterWorldBounds(eid);
    if (bounds.width <= 0 || bounds.height <= 0) {
      removeGauge(eid);
      continue;
    }

    const gauge = getOrCreateGauge(eid, world.stage);
    const gaugeWidth = getStaminaGaugeWidth(bounds.width);
    const gaugeRatio = getStaminaGaugeFillRatio(CharacterStatusComp.stamina[eid]);
    const fillWidth = gaugeWidth * gaugeRatio;
    const radius = STAMINA_GAUGE_HEIGHT / 2;

    gauge.clear();
    gauge
      .roundRect(
        -gaugeWidth / 2,
        -STAMINA_GAUGE_HEIGHT / 2,
        gaugeWidth,
        STAMINA_GAUGE_HEIGHT,
        radius,
      )
      .fill({
        color: STAMINA_GAUGE_TRACK_COLOR,
        alpha: STAMINA_GAUGE_TRACK_ALPHA,
      })
      .stroke({
        color: STAMINA_GAUGE_BORDER_COLOR,
        alpha: STAMINA_GAUGE_BORDER_ALPHA,
        width: 1,
      });

    if (fillWidth > 0) {
      gauge
        .rect(
          -gaugeWidth / 2,
          -STAMINA_GAUGE_HEIGHT / 2,
          fillWidth,
          STAMINA_GAUGE_HEIGHT,
        )
        .fill({ color: getStaminaGaugeFillColor(CharacterStatusComp.stamina[eid]) });
    }

    gauge.position.set(
      PositionComp.x[eid],
      clampStaminaGaugeY(world, bounds.topY - STAMINA_GAUGE_Y_OFFSET),
    );
    gauge.zIndex = getEffectiveCharacterZIndex(eid) - 1;
    gauge.visible = true;
    activeGaugeEntities.add(eid);
  }

  const trackedEids = Array.from(entityGaugeStore.keys());
  for (let i = 0; i < trackedEids.length; i++) {
    const eid = trackedEids[i];
    if (!activeGaugeEntities.has(eid)) {
      removeGauge(eid);
    }
  }

  return params;
}