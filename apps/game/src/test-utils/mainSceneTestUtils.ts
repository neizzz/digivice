import { createWorld, type IWorld } from "bitecs";
import * as PIXI from "pixi.js";
import { createCharacterEntity } from "../scenes/MainScene/entityFactory";
import { getEvolutionSpec } from "../scenes/MainScene/evolutionConfig";
import {
  AnimationKey,
  CharacterKeyECS,
  CharacterState,
  ObjectType,
  type Boundary,
  SpritesheetKey,
  TextureKey,
} from "../scenes/MainScene/types";
import { TimeOfDay, TimeOfDayMode } from "../scenes/MainScene/timeOfDay";

export type TestWorld = IWorld & {
  _currentTime: number;
  _timeOfDay: TimeOfDay;
  _timeOfDayMode: TimeOfDayMode;
  _projectedUpcomingSunTimes: {
    sunriseAt: number;
    sunsetAt: number;
    nextSunriseAt: number;
    nextSunsetAt: number;
  } | null;
  isSimulationMode: boolean;
  positionBoundary: Boundary;
  applyPendingRecoverySyringeImpact: (eid: number) => void;
  handleThrownFoodLanded: (eid: number) => void;
  handleFoodConsumedForAd: (eid: number) => void;
  handleHospitalRecoveryAnimationComplete: (eid: number) => void;
  currentTime: number;
  timeOfDay: TimeOfDay;
  timeOfDayMode: TimeOfDayMode;
  getTimeOfDay: () => TimeOfDay;
  getTimeOfDayMode: () => TimeOfDayMode;
  getProjectedUpcomingSunTimes: (
    referenceTime?: number,
  ) => {
    sunriseAt: number;
    sunsetAt: number;
    nextSunriseAt: number;
    nextSunsetAt: number;
  } | null;
};

export function createTestWorld(options?: {
  now?: number;
  isSimulationMode?: boolean;
  positionBoundary?: Boundary;
  timeOfDay?: TimeOfDay;
  timeOfDayMode?: TimeOfDayMode;
  projectedUpcomingSunTimes?: {
    sunriseAt: number;
    sunsetAt: number;
    nextSunriseAt: number;
    nextSunsetAt: number;
  } | null;
}): TestWorld {
  const world = createWorld({}) as TestWorld;
  const now = options?.now ?? 0;

  world._currentTime = now;
  world._timeOfDay = options?.timeOfDay ?? TimeOfDay.Day;
  world._timeOfDayMode = options?.timeOfDayMode ?? TimeOfDayMode.Manual;
  world._projectedUpcomingSunTimes = options?.projectedUpcomingSunTimes ?? null;
  world.isSimulationMode = options?.isSimulationMode ?? false;
  world.positionBoundary = options?.positionBoundary ?? {
    x: 0,
    y: 0,
    width: 1000,
    height: 1000,
  };
  world.applyPendingRecoverySyringeImpact = () => {};
  world.handleThrownFoodLanded = () => {};
  world.handleFoodConsumedForAd = () => {};
  world.handleHospitalRecoveryAnimationComplete = () => {};

  Object.defineProperty(world, "currentTime", {
    configurable: true,
    enumerable: true,
    get() {
      return world._currentTime;
    },
  });

  Object.defineProperty(world, "timeOfDay", {
    configurable: true,
    enumerable: true,
    get() {
      return world._timeOfDay;
    },
  });

  Object.defineProperty(world, "timeOfDayMode", {
    configurable: true,
    enumerable: true,
    get() {
      return world._timeOfDayMode;
    },
  });

  world.getTimeOfDay = () => world._timeOfDay;
  world.getTimeOfDayMode = () => world._timeOfDayMode;
  world.getProjectedUpcomingSunTimes = (_referenceTime?: number) =>
    world._projectedUpcomingSunTimes;

  return world;
}

export function setWorldTime(world: TestWorld, now: number): void {
  world._currentTime = now;
}

export function setWorldTimeOfDay(world: TestWorld, timeOfDay: TimeOfDay): void {
  world._timeOfDay = timeOfDay;
}

export function setWorldTimeOfDayMode(
  world: TestWorld,
  timeOfDayMode: TimeOfDayMode,
): void {
  world._timeOfDayMode = timeOfDayMode;
}

export function setWorldProjectedUpcomingSunTimes(
  world: TestWorld,
  projectedUpcomingSunTimes: TestWorld["_projectedUpcomingSunTimes"],
): void {
  world._projectedUpcomingSunTimes = projectedUpcomingSunTimes;
}

export function withMockedDateNow<T>(now: number, fn: () => T): T {
  const originalDateNow = Date.now;
  Date.now = () => now;

  try {
    return fn();
  } finally {
    Date.now = originalDateNow;
  }
}

export async function withMockedDateNowAsync<T>(
  now: number,
  fn: () => Promise<T>,
): Promise<T> {
  const originalDateNow = Date.now;
  Date.now = () => now;

  try {
    return await fn();
  } finally {
    Date.now = originalDateNow;
  }
}

export function withMockedRandom<T>(value: number, fn: () => T): T {
  const originalRandom = Math.random;
  Math.random = () => value;

  try {
    return fn();
  } finally {
    Math.random = originalRandom;
  }
}

export async function withMockedRandomAsync<T>(
  value: number,
  fn: () => Promise<T>,
): Promise<T> {
  const originalRandom = Math.random;
  Math.random = () => value;

  try {
    return await fn();
  } finally {
    Math.random = originalRandom;
  }
}

export function createTestCharacter(
  world: TestWorld,
  options?: {
    state?: CharacterState;
    stamina?: number;
    x?: number;
    y?: number;
    characterKey?: CharacterKeyECS;
  },
): number {
  const state = options?.state ?? CharacterState.IDLE;
  const characterKey = options?.characterKey ?? CharacterKeyECS.TestGreenSlimeA1;
  const evolutionPhase = getEvolutionSpec(characterKey)?.phase ?? 1;

  return createCharacterEntity(world, {
    position: {
      x: options?.x ?? 50,
      y: options?.y ?? 50,
    },
    angle: { value: 0 },
    speed: { value: 0 },
    object: {
      id: Date.now() + Math.floor(Math.random() * 1000),
      state,
      type: ObjectType.CHARACTER,
    },
    characterStatus: {
      characterKey,
      stamina: options?.stamina ?? 5,
      evolutionGage: 0,
      evolutionPhase,
      statuses: new Array(ECS_CHARACTER_STATUS_LENGTH).fill(ECS_NULL_VALUE),
    },
    render: {
      storeIndex: ECS_NULL_VALUE,
      textureKey: state === CharacterState.EGG ? TextureKey.EGG0 : TextureKey.NULL,
      scale: 3,
      zIndex: ECS_NULL_VALUE,
    },
    animationRender:
      state !== CharacterState.EGG && state !== CharacterState.DEAD
        ? {
            storeIndex: ECS_NULL_VALUE,
            spritesheetKey: characterKey as unknown as SpritesheetKey,
            animationKey: AnimationKey.IDLE,
            isPlaying: true,
            loop: true,
            speed: 0.04,
          }
        : undefined,
  });
}

export function mockLoadedSpritesheetAliases(aliases: string[]): () => void {
  const dummySpritesheet = Object.create(PIXI.Spritesheet.prototype);
  const originalGet = PIXI.Assets.get.bind(PIXI.Assets);

  (PIXI.Assets as typeof PIXI.Assets & { get: typeof PIXI.Assets.get }).get = ((
    key: string,
  ) => {
    if (aliases.includes(key)) {
      return dummySpritesheet;
    }

    return originalGet(key);
  }) as typeof PIXI.Assets.get;

  return () => {
    (PIXI.Assets as typeof PIXI.Assets & { get: typeof PIXI.Assets.get }).get =
      originalGet;
  };
}
