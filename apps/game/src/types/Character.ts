export enum CharacterKey {
  /** NOTE: asset 파일명과 직결됨 */
  GreenSlimeA1 = "green-slime_A1",
  GreenSlimeB1 = "green-slime_B1",
  GreenSlimeB2 = "green-slime_B2",
  GreenSlimeB3 = "green-slime_B3",
  GreenSlimeC1 = "green-slime_C1",
  GreenSlimeC2 = "green-slime_C2",
  GreenSlimeC3 = "green-slime_C3",
  GreenSlimeC4 = "green-slime_C4",
  GreenSlimeD1 = "green-slime_D1",
  GreenSlimeD2 = "green-slime_D2",
  GreenSlimeD3 = "green-slime_D3",
  GreenSlimeD4 = "green-slime_D4",

  SkullSlimeA1 = "skull-slime_A1",
  SkullSlimeB1 = "skull-slime_B1",
  SkullSlimeB2 = "skull-slime_B2",
  SkullSlimeC1 = "skull-slime_C1",
  SkullSlimeC2 = "skull-slime_C2",
  SkullSlimeD1 = "skull-slime_D1",
  SkullSlimeD2 = "skull-slime_D2",

  SoilSlimeA1 = "soil-slime_A1",
  SoilSlimeB1 = "soil-slime_B1",
  SoilSlimeB2 = "soil-slime_B2",
  SoilSlimeC1 = "soil-slime_C1",
  SoilSlimeC2 = "soil-slime_C2",
  SoilSlimeC3 = "soil-slime_C3",
  SoilSlimeD1 = "soil-slime_D1",
  SoilSlimeD2 = "soil-slime_D2",
  SoilSlimeD3 = "soil-slime_D3",
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

function getCharacterClassFromKey(key: CharacterKey): CharacterClass {
  const classCode = key.split("_")[1]?.charAt(0);

  switch (classCode) {
    case "A":
      return CharacterClass.A;
    case "B":
      return CharacterClass.B;
    case "C":
      return CharacterClass.C;
    case "D":
      return CharacterClass.D;
    default:
      throw new Error(`[Character] Unknown character class for key=${key}`);
  }
}

export const CharacterDictionary: Record<CharacterKey, CharacterMetadata> =
  Object.fromEntries(
    Object.values(CharacterKey).map((key) => [
      key,
      createCharacterMetadata(key, getCharacterClassFromKey(key)),
    ]),
  ) as Record<CharacterKey, CharacterMetadata>;
