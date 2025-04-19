import { ControlButtonType } from "@digivice/game";
import type React from "react";
import { useEffect, useState, useRef } from "react";

interface ControlButtonProps {
  type: ControlButtonType;
  onClick?: () => void; // 클릭 이벤트 핸들러
  className?: string; // 추가 스타일링을 위한 클래스
  // 슬라이더 버튼을 위한 추가 props
  sliderWidth?: number;
  sliderValue?: number;
  onSliderChange?: (value: number) => void;
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
  sliderValue = 0.5,
  onSliderChange,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [currentSliderValue, setCurrentSliderValue] = useState(sliderValue);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentSliderValue(sliderValue);
  }, [sliderValue]);

  // 버튼 누름 상태에 따른 스프라이트 정보 선택
  const size = 64;
  const spriteState = isPressed ? "pressed" : "normal";
  const spriteInfo = spriteInfoMap[type][spriteState];
  const isSlider = type === ControlButtonType.Clean && !!sliderWidth;

  // 이벤트 처리를 단순화하고 최적화
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsPressed(true);

    // 슬라이더 버튼인 경우, 슬라이더 드래그 시작
    if (sliderWidth && sliderRef.current) {
      setIsDragging(true);
      updateSliderPosition(e);
    }
  };

  const handlePointerUp = () => {
    setIsPressed(false);
    setIsDragging(false);
    // 버튼을 눌렀다가 뗄 때 onClick 핸들러 호출 (슬라이더가 아닌 경우)
    if (onClick && !isSlider) onClick();
  };

  const handlePointerLeave = () => {
    if (isPressed) setIsPressed(false);
    setIsDragging(false);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging && isSlider) {
      updateSliderPosition(e);
    }
  };

  const updateSliderPosition = (e: React.PointerEvent) => {
    if (sliderRef.current) {
      const sliderRect = sliderRef.current.getBoundingClientRect();
      const relativeX = e.clientX - sliderRect.left;
      const newValue = Math.max(0, Math.min(1, relativeX / sliderRect.width));

      setCurrentSliderValue(newValue);
      if (onSliderChange) {
        onSliderChange(newValue);
      }
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
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
      >
        <div className="w-full h-4 self-center  bg-gray-700 bg-opacity-50 rounded-full" />
        <div
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
