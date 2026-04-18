/** NOTE: typescript type은 types.ts 참고 */
import { defineComponent, Types } from "bitecs";

export const ObjectComp = defineComponent({
  id: Types.f64, // 큰 숫자 ID를 정확히 저장하기 위해 f64 사용
  type: Types.ui8 /** {@link enum ObjectType} */,
  state: Types.ui8, // 각 type 맞는 상태 (상태가 없을 수도 있음)
});
export const CharacterStatusComp = defineComponent({
  characterKey: Types.ui16, // = spritesheet key
  stamina: Types.ui8, // 스테미나 (0 ~ 10)
  evolutionGage: Types.f32, // 진화 게이지 (0.0 ~ 100.0)
  evolutionPhase: Types.ui8, // 진화 페이즈 (1 ~ 4)
  statuses: [
    Types.ui8,
    ECS_CHARACTER_STATUS_LENGTH,
  ] /** Array of {@link enum CharacterSatus} */,
});
export const PositionComp = defineComponent({ x: Types.f32, y: Types.f32 });
export const AngleComp = defineComponent({ value: Types.f32 }); // 각도 (라디안 단위)
export const SpeedComp = defineComponent({ value: Types.f32 }); // 속도
export const FreshnessComp = defineComponent({
  freshness: Types.ui8, // enum Freshness
});
export const DestinationComp = defineComponent({
  type: Types.ui8 /** ${@link enum DestinationType} */,
  target: Types.eid,
  x: Types.ui32,
  y: Types.ui32,
});
export const RandomMovementComp = defineComponent({
  minIdleTime: Types.ui32,
  maxIdleTime: Types.ui32,
  minMoveTime: Types.ui32,
  maxMoveTime: Types.ui32,
  nextChange: Types.f64,
});

/**
 * Render 관련 컴포넌트들
 */
export const RenderComp = defineComponent({
  storeIndex: Types.ui16, // sprite 인스턴스 참조 인덱스
  textureKey: Types.ui16 /** {@link enum TextureKey} */,
  scale: Types.f32,
  zIndex: Types.ui16, // 기본적으로 ECS_NULL_VALUE로 설정 -> y 좌표로 설정 (렌더링 순서 결정용)
});
export const AnimationRenderComp = defineComponent({
  storeIndex: Types.ui16, // animated sprite 인스턴스 참조 인덱스
  spritesheetKey: Types.ui16, // 스프라이트 시트 키 (PIXI Assets의 key)
  animationKey: Types.ui8, // 현재 재생 중인 애니메이션 키 {@link enum AnimationKey}
  isPlaying: Types.ui8, // 재생 중인지 여부 (0 = false, 1 = true)
  loop: Types.ui8, // 루프 여부 (0 = false, 1 = true)
  speed: Types.f32, // 애니메이션 속도 배율 (1.0 = 기본 속도)
});
export const StatusIconRenderComp = defineComponent({
  storeIndexes: [Types.ui8, ECS_CHARACTER_STATUS_LENGTH], // 각 상태 아이콘의 sprite 인스턴스 참조 인덱스 배열
  visibleCount: Types.ui8, // 현재 표시 중인 아이콘 개수
});
export const ThrowAnimationComp = defineComponent({
  // Initial position
  initialX: Types.f32,
  initialY: Types.f32,
  // Final position
  finalX: Types.f32,
  finalY: Types.f32,
  // Timing
  elapsedTime: Types.f32, // ms
  // State
  isActive: Types.ui8, // 0 = false, 1 = true
});

/**
 * 음식 먹기 관련 컴포넌트
 */
export const FoodEatingComp = defineComponent({
  targetFood: Types.eid, // 먹을 음식의 엔티티 ID
  progress: Types.f32, // 먹는 진행도 (0.0 ~ 1.0)
  duration: Types.f32, // 먹는데 걸리는 총 시간 (ms)
  elapsedTime: Types.f32, // 경과 시간 (ms)
  isActive: Types.ui8, // 먹고 있는지 여부 (0 = false, 1 = true)
});

/**
 * 음식 마스킹 관련 컴포넌트
 */
export const FoodMaskComp = defineComponent({
  maskStoreIndex: Types.ui16, // 마스크 스프라이트 참조 인덱스
  progress: Types.f32, // 마스킹 진행도 (0.0 ~ 1.0)
  isInitialized: Types.ui8, // 초기화 여부 (0 = false, 1 = true)
});

/**
 * 소화기관 관련 컴포넌트
 */
export const DigestiveSystemComp = defineComponent({
  capacity: Types.f32, // 소화기관 용량 (기본 5.0)
  currentLoad: Types.f32, // 현재 차있는 양
  nextPoopTime: Types.f64, // 다음 똥 싸는 시간 (timestamp)
});

/**
 * 질병 시스템 컴포넌트
 */
export const DiseaseSystemComp = defineComponent({
  nextCheckTime: Types.f64, // 다음 질병 체크 시간 (timestamp)
  sickStartTime: Types.f64, // 질병 시작 시간 (timestamp) - 기록용
});

export const SleepSystemComp = defineComponent({
  fatigue: Types.f32,
  nextSleepTime: Types.f64,
  nextWakeTime: Types.f64,
  nextNapCheckTime: Types.f64,
  nextNightWakeCheckTime: Types.f64,
  sleepMode: Types.ui8,
  pendingSleepReason: Types.ui8,
  pendingWakeReason: Types.ui8,
  sleepSessionStartedAt: Types.f64,
});

/**
 * 음식 신선도 시간 추적 컴포넌트
 */
export const FreshnessTimerComp = defineComponent({
  createdTime: Types.f64, // 음식이 생성된 시간 (timestamp)
  normalTime: Types.ui32, // FRESH -> NORMAL로 변하는 시간 (ms)
  staleTime: Types.ui32, // NORMAL -> STALE로 변하는 시간 (ms)
  isBeingEaten: Types.ui8, // 현재 먹히고 있는지 여부 (0 = false, 1 = true)
});

/**
 * 캐릭터 생존 상태 컴포넌트
 */
export const VitalityComp = defineComponent({
  urgentStartTime: Types.f64, // urgent 상태 시작 시간 (timestamp)
  deathTime: Types.f64, // 죽을 시간 (timestamp)
  isDead: Types.ui8, // 죽었는지 여부 (0 = false, 1 = true)
});

/**
 * 임시 상태 추적 컴포넌트 (happy 등 일시적인 상태용)
 */
export const TemporaryStatusComp = defineComponent({
  statusType: Types.ui8, // 임시 상태 타입 (CharacterStatus enum)
  startTime: Types.f64, // 상태 시작 시간 (timestamp)
});

/**
 * 스파클 이펙트 컴포넌트
 */
export const SparkleEffectComp = defineComponent({
  isActive: Types.ui8, // 효과 활성 상태 (0 = false, 1 = true)
  sparkleCount: Types.ui8, // 현재 반짝임 개수
  nextSpawnTime: Types.f64, // 다음 반짝임 생성 시간 (timestamp)
  spawnInterval: Types.ui32, // 반짝임 생성 간격 (ms)
});
/**
 * 알 부화 컴포넌트
 */
export const EggHatchComp = defineComponent({
  hatchTime: Types.f64, // 부화할 시간 (timestamp)
  isReadyToHatch: Types.ui8, // 부화 준비 완료 여부 (0 = false, 1 = true)
});

/**
 * 청소 대상 컴포넌트 (청소가 가능한 엔티티에 추가)
 */
export const CleanableComp = defineComponent({
  isHighlighted: Types.ui8, // 점선 테두리 표시 여부 (0 = false, 1 = true)
  cleaningProgress: Types.f32, // 청소 진행도 (0.0 = 투명하지 않음, 1.0 = 완전 투명)
  isBeingCleaned: Types.ui8, // 현재 청소 중인지 여부 (0 = false, 1 = true)
});

/**
 * 빗자루 렌더링 컴포넌트
 */
export const BroomRenderComp = defineComponent({
  storeIndex: Types.ui16, // 빗자루 스프라이트 참조 인덱스
  targetX: Types.f32, // 빗자루가 향할 목표 X 좌표
  targetY: Types.f32, // 빗자루가 향할 목표 Y 좌표
  offsetX: Types.f32, // 슬라이더 값에 따른 X 오프셋
  isVisible: Types.ui8, // 빗자루 표시 여부 (0 = false, 1 = true)
});

/**
 * 범용 effect 애니메이션 컴포넌트
 */
export const EffectAnimationComp = defineComponent({
  storeIndex: Types.ui16, // effect 스프라이트 참조 인덱스
  startTime: Types.f64, // 애니메이션 시작 시간 (timestamp)
  duration: Types.f32, // 애니메이션 지속 시간 (ms)
  effectType: Types.ui8, // effect 타입
  isActive: Types.ui8, // 애니메이션 활성화 여부 (0 = false, 1 = true)
});
