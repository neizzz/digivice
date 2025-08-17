import { hasComponent } from "bitecs";
import {
  ObjectComp,
  CharacterStatusComp,
  AnimationRenderComp,
  RenderComp,
} from "../raw-components";
import { MainSceneWorld } from "../world";
import { ObjectType, CharacterKey, CharacterState } from "../types";
import {
  getCharacterSpritesheetOptions,
  loadSpritesheet,
  isSpritesheetLoaded,
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
      nextCharacterKey = CharacterKey.TestGreenSlimeB1;
      break;
    case 2:
      // Phase 2 -> Phase 3: B1 -> C1
      nextPhase = 3;
      nextCharacterKey = CharacterKey.TestGreenSlimeC1;
      break;
    case 3:
      // Phase 3 -> Phase 4: C1 -> D1
      nextPhase = 4;
      nextCharacterKey = CharacterKey.TestGreenSlimeD1;
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

  // 진화 처리
  CharacterStatusComp.evolutionPhase[eid] = nextPhase;
  CharacterStatusComp.characterKey[eid] = nextCharacterKey;
  CharacterStatusComp.evolutionGage[eid] = 0.0; // 진화 게이지 리셋

  console.log(
    `[EvolutionSystem] Character ${eid} evolved from phase ${currentPhase} to ${nextPhase}!`
  );
  console.log(
    `[EvolutionSystem] Character key changed from ${currentCharacterKey} to ${nextCharacterKey}`
  );

  // 스프라이트시트 업데이트 (비동기)
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
  newCharacterKey: CharacterKey
): void {
  // 스프라이트시트 동적 로딩 (비동기)
  loadCharacterSpritesheet(eid, newCharacterKey);

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
 * 캐릭터 스프라이트시트 동적 로딩 (비동기)
 */
async function loadCharacterSpritesheet(
  eid: number,
  characterKey: CharacterKey
): Promise<void> {
  try {
    // 스프라이트시트 로드 옵션 가져오기
    const spritesheetOptions = getCharacterSpritesheetOptions(characterKey);
    if (!spritesheetOptions) {
      console.error(
        `[EvolutionSystem] No spritesheet options found for character key: ${characterKey}`
      );
      return;
    }

    const spritesheetAlias = spritesheetOptions.alias!;

    // 스프라이트시트가 이미 로드되어 있는지 확인
    if (!isSpritesheetLoaded(spritesheetAlias)) {
      console.log(
        `[EvolutionSystem] Loading spritesheet for evolved character ${eid}: ${spritesheetAlias}`
      );

      const loadResult = await loadSpritesheet(spritesheetOptions);
      if (!loadResult) {
        console.error(
          `[EvolutionSystem] Failed to load spritesheet for evolved character ${eid}: ${spritesheetAlias}`
        );
        return;
      }

      console.log(
        `[EvolutionSystem] Successfully loaded spritesheet for evolution: ${spritesheetAlias}`
      );
    } else {
      console.log(
        `[EvolutionSystem] Spritesheet already loaded for evolution: ${spritesheetAlias}`
      );
    }
  } catch (error) {
    console.error(
      `[EvolutionSystem] Error loading spritesheet for evolved character ${eid}:`,
      error
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
export function getCharacterNameByKey(characterKey: CharacterKey): string {
  switch (characterKey) {
    case CharacterKey.TestGreenSlimeA1:
      return "Green Slime (Baby)";
    case CharacterKey.TestGreenSlimeB1:
      return "Green Slime (Child)";
    case CharacterKey.TestGreenSlimeC1:
      return "Green Slime (Adult)";
    case CharacterKey.TestGreenSlimeD1:
      return "Green Slime (Ultimate)";
    default:
      return "Unknown Character";
  }
}
