import { ControlButtonType } from "@digivice/game";
import type React from "react";
import { useEffect, useState, useRef } from "react";
import { SliderController } from "../SliderController";

interface ControlButtonProps {
  type: ControlButtonType;
  onClick?: () => void; // 클릭 이벤트 핸들러
  className?: string; // 추가 스타일링을 위한 클래스
  // 슬라이더 버튼을 위한 추가 props
  sliderWidth?: number;
  initialSliderValue?: number;
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
    normal: { x: 320, y: 0 },
    pressed: { x: 320, y: 64 },
  },
  [ControlButtonType.Jump]: {
    normal: { x: 384, y: 0 },
    pressed: { x: 384, y: 64 },
  },
  [ControlButtonType.DoubleJump]: {
    normal: { x: 448, y: 0 },
    pressed: { x: 448, y: 64 },
  },
  [ControlButtonType.Attack]: {
    normal: { x: 512, y: 0 },
    pressed: { x: 512, y: 64 },
  },
  [ControlButtonType.Settings]: {
    normal: { x: 576, y: 0 },
    pressed: { x: 576, y: 64 },
  },
  [ControlButtonType.Next]: {
    normal: { x: 640, y: 0 },
    pressed: { x: 640, y: 64 },
  },
  [ControlButtonType.Confirm]: {
    normal: { x: 704, y: 0 },
    pressed: { x: 704, y: 64 },
  },
  [ControlButtonType.Cancel]: {
    normal: { x: 768, y: 0 },
    pressed: { x: 768, y: 64 },
  },
};

const ControlButton: React.FC<ControlButtonProps> = ({
  type,
  onClick,
  className,
  sliderWidth,
  initialSliderValue = 0.5,
  onSliderChange,
  onSliderEnd,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [currentSliderValue, setCurrentSliderValue] =
    useState(initialSliderValue);
  const sliderRef = useRef<HTMLDivElement>(null);
  const sliderControllerRef = useRef<SliderController | null>(null);
  const sliderButtonRef = useRef<HTMLDivElement>(null);

  const isSlider = type === ControlButtonType.Clean && !!sliderWidth;

  // 슬라이더 컨트롤러 초기화 및 정리
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    // 슬라이더인 경우에만 컨트롤러 생성
    if (isSlider && sliderRef.current) {
      const controller = new SliderController(sliderRef.current, {
        initialValue: initialSliderValue,
        onChange: (value) => {
          setCurrentSliderValue(value);
          onSliderChange?.(value);
        },
        onDragStart: () => {
          setIsPressed(true);
        },
        onDragEnd: () => {
          setIsPressed(false);
          onSliderEnd?.();
        },
      });

      sliderControllerRef.current = controller;

      // 정리 함수
      return () => {
        controller.dispose();
        sliderControllerRef.current = null;
      };
    }
  }, [isSlider, onSliderChange, onSliderEnd]);

  // 버튼 누름 상태에 따른 스프라이트 정보 선택
  const size = 64;
  const spriteState = isPressed ? "pressed" : "normal";
  const spriteInfo = spriteInfoMap[type][spriteState];

  // 일반 버튼 이벤트 핸들러
  const handlePointerDown = () => {
    if (!isSlider) {
      setIsPressed(true);
    }
  };

  const handlePointerUp = () => {
    if (!isSlider) {
      setIsPressed(false);
      if (onClick) onClick();
    }
  };

  const handlePointerLeave = () => {
    if (!isSlider && isPressed) {
      setIsPressed(false);
    }
  };

  const buttonStyle = {
    width: `${size}px`,
    height: `${size}px`,
    backgroundImage: `url("/ui/sprites/control-buttons.png")`,
    backgroundPosition: `-${spriteInfo.x}px -${spriteInfo.y}px`,
  };

  // 슬라이더 버튼 렌더링
  if (isSlider) {
    return (
      <div
        className={"relative flex justify-center"}
        style={{ width: `${sliderWidth}px`, height: `${size}px` }}
        ref={sliderRef}
      >
        <div className="self-center w-full h-4 bg-gray-700 bg-opacity-50 rounded-full" />
        <div
          ref={sliderButtonRef}
          className="absolute top-0 left-0 h-full"
          style={{
            transform: `translateX(${
              currentSliderValue * (sliderWidth - size)
            }px)`,
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
      className={`bg-no-repeat border-none bg-transparent p-0 outline-none select-none [-webkit-tap-highlight-color:transparent] scale-[1.4] ${
        className || ""
      }`}
    />
  );
};

export default ControlButton;
