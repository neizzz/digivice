// ECS 컴포넌트 정의
import { defineComponent, Types } from "bitecs";

export const ObjectComp = defineComponent({
  id: Types.f32,
  type: Types.ui8 /** {@link enum ObjectType} */,
  state: Types.ui8, // 각 type 맞는 상태 (상태가 없을 수도 있음)
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
  destX: Types.ui32,
  destY: Types.ui32,
});
export const RandomMovementComp = defineComponent({
  minIdleTime: Types.ui32,
  maxIdleTime: Types.ui32,
  minMoveTime: Types.ui32,
  maxMoveTime: Types.ui32,
  nextChange: Types.ui32,
});

/**
 * Render 관련 컴포넌트들
 */
// export const SpriteComp = defineComponent({ index: Types.ui32 }); // sprite 인스턴스 참조 인덱스
export const RenderComp = defineComponent({
  spriteRefIndex: Types.ui16, // sprite 인스턴스 참조 인덱스
  textureKey: Types.ui16 /** {@link enum TextureKey} */,
  zIndex: Types.ui32,
});
