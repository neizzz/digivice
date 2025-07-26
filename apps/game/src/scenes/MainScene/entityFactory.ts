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
  CharacterStatusComp,
  AnimationRenderComp,
  StatusIconRenderComp,
  ThrowAnimationComp,
} from "./raw-components";
import {
  CharacterKey,
  CharacterState,
  DestinationType,
  FoodState,
  Freshness,
  ObjectType,
  PillState,
  TextureKey,
} from "./types";
import { generatePersistentNumericId } from "../../utils/generate";
import { EntityComponents } from "./world";
import { INTENTED_FRONT_Z_INDEX } from "@/config";

type WithRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

export function createCharacterEntity(
  world: IWorld,
  components: EntityComponents
): number {
  const _components = components as WithRequired<
    EntityComponents,
    "position" | "speed" | "render"
  >;
  const eid = addEntity(world);

  addComponent(world, ObjectComp, eid);
  ObjectComp.id[eid] = components.object?.id || generatePersistentNumericId(); // 영속적인 고유 ID 생성
  ObjectComp.type[eid] = ObjectType.CHARACTER;
  ObjectComp.state[eid] = components.object?.state || CharacterState.IDLE;

  addComponent(world, CharacterStatusComp, eid);
  CharacterStatusComp.statuses[eid] = new Uint8Array(
    components.characterStatus?.statuses ??
      Uint8Array.from(
        { length: ECS_CHARACTER_STATUS_LENGTH },
        () => ECS_NULL_VALUE
      )
  );
  CharacterStatusComp.characterKey[eid] =
    components.characterStatus?.characterKey || CharacterKey.TestGreenSlimeA1; // 기본 캐릭터 키
  CharacterStatusComp.evolutionPhase[eid] =
    components.characterStatus?.evolutionPhase || 1; // 기본 진화 페이즈는 1
  CharacterStatusComp.evolutionGage[eid] =
    components.characterStatus?.evolutionGage ?? 0; // 기본 진화 게이지

  addComponent(world, PositionComp, eid);
  PositionComp.x[eid] = _components.position?.x || ECS_NULL_VALUE;
  PositionComp.y[eid] = _components.position?.y || ECS_NULL_VALUE;

  // addComponent(world, AngleComp, eid);
  // AngleComp.value[eid] = _components.angle?.value || ECS_NULL_VALUE;

  addComponent(world, RenderComp, eid);
  RenderComp.storeIndex[eid] = ECS_NULL_VALUE; // 스프라이트 참조 인덱스는 나중에 설정
  RenderComp.textureKey[eid] = _components.render.textureKey;
  RenderComp.scale[eid] = _components.render.scale || 1; // 기본 스케일은 1
  RenderComp.zIndex[eid] = ECS_NULL_VALUE;

  addComponent(world, AnimationRenderComp, eid);
  AnimationRenderComp.storeIndex[eid] = ECS_NULL_VALUE; // 애니메이션 스프라이트 참조 인덱스는 나중에 설정
  AnimationRenderComp.spritesheetKey[eid] =
    _components.animationRender?.spritesheetKey || ECS_NULL_VALUE;
  AnimationRenderComp.animationKey[eid] =
    _components.animationRender?.animationKey || ECS_NULL_VALUE;
  AnimationRenderComp.isPlaying[eid] = _components.animationRender?.isPlaying
    ? 1
    : 0;
  AnimationRenderComp.loop[eid] = _components.animationRender?.loop ? 1 : 0;
  AnimationRenderComp.speed[eid] = _components.animationRender?.speed || 1; // 기본 속도는 1.0

  // 상태 아이콘 렌더링 컴포넌트 초기화
  addComponent(world, StatusIconRenderComp, eid);
  StatusIconRenderComp.storeIndexes[eid] = new Uint8Array(
    ECS_CHARACTER_STATUS_LENGTH
  ).fill(ECS_NULL_VALUE);
  StatusIconRenderComp.visibleCount[eid] = 0;

  addComponent(world, SpeedComp, eid);
  SpeedComp.value[eid] = _components.speed?.value || ECS_NULL_VALUE;

  // if (components.object?.state !== CharacterState.EGG) {
  addComponent(world, RandomMovementComp, eid);
  RandomMovementComp.minIdleTime[eid] = 2000;
  RandomMovementComp.maxIdleTime[eid] = 8000;
  RandomMovementComp.minMoveTime[eid] = 1000;
  RandomMovementComp.maxMoveTime[eid] = 8000;
  RandomMovementComp.nextChange[eid] = ECS_NULL_VALUE;
  // }

  addComponent(world, DestinationComp, eid);
  DestinationComp.type[eid] = ECS_NULL_VALUE;
  DestinationComp.target[eid] = ECS_NULL_VALUE;
  DestinationComp.x[eid] = ECS_NULL_VALUE;
  DestinationComp.y[eid] = ECS_NULL_VALUE;

  return eid;
}

export function createBirdEntity(
  world: IWorld,
  components: EntityComponents
): number {
  const _components = components as WithRequired<
    EntityComponents,
    "position" | "angle" | "speed"
  >;
  const eid = addEntity(world);

  addComponent(world, ObjectComp, eid);
  ObjectComp.id[eid] = generatePersistentNumericId(); // 영속적인 고유 ID 생성
  ObjectComp.type[eid] = ObjectType.BIRD;
  ObjectComp.state[eid] = 0; // Bird는 별도 상태 enum이 없음

  addComponent(world, PositionComp, eid);
  PositionComp.x[eid] = _components.position.x || 0;
  PositionComp.y[eid] = _components.position.y || 0;

  addComponent(world, AngleComp, eid);
  AngleComp.value[eid] = _components.angle.value || 0;

  addComponent(world, RenderComp, eid);
  RenderComp.storeIndex[eid] = 0;
  RenderComp.textureKey[eid] = ECS_NULL_VALUE; // Bird 텍스처로 변경
  RenderComp.zIndex[eid] = INTENTED_FRONT_Z_INDEX; // Bird는 높은 z-index

  addComponent(world, SpeedComp, eid);
  SpeedComp.value[eid] = _components.speed.value;

  addComponent(world, DestinationComp, eid);
  DestinationComp.type[eid] = DestinationType.NULL;
  DestinationComp.target[eid] = ECS_NULL_VALUE;
  DestinationComp.x[eid] = ECS_NULL_VALUE;
  DestinationComp.y[eid] = ECS_NULL_VALUE;

  return eid;
}

export function createFoodEntity(
  world: IWorld,
  components: EntityComponents
): number {
  const _components = components as WithRequired<
    EntityComponents,
    "object" | "position" | "angle" | "render" | "freshness"
  >;
  const eid = addEntity(world);

  // ObjectComp
  addComponent(world, ObjectComp, eid);
  ObjectComp.id[eid] = _components.object.id || generatePersistentNumericId(); // 영속적인 고유 ID 생성
  ObjectComp.type[eid] = ObjectType.FOOD;
  ObjectComp.state[eid] = _components.object.state || FoodState.BEING_THROWING;

  // PositionComp
  addComponent(world, PositionComp, eid);
  PositionComp.x[eid] = _components.position.x || 0;
  PositionComp.y[eid] = _components.position.y || 0;

  // AngleComp
  addComponent(world, AngleComp, eid);
  AngleComp.value[eid] = _components.angle.value || 0;

  // RenderComp
  addComponent(world, RenderComp, eid);
  RenderComp.storeIndex[eid] = ECS_NULL_VALUE; // 스프라이트 참조 인덱스는 나중에 설정
  RenderComp.textureKey[eid] = _components.render.textureKey; // Food 텍스처로 변경
  RenderComp.zIndex[eid] = _components.position.y;

  // FreshnessComp
  addComponent(world, FreshnessComp, eid);
  FreshnessComp.freshness[eid] =
    _components.freshness.freshness || Freshness.FRESH;

  return eid;
}

export function createPillEntity(
  world: IWorld,
  components: EntityComponents
): number {
  const _components = components as WithRequired<
    EntityComponents,
    "position" | "angle" | "speed"
  >;
  const eid = addEntity(world);

  // ObjectComp
  addComponent(world, ObjectComp, eid);
  ObjectComp.id[eid] = generatePersistentNumericId(); // 영속적인 고유 ID 생성
  ObjectComp.type[eid] = ObjectType.PILL;
  ObjectComp.state[eid] = PillState.BEING_DELIVERED;

  // PositionComp
  addComponent(world, PositionComp, eid);
  PositionComp.x[eid] = _components.position.x || ECS_NULL_VALUE;
  PositionComp.y[eid] = _components.position.y || ECS_NULL_VALUE;

  // AngleComp
  addComponent(world, AngleComp, eid);
  AngleComp.value[eid] = _components.angle.value || ECS_NULL_VALUE;

  // RenderComp
  addComponent(world, RenderComp, eid);
  RenderComp.storeIndex[eid] = ECS_NULL_VALUE; // 스프라이트 참조 인덱스는 나중에 설정
  RenderComp.textureKey[eid] = TextureKey.PILL1; // Pill은 다른 색상으로
  RenderComp.zIndex[eid] = _components.position.y;

  // SpeedComp (알약도 이동할 수 있음)
  addComponent(world, SpeedComp, eid);
  SpeedComp.value[eid] = _components.speed.value || ECS_NULL_VALUE;

  // DestinationComp
  addComponent(world, DestinationComp, eid);
  DestinationComp.type[eid] = DestinationType.NULL;
  DestinationComp.target[eid] = ECS_NULL_VALUE; // 대상 엔티티 ID는 아직 없음
  DestinationComp.x[eid] = ECS_NULL_VALUE;
  DestinationComp.y[eid] = ECS_NULL_VALUE;

  return eid;
}

export function createPoobEntity(
  world: IWorld,
  components: EntityComponents
): number {
  const _components = components as WithRequired<
    EntityComponents,
    "object" | "position" | "angle"
  >;
  const eid = addEntity(world);

  // ObjectComp
  addComponent(world, ObjectComp, eid);
  ObjectComp.id[eid] = _components.object.id || generatePersistentNumericId(); // 영속적인 고유 ID 생성
  ObjectComp.type[eid] = ObjectType.POOB;
  ObjectComp.state[eid] = ECS_NULL_VALUE; // Poob는 별도 상태 enum이 없음

  // PositionComp
  addComponent(world, PositionComp, eid);
  PositionComp.x[eid] = _components.position.x || ECS_NULL_VALUE;
  PositionComp.y[eid] = _components.position.y || ECS_NULL_VALUE;

  // AngleComp
  addComponent(world, AngleComp, eid);
  AngleComp.value[eid] = _components.angle.value || ECS_NULL_VALUE;

  // RenderComp
  addComponent(world, RenderComp, eid);
  RenderComp.storeIndex[eid] = 0;
  RenderComp.textureKey[eid] = TextureKey.POOB; // Poob 전용 텍스처 사용
  RenderComp.zIndex[eid] = _components.position.y;

  return eid;
}

/**
 * 던져지는 음식 엔티티 생성
 */
export function createThrowingFoodEntity(
  world: IWorld,
  options: {
    initialPosition: { x: number; y: number };
    finalPosition: { x: number; y: number };
  }
): number {
  const eid = addEntity(world);

  // 64가지 음식 중 랜덤 선택 (FOOD1 = 400 ~ FOOD64 = 463)
  const randomFoodKey = TextureKey.FOOD1 + Math.floor(Math.random() * 64);

  // Object component
  addComponent(world, ObjectComp, eid);
  ObjectComp.id[eid] = generatePersistentNumericId();
  ObjectComp.type[eid] = ObjectType.FOOD;
  ObjectComp.state[eid] = FoodState.BEING_THROWING;

  // Position component (초기 위치 설정)
  addComponent(world, PositionComp, eid);
  PositionComp.x[eid] = options.initialPosition.x;
  PositionComp.y[eid] = options.initialPosition.y;

  // Angle component (렌더링을 위해 필요)
  addComponent(world, AngleComp, eid);
  AngleComp.value[eid] = 0; // 기본 각도

  // Render component
  addComponent(world, RenderComp, eid);
  RenderComp.storeIndex[eid] = ECS_NULL_VALUE;
  RenderComp.textureKey[eid] = randomFoodKey;
  RenderComp.scale[eid] = 4; // 초기 큰 크기로 시작 (시스템에서 관리)
  RenderComp.zIndex[eid] = INTENTED_FRONT_Z_INDEX;

  // Freshness component
  addComponent(world, FreshnessComp, eid);
  FreshnessComp.freshness[eid] = Freshness.FRESH;

  // Throw animation component
  addComponent(world, ThrowAnimationComp, eid);
  ThrowAnimationComp.initialX[eid] = options.initialPosition.x;
  ThrowAnimationComp.initialY[eid] = options.initialPosition.y;
  ThrowAnimationComp.finalX[eid] = options.finalPosition.x;
  ThrowAnimationComp.finalY[eid] = options.finalPosition.y;
  ThrowAnimationComp.elapsedTime[eid] = 0;
  ThrowAnimationComp.isActive[eid] = 1; // 활성화

  console.log(`[EntityFactory] Created throwing food entity: ${eid}`);
  console.log(
    `[EntityFactory] - Initial position: (${options.initialPosition.x}, ${options.initialPosition.y})`
  );
  console.log(
    `[EntityFactory] - Final position: (${options.finalPosition.x}, ${options.finalPosition.y})`
  );
  console.log(`[EntityFactory] - Random food texture key: ${randomFoodKey}`);

  return eid;
}
