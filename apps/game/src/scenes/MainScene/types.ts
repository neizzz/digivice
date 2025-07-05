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
  IDLE = 1,
  MOVING = 2,
  SLEEPING = 3,
  SICK = 4,
  EATING = 5,
  DEAD = 6,
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
  NULL = 0, // 목적지 없음
  STRAIGHT = 1, // 직선 이동
  THROW = 2, // 던지기(포물선)
  STRAIGHT_LANDING = 3, // 착지하면서 직선 이동
  STRAIGHT_TAKING_OFF = 4, // 이륙하면서 직선 이동
}

/** NOTE: RenderSystem.ts에 {@link TEXTURES}배열과 싱크가 맞아야 함. */
export enum TextureKey {
  // Character sprites
  TestGreenSlimeA1 = 1,
  TestGreenSlimeB1 = 2,
  TestGreenSlimeC1 = 3,
  TestGreenSlimeD1 = 4,
  GreenSlime = 5,
  Mushroom2 = 6,

  // Bird sprites
  Bird1 = 7,
  Bird2 = 8,

  // Food sprites
  Food1 = 9,
  Food2 = 10,
  Food3 = 11,

  // Common 16x16 sprites
  Poob = 12,
  Broom = 13,

  // Common 32x32 sprites
  Basket = 14,
  Tombstone = 15,

  // Egg sprites
  Egg1 = 16,
  Egg2 = 17,

  // Tileset
  GrassTile = 18,
}

/** Components (raw-components에 있는 component와 대응) */
/**
 * ECS 컴포넌트 데이터 타입 정의 (bitECS 컴포넌트 기반)
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

export type RenderComponent = {
  spriteRefIndex: number;
  textureKey: TextureKey;
  zIndex: number;
};

export type SpeedComponent = {
  value: number;
};

export type FreshnessComponent = {
  freshness: Freshness;
};

export type DestinationComponent = {
  type: DestinationType;
  destX: number;
  destY: number;
};

export type RandomMovementComponent = {
  minIdleTime: number;
  maxIdleTime: number;
  minMoveTime: number;
  maxMoveTime: number;
  nextChange: number;
};
