export enum CharacterKey {
  /** NOTE: asset 파일명과 직결됨 */
  TestGreenSlimeA1 = "green-slime_A1",
  TestGreenSlimeB1 = "green-slime_B1",
  TestGreenSlimeB2 = "green-slime_B2",
  TestGreenSlimeB3 = "green-slime_B3",
  TestGreenSlimeC1 = "green-slime_C1",
  TestGreenSlimeC2 = "green-slime_C2",
  TestGreenSlimeC3 = "green-slime_C3",
  TestGreenSlimeC4 = "green-slime_C4",
  TestGreenSlimeD1 = "green-slime_D1",
  TestGreenSlimeD2 = "green-slime_D2",
  TestGreenSlimeD3 = "green-slime_D3",
  TestGreenSlimeD4 = "green-slime_D4",
}

export enum CharacterClass {
  A = "character-class-a",
  B = "character-class-b",
  C = "character-class-c",
  D = "character-class-d",
}

export enum CharacterState {
  IDLE = "idle",
  WALKING = "walking",
  SLEEPING = "sleeping",
  SICK = "sick",
  EATING = "eating",
  DEAD = "dead",
}

export type CharacterAnimationMapping = Partial<Record<CharacterState, string>>;

export type CharacterMetadata = {
  key: CharacterKey;
  class: CharacterClass;
  scale: number;
  speed: number;
  animationMapping: CharacterAnimationMapping;
};

const animationMapping: CharacterAnimationMapping = {
  [CharacterState.IDLE]: "idle",
  [CharacterState.WALKING]: "walking",
  [CharacterState.SLEEPING]: "sleeping",
  [CharacterState.EATING]: "eating",
  [CharacterState.SICK]: "sick",
};

function createCharacterMetadata(
  key: CharacterKey,
  characterClass: CharacterClass,
): CharacterMetadata {
  switch (characterClass) {
    case CharacterClass.A:
      return {
        key,
        class: characterClass,
        scale: 3.0,
        speed: 1.0,
        animationMapping,
      };
    case CharacterClass.B:
      return {
        key,
        class: characterClass,
        scale: 3.5,
        speed: 1.5,
        animationMapping,
      };
    case CharacterClass.C:
      return {
        key,
        class: characterClass,
        scale: 4.0,
        speed: 2.0,
        animationMapping,
      };
    case CharacterClass.D:
      return {
        key,
        class: characterClass,
        scale: 4.5,
        speed: 2.5,
        animationMapping,
      };
  }
}

export const CharacterDictionary: Record<CharacterKey, CharacterMetadata> = {
  [CharacterKey.TestGreenSlimeA1]: createCharacterMetadata(
    CharacterKey.TestGreenSlimeA1,
    CharacterClass.A,
  ),
  [CharacterKey.TestGreenSlimeB1]: createCharacterMetadata(
    CharacterKey.TestGreenSlimeB1,
    CharacterClass.B,
  ),
  [CharacterKey.TestGreenSlimeB2]: createCharacterMetadata(
    CharacterKey.TestGreenSlimeB2,
    CharacterClass.B,
  ),
  [CharacterKey.TestGreenSlimeB3]: createCharacterMetadata(
    CharacterKey.TestGreenSlimeB3,
    CharacterClass.B,
  ),
  [CharacterKey.TestGreenSlimeC1]: createCharacterMetadata(
    CharacterKey.TestGreenSlimeC1,
    CharacterClass.C,
  ),
  [CharacterKey.TestGreenSlimeC2]: createCharacterMetadata(
    CharacterKey.TestGreenSlimeC2,
    CharacterClass.C,
  ),
  [CharacterKey.TestGreenSlimeC3]: createCharacterMetadata(
    CharacterKey.TestGreenSlimeC3,
    CharacterClass.C,
  ),
  [CharacterKey.TestGreenSlimeC4]: createCharacterMetadata(
    CharacterKey.TestGreenSlimeC4,
    CharacterClass.C,
  ),
  [CharacterKey.TestGreenSlimeD1]: createCharacterMetadata(
    CharacterKey.TestGreenSlimeD1,
    CharacterClass.D,
  ),
  [CharacterKey.TestGreenSlimeD2]: createCharacterMetadata(
    CharacterKey.TestGreenSlimeD2,
    CharacterClass.D,
  ),
  [CharacterKey.TestGreenSlimeD3]: createCharacterMetadata(
    CharacterKey.TestGreenSlimeD3,
    CharacterClass.D,
  ),
  [CharacterKey.TestGreenSlimeD4]: createCharacterMetadata(
    CharacterKey.TestGreenSlimeD4,
    CharacterClass.D,
  ),
};
