import { defineQuery, exitQuery } from "bitecs";
import * as PIXI from "pixi.js";
import { ObjectComp, PositionComp, RenderComp } from "../raw-components";
import { ObjectType } from "../types";
import { MainSceneWorld } from "../world";
import {
  NAME_LABEL_FILL_COLOR,
  NAME_LABEL_FONT_FAMILIES,
  NAME_LABEL_FONT_SIZE,
  NAME_LABEL_STROKE_COLOR,
  NAME_LABEL_STROKE_WIDTH,
  truncateNameLabelToWidth,
} from "../../../utils/nameLabel";
import { getAnimatedSpriteStore } from "./AnimationRenderSystem";
import { getSpriteStore } from "./RenderSystem";

const characterQuery = defineQuery([ObjectComp, PositionComp, RenderComp]);
const characterExitQuery = exitQuery(characterQuery);

const labelStore = new Map<number, PIXI.Text>();

const NAME_LABEL_STYLE = new PIXI.TextStyle({
  fontFamily: [...NAME_LABEL_FONT_FAMILIES],
  fontSize: NAME_LABEL_FONT_SIZE,
  fill: NAME_LABEL_FILL_COLOR,
  align: "center",
  stroke: { color: NAME_LABEL_STROKE_COLOR, width: NAME_LABEL_STROKE_WIDTH },
});

const FALLBACK_CHARACTER_HEIGHT = 48;
const LABEL_MARGIN = 8;
const LABEL_VERTICAL_OFFSET = 26;
const LABEL_Z_INDEX_OFFSET = 1000;

export function characterNameLabelSystem(params: {
  world: MainSceneWorld;
  delta: number;
}): typeof params {
  const { world } = params;
  const exitedEntities = characterExitQuery(world);

  for (let i = 0; i < exitedEntities.length; i++) {
    removeCharacterNameLabel(exitedEntities[i]);
  }

  const rawName = world.getInMemoryData().world_metadata.monster_name?.trim();
  const displayName = rawName ? truncateDisplayName(rawName) : "";
  const entities = characterQuery(world);

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
      removeCharacterNameLabel(eid);
      continue;
    }

    if (!displayName) {
      removeCharacterNameLabel(eid);
      continue;
    }

    const displayObject = getCharacterDisplayObject(eid);
    if (!displayObject) {
      removeCharacterNameLabel(eid);
      continue;
    }

    const label = getOrCreateCharacterNameLabel(eid, world.stage);
    if (label.text !== displayName) {
      label.text = displayName;
    }

    updateCharacterNameLabel(label, eid, displayObject);
  }

  return params;
}

export function cleanupCharacterNameLabels(): void {
  labelStore.forEach((label) => {
    label.removeFromParent();
    label.destroy();
  });
  labelStore.clear();
}

function getOrCreateCharacterNameLabel(
  eid: number,
  stage: PIXI.Container
): PIXI.Text {
  const existingLabel = labelStore.get(eid);
  if (existingLabel) {
    return existingLabel;
  }

  const label = new PIXI.Text({
    text: "",
    style: NAME_LABEL_STYLE,
    anchor: { x: 0.5, y: 0 },
  });

  label.roundPixels = true;
  stage.addChild(label);
  labelStore.set(eid, label);
  return label;
}

function removeCharacterNameLabel(eid: number): void {
  const label = labelStore.get(eid);
  if (!label) {
    return;
  }

  label.removeFromParent();
  label.destroy();
  labelStore.delete(eid);
}

function updateCharacterNameLabel(
  label: PIXI.Text,
  eid: number,
  displayObject: PIXI.Container
): void {
  const x = PositionComp.x[eid];
  const y = PositionComp.y[eid];
  const configuredZIndex = RenderComp.zIndex[eid];
  const effectiveZIndex =
    configuredZIndex === ECS_NULL_VALUE ? y : configuredZIndex;
  const characterHeight = getDisplayObjectHeight(displayObject, eid);

  label.position.set(
    x,
    y + characterHeight / 2 + LABEL_MARGIN - LABEL_VERTICAL_OFFSET
  );
  label.zIndex = effectiveZIndex + LABEL_Z_INDEX_OFFSET;
  label.visible = true;
}

function getCharacterDisplayObject(
  eid: number
): PIXI.Sprite | PIXI.AnimatedSprite | undefined {
  return (
    getSpriteStore().get(eid) ??
    getAnimatedSpriteStore().get(eid)
  );
}

function getDisplayObjectHeight(
  displayObject: PIXI.Container,
  eid: number
): number {
  const height = "height" in displayObject ? Number(displayObject.height) : NaN;

  if (Number.isFinite(height) && height > 0) {
    return height;
  }

  const scale = RenderComp.scale[eid];
  return scale > 0 ? scale * 16 : FALLBACK_CHARACTER_HEIGHT;
}

function truncateDisplayName(name: string): string {
  return truncateNameLabelToWidth(name);
}
