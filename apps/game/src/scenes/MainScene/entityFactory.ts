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
  FreshnessTimerComp,
  // Add new components for character creation
  DigestiveSystemComp,
  DiseaseSystemComp,
  SleepSystemComp,
  VitalityComp,
  TemporaryStatusComp,
  EggHatchComp,
} from "./raw-components";
import {
  CharacterKeyECS,
  CharacterState,
  DestinationType,
  FoodState,
  Freshness,
  ObjectType,
  PillState,
  TextureKey,
  SleepMode,
  SleepReason,
} from "./types";
import { generatePersistentNumericId } from "../../utils/generate";
import { EntityComponents } from "./world";
import { INTENTED_FRONT_Z_INDEX } from "@/constants";
import { getCharacterStats } from "./characterStats";
import { createEggHatchSchedule, GAME_CONSTANTS } from "./config";

type WithRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

export function createCharacterEntity(
  world: IWorld,
  components: EntityComponents
): number {
  const _components = components as WithRequired<
    EntityComponents,
    "position" | "speed" | "render" | "object"
  >;
  const eid = addEntity(world);

  addComponent(world, ObjectComp, eid);
  ObjectComp.id[eid] = _components.object?.id || generatePersistentNumericId(); // 영속적인 고유 ID 생성
  ObjectComp.type[eid] = ObjectType.CHARACTER;
  ObjectComp.state[eid] = _components.object.state;

  addComponent(world, CharacterStatusComp, eid);
  CharacterStatusComp.statuses[eid] = new Uint8Array(
    _components.characterStatus?.statuses ??
      Uint8Array.from(
        { length: ECS_CHARACTER_STATUS_LENGTH },
        () => ECS_NULL_VALUE
      )
  );
  CharacterStatusComp.characterKey[eid] =
    _components.characterStatus?.characterKey ||
    CharacterKeyECS.TestGreenSlimeA1; // 기본 캐릭터 키
  CharacterStatusComp.stamina[eid] = _components.characterStatus?.stamina ?? 5; // 기본 스테미나 (MAX보다 낮게 시작)
  CharacterStatusComp.evolutionPhase[eid] =
    _components.characterStatus?.evolutionPhase || 1; // 기본 진화 페이즈는 1
  CharacterStatusComp.evolutionGage[eid] =
    _components.characterStatus?.evolutionGage ?? 0; // 기본 진화 게이지

  addComponent(world, PositionComp, eid);
  PositionComp.x[eid] = _components.position?.x || ECS_NULL_VALUE;
  PositionComp.y[eid] = _components.position?.y || ECS_NULL_VALUE;

  addComponent(world, AngleComp, eid);
  AngleComp.value[eid] = _components.angle?.value || 0; // 기본 각도는 0

  addComponent(world, RenderComp, eid);
  RenderComp.storeIndex[eid] = ECS_NULL_VALUE; // 렌더링 시스템에서 eid로 설정됨
  RenderComp.textureKey[eid] = _components.render.textureKey;

  // 캐릭터 키로부터 스탯 가져와서 scale 설정
  const renderCharacterKey = CharacterStatusComp.characterKey[eid];
  const renderCharacterStats = getCharacterStats(renderCharacterKey);
  RenderComp.scale[eid] =
    _components.render.scale || renderCharacterStats.scale;
  RenderComp.zIndex[eid] = ECS_NULL_VALUE;

  // EGG 상태이거나 죽은 상태가 아닐 때만 애니메이션 렌더링 컴포넌트 추가
  if (
    ObjectComp.state[eid] !== CharacterState.EGG &&
    ObjectComp.state[eid] !== CharacterState.DEAD
  ) {
    addComponent(world, AnimationRenderComp, eid);
    AnimationRenderComp.storeIndex[eid] = ECS_NULL_VALUE; // 렌더링 시스템에서 eid로 설정됨
    AnimationRenderComp.spritesheetKey[eid] =
      _components.animationRender?.spritesheetKey || ECS_NULL_VALUE;
    AnimationRenderComp.animationKey[eid] =
      _components.animationRender?.animationKey || ECS_NULL_VALUE;
    AnimationRenderComp.isPlaying[eid] = _components.animationRender?.isPlaying
      ? 1
      : 0;
    AnimationRenderComp.loop[eid] = _components.animationRender?.loop ? 1 : 0;
    AnimationRenderComp.speed[eid] = _components.animationRender?.speed || 1; // 기본 속도는 1.0
  }

  // 상태 아이콘 렌더링 컴포넌트 초기화
  addComponent(world, StatusIconRenderComp, eid);
  StatusIconRenderComp.storeIndexes[eid] = new Uint8Array(
    ECS_CHARACTER_STATUS_LENGTH
  ).fill(ECS_NULL_VALUE);
  StatusIconRenderComp.visibleCount[eid] = 0;

  addComponent(world, SpeedComp, eid);
  SpeedComp.value[eid] = 0; // idle 상태로 시작

  // EGG 상태이거나 죽은 상태가 아닐 때만 랜덤 이동 컴포넌트 추가
  if (
    ObjectComp.state[eid] !== CharacterState.EGG &&
    ObjectComp.state[eid] !== CharacterState.DEAD
  ) {
    addComponent(world, RandomMovementComp, eid);
    // 기본값으로 설정 (time 관련 속성은 characterStats에서 제거됨)
    RandomMovementComp.minIdleTime[eid] = 2000;
    RandomMovementComp.maxIdleTime[eid] = 8000;
    RandomMovementComp.minMoveTime[eid] = 1000;
    RandomMovementComp.maxMoveTime[eid] = 8000;
    // 캐릭터 생성 시 idle 상태로 시작하도록 설정
    RandomMovementComp.nextChange[eid] =
      Date.now() + 1000 + Math.random() * 2000; // 1-3초 후 첫 이동
  }

  addComponent(world, DestinationComp, eid);
  DestinationComp.type[eid] = ECS_NULL_VALUE;
  DestinationComp.target[eid] = ECS_NULL_VALUE;
  DestinationComp.x[eid] = ECS_NULL_VALUE;
  DestinationComp.y[eid] = ECS_NULL_VALUE;

  // DigestiveSystemComp 추가
  addComponent(world, DigestiveSystemComp, eid);
  DigestiveSystemComp.capacity[eid] = GAME_CONSTANTS.DIGESTIVE_CAPACITY; // GAME_CONSTANTS 사용
  DigestiveSystemComp.currentLoad[eid] = 0.0; // 현재 차있는 양
  DigestiveSystemComp.nextPoopTime[eid] = 0; // 다음 똥 싸는 시간 (처음엔 설정 안함)
  DigestiveSystemComp.nextSmallPoopTime[eid] = 0; // under-capacity 작은 똥 시간 (처음엔 설정 안함)

  // DiseaseSystemComp 추가
  addComponent(world, DiseaseSystemComp, eid);
  DiseaseSystemComp.nextCheckTime[eid] =
    Date.now() + GAME_CONSTANTS.DISEASE_CHECK_INTERVAL; // 첫 질병 체크
  DiseaseSystemComp.sickStartTime[eid] = 0; // 질병 시작 시간 (처음엔 건강)

  // SleepSystemComp 추가
  addComponent(world, SleepSystemComp, eid);
  SleepSystemComp.fatigue[eid] = GAME_CONSTANTS.FATIGUE_DEFAULT;
  SleepSystemComp.nextSleepTime[eid] = 0;
  SleepSystemComp.nextWakeTime[eid] = 0;
  SleepSystemComp.nextNapCheckTime[eid] =
    Date.now() + GAME_CONSTANTS.DAY_NAP_CHECK_INTERVAL;
  SleepSystemComp.nextNightWakeCheckTime[eid] = 0;
  SleepSystemComp.sleepMode[eid] =
    ObjectComp.state[eid] === CharacterState.SLEEPING
      ? SleepMode.NIGHT_SLEEP
      : SleepMode.AWAKE;
  SleepSystemComp.pendingSleepReason[eid] = SleepReason.NONE;
  SleepSystemComp.pendingWakeReason[eid] = SleepReason.NONE;
  SleepSystemComp.sleepSessionStartedAt[eid] =
    ObjectComp.state[eid] === CharacterState.SLEEPING ? Date.now() : 0;

  // VitalityComp 추가
  addComponent(world, VitalityComp, eid);
  VitalityComp.urgentStartTime[eid] = 0; // urgent 상태 시작 시간 (처음엔 설정 안함)
  VitalityComp.deathTime[eid] = 0; // 죽을 시간 (처음엔 설정 안함)
  VitalityComp.isDead[eid] = 0; // 살아있음

  // TemporaryStatusComp 추가
  addComponent(world, TemporaryStatusComp, eid);
  TemporaryStatusComp.statusType[eid] = ECS_NULL_VALUE; // 임시 상태 타입 (초기에는 상태 없음)
  TemporaryStatusComp.startTime[eid] = 0; // 상태 시작 시간
  // 참고: Happy 상태는 스테미나가 GAME_CONSTANTS.MAX_STAMINA 미만에서 GAME_CONSTANTS.MAX_STAMINA로 회복될 때만 시스템에서 설정됨

  // EggHatchComp 추가 (EGG 상태일 때만 의미가 있음)
  addComponent(world, EggHatchComp, eid);
  if (ObjectComp.state[eid] === CharacterState.EGG) {
    const { hatchTime, hatchDurationMs } = createEggHatchSchedule();
    EggHatchComp.hatchTime[eid] = hatchTime;
    EggHatchComp.hatchDurationMs[eid] = hatchDurationMs;
    EggHatchComp.isReadyToHatch[eid] = 0; // 아직 부화 준비 안됨
  } else {
    EggHatchComp.hatchTime[eid] = 0;
    EggHatchComp.hatchDurationMs[eid] = 0;
    EggHatchComp.isReadyToHatch[eid] = 0;
  }

  return eid;
}

// export function createFoodEntity(
//   world: IWorld,
//   components: EntityComponents
// ): number {
//   const _components = components as WithRequired<
//     EntityComponents,
//     "object" | "position" | "angle" | "render" | "freshness"
//   >;
//   const eid = addEntity(world);

//   // ObjectComp
//   addComponent(world, ObjectComp, eid);
//   ObjectComp.id[eid] = _components.object.id || generatePersistentNumericId(); // 영속적인 고유 ID 생성
//   ObjectComp.type[eid] = ObjectType.FOOD;
//   ObjectComp.state[eid] = _components.object.state || FoodState.BEING_THROWING;

//   // PositionComp
//   addComponent(world, PositionComp, eid);
//   PositionComp.x[eid] = _components.position.x || 0;
//   PositionComp.y[eid] = _components.position.y || 0;

//   // RenderComp
//   addComponent(world, RenderComp, eid);
//   RenderComp.storeIndex[eid] = ECS_NULL_VALUE; // 스프라이트 참조 인덱스는 나중에 설정
//   RenderComp.textureKey[eid] = _components.render.textureKey; // Food 텍스처로 변경
//   RenderComp.zIndex[eid] = ECS_NULL_VALUE;

//   // FreshnessComp
//   addComponent(world, FreshnessComp, eid);
//   FreshnessComp.freshness[eid] =
//     _components.freshness.freshness || Freshness.FRESH;

//   // FreshnessTimerComp 추가 (신선도 타이머)
//   addComponent(world, FreshnessTimerComp, eid);
//   FreshnessTimerComp.createdTime[eid] = Date.now();
//   FreshnessTimerComp.normalTime[eid] = GAME_CONSTANTS.FRESH_TO_NORMAL_TIME;
//   FreshnessTimerComp.staleTime[eid] = GAME_CONSTANTS.NORMAL_TO_STALE_TIME;
//   FreshnessTimerComp.isBeingEaten[eid] = 0;

//   return eid;
// }

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
  RenderComp.storeIndex[eid] = ECS_NULL_VALUE; // 렌더링 시스템에서 eid로 설정됨
  RenderComp.textureKey[eid] = TextureKey.PILL1; // Pill은 다른 색상으로
  RenderComp.zIndex[eid] = ECS_NULL_VALUE;

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

  console.log(`[EntityFactory] Creating poob entity with EID: ${eid}`);

  // ObjectComp
  addComponent(world, ObjectComp, eid);
  ObjectComp.id[eid] =
    _components.object.id && _components.object.id !== ECS_NULL_VALUE
      ? _components.object.id
      : generatePersistentNumericId(); // 0이거나 falsy 값일 때 새 ID 생성
  ObjectComp.type[eid] = ObjectType.POOB;
  ObjectComp.state[eid] = ECS_NULL_VALUE; // Poob는 별도 상태 enum이 없음

  console.log(`[EntityFactory] Poob object ID: ${ObjectComp.id[eid]}`);

  // PositionComp
  addComponent(world, PositionComp, eid);
  PositionComp.x[eid] = _components.position.x;
  PositionComp.y[eid] = _components.position.y;

  console.log(
    `[EntityFactory] Poob position: (${PositionComp.x[eid]}, ${PositionComp.y[eid]})`
  );

  // AngleComp
  addComponent(world, AngleComp, eid);
  AngleComp.value[eid] = _components.angle.value || ECS_NULL_VALUE;

  // RenderComp
  addComponent(world, RenderComp, eid);
  RenderComp.storeIndex[eid] = ECS_NULL_VALUE; // 렌더링 시스템에서 eid로 설정됨
  RenderComp.textureKey[eid] = TextureKey.POOB; // Poob 전용 텍스처 사용
  RenderComp.zIndex[eid] = ECS_NULL_VALUE;
  RenderComp.scale[eid] =
    _components.render?.scale ?? 2.4 + Math.random() * (3.6 - 2.4);

  console.log(
    `[EntityFactory] Poob entity created successfully with EID: ${eid}, ObjectID: ${ObjectComp.id[eid]}`
  );

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
  const entityId = generatePersistentNumericId();
  ObjectComp.id[eid] = entityId;
  ObjectComp.type[eid] = ObjectType.FOOD;
  ObjectComp.state[eid] = FoodState.BEING_THROWING;

  // Position component (초기 위치 설정)
  addComponent(world, PositionComp, eid);
  PositionComp.x[eid] = options.initialPosition.x;
  PositionComp.y[eid] = options.initialPosition.y;

  // Render component
  addComponent(world, RenderComp, eid);
  RenderComp.storeIndex[eid] = ECS_NULL_VALUE; // 렌더링 시스템에서 eid로 설정됨
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

  console.log(
    `[EntityFactory] Created throwing food entity: ECS_ID=${eid}, OBJECT_ID=${entityId}`
  );
  console.log(
    `[EntityFactory] - Random food texture key: ${randomFoodKey} (food-${
      Math.floor(Math.random() * 64) + 1
    })`
  );
  console.log(
    `[EntityFactory] - Initial position: (${options.initialPosition.x}, ${options.initialPosition.y})`
  );
  console.log(
    `[EntityFactory] - Final position: (${options.finalPosition.x}, ${options.finalPosition.y})`
  );

  return eid;
}
