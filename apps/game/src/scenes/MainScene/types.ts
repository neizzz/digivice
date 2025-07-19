/**
 * Types
 */
export type Boundary = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Enums
 */
export enum ObjectType {
  CHARACTER = 1 /** {@link enum CharacterState} */,
  BIRD = 2,
  FOOD = 3 /** {@link enum FoodState} */,
  POOB = 4,
  PILL = 5 /** {@link enum PillState} */,
}
export enum CharacterState {
  EGG = 0,
  IDLE = 1,
  MOVING = 2,
  SLEEPING = 3,
  SICK = 4,
  EATING = 5,
  DEAD = 6,
}
export enum CharacterStatus {
  UNHAPPY = 1,
  URGENT = 2,
  SICK = 3,
  HAPPY = 4,
}
export enum FoodState {
  BEING_THROWING = 1,
  LANDED = 2,
  BEING_INTAKEN = 3,
  TARGETED = 4,
  CLEANING = 5,
  CLEANED = 6,
}
// TODO:
export enum PillState {
  BEING_DELIVERED = 1,
  BEING_INTAKEN = 2,
}
export enum Freshness {
  FRESH = 1,
  NORMAL = 2,
  STALE = 3,
}
export enum IntakeType {
  BITE = 1,
  ABSORPTION = 2,
}
export enum DestinationType {
  NULL = ECS_NULL_VALUE,

  STRAIGHT = 1, // 직선 이동
  THROW = 2, // 던지기(포물선)
  TARGETED = 3, // 목표 지점으로 이동()
  STRAIGHT_LANDING = 4, // 착지하면서 직선 이동
  STRAIGHT_TAKING_OFF = 5, // 이륙하면서 직선 이동
}
/** NOTE: RenderSystem.ts에 {@link TEXTURE_MAP}과 싱크가 맞아야 함. */
export enum CharacterKey {
  NULL = ECS_NULL_VALUE,

  TestGreenSlimeA1 = 1,
  TestGreenSlimeB1 = 2,
  TestGreenSlimeC1 = 3,
  TestGreenSlimeD1 = 4,
}
export enum SpritesheetKey {
  NULL = ECS_NULL_VALUE,

  // Character spriteshsetKey (= CharacterKey)
  TestGreenSlimeA1 = 1,
  TestGreenSlimeB1 = 2,
  TestGreenSlimeC1 = 3,
  TestGreenSlimeD1 = 4,

  // TestGreenSlimeA1 = "test-green-slime_A1",
  // TestGreenSlimeB1 = "test-green-slime_B1",
  // TestGreenSlimeC1 = "test-green-slime_C1",
  // TestGreenSlimeD1 = "test-green-slime_D1",
}
export enum AnimationKey {
  NULL = ECS_NULL_VALUE,
  IDLE = 1,
  WALKING = 2,
  SLEEPING = 3,
  EATING = 4,
  SICK = 5,
  FLY = 6,
}
export enum TextureKey {
  NULL = ECS_NULL_VALUE,

  // Character Keys
  // TestGreenSlimeA1 = 1,
  // TestGreenSlimeB1 = 2,
  // TestGreenSlimeC1 = 3,
  // TestGreenSlimeD1 = 4,

  // Bird sprites
  // BIRD = 100,

  // Common 16x16 sprites
  POOB = 101,
  BROOM = 102,

  // Common 32x32 sprites
  BASKET = 103,
  TOMB = 104,

  // Food sprites
  FOOD1 = 110,
  FOOD2 = 111,
  FOOD3 = 112,

  // Egg sprites
  EGG0 = 150,
  EGG1 = 151,

  PILL1 = 200,
  PILL2 = 201,
}

/**
 * Components (raw-components.ts에 있는 ECS component와 대응)
 */
export type PositionComponent = {
  x: number;
  y: number;
};
export type AngleComponent = {
  value: number; // 라디안 단위
};
export type ObjectComponent = {
  id: number;
  type: ObjectType;
  state: number; // CharacterState, FoodState, PillState 등
};
export type CharacterStatusComponent = {
  characterKey: CharacterKey; // 캐릭터 키 (TextureKey)
  evolutionGage: number; // 진화 게이지 (0.0 ~ 100.0)
  evolutionPhase: number; // 진화 페이즈 (1 ~ 4)
  statuses: CharacterStatus[]; // Array of {@link enum CharacterStatus}
};
export type SpeedComponent = {
  value: number;
};
export type FreshnessComponent = {
  freshness: Freshness;
};
export type DestinationComponent = {
  type: DestinationType;
  target: number; // 대상 엔티티 ID (TARGETED인 경우 사용)
  x: number;
  y: number;
};
export type RandomMovementComponent = {
  minIdleTime: number;
  maxIdleTime: number;
  minMoveTime: number;
  maxMoveTime: number;
  nextChange: number;
};

export type RenderComponent = {
  storeIndex: number;
  textureKey: TextureKey;
  scale: number;
  zIndex: number;
};

export type AnimationRenderComponent = {
  storeIndex: number; // animated sprite 인스턴스 참조 인덱스
  spritesheetKey: SpritesheetKey; // 스프라이트 시트 키 (PIXI Assets의 key)
  animationKey: AnimationKey; // 현재 재생 중인 애니메이션 키
  isPlaying: boolean; // 재생 중인지 여부
  loop: boolean; // 루프 여부
  speed: number; // 애니메이션 속도 배율 (1.0 = 기본 속도)
};
