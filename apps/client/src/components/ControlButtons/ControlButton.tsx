import { ControlButtonType } from "@digivice/game";
import type React from "react";
import { useEffect, useState, useRef } from "react";
import { SliderController } from "../SliderController";
import { VibrationAdapter } from "../../adapter/VibrationAdapter";
import {
  playBroomSound,
  playBigJumpSound,
  playControlButtonDownSound,
  playControlButtonUpSound,
  playSmallJumpSound,
} from "../../utils/uiSfx";

const SLIDER_THUMB_SIZE = 64;
const SLIDER_TRACK_RANGE_MULTIPLIER = 1.1;
const SLIDER_INPUT_RANGE_MULTIPLIER = 1.05;
const SLIDER_DRAG_VIBRATION_STEP_PX = 12;
const SLIDER_DRAG_VIBRATION_DURATION = 10;
const SLIDER_DRAG_VIBRATION_STRENGTH = 18;
const SLIDER_DIRECTION_CHANGE_VIBRATION_DURATION = 14;
const SLIDER_DIRECTION_CHANGE_VIBRATION_STRENGTH = 30;
const SLIDER_DIRECTION_CHANGE_THRESHOLD = 0.008;

interface ControlButtonProps {
  type: ControlButtonType;
  onClick?: () => void; // 클릭 이벤트 핸들러
  className?: string; // 추가 스타일링을 위한 클래스
  // 슬라이더 버튼을 위한 추가 props
  sliderWidth?: number;
  initialSliderValue?: number;
  hasCleaningTarget?: boolean;
  onSliderChange?: (value: number) => void;
  onSliderEnd?: () => void; // 슬라이더 종료 이벤트 핸들러
  isSlider?: boolean;
}

const spriteInfoMap: Record<
  ControlButtonType,
  {
    normal: { x: number; y: number };
    pressed: { x: number; y: number };
  }
> = {
  [ControlButtonType.Clean]: {
    normal: { x: 640, y: 0 },
    pressed: { x: 704, y: 0 },
  },
  [ControlButtonType.Jump]: {
    normal: { x: 768, y: 0 },
    pressed: { x: 832, y: 0 },
  },
  [ControlButtonType.DoubleJump]: {
    normal: { x: 896, y: 0 },
    pressed: { x: 960, y: 0 },
  },
  [ControlButtonType.Attack]: {
    normal: { x: 1024, y: 0 },
    pressed: { x: 1088, y: 0 },
  },
  [ControlButtonType.Settings]: {
    normal: { x: 1152, y: 0 },
    pressed: { x: 1216, y: 0 },
  },
  [ControlButtonType.Next]: {
    normal: { x: 1280, y: 0 },
    pressed: { x: 1344, y: 0 },
  },
  [ControlButtonType.Confirm]: {
    normal: { x: 1408, y: 0 },
    pressed: { x: 1472, y: 0 },
  },
  [ControlButtonType.Cancel]: {
    normal: { x: 1536, y: 0 },
    pressed: { x: 1600, y: 0 },
  },
  [ControlButtonType.Book]: {
    normal: { x: 1664, y: 0 },
    pressed: { x: 1728, y: 0 },
  },
  [ControlButtonType.Previous]: {
    normal: { x: 1792, y: 0 },
    pressed: { x: 1856, y: 0 },
  },
};

// VibrationAdapter 싱글톤 인스턴스
const vibrationAdapter = new VibrationAdapter();

const ControlButton: React.FC<ControlButtonProps> = ({
  type,
  onClick,
  className,
  sliderWidth,
  initialSliderValue = 0.5,
  hasCleaningTarget = false,
  onSliderChange,
  onSliderEnd,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [currentSliderValue, setCurrentSliderValue] =
    useState(initialSliderValue);
  const sliderRef = useRef<HTMLDivElement>(null);
  const sliderControllerRef = useRef<SliderController | null>(null);
  const currentSliderValueRef = useRef(initialSliderValue);
  const lastSliderDragValueRef = useRef(initialSliderValue);
  const accumulatedDragDistanceRef = useRef(0);
  const lastDragDirectionRef = useRef<-1 | 0 | 1>(0);
  const hasCleaningTargetRef = useRef(hasCleaningTarget);
  const onSliderChangeRef = useRef(onSliderChange);
  const onSliderEndRef = useRef(onSliderEnd);
  const vibrationStepValueRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isPressedRef = useRef(false);

  const isSlider = type === ControlButtonType.Clean && !!sliderWidth;
  const sliderTrackWidth = sliderWidth
    ? Math.max(
        0,
        (sliderWidth - SLIDER_THUMB_SIZE) * SLIDER_TRACK_RANGE_MULTIPLIER,
      )
    : 0;
  const vibrationStepValue = Math.min(
    1,
    SLIDER_DRAG_VIBRATION_STEP_PX / Math.max(1, sliderTrackWidth),
  );

  useEffect(() => {
    hasCleaningTargetRef.current = hasCleaningTarget;
    onSliderChangeRef.current = onSliderChange;
    onSliderEndRef.current = onSliderEnd;
    vibrationStepValueRef.current = vibrationStepValue;
  }, [hasCleaningTarget, onSliderChange, onSliderEnd, vibrationStepValue]);

  // 슬라이더 컨트롤러 초기화 및 정리
  useEffect(() => {
    // 슬라이더인 경우에만 컨트롤러 생성
    if (isSlider && sliderRef.current) {
      const controller = new SliderController(sliderRef.current, {
        initialValue: initialSliderValue,
        thumbWidth: SLIDER_THUMB_SIZE,
        rangeMultiplier: SLIDER_INPUT_RANGE_MULTIPLIER,
        onChange: (value) => {
          const signedDelta = value - lastSliderDragValueRef.current;
          const delta = Math.abs(signedDelta);
          const dragDirection =
            signedDelta > SLIDER_DIRECTION_CHANGE_THRESHOLD
              ? 1
              : signedDelta < -SLIDER_DIRECTION_CHANGE_THRESHOLD
                ? -1
                : 0;

          if (hasCleaningTargetRef.current && dragDirection !== 0) {
            const hasStartedMoving = lastDragDirectionRef.current === 0;
            const hasChangedDirection =
              lastDragDirectionRef.current !== 0 &&
              dragDirection !== lastDragDirectionRef.current;

            if (hasStartedMoving || hasChangedDirection) {
              playBroomSound();
            }

            if (hasChangedDirection) {
              void vibrationAdapter.vibrate(
                SLIDER_DIRECTION_CHANGE_VIBRATION_DURATION,
                SLIDER_DIRECTION_CHANGE_VIBRATION_STRENGTH,
              );
            }
          }

          if (dragDirection !== 0) {
            lastDragDirectionRef.current = dragDirection;
          }

          accumulatedDragDistanceRef.current += delta;
          lastSliderDragValueRef.current = value;
          currentSliderValueRef.current = value;

          if (
            hasCleaningTargetRef.current &&
            accumulatedDragDistanceRef.current >= vibrationStepValueRef.current
          ) {
            accumulatedDragDistanceRef.current %= vibrationStepValueRef.current;
            void vibrationAdapter.vibrate(
              SLIDER_DRAG_VIBRATION_DURATION,
              SLIDER_DRAG_VIBRATION_STRENGTH,
            );
          }

          setCurrentSliderValue(value);
          onSliderChangeRef.current?.(value);
        },
        onDragStart: () => {
          playControlButtonDownSound();
          isDraggingRef.current = true;
          lastSliderDragValueRef.current = currentSliderValueRef.current;
          accumulatedDragDistanceRef.current = 0;
          lastDragDirectionRef.current = 0;
          setIsPressed(true);
        },
        onDragEnd: () => {
          playControlButtonUpSound();
          isDraggingRef.current = false;
          accumulatedDragDistanceRef.current = 0;
          lastDragDirectionRef.current = 0;
          setIsPressed(false);
          onSliderEndRef.current?.();
          vibrationAdapter.vibrate();
        },
      });

      sliderControllerRef.current = controller;

      // 정리 함수
      return () => {
        isDraggingRef.current = false;
        controller.dispose();
        sliderControllerRef.current = null;
      };
    }
  }, [isSlider]);

  useEffect(() => {
    if (isDraggingRef.current) {
      return;
    }

    setCurrentSliderValue(initialSliderValue);
    currentSliderValueRef.current = initialSliderValue;
    lastSliderDragValueRef.current = initialSliderValue;
    accumulatedDragDistanceRef.current = 0;
    lastDragDirectionRef.current = 0;
    sliderControllerRef.current?.setValue(initialSliderValue, {
      emitChange: false,
    });
  }, [initialSliderValue]);

  // 버튼 누름 상태에 따른 스프라이트 정보 선택
  const size = SLIDER_THUMB_SIZE;
  const spriteState = isPressed ? "pressed" : "normal";
  const spriteInfo = spriteInfoMap[type][spriteState];
  const shouldTriggerOnPointerDown =
    type === ControlButtonType.Jump || type === ControlButtonType.DoubleJump;
  const shouldPlayControlButtonKeySound = !(
    type === ControlButtonType.Jump || type === ControlButtonType.DoubleJump
  );

  // 일반 버튼 이벤트 핸들러
  const handlePointerDown = () => {
    if (!isSlider) {
      isPressedRef.current = true;
      setIsPressed(true);

      if (shouldPlayControlButtonKeySound) {
        playControlButtonDownSound();
      } else if (type === ControlButtonType.Jump) {
        playSmallJumpSound();
      } else if (type === ControlButtonType.DoubleJump) {
        playBigJumpSound();
      }

      if (shouldTriggerOnPointerDown) {
        onClick?.();
        window.setTimeout(() => {
          void vibrationAdapter.vibrate();
        }, 0);
      }
    }
  };

  const handlePointerUp = () => {
    if (!isSlider) {
      const shouldTriggerClick = isPressedRef.current;
      isPressedRef.current = false;
      setIsPressed(false);

      if (shouldTriggerClick && shouldPlayControlButtonKeySound) {
        playControlButtonUpSound();
      }

      if (shouldTriggerClick && !shouldTriggerOnPointerDown) {
        onClick?.();
        window.setTimeout(() => {
          void vibrationAdapter.vibrate();
        }, 0);
      }
    }
  };

  const handlePointerLeave = () => {
    if (!isSlider && isPressedRef.current) {
      isPressedRef.current = false;
      setIsPressed(false);
      if (shouldPlayControlButtonKeySound) {
        playControlButtonUpSound();
      }
    }
  };

  const handlePointerCancel = () => {
    if (!isSlider && isPressedRef.current) {
      isPressedRef.current = false;
      setIsPressed(false);
      if (shouldPlayControlButtonKeySound) {
        playControlButtonUpSound();
      }
    }
  };

  const buttonStyle = {
    width: `${size}px`,
    height: `${size}px`,
    backgroundImage: `url("/assets/ui/sprites/control-buttons.png")`,
    backgroundPosition: `-${spriteInfo.x}px -${spriteInfo.y}px`,
  };

  // 슬라이더 버튼 렌더링
  if (isSlider) {
    const trackInset = size / 2;
    const baseTrackWidth = Math.max(0, sliderWidth - size);
    const trackWidth = sliderTrackWidth;
    const extraTrackOffset = (trackWidth - baseTrackWidth) / 2;

    return (
      <div
        className={"relative flex justify-center overflow-visible"}
        style={{ width: `${sliderWidth}px`, height: `${size}px` }}
        ref={sliderRef}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 h-4 bg-gray-700 bg-opacity-50 rounded-full"
          style={{
            left: `${trackInset - extraTrackOffset}px`,
            width: `${trackWidth}px`,
          }}
        />
        <div
          className="absolute top-0 left-0 h-full"
          style={{
            transform: `translateX(${currentSliderValue * trackWidth - extraTrackOffset}px)`,
          }}
        >
          <div
            style={buttonStyle}
            className="bg-no-repeat border-none bg-transparent p-0 outline-none select-none [-webkit-tap-highlight-color:transparent] scale-[1.4]"
          />
        </div>
      </div>
    );
  }

  // 일반 버튼 렌더링
  return (
    <button
      type={"button"}
      style={buttonStyle}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerCancel}
      className={`bg-no-repeat border-none bg-transparent p-0 outline-none select-none [-webkit-tap-highlight-color:transparent] scale-[1.4] ${
        className || ""
      }`}
    />
  );
};

export default ControlButton;
