// Entity 생성 함수들
import { addEntity, addComponent, IWorld } from "bitecs";
import {
  ObjectComp,
  PositionComp,
  AngleComp,
  RenderComp,
  FreshnessComp,
  RandomMovementComp,
  SpeedComp,
  DestinationComp,
} from "./raw-components";
import {
  CharacterState,
  DestinationType,
  FoodState,
  Freshness,
  ObjectType,
  PillState,
  TextureKey,
} from "./types";
import { generatePersistentNumericId } from "../../utils/generate";

export interface CreateEntityOptions {
  x?: number;
  y?: number;
  angle?: number;
  speed?: number;
}

/**
 * Character 엔티티 생성
 * Components: [ActorTag, ObjectComp, PositionComp, AngleComp, RenderComp]
 */
export function createCharacterEntity(
  world: IWorld,
  options: CreateEntityOptions = {}
): number {
  const eid = addEntity(world);

  // ObjectComp
  addComponent(world, ObjectComp, eid);
  ObjectComp.id[eid] = generatePersistentNumericId(); // 영속적인 고유 ID 생성
  ObjectComp.type[eid] = ObjectType.CHARACTER;
  ObjectComp.state[eid] = CharacterState.IDLE;

  // PositionComp
  addComponent(world, PositionComp, eid);
  PositionComp.x[eid] = options.x ?? 0;
  PositionComp.y[eid] = options.y ?? 0;

  // AngleComp
  addComponent(world, AngleComp, eid);
  AngleComp.value[eid] = options.angle ?? 0;

  // RenderComp
  addComponent(world, RenderComp, eid);
  RenderComp.spriteRefIndex[eid] = 0; // 스프라이트 참조 인덱스는 나중에 설정
  RenderComp.textureKey[eid] = TextureKey.TestGreenSlimeA1;
  RenderComp.zIndex[eid] = options.y ?? 0;

  // SpeedComp (캐릭터는 이동 가능)
  addComponent(world, SpeedComp, eid);
  SpeedComp.value[eid] = options.speed ?? 50;

  // RandomMovementComp (랜덤 움직임)
  addComponent(world, RandomMovementComp, eid);
  RandomMovementComp.minIdleTime[eid] = 1000;
  RandomMovementComp.maxIdleTime[eid] = 3000;
  RandomMovementComp.minMoveTime[eid] = 1000;
  RandomMovementComp.maxMoveTime[eid] = 2000;
  RandomMovementComp.nextChange[eid] = Date.now() + 1000;

  // DestinationComp
  addComponent(world, DestinationComp, eid);
  DestinationComp.type[eid] = DestinationType.NULL;
  DestinationComp.destX[eid] = 0;
  DestinationComp.destY[eid] = 0;

  return eid;
}

/**
 * Bird 엔티티 생성
 * Components: [BirdTag, ObjectComp, PositionComp, AngleComp, RenderComp]
 */
export function createBirdEntity(
  world: IWorld,
  options: CreateEntityOptions = {}
): number {
  const eid = addEntity(world);

  // ObjectComp
  addComponent(world, ObjectComp, eid);
  ObjectComp.id[eid] = generatePersistentNumericId(); // 영속적인 고유 ID 생성
  ObjectComp.type[eid] = ObjectType.BIRD;
  ObjectComp.state[eid] = 0; // Bird는 별도 상태 enum이 없음

  // PositionComp
  addComponent(world, PositionComp, eid);
  PositionComp.x[eid] = options.x ?? 0;
  PositionComp.y[eid] = options.y ?? 0;

  // AngleComp
  addComponent(world, AngleComp, eid);
  AngleComp.value[eid] = options.angle ?? 0;

  // RenderComp
  addComponent(world, RenderComp, eid);
  RenderComp.spriteRefIndex[eid] = 0;
  RenderComp.textureKey[eid] = TextureKey.Bird1; // Bird 텍스처로 변경
  RenderComp.zIndex[eid] = (options.y ?? 0) + 1000; // Bird는 높은 z-index

  // SpeedComp (새는 빠르게 이동)
  addComponent(world, SpeedComp, eid);
  SpeedComp.value[eid] = options.speed ?? 100;

  // DestinationComp
  addComponent(world, DestinationComp, eid);
  DestinationComp.type[eid] = DestinationType.NULL;
  DestinationComp.destX[eid] = 0;
  DestinationComp.destY[eid] = 0;

  return eid;
}

/**
 * Food 엔티티 생성
 * Components: [ObjectComp, PositionComp, AngleComp, RenderComp, FreshnessComp]
 */
export function createFoodEntity(
  world: IWorld,
  options: CreateEntityOptions & { freshness?: Freshness } = {}
): number {
  const eid = addEntity(world);

  // ObjectComp
  addComponent(world, ObjectComp, eid);
  ObjectComp.id[eid] = generatePersistentNumericId(); // 영속적인 고유 ID 생성
  ObjectComp.type[eid] = ObjectType.FOOD;
  ObjectComp.state[eid] = FoodState.LANDED;

  // PositionComp
  addComponent(world, PositionComp, eid);
  PositionComp.x[eid] = options.x ?? 0;
  PositionComp.y[eid] = options.y ?? 0;

  // AngleComp
  addComponent(world, AngleComp, eid);
  AngleComp.value[eid] = options.angle ?? 0;

  // RenderComp
  addComponent(world, RenderComp, eid);
  RenderComp.spriteRefIndex[eid] = 0;
  RenderComp.textureKey[eid] = TextureKey.Food1; // Food 텍스처로 변경
  RenderComp.zIndex[eid] = options.y ?? 0;

  // FreshnessComp
  addComponent(world, FreshnessComp, eid);
  FreshnessComp.freshness[eid] = options.freshness ?? Freshness.FRESH;

  return eid;
}

/**
 * Pill 엔티티 생성
 * Components: [ObjectComp, PositionComp, AngleComp, RenderComp]
 */
export function createPillEntity(
  world: IWorld,
  options: CreateEntityOptions = {}
): number {
  const eid = addEntity(world);

  // ObjectComp
  addComponent(world, ObjectComp, eid);
  ObjectComp.id[eid] = generatePersistentNumericId(); // 영속적인 고유 ID 생성
  ObjectComp.type[eid] = ObjectType.PILL;
  ObjectComp.state[eid] = PillState.BEING_DELIVERED;

  // PositionComp
  addComponent(world, PositionComp, eid);
  PositionComp.x[eid] = options.x ?? 0;
  PositionComp.y[eid] = options.y ?? 0;

  // AngleComp
  addComponent(world, AngleComp, eid);
  AngleComp.value[eid] = options.angle ?? 0;

  // RenderComp
  addComponent(world, RenderComp, eid);
  RenderComp.spriteRefIndex[eid] = 0;
  RenderComp.textureKey[eid] = TextureKey.TestGreenSlimeD1; // Pill은 다른 색상으로
  RenderComp.zIndex[eid] = options.y ?? 0;

  // SpeedComp (알약도 이동할 수 있음)
  addComponent(world, SpeedComp, eid);
  SpeedComp.value[eid] = options.speed ?? 30;

  // DestinationComp
  addComponent(world, DestinationComp, eid);
  DestinationComp.type[eid] = DestinationType.NULL;
  DestinationComp.destX[eid] = 0;
  DestinationComp.destY[eid] = 0;

  return eid;
}

/**
 * Poob 엔티티 생성
 * Components: [ObjectComp, PositionComp, AngleComp, RenderComp]
 */
export function createPoobEntity(
  world: IWorld,
  options: CreateEntityOptions = {}
): number {
  const eid = addEntity(world);

  // ObjectComp
  addComponent(world, ObjectComp, eid);
  ObjectComp.id[eid] = generatePersistentNumericId(); // 영속적인 고유 ID 생성
  ObjectComp.type[eid] = ObjectType.POOB;
  ObjectComp.state[eid] = 0; // Poob는 별도 상태 enum이 없음

  // PositionComp
  addComponent(world, PositionComp, eid);
  PositionComp.x[eid] = options.x ?? 0;
  PositionComp.y[eid] = options.y ?? 0;

  // AngleComp
  addComponent(world, AngleComp, eid);
  AngleComp.value[eid] = options.angle ?? 0;

  // RenderComp
  addComponent(world, RenderComp, eid);
  RenderComp.spriteRefIndex[eid] = 0;
  RenderComp.textureKey[eid] = TextureKey.Poob; // Poob 전용 텍스처 사용
  RenderComp.zIndex[eid] = options.y ?? 0;

  return eid;
}
