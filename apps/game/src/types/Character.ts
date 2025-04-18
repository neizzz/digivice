export enum CharacterKey {
  GreenSlime = "green-slime",
  // Mushroom2 = "mushroom2",
}

// 캐릭터 상태를 나타내는 enum 추가
export enum CharacterState {
  IDLE = "idle",
  WALKING = "walking",
  SLEEPING = "sleeping",
  EATING = "eating", // 먹는 상태 추가
}

export type CharacterMetadata = {
  key: CharacterKey;
  scale: number;
  speed: number;
  animationMapping: Record<CharacterState, string>;
};

export const CharacterDictionary: Record<CharacterKey, CharacterMetadata> = {
  [CharacterKey.GreenSlime]: {
    key: CharacterKey.GreenSlime,
    scale: 3.0,
    speed: 1.0,
    animationMapping: {
      [CharacterState.IDLE]: "idle",
      [CharacterState.WALKING]: "walking",
      [CharacterState.SLEEPING]: "sleeping",
      [CharacterState.EATING]: "eating",
    },
  },
  // [CharacterKey.Mushroom2]: {
  // 	key: CharacterKey.Mushroom2,
  // 	scale: 2.0,
  // 	animationMapping: {
  // 		[CharacterState.IDLE]: "idle",
  // 		[CharacterState.WALKING]: "walking",
  // 		[CharacterState.SLEEPING]: "sleeping",
  // 		[CharacterState.EATING]: "eating", // 먹는 애니메이션 매핑 추가
  // 	},
  // },
  // 다른 캐릭터 추가 가능
};
