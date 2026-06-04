import { defineQuery, hasComponent, addComponent } from "bitecs";
import {
  ObjectComp,
  EggHatchComp,
  FreshnessComp,
  RandomMovementComp,
  AnimationRenderComp,
  CharacterStatusComp,
} from "../raw-components";
import { MainSceneWorld } from "../world";
import {
  CharacterKeyECS,
  CharacterState,
  AnimationKey,
  Freshness,
  ObjectType,
} from "../types";
import {
  ensureCharacterSpritesheetLoaded,
  getCharacterSpritesheetOptions,
  isSpritesheetLoaded,
} from "../../../utils/asset";
import { ensureCharacterOpaqueBoundsComputed } from "./CharacterOpaqueBounds";
import { recordMonsterBookReach } from "../monsterBook";
import { resolveEggHatchStartingGeneSelection } from "../eggHatchGeneSelection";

const eggQuery = defineQuery([ObjectComp, EggHatchComp]);
const staleFoodQuery = defineQuery([ObjectComp, FreshnessComp]);
const pendingRealtimeHatchAttemptsByWorld = new WeakMap<
  MainSceneWorld,
  Set<number>
>();

/**
 * 알 부화 시스템
 * - EGG 상태의 캐릭터가 일정 시간 후 부화하여 IDLE 상태로 변경
 * - 부화 시 RandomMovementComp과 AnimationRenderComp를 추가
 * - 필요한 스프라이트시트를 동적으로 로드
 */
export function eggHatchSystem(params: {
  world: MainSceneWorld;
  currentTime: number;
}): typeof params {
  const { world, currentTime } = params;
  const entities = eggQuery(world);

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    // EGG 상태가 아니면 건너뛰기
    if (ObjectComp.state[eid] !== CharacterState.EGG) continue;

    // 부화 시간이 되었는지 확인
    if (currentTime < EggHatchComp.hatchTime[eid]) {
      continue;
    }

    if (!EggHatchComp.isReadyToHatch[eid]) {
      const logContext = buildEggHatchDiagnosticsContext(
        eid,
        world,
        currentTime,
      );
      EggHatchComp.isReadyToHatch[eid] = 1;

      console.log(`[EggHatchSystem] Character ${eid} is ready to hatch!`);
      console.warn("[ImportantDiagnostics][EggHatchExecution]", {
        phase: "ready_to_hatch",
        ...logContext,
      });
    }

    if (world.isSimulationMode) {
      hatchCharacterForSimulation(eid, world, currentTime);
    } else {
      // 실시간 모드에서는 필요한 에셋을 보장 로드한 뒤 부화 처리
      void hatchCharacter(eid, world, currentTime);
    }
  }

  return params;
}

function completeHatch(
  eid: number,
  world: MainSceneWorld,
  currentTime: number,
  characterKey: CharacterKeyECS,
): void {
  const previousCharacterKey = CharacterStatusComp.characterKey[eid];
  CharacterStatusComp.characterKey[eid] = characterKey;
  CharacterStatusComp.evolutionPhase[eid] = 1;

  // 캐릭터 상태를 IDLE로 변경
  ObjectComp.state[eid] = CharacterState.IDLE;
  EggHatchComp.hatchTime[eid] = 0;
  EggHatchComp.hatchDurationMs[eid] = 0;
  EggHatchComp.isReadyToHatch[eid] = 0;
  EggHatchComp.syringeCount[eid] = 0;
  EggHatchComp.pendingCharacterKey[eid] = CharacterKeyECS.NULL;

  // RandomMovementComp 추가 (이제 움직일 수 있음)
  if (!hasComponent(world, RandomMovementComp, eid)) {
    addComponent(world, RandomMovementComp, eid);
    RandomMovementComp.minIdleTime[eid] = 2000;
    RandomMovementComp.maxIdleTime[eid] = 8000;
    RandomMovementComp.minMoveTime[eid] = 1000;
    RandomMovementComp.maxMoveTime[eid] = 8000;
    // 부화 후 잠시 후 첫 이동 시작
    RandomMovementComp.nextChange[eid] =
      currentTime + 2000 + Math.random() * 3000;
  }

  // AnimationRenderComp 추가 (이제 애니메이션 표시 가능)
  if (!hasComponent(world, AnimationRenderComp, eid)) {
    addComponent(world, AnimationRenderComp, eid);
    AnimationRenderComp.storeIndex[eid] = ECS_NULL_VALUE;
    AnimationRenderComp.spritesheetKey[eid] = characterKey;
    AnimationRenderComp.animationKey[eid] = AnimationKey.IDLE;
    AnimationRenderComp.isPlaying[eid] = 1;
    AnimationRenderComp.loop[eid] = 1;
    AnimationRenderComp.speed[eid] = 0.04;

    console.log(
      `[EggHatchSystem] Added AnimationRenderComp with characterKey: ${characterKey}`,
    );
  }

  console.log(
    `[EggHatchSystem] Character ${eid} has hatched! State changed to IDLE with characterKey: ${characterKey}`,
  );
  console.warn("[ImportantDiagnostics][EggHatchExecution]", {
    phase: "complete_hatch",
    ...buildEggHatchDiagnosticsContext(eid, world, currentTime),
    previousCharacterKey,
    appliedCharacterKey: characterKey,
  });

  recordMonsterBookReach({
    world,
    characterKey,
    source: "hatch",
    reachedAt: currentTime,
    objectId: ObjectComp.id[eid],
  });
}

function countStaleFoodAtHatch(world: MainSceneWorld): number {
  const entities = staleFoodQuery(world);
  let count = 0;

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    if (
      ObjectComp.type[eid] === ObjectType.FOOD &&
      FreshnessComp.freshness[eid] === Freshness.STALE
    ) {
      count += 1;
    }
  }

  return count;
}

function selectStartingCharacterForHatch(
  eid: number,
  world: MainSceneWorld,
): {
  staleFoodCountAtHatch: number;
  syringeCount: number;
  random: number;
  characterKey: CharacterKeyECS;
} {
  const staleFoodCountAtHatch = countStaleFoodAtHatch(world);
  const syringeCount = EggHatchComp.syringeCount[eid];
  const random = Math.random();
  const selection = resolveEggHatchStartingGeneSelection({
    staleFoodCountAtHatch,
    syringeCount,
    random,
  });

  console.warn("[ImportantDiagnostics][EggHatchSelection]", {
    eid,
    objectId: ObjectComp.id[eid],
    currentTime: world.currentTime,
    hatchTime: EggHatchComp.hatchTime[eid],
    hatchDurationMs: EggHatchComp.hatchDurationMs[eid],
    isReadyToHatch: EggHatchComp.isReadyToHatch[eid] === 1,
    currentCharacterKey: CharacterStatusComp.characterKey[eid],
    isSimulationMode: world.isSimulationMode,
    state: ObjectComp.state[eid],
    staleFoodCountAtHatch,
    syringeCount,
    random,
    normalizedStaleFoodCountAtHatch:
      selection.normalizedStaleFoodCountAtHatch,
    normalizedSyringeCount: selection.normalizedSyringeCount,
    normalizedRandom: selection.normalizedRandom,
    rollPercent: selection.rollPercent,
    probabilities: selection.probabilities,
    selectedCharacterKey: selection.selectedCharacterKey,
  });

  return {
    staleFoodCountAtHatch,
    syringeCount,
    random,
    characterKey: selection.selectedCharacterKey,
  };
}

function getPendingStartingCharacterKey(eid: number): CharacterKeyECS | null {
  const pendingCharacterKey = EggHatchComp.pendingCharacterKey[eid];
  switch (pendingCharacterKey) {
    case CharacterKeyECS.GreenSlimeA1:
    case CharacterKeyECS.SoilSlimeA1:
    case CharacterKeyECS.SkullSlimeA1:
      return pendingCharacterKey;
    default:
      return null;
  }
}

function getOrCreatePendingStartingCharacterForHatch(
  eid: number,
  world: MainSceneWorld,
): CharacterKeyECS {
  const pendingCharacterKey = getPendingStartingCharacterKey(eid);
  if (pendingCharacterKey !== null) {
    return pendingCharacterKey;
  }

  const { characterKey } = selectStartingCharacterForHatch(eid, world);
  EggHatchComp.pendingCharacterKey[eid] = characterKey;
  return characterKey;
}

function hatchCharacterForSimulation(
  eid: number,
  world: MainSceneWorld,
  currentTime: number,
): void {
  console.warn("[ImportantDiagnostics][EggHatchExecution]", {
    phase: "simulation_start",
    ...buildEggHatchDiagnosticsContext(eid, world, currentTime),
  });
  const characterKey = getOrCreatePendingStartingCharacterForHatch(eid, world);
  const spritesheetOptions = getCharacterSpritesheetOptions(characterKey);
  const spritesheetAlias =
    spritesheetOptions?.alias || spritesheetOptions?.jsonPath;

  if (!spritesheetAlias || !isSpritesheetLoaded(spritesheetAlias)) {
    console.warn(
      `[EggHatchSystem] Simulation hatch skipped for character ${eid} because spritesheet is not preloaded. Keeping EGG state.`,
    );
    console.warn("[ImportantDiagnostics][EggHatchExecution]", {
      phase: "simulation_skipped_unloaded_spritesheet",
      ...buildEggHatchDiagnosticsContext(eid, world, currentTime),
      selectedCharacterKey: characterKey,
      spritesheetAlias: spritesheetAlias ?? null,
    });
    return;
  }

  void ensureCharacterOpaqueBoundsComputed(characterKey);
  completeHatch(eid, world, currentTime, characterKey);
}

/**
 * 캐릭터 부화 처리 (비동기)
 */
async function hatchCharacter(
  eid: number,
  world: MainSceneWorld,
  currentTime: number
): Promise<void> {
  const pendingAttempts = getPendingRealtimeHatchAttempts(world);
  if (pendingAttempts.has(eid)) {
    return;
  }
  pendingAttempts.add(eid);

  try {
    console.warn("[ImportantDiagnostics][EggHatchExecution]", {
      phase: "realtime_start",
      ...buildEggHatchDiagnosticsContext(eid, world, currentTime),
    });
    const characterKey = getOrCreatePendingStartingCharacterForHatch(eid, world);

    const isLoaded = await ensureCharacterSpritesheetLoaded({
      characterKey,
      reason: "hatch",
      eid,
      maxRetries: 2,
    });
    if (!isLoaded) {
      console.warn(
        `[EggHatchSystem] Hatch delayed for character ${eid}. Keeping EGG state because spritesheet could not be loaded.`
      );
      console.warn("[ImportantDiagnostics][EggHatchExecution]", {
        phase: "realtime_delayed_unloaded_spritesheet",
        ...buildEggHatchDiagnosticsContext(eid, world, currentTime),
        selectedCharacterKey: characterKey,
      });
      return;
    }

    await ensureCharacterOpaqueBoundsComputed(characterKey);
    completeHatch(eid, world, currentTime, characterKey);
  } catch (error) {
    console.error(
      `[EggHatchSystem] Error during hatching process for character ${eid}:`,
      error
    );
  } finally {
    pendingAttempts.delete(eid);
  }
}

function getPendingRealtimeHatchAttempts(world: MainSceneWorld): Set<number> {
  let pendingAttempts = pendingRealtimeHatchAttemptsByWorld.get(world);
  if (!pendingAttempts) {
    pendingAttempts = new Set<number>();
    pendingRealtimeHatchAttemptsByWorld.set(world, pendingAttempts);
  }

  return pendingAttempts;
}

function buildEggHatchDiagnosticsContext(
  eid: number,
  world: MainSceneWorld,
  currentTime: number,
): Record<string, unknown> {
  return {
    eid,
    objectId: ObjectComp.id[eid],
    currentTime,
    hatchTime: EggHatchComp.hatchTime[eid],
    hatchDurationMs: EggHatchComp.hatchDurationMs[eid],
    isReadyToHatch: EggHatchComp.isReadyToHatch[eid] === 1,
    state: ObjectComp.state[eid],
    currentCharacterKey: CharacterStatusComp.characterKey[eid],
    syringeCount: EggHatchComp.syringeCount[eid],
    pendingCharacterKey: EggHatchComp.pendingCharacterKey[eid],
    isSimulationMode: world.isSimulationMode,
  };
}
