import { hasComponent } from "bitecs";
import {
  ObjectComp,
  CharacterStatusComp,
  AnimationRenderComp,
  RenderComp,
} from "../raw-components";
import { MainSceneWorld } from "../world";
import { ObjectType, CharacterKeyECS, CharacterState } from "../types";
import {
  canEvolveFromConfig,
  EVOLUTION_GAUGE_CONFIG,
  getCharacterDisplayName,
  hasReachedEvolutionGaugeMax,
  resolveEvolutionCandidate,
  resolveEvolutionPhase,
} from "../evolutionConfig";
import { ensureCharacterSpritesheetLoaded } from "../../../utils/asset";
import { ensureCharacterOpaqueBoundsComputed } from "./CharacterOpaqueBounds";

/**
 * 진화 처리 함수
 * - 현재 캐릭터 키 기준으로 진화 후보를 결정
 * - 스프라이트시트 변경 및 동적 로딩
 */
export function evolveCharacter(world: MainSceneWorld, eid: number): void {
  if (ObjectComp.type[eid] !== ObjectType.CHARACTER) return;
  if (ObjectComp.state[eid] === CharacterState.DEAD) return;

  const currentCharacterKey = CharacterStatusComp.characterKey[eid];
  const currentPhase = CharacterStatusComp.evolutionPhase[eid];

  if (!canEvolveFromConfig(currentCharacterKey)) {
    console.log(
      `[EvolutionSystem] Character ${eid} is already at max evolution stage: key=${currentCharacterKey}`,
    );
    return;
  }

  const evolutionCandidate = resolveEvolutionCandidate(currentCharacterKey);
  if (!evolutionCandidate) {
    console.warn(
      `[EvolutionSystem] No evolution candidate resolved for character ${eid}: key=${currentCharacterKey}`,
    );
    return;
  }

  const nextCharacterKey = evolutionCandidate.to;
  const nextPhase = resolveEvolutionPhase({
    currentCharacterKey,
    targetCharacterKey: nextCharacterKey,
    candidateKind: evolutionCandidate.kind,
  });

  void applyEvolutionWithLoadedAsset({
    world,
    eid,
    currentPhase,
    currentCharacterKey,
    nextPhase,
    nextCharacterKey,
    candidateKind: evolutionCandidate.kind,
  });
}

async function applyEvolutionWithLoadedAsset(params: {
  world: MainSceneWorld;
  eid: number;
  currentPhase: number;
  currentCharacterKey: CharacterKeyECS;
  nextPhase: number;
  nextCharacterKey: CharacterKeyECS;
  candidateKind: string;
}): Promise<void> {
  const {
    world,
    eid,
    currentPhase,
    currentCharacterKey,
    nextPhase,
    nextCharacterKey,
    candidateKind,
  } = params;

  const isLoaded = await ensureCharacterSpritesheetLoaded({
    characterKey: nextCharacterKey,
    reason: "evolution",
    eid,
    maxRetries: 2,
  });

  if (!isLoaded) {
    console.error(
      `[EvolutionSystem] Evolution aborted for ${eid}. Keeping current form because next spritesheet is unavailable: key=${nextCharacterKey}`,
    );
    return;
  }

  await ensureCharacterOpaqueBoundsComputed(nextCharacterKey);

  CharacterStatusComp.evolutionPhase[eid] = nextPhase;
  CharacterStatusComp.characterKey[eid] = nextCharacterKey;
  CharacterStatusComp.evolutionGage[eid] = 0.0;

  console.log(
    `[EvolutionSystem] Character ${eid} evolved: phase ${currentPhase} -> ${nextPhase}, key ${currentCharacterKey} -> ${nextCharacterKey}, kind=${candidateKind}`,
  );

  updateCharacterSprites(world, eid, nextCharacterKey);
}

function updateCharacterSprites(
  world: MainSceneWorld,
  eid: number,
  newCharacterKey: CharacterKeyECS,
): void {
  if (hasComponent(world, AnimationRenderComp, eid)) {
    AnimationRenderComp.spritesheetKey[eid] = newCharacterKey;
    AnimationRenderComp.storeIndex[eid] = ECS_NULL_VALUE;

    console.log(
      `[EvolutionSystem] Updated AnimationRenderComp spritesheetKey to ${newCharacterKey} for character ${eid}`,
    );
  }

  if (hasComponent(world, RenderComp, eid)) {
    RenderComp.textureKey[eid] = ECS_NULL_VALUE;

    console.log(
      `[EvolutionSystem] Cleared static texture for evolved character ${eid}, animation system will handle rendering`,
    );
  }
}

/**
 * 진화 가능 여부 체크
 */
export function canEvolve(eid: number): boolean {
  const currentCharacterKey = CharacterStatusComp.characterKey[eid];
  const evolutionGauge = CharacterStatusComp.evolutionGage[eid];

  return (
    canEvolveFromConfig(currentCharacterKey) &&
    hasReachedEvolutionGaugeMax(evolutionGauge)
  );
}

/**
 * 현재 진화 단계에 따른 캐릭터 이름 반환
 */
export function getCharacterNameByKey(characterKey: CharacterKeyECS): string {
  return getCharacterDisplayName(characterKey);
}

export function getMaxEvolutionGauge(): number {
  return EVOLUTION_GAUGE_CONFIG.maxGauge;
}
