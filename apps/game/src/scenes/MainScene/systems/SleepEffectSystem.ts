import { defineQuery, exitQuery } from "bitecs";
import * as PIXI from "pixi.js";
import { ObjectComp, PositionComp, RenderComp } from "../raw-components";
import { CharacterState, ObjectType } from "../types";
import { MainSceneWorld } from "../world";
import { getCharacterVerticalBounds } from "./CharacterDisplayBounds";

const SLEEP_FRAME_INTERVAL = 1000;
const SLEEP_TOP_OFFSET = 2;
const SLEEP_HORIZONTAL_OFFSETS = [4, 0] as const;
const SLEEP_TEXT_COLOR = 0xc8c8c8;
const SLEEP_FONT_FAMILY = [
  "Press Start 2P",
  "Apple Color Emoji",
  "Segoe UI Emoji",
  "Noto Color Emoji",
  "sans-serif",
];

const SLEEP_BASE_TEXT_STYLE: Partial<PIXI.TextStyleOptions> = {
  fontFamily: SLEEP_FONT_FAMILY,
  fill: SLEEP_TEXT_COLOR,
  align: "center",
};

const SLEEP_FRAME_DEFINITIONS = [
  {
    gap: 6,
    letters: [
      { char: "z", fontSize: 12, offsetX: 0, offsetY: 0 },
      { char: "z", fontSize: 20, offsetX: 0, offsetY: -12 },
    ],
  },
  {
    gap: 2,
    letters: [
      { char: "z", fontSize: 12, offsetX: 0, offsetY: 0 },
      { char: "z", fontSize: 20, offsetX: 0, offsetY: -14 },
      { char: "z", fontSize: 24, offsetX: -46, offsetY: -24 },
    ],
  },
] as const;

interface SleepEffect {
  container: PIXI.Container;
  letters: PIXI.Text[];
  currentFrameIndex: 0 | 1;
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

  sleepEffect.currentFrameIndex = sleepEffect.currentFrameIndex === 0 ? 1 : 0;
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
  const frameOffsetX =
    SLEEP_HORIZONTAL_OFFSETS[
      sleepEffectMap.get(eid)?.currentFrameIndex ?? 0
    ] ?? 0;

  container.position.set(x + frameOffsetX, topY + SLEEP_TOP_OFFSET);
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
  frameIndex: 0 | 1,
): PIXI.Text[] {
  const frameDefinition = SLEEP_FRAME_DEFINITIONS[frameIndex];
  const { letters: letterDefinitions, gap: letterGap } = frameDefinition;

  container.removeChildren().forEach((child) => child.destroy());

  const letters = letterDefinitions.map((letterDef) => {
    const text = new PIXI.Text({
      text: letterDef.char,
      style: new PIXI.TextStyle({
        ...SLEEP_BASE_TEXT_STYLE,
        fontSize: letterDef.fontSize,
      }),
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

  let currentX = 0;
  for (let i = 0; i < letters.length; i++) {
    const letter = letters[i];
    const offsetX = letterDefinitions[i].offsetX;
    const offsetY = letterDefinitions[i].offsetY;
    const x = currentX + offsetX;
    const y = offsetY;
    letter.position.set(x, y);
    positionedLetters.push({ x, y, width: letter.width });
    currentX += letter.width + letterGap;
  }

  const maxBottom = Math.max(
    ...letters.map((letter, index) => letterDefinitions[index].offsetY + letter.height),
  );

  for (let i = 0; i < letters.length; i++) {
    letters[i].y -= maxBottom;
  }

  const minX = Math.min(...positionedLetters.map(({ x }) => x));
  const maxRight = Math.max(
    ...positionedLetters.map(({ x, width }) => x + width),
  );

  container.pivot.set((minX + maxRight) / 2, 0);
  return letters;
}
