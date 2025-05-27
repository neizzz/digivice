export enum CharacterKey {
  /** NOTE: asset 파일명과 직결됨 */
  TestGreenSlimeA1 = "test-green-slime_A1",
  TestGreenSlimeB1 = "test-green-slime_B1",
  TestGreenSlimeC1 = "test-green-slime_C1",
  TestGreenSlimeD1 = "test-green-slime_D1",
  // Mushroom2 = "mushroom2",
}

export enum CharacterClass {
  A = "character-class-a",
  B = "character-class-b",
  C = "character-class-c",
  D = "character-class-d",
}

// 캐릭터 상태를 나타내는 enum 추가
export enum CharacterState {
  IDLE = "idle",
  WALKING = "walking",
  SLEEPING = "sleeping",
  SICK = "sick",
  EATING = "eating", // 먹는 상태 추가
  DEAD = "dead", // 죽은 상태 추가
}

export type CharacterAnimationMapping = Partial<Record<CharacterState, string>>;

export type CharacterMetadata = {
  key: CharacterKey;
  class: CharacterClass;
  scale: number;
  speed: number;
  maxStamina: number; // 최대 스태미나 (옵션)
  animationMapping: CharacterAnimationMapping;
};

const animationMapping: CharacterAnimationMapping = {
  [CharacterState.IDLE]: "idle",
  [CharacterState.WALKING]: "walking",
  [CharacterState.SLEEPING]: "sleeping",
  [CharacterState.EATING]: "eating",
  [CharacterState.SICK]: "sick",
};

export const CharacterDictionary: Record<
  CharacterKey,
  // CharacterKey | "egg",
  CharacterMetadata
> = {
  // egg: {
  //   key: "egg",
  //   scale: 2.0,
  //   speed: Number.NaN,
  //   maxStamina: Number.NaN,
  //   animationMapping,
  // },
  [CharacterKey.TestGreenSlimeA1]: {
    key: CharacterKey.TestGreenSlimeA1,
    class: CharacterClass.A,
    scale: 3.0,
    speed: 1.0,
    maxStamina: 10, // 기본 최대 스태미나 값
    animationMapping,
  },
  [CharacterKey.TestGreenSlimeB1]: {
    key: CharacterKey.TestGreenSlimeB1,
    class: CharacterClass.B,
    scale: 3.5,
    speed: 1.5,
    maxStamina: 10, // 기본 최대 스태미나 값
    animationMapping,
  },
  [CharacterKey.TestGreenSlimeC1]: {
    key: CharacterKey.TestGreenSlimeC1,
    class: CharacterClass.C,
    scale: 4.0,
    speed: 2.0,
    maxStamina: 10, // 기본 최대 스태미나 값
    animationMapping,
  },
  [CharacterKey.TestGreenSlimeD1]: {
    key: CharacterKey.TestGreenSlimeD1,
    class: CharacterClass.D,
    scale: 4.5,
    speed: 2.5,
    maxStamina: 10, // 기본 최대 스태미나 값
    animationMapping,
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
