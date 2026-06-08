import {
  addComponent,
  defineQuery,
  hasComponent,
  removeComponent,
} from "bitecs";
import {
  CharacterStatusComp,
  DirtyExposureComp,
  FreshnessComp,
  MutationRiskComp,
  ObjectComp,
} from "../raw-components";
import {
  MUTATION_DIRTY_EXPOSURE_STACK_INTERVAL_MS,
  MUTATION_STACK_CAP,
  getMutationDetoxIntervalMs,
} from "../mutationConfig";
import {
  CharacterState,
  FoodState,
  Freshness,
  ObjectType,
} from "../types";
import type { MainSceneWorld } from "../world";

const characterQuery = defineQuery([ObjectComp, CharacterStatusComp]);
const objectQuery = defineQuery([ObjectComp]);

export function mutationRiskSystem(params: {
  world: MainSceneWorld;
  currentTime: number;
}): typeof params {
  const { world, currentTime } = params;

  updateDirtyExposureSources(world, currentTime);
  detoxCharacterMutationStacks(world, currentTime);

  return params;
}

export function recordUnnecessaryMutationInjection(
  world: MainSceneWorld,
  characterEid: number,
  currentTime: number,
): void {
  ensureMutationRiskComp(world, characterEid, currentTime);
  detoxInjectionStacks(characterEid, currentTime);

  MutationRiskComp.unnecessaryInjectionStacks[characterEid] = Math.min(
    MUTATION_STACK_CAP,
    MutationRiskComp.unnecessaryInjectionStacks[characterEid] + 1,
  );
  MutationRiskComp.lastInjectionDetoxTime[characterEid] = currentTime;
}

export function getMutationRiskStacks(
  world: MainSceneWorld,
  characterEid: number,
): {
  unnecessaryInjectionStacks: number;
  dirtyExposureStacks: number;
} {
  const activeDirtyExposureStacks = countActiveDirtyExposureStacks(world);

  return {
    unnecessaryInjectionStacks: hasComponent(
      world,
      MutationRiskComp,
      characterEid,
    )
      ? MutationRiskComp.unnecessaryInjectionStacks[characterEid]
      : 0,
    dirtyExposureStacks: activeDirtyExposureStacks,
  };
}

export function finalizeDirtyExposureForEntity(
  world: MainSceneWorld,
  dirtyEid: number,
  currentTime: number,
): void {
  if (!hasComponent(world, DirtyExposureComp, dirtyEid)) {
    return;
  }

  updateDirtyExposureEntity(dirtyEid, currentTime);
  removeComponent(world, DirtyExposureComp, dirtyEid);
}

function updateDirtyExposureSources(
  world: MainSceneWorld,
  currentTime: number,
): void {
  const entities = objectQuery(world);

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    const isDirty = isDirtyExposureSource(world, eid);

    if (!isDirty) {
      if (hasComponent(world, DirtyExposureComp, eid)) {
        finalizeDirtyExposureForEntity(world, eid, currentTime);
      }
      continue;
    }

    if (!hasComponent(world, DirtyExposureComp, eid)) {
      addComponent(world, DirtyExposureComp, eid);
      DirtyExposureComp.stackCount[eid] = 0;
      DirtyExposureComp.accumulatedExposureMs[eid] = 0;
      DirtyExposureComp.lastUpdatedTime[eid] = currentTime;
    }

    updateDirtyExposureEntity(eid, currentTime);
  }
}

function isDirtyExposureSource(world: MainSceneWorld, eid: number): boolean {
  if (ObjectComp.type[eid] === ObjectType.POOB) {
    return true;
  }

  return (
    ObjectComp.type[eid] === ObjectType.FOOD &&
    hasComponent(world, FreshnessComp, eid) &&
    FreshnessComp.freshness[eid] === Freshness.STALE &&
    ObjectComp.state[eid] !== FoodState.BEING_THROWING
  );
}

function updateDirtyExposureEntity(eid: number, currentTime: number): void {
  const lastUpdatedTime = DirtyExposureComp.lastUpdatedTime[eid];

  if (!Number.isFinite(lastUpdatedTime)) {
    DirtyExposureComp.lastUpdatedTime[eid] = currentTime;
    return;
  }

  const elapsedMs = Math.max(0, currentTime - lastUpdatedTime);
  if (elapsedMs <= 0) {
    return;
  }

  const totalExposureMs =
    DirtyExposureComp.accumulatedExposureMs[eid] + elapsedMs;
  const gainedStacks = Math.floor(
    totalExposureMs / MUTATION_DIRTY_EXPOSURE_STACK_INTERVAL_MS,
  );
  const remainder =
    totalExposureMs % MUTATION_DIRTY_EXPOSURE_STACK_INTERVAL_MS;

  if (gainedStacks > 0) {
    DirtyExposureComp.stackCount[eid] = Math.min(
      MUTATION_STACK_CAP,
      DirtyExposureComp.stackCount[eid] + gainedStacks,
    );
  }

  DirtyExposureComp.accumulatedExposureMs[eid] = remainder;
  DirtyExposureComp.lastUpdatedTime[eid] = currentTime;
}

function detoxCharacterMutationStacks(
  world: MainSceneWorld,
  currentTime: number,
): void {
  const characters = characterQuery(world);

  for (let i = 0; i < characters.length; i++) {
    const eid = characters[i];

    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
      continue;
    }

    if (
      ObjectComp.state[eid] === CharacterState.EGG ||
      ObjectComp.state[eid] === CharacterState.DEAD
    ) {
      ensureMutationRiskComp(world, eid, currentTime);
      MutationRiskComp.dirtyExposureStacks[eid] = 0;
      continue;
    }

    ensureMutationRiskComp(world, eid, currentTime);
    MutationRiskComp.dirtyExposureStacks[eid] = 0;
    detoxInjectionStacks(eid, currentTime);
  }
}

function detoxInjectionStacks(eid: number, currentTime: number): void {
  const nextStacks = getDetoxedStackCount({
    currentStacks: MutationRiskComp.unnecessaryInjectionStacks[eid],
    lastDetoxTime: MutationRiskComp.lastInjectionDetoxTime[eid],
    currentTime,
    detoxIntervalMs: getMutationDetoxIntervalMs(
      CharacterStatusComp.characterKey[eid],
    ),
  });

  MutationRiskComp.unnecessaryInjectionStacks[eid] = nextStacks.stacks;
  MutationRiskComp.lastInjectionDetoxTime[eid] = nextStacks.lastDetoxTime;
}

function getDetoxedStackCount(params: {
  currentStacks: number;
  lastDetoxTime: number;
  currentTime: number;
  detoxIntervalMs: number;
}): { stacks: number; lastDetoxTime: number } {
  const { currentStacks, currentTime, detoxIntervalMs } = params;
  let { lastDetoxTime } = params;

  if (!Number.isFinite(lastDetoxTime)) {
    lastDetoxTime = currentTime;
  }

  if (currentStacks <= 0 || detoxIntervalMs <= 0) {
    return { stacks: 0, lastDetoxTime: currentTime };
  }

  const elapsedMs = Math.max(0, currentTime - lastDetoxTime);
  const detoxCount = Math.floor(elapsedMs / detoxIntervalMs);

  if (detoxCount <= 0) {
    return { stacks: currentStacks, lastDetoxTime };
  }

  const stacks = Math.max(0, currentStacks - detoxCount);

  return {
    stacks,
    lastDetoxTime:
      stacks === 0 ? currentTime : lastDetoxTime + detoxCount * detoxIntervalMs,
  };
}

function ensureMutationRiskComp(
  world: MainSceneWorld,
  eid: number,
  currentTime: number,
): void {
  if (hasComponent(world, MutationRiskComp, eid)) {
    return;
  }

  addComponent(world, MutationRiskComp, eid);
  MutationRiskComp.unnecessaryInjectionStacks[eid] = 0;
  MutationRiskComp.dirtyExposureStacks[eid] = 0;
  MutationRiskComp.lastInjectionDetoxTime[eid] = currentTime;
  MutationRiskComp.lastDirtyDetoxTime[eid] = currentTime;
}

function countActiveDirtyExposureStacks(world: MainSceneWorld): number {
  const dirtyEntities = objectQuery(world);
  let stackCount = 0;

  for (let i = 0; i < dirtyEntities.length; i++) {
    const eid = dirtyEntities[i];

    if (!isDirtyExposureSource(world, eid)) {
      continue;
    }

    stackCount += hasComponent(world, DirtyExposureComp, eid)
      ? Math.max(1, DirtyExposureComp.stackCount[eid])
      : 1;
  }

  return stackCount;
}
