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

    // 테스트용: 첫 번째 캐릭터에게 고정 상태 부여 (디버깅용)
    if (i === 0) {
      const currentStatuses = Array.from(
        CharacterStatusComp.statuses[eid]
      ).filter((s) => s !== ECS_NULL_VALUE);
      if (currentStatuses.length === 0) {
        // 처음에 상태가 없으면 테스트 상태들 추가
        addCharacterStatus(eid, CharacterStatus.HAPPY);
        addCharacterStatus(eid, CharacterStatus.SICK);
        console.log(
          `[CharacterManager] Added test statuses to character ${eid}:`,
          [CharacterStatus.HAPPY, CharacterStatus.SICK]
        );
      }
    }

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
  console.log(
    `[addCharacterStatus] Current statuses for entity ${eid}:`,
    Array.from(currentStatuses)
  );

  // 이미 해당 상태가 있는지 확인
  if (currentStatuses.includes(status)) {
    console.log(
      `[addCharacterStatus] Status ${status} already exists for entity ${eid}`
    );
    return;
  }

  // 첫 번째 빈 슬롯(ECS_NULL_VALUE)에 상태 추가
  for (let i = 0; i < currentStatuses.length; i++) {
    if (currentStatuses[i] === ECS_NULL_VALUE) {
      currentStatuses[i] = status;
      console.log(
        `[addCharacterStatus] Added status ${status} to entity ${eid} at slot ${i}. New statuses:`,
        Array.from(currentStatuses)
      );
      return;
    }
  }

  console.warn(
    `[addCharacterStatus] No empty slot available for entity ${eid} to add status ${status}`
  );
}

export function removeCharacterStatus(
  eid: number,
  status: CharacterStatus
): void {
  const currentStatuses = CharacterStatusComp.statuses[eid];

  // 해당 상태를 찾아서 ECS_NULL_VALUE로 교체
  for (let i = 0; i < currentStatuses.length; i++) {
    if (currentStatuses[i] === status) {
      currentStatuses[i] = ECS_NULL_VALUE;
      console.log(
        `[removeCharacterStatus] Removed status ${status} from entity ${eid} at slot ${i}. New statuses:`,
        Array.from(currentStatuses)
      );
      return;
    }
  }

  console.warn(
    `[removeCharacterStatus] Status ${status} not found for entity ${eid}`
  );
}

export function hasCharacterStatus(
  eid: number,
  status: CharacterStatus
): boolean {
  const currentStatuses = CharacterStatusComp.statuses[eid];
  return currentStatuses.includes(status);
}

export function clearCharacterStatuses(eid: number): void {
  const currentStatuses = CharacterStatusComp.statuses[eid];
  // 모든 슬롯을 ECS_NULL_VALUE로 초기화 (길이는 유지)
  for (let i = 0; i < currentStatuses.length; i++) {
    currentStatuses[i] = ECS_NULL_VALUE;
  }
  console.log(
    `[clearCharacterStatuses] Cleared all statuses for entity ${eid}. New statuses:`,
    Array.from(currentStatuses)
  );
}
