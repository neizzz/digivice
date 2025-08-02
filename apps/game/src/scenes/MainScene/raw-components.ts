/** NOTE: typescript type은 types.ts 참고 */
import { defineComponent, Types } from "bitecs";

export const ObjectComp = defineComponent({
  id: Types.f32,
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
export const IntakeComp = defineComponent({
  type: Types.ui8 /** {@link enum IntakeType} */,
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
