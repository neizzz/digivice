import { defineQuery, exitQuery } from "bitecs";
import * as PIXI from "pixi.js";
import { ObjectComp, PositionComp, RenderComp } from "../raw-components";
import { CharacterState, ObjectType } from "../types";
import { MainSceneWorld } from "../world";
import { getCharacterVerticalBounds } from "./CharacterDisplayBounds";

const SLEEP_FRAME_INTERVAL = 1000;
const SLEEP_TOP_OFFSET = 4;
const SLEEP_HORIZONTAL_OFFSET = -6;
const SLEEP_GRADIENT_TOP_COLOR = 0x1f4f8f;
const SLEEP_GRADIENT_BOTTOM_COLOR = 0x7dcfff;
const SLEEP_STROKE_COLOR = 0x000000;
const SLEEP_STROKE_WIDTH = 1;
const SLEEP_SMALL_Z_FONT_SIZE = 10.8;
const SLEEP_MEDIUM_Z_FONT_SIZE = 16.2;
const SLEEP_LARGE_Z_FONT_SIZE = 19.44;
const SLEEP_FONT_FAMILY = [
  "NeoDunggeunmo Pro",
  "Apple Color Emoji",
  "Segoe UI Emoji",
  "Noto Color Emoji",
  "sans-serif",
];

const SLEEP_BASE_TEXT_STYLE: Partial<PIXI.TextStyleOptions> = {
  fontFamily: SLEEP_FONT_FAMILY,
  align: "center",
};

const SLEEP_FRAME_DEFINITIONS = [
  {
    letters: [
      { char: "Z", fontSize: SLEEP_SMALL_Z_FONT_SIZE, offsetX: 0, offsetY: 0 },
    ],
  },
  {
    letters: [
      { char: "Z", fontSize: SLEEP_SMALL_Z_FONT_SIZE, offsetX: 0, offsetY: 0 },
      { char: "Z", fontSize: SLEEP_MEDIUM_Z_FONT_SIZE, offsetX: 12, offsetY: -10 },
    ],
  },
  {
    letters: [
      { char: "Z", fontSize: SLEEP_SMALL_Z_FONT_SIZE, offsetX: 0, offsetY: 0 },
      { char: "Z", fontSize: SLEEP_MEDIUM_Z_FONT_SIZE, offsetX: 12, offsetY: -10 },
      { char: "Z", fontSize: SLEEP_LARGE_Z_FONT_SIZE, offsetX: -10, offsetY: -24 },
    ],
  },
  {
    letters: [],
  },
] as const;

interface SleepEffect {
  container: PIXI.Container;
  letters: PIXI.Text[];
  currentFrameIndex: number;
  lastFrameChangeTime: number;
}

const sleepEffectMap = new Map<number, SleepEffect>();

const characterQuery = defineQuery([ObjectComp, PositionComp, RenderComp]);
const characterExitQuery = exitQuery(characterQuery);

export function sleepEffectSystem(params: {
  world: MainSceneWorld;
  delta: number;
  stage: PIXI.Container | null;
}): typeof params {
  const { world, stage } = params;

  if (!stage) {
    return params;
  }

  const exitedEntities = characterExitQuery(world);
  for (let i = 0; i < exitedEntities.length; i++) {
    removeSleepEffect(exitedEntities[i]);
  }

  if (!world.isSleepDebugEffectEnabled()) {
    cleanupSleepEffectEntities();
    return params;
  }

  const entities = characterQuery(world);
  const activeSleepingEntities = new Set<number>();
  const currentTime = Date.now();

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
      removeSleepEffect(eid);
      continue;
    }

    if (ObjectComp.state[eid] !== CharacterState.SLEEPING) {
      removeSleepEffect(eid);
      continue;
    }

    activeSleepingEntities.add(eid);

    const sleepEffect = getOrCreateSleepEffect(eid, stage, currentTime);
    updateSleepEffectFrame(sleepEffect, currentTime);
    updateSleepEffectPosition(sleepEffect.container, eid);
  }

  const trackedEntities = Array.from(sleepEffectMap.keys());
  for (let i = 0; i < trackedEntities.length; i++) {
    const eid = trackedEntities[i];
    if (!activeSleepingEntities.has(eid)) {
      removeSleepEffect(eid);
    }
  }

  return params;
}

export function cleanupSleepEffects(_stage: PIXI.Container): void {
  cleanupSleepEffectEntities();
}

export function cleanupSleepEffectStateForTests(): void {
  cleanupSleepEffectEntities();
}

function cleanupSleepEffectEntities(): void {
  sleepEffectMap.forEach((_, eid) => {
    removeSleepEffect(eid);
  });
}

function getOrCreateSleepEffect(
  eid: number,
  stage: PIXI.Container,
  currentTime: number,
): SleepEffect {
  const existingEffect = sleepEffectMap.get(eid);
  if (existingEffect) {
    return existingEffect;
  }

  const container = new PIXI.Container();
  container.eventMode = "none";
  stage.addChild(container);

  const sleepEffect: SleepEffect = {
    container,
    letters: [],
    currentFrameIndex: 0,
    lastFrameChangeTime: currentTime,
  };
  rebuildSleepEffectLetters(sleepEffect);

  sleepEffectMap.set(eid, sleepEffect);

  return sleepEffect;
}

function removeSleepEffect(eid: number): void {
  const sleepEffect = sleepEffectMap.get(eid);
  if (!sleepEffect) {
    return;
  }

  sleepEffect.container.removeFromParent();
  sleepEffect.container.destroy({ children: true });
  sleepEffectMap.delete(eid);
}

function updateSleepEffectFrame(
  sleepEffect: SleepEffect,
  currentTime: number,
): void {
  if (currentTime - sleepEffect.lastFrameChangeTime < SLEEP_FRAME_INTERVAL) {
    return;
  }

  sleepEffect.currentFrameIndex =
    (sleepEffect.currentFrameIndex + 1) % SLEEP_FRAME_DEFINITIONS.length;
  sleepEffect.lastFrameChangeTime = currentTime;
  rebuildSleepEffectLetters(sleepEffect);
}

function updateSleepEffectPosition(
  container: PIXI.Container,
  eid: number,
): void {
  const x = PositionComp.x[eid];
  const y = PositionComp.y[eid];
  const configuredZIndex = RenderComp.zIndex[eid];
  const effectiveZIndex =
    configuredZIndex === ECS_NULL_VALUE ? y : configuredZIndex;
  const { topY } = getCharacterVerticalBounds(eid);

  container.position.set(x + SLEEP_HORIZONTAL_OFFSET, topY + SLEEP_TOP_OFFSET);
  container.zIndex = effectiveZIndex + 2;
  container.visible = true;
}

function rebuildSleepEffectLetters(sleepEffect: SleepEffect): void {
  sleepEffect.letters = renderSleepTextFrame(
    sleepEffect.container,
    sleepEffect.currentFrameIndex,
  );
}

function renderSleepTextFrame(
  container: PIXI.Container,
  frameIndex: number,
): PIXI.Text[] {
  const frameDefinition = SLEEP_FRAME_DEFINITIONS[frameIndex];
  const { letters: letterDefinitions } = frameDefinition;

  container.removeChildren().forEach((child) => child.destroy());
  container.pivot.set(0, 0);

  if (letterDefinitions.length === 0) {
    return [];
  }

  const letters = letterDefinitions.map((letterDef) => {
    const text = new PIXI.Text({
      text: letterDef.char,
      style: createSleepTextStyle(letterDef.fontSize),
    });

    text.roundPixels = true;
    container.addChild(text);
    return text;
  });

  const positionedLetters: Array<{
    x: number;
    y: number;
    width: number;
  }> = [];

  for (let i = 0; i < letters.length; i++) {
    const letter = letters[i];
    const offsetX = letterDefinitions[i].offsetX;
    const offsetY = letterDefinitions[i].offsetY;
    const x = offsetX;
    const y = offsetY;
    letter.position.set(x, y);
    positionedLetters.push({ x, y, width: letter.width });
  }

  const maxBottom = Math.max(
    ...letters.map((letter, index) => letterDefinitions[index].offsetY + letter.height),
  );

  for (let i = 0; i < letters.length; i++) {
    letters[i].y -= maxBottom;
  }

  return letters;
}

function createSleepTextStyle(fontSize: number): PIXI.TextStyle {
  const fill = new PIXI.FillGradient({
    type: "linear",
    textureSpace: "local",
    start: { x: 0, y: 0 },
    end: { x: 0, y: fontSize },
    colorStops: [
      { offset: 0, color: SLEEP_GRADIENT_TOP_COLOR },
      { offset: 1, color: SLEEP_GRADIENT_BOTTOM_COLOR },
    ],
  });

  return new PIXI.TextStyle({
    ...SLEEP_BASE_TEXT_STYLE,
    fontSize,
    fill,
    stroke: {
      color: SLEEP_STROKE_COLOR,
      width: SLEEP_STROKE_WIDTH,
    },
  });
}
