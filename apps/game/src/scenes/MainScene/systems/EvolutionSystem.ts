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
  ensureCharacterSpritesheetLoaded,
} from "../../../utils/asset";

/**
 * 진화 처리 함수
 * - 현재 진화 단계에 따라 다음 단계로 진화
 * - 스프라이트시트 변경 및 동적 로딩
 */
export function evolveCharacter(world: MainSceneWorld, eid: number): void {
  // 캐릭터 타입이 아니면 진화하지 않음
  if (ObjectComp.type[eid] !== ObjectType.CHARACTER) return;

  // 죽은 캐릭터는 진화하지 않음
  if (ObjectComp.state[eid] === CharacterState.DEAD) return;

  const currentPhase = CharacterStatusComp.evolutionPhase[eid];
  const currentCharacterKey = CharacterStatusComp.characterKey[eid];

  // 진화 단계 결정
  let nextPhase = currentPhase;
  let nextCharacterKey = currentCharacterKey;

  switch (currentPhase) {
    case 1:
      // Phase 1 -> Phase 2: A1 -> B1
      nextPhase = 2;
      nextCharacterKey = CharacterKeyECS.TestGreenSlimeB1;
      break;
    case 2:
      // Phase 2 -> Phase 3: B1 -> C1
      nextPhase = 3;
      nextCharacterKey = CharacterKeyECS.TestGreenSlimeC1;
      break;
    case 3:
      // Phase 3 -> Phase 4: C1 -> D1
      nextPhase = 4;
      nextCharacterKey = CharacterKeyECS.TestGreenSlimeD1;
      break;
    case 4:
      // 이미 최대 진화 단계
      console.log(
        `[EvolutionSystem] Character ${eid} is already at max evolution phase`
      );
      return;
    default:
      console.warn(
        `[EvolutionSystem] Invalid evolution phase ${currentPhase} for character ${eid}`
      );
      return;
  }

  void applyEvolutionWithLoadedAsset({
    world,
    eid,
    currentPhase,
    currentCharacterKey,
    nextPhase,
    nextCharacterKey,
  });
}

async function applyEvolutionWithLoadedAsset(params: {
  world: MainSceneWorld;
  eid: number;
  currentPhase: number;
  currentCharacterKey: CharacterKeyECS;
  nextPhase: number;
  nextCharacterKey: CharacterKeyECS;
}): Promise<void> {
  const {
    world,
    eid,
    currentPhase,
    currentCharacterKey,
    nextPhase,
    nextCharacterKey,
  } = params;

  const isLoaded = await ensureCharacterSpritesheetLoaded({
    characterKey: nextCharacterKey,
    reason: "evolution",
    eid,
    maxRetries: 2,
  });

  if (!isLoaded) {
    console.error(
      `[EvolutionSystem] Evolution aborted for ${eid}. Keeping current form because next spritesheet is unavailable: key=${nextCharacterKey}`
    );
    return;
  }

  // 진화 처리 (에셋 로드 성공 후 반영)
  CharacterStatusComp.evolutionPhase[eid] = nextPhase;
  CharacterStatusComp.characterKey[eid] = nextCharacterKey;
  CharacterStatusComp.evolutionGage[eid] = 0.0; // 진화 게이지 리셋

  console.log(
    `[EvolutionSystem] Character ${eid} evolved from phase ${currentPhase} to ${nextPhase}!`
  );
  console.log(
    `[EvolutionSystem] Character key changed from ${currentCharacterKey} to ${nextCharacterKey}`
  );

  // 스프라이트시트 업데이트
  updateCharacterSprites(world, eid, nextCharacterKey);
}

/**
 * 캐릭터 스프라이트 업데이트
 * - AnimationRenderComp의 spritesheetKey 변경
 * - RenderComp의 textureKey를 NULL로 설정하여 애니메이션 시스템이 처리하도록 함
 * - 필요한 스프라이트시트를 동적으로 로드
 */
function updateCharacterSprites(
  world: MainSceneWorld,
  eid: number,
  newCharacterKey: CharacterKeyECS
): void {
  // AnimationRenderComp 업데이트
  if (hasComponent(world, AnimationRenderComp, eid)) {
    AnimationRenderComp.spritesheetKey[eid] = newCharacterKey;
    // storeIndex를 ECS_NULL_VALUE로 설정하여 다음 프레임에 새 스프라이트시트 로드
    AnimationRenderComp.storeIndex[eid] = ECS_NULL_VALUE;

    console.log(
      `[EvolutionSystem] Updated AnimationRenderComp spritesheetKey to ${newCharacterKey} for character ${eid}`
    );
  }

  // RenderComp 업데이트 (정적 텍스처는 사용하지 않음)
  if (hasComponent(world, RenderComp, eid)) {
    RenderComp.textureKey[eid] = ECS_NULL_VALUE;

    console.log(
      `[EvolutionSystem] Cleared static texture for evolved character ${eid}, animation system will handle rendering`
    );
  }
}

/**
 * 진화 가능 여부 체크
 */
export function canEvolve(eid: number): boolean {
  const currentPhase = CharacterStatusComp.evolutionPhase[eid];
  const evolutionGauge = CharacterStatusComp.evolutionGage[eid];

  // 최대 진화 단계가 아니고, 진화 게이지가 100 이상이면 진화 가능
  return currentPhase < 4 && evolutionGauge >= 100.0;
}

/**
 * 현재 진화 단계에 따른 캐릭터 이름 반환
 */
export function getCharacterNameByKey(characterKey: CharacterKeyECS): string {
  switch (characterKey) {
    case CharacterKeyECS.TestGreenSlimeA1:
      return "Green Slime (Baby)";
    case CharacterKeyECS.TestGreenSlimeB1:
      return "Green Slime (Child)";
    case CharacterKeyECS.TestGreenSlimeC1:
      return "Green Slime (Adult)";
    case CharacterKeyECS.TestGreenSlimeD1:
      return "Green Slime (Ultimate)";
    default:
      return "Unknown Character";
  }
}
