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
  DISCOVER = 5,
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
/** NOTE: RenderSystem {@link TEXTURE_MAP}과 싱크가 맞아야 함. */
export enum TextureKey {
  NULL = ECS_NULL_VALUE,

  // Character Keys (1-99)
  // TestGreenSlimeA1 = 1,
  // TestGreenSlimeB1 = 2,
  // TestGreenSlimeC1 = 3,
  // TestGreenSlimeD1 = 4,

  // Bird sprites (100-199)
  // BIRD = 100,

  // Common 16x16 sprites (200-299)
  POOB = 200,
  BROOM = 201,
  SICK = 202,
  HAPPY = 203,
  UNHAPPY = 204,
  URGENT = 205,
  DISCOVER = 206,

  // Common 32x32 sprites (300-399)
  BASKET = 300,
  TOMB = 301,

  // Food sprites (400-499)
  FOOD1 = 400,
  FOOD2 = 401,
  FOOD3 = 402,
  FOOD4 = 403,
  FOOD5 = 404,
  FOOD6 = 405,
  FOOD7 = 406,
  FOOD8 = 407,
  FOOD9 = 408,
  FOOD10 = 409,
  FOOD11 = 410,
  FOOD12 = 411,
  FOOD13 = 412,
  FOOD14 = 413,
  FOOD15 = 414,
  FOOD16 = 415,
  FOOD17 = 416,
  FOOD18 = 417,
  FOOD19 = 418,
  FOOD20 = 419,
  FOOD21 = 420,
  FOOD22 = 421,
  FOOD23 = 422,
  FOOD24 = 423,
  FOOD25 = 424,
  FOOD26 = 425,
  FOOD27 = 426,
  FOOD28 = 427,
  FOOD29 = 428,
  FOOD30 = 429,
  FOOD31 = 430,
  FOOD32 = 431,
  FOOD33 = 432,
  FOOD34 = 433,
  FOOD35 = 434,
  FOOD36 = 435,
  FOOD37 = 436,
  FOOD38 = 437,
  FOOD39 = 438,
  FOOD40 = 439,
  FOOD41 = 440,
  FOOD42 = 441,
  FOOD43 = 442,
  FOOD44 = 443,
  FOOD45 = 444,
  FOOD46 = 445,
  FOOD47 = 446,
  FOOD48 = 447,
  FOOD49 = 448,
  FOOD50 = 449,
  FOOD51 = 450,
  FOOD52 = 451,
  FOOD53 = 452,
  FOOD54 = 453,
  FOOD55 = 454,
  FOOD56 = 455,
  FOOD57 = 456,
  FOOD58 = 457,
  FOOD59 = 458,
  FOOD60 = 459,
  FOOD61 = 460,
  FOOD62 = 461,
  FOOD63 = 462,
  FOOD64 = 463,

  // Egg sprites (500-599)
  EGG0 = 500,
  EGG1 = 501,

  // Pill sprites (600-699)
  PILL1 = 600,
  PILL2 = 601,
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
  stamina: number; // 스테미나 (0 ~ 10)
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

export type StatusIconRenderComponent = {
  storeIndexes: number[]; // 각 상태 아이콘의 sprite 인스턴스 참조 인덱스 배열
  visibleCount: number; // 현재 표시 중인 아이콘 개수
};
export type ThrowAnimationComponent = {
  initialPosition: PositionComponent;
  finalPosition: PositionComponent;
  initialScale: number;
  finalScale: number;
  duration: number; // ms
  elapsedTime: number; // ms
  isActive: boolean;
  maxHeight: number; // 포물선 최대 높이
};
