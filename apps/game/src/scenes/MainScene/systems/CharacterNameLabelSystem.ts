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
import {
  getCharacterDisplayObject,
  getCharacterVerticalBounds,
} from "./CharacterDisplayBounds";

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

const NAME_LABEL_BOTTOM_OFFSET = 2;
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

    updateCharacterNameLabel(label, eid);
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

function updateCharacterNameLabel(label: PIXI.Text, eid: number): void {
  const x = PositionComp.x[eid];
  const y = PositionComp.y[eid];
  const configuredZIndex = RenderComp.zIndex[eid];
  const effectiveZIndex =
    configuredZIndex === ECS_NULL_VALUE ? y : configuredZIndex;
  const { bottomY } = getCharacterVerticalBounds(eid);

  label.position.set(x, bottomY + NAME_LABEL_BOTTOM_OFFSET);
  label.zIndex = effectiveZIndex + LABEL_Z_INDEX_OFFSET;
  label.visible = true;
}

function truncateDisplayName(name: string): string {
  return truncateNameLabelToWidth(name);
}
