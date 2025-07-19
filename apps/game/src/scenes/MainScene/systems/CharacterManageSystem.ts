import { defineQuery } from "bitecs";
import { ObjectComp, CharacterStatusComp, RenderComp } from "../raw-components";
import {
  ObjectType,
  CharacterStatus,
  TextureKey,
  CharacterKey,
} from "../types";
import { MainSceneWorld } from "../world";

// 진화 페이즈별 기본 텍스처 매핑
const EVOLUTION_PHASE_CHARACTER_KEY: Record<
  number,
  Partial<Record<CharacterKey, number /** 확률 0.0 ~1.0 */>>
> = {
  0: {
    [CharacterKey.TestGreenSlimeA1]: 1,
  },
  1: {
    [CharacterKey.TestGreenSlimeB1]: 1,
  },
  2: {
    [CharacterKey.TestGreenSlimeC1]: 1,
  },
  3: {
    [CharacterKey.TestGreenSlimeD1]: 1,
  },
};

const characterQuery = defineQuery([
  ObjectComp,
  CharacterStatusComp,
  RenderComp,
]);

export function characterManagerSystem(params: {
  world: MainSceneWorld;
  delta: number;
}): typeof params {
  const { world } = params;
  const characters = characterQuery(world);

  for (let i = 0; i < characters.length; i++) {
    const eid = characters[i];

    // 캐릭터 타입인지 확인
    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
      continue;
    }

    // const characterKey = CharacterStatusComp.characterKey[eid];

    // 현재 캐릭터의 상태와 진화 정보 가져오기
    const statusArray = CharacterStatusComp.statuses[eid];
    const evolutionPhase = CharacterStatusComp.evolutionPhase[eid];

    // 주요 상태 결정
    const primaryStatus = getPrimaryStatus(statusArray);
  }

  return params;
}

// 상태별 텍스처 변화 규칙 (추후 확장 가능)
const getTextureVariationForStatus = (
  baseTexture: TextureKey,
  status: CharacterStatus
): TextureKey => {
  // 현재는 상태에 관계없이 기본 텍스처 반환
  // 추후 상태별로 다른 텍스처나 애니메이션을 적용할 수 있음
  switch (status) {
    case CharacterStatus.SICK:
      // 아픈 상태일 때는 별도 텍스처 사용 가능 (추후 구현)
      return baseTexture;
    case CharacterStatus.HAPPY:
      // 행복한 상태일 때는 별도 텍스처 사용 가능 (추후 구현)
      return baseTexture;
    case CharacterStatus.URGENT:
      // 긴급 상태일 때는 별도 텍스처 사용 가능 (추후 구현)
      return baseTexture;
    case CharacterStatus.UNHAPPY:
      // 불행한 상태일 때는 별도 텍스처 사용 가능 (추후 구현)
      return baseTexture;
    default:
      return baseTexture;
  }
};

function getPrimaryStatus(statusArray: Uint8Array): CharacterStatus | null {
  if (!statusArray || statusArray.length === 0) {
    return null;
  }

  // 상태 우선순위: URGENT > SICK > UNHAPPY > HAPPY
  const priorities = [
    CharacterStatus.URGENT,
    CharacterStatus.SICK,
    CharacterStatus.UNHAPPY,
    CharacterStatus.HAPPY,
  ];

  for (const status of priorities) {
    if (statusArray.includes(status)) {
      return status;
    }
  }

  return null;
}

export function addCharacterStatus(eid: number, status: CharacterStatus): void {
  const currentStatuses = CharacterStatusComp.statuses[eid];
  if (!currentStatuses.includes(status)) {
    const newStatuses = new Uint8Array([...currentStatuses, status]);
    CharacterStatusComp.statuses[eid] = newStatuses;
  }
}

export function removeCharacterStatus(
  eid: number,
  status: CharacterStatus
): void {
  const currentStatuses = CharacterStatusComp.statuses[eid];
  const filteredStatuses = currentStatuses.filter((s) => s !== status);
  CharacterStatusComp.statuses[eid] = new Uint8Array(filteredStatuses);
}

export function hasCharacterStatus(
  eid: number,
  status: CharacterStatus
): boolean {
  const currentStatuses = CharacterStatusComp.statuses[eid];
  return currentStatuses.includes(status);
}

export function clearCharacterStatuses(eid: number): void {
  CharacterStatusComp.statuses[eid] = new Uint8Array();
}
