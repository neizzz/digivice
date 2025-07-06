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
  TARGETED = 3, // 목표 지점으로 이동()
  STRAIGHT_LANDING = 4, // 착지하면서 직선 이동
  STRAIGHT_TAKING_OFF = 5, // 이륙하면서 직선 이동
}
/** NOTE: RenderSystem.ts에 {@link TEXTURE_MAP}과 싱크가 맞아야 함. */
export enum TextureKey {
  // Character sprites
  TestGreenSlimeA1 = 1,
  TestGreenSlimeB1 = 2,
  TestGreenSlimeC1 = 3,
  TestGreenSlimeD1 = 4,
  GreenSlime = 5,
  Mushroom2 = 6,

  // Bird sprites
  BIRD = 100,
  // BIRD2 = 101,
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
export type RenderComponent = {
  spriteRefIndex: number;
  textureKey: TextureKey;
  scale: number;
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
