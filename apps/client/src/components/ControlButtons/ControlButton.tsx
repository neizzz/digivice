import React, { useState } from "react";
import styled from "styled-components";
import { ControlButtonStyleType } from "@digivice/game";

// 각 버튼 타입 및 상태(기본/누름)에 대한 스프라이트 좌표 매핑
const buttonSpriteMap: Record<
  ControlButtonStyleType,
  {
    normal: { x: number; y: number; width: number; height: number };
    pressed: { x: number; y: number; width: number; height: number };
  }
> = {
  [ControlButtonStyleType.GRAY]: {
    normal: { x: 0, y: 88, width: 42, height: 42 },
    pressed: { x: 43, y: 88, width: 42, height: 42 },
  },
  [ControlButtonStyleType.ORANGE]: {
    normal: { x: 0, y: 131, width: 42, height: 42 },
    pressed: { x: 43, y: 131, width: 42, height: 42 },
  },
  [ControlButtonStyleType.GREEN]: {
    normal: { x: 0, y: 174, width: 42, height: 42 },
    pressed: { x: 43, y: 174, width: 42, height: 42 },
  },
  [ControlButtonStyleType.PINK]: {
    normal: { x: 0, y: 304, width: 42, height: 42 },
    pressed: { x: 43, y: 304, width: 42, height: 42 },
  },
};

interface ControlButtonProps {
  buttonStyleType: ControlButtonStyleType; // 버튼 색상 타입 (필수)
  onClick?: () => void; // 클릭 이벤트 핸들러
  className?: string; // 추가 스타일링을 위한 클래스
}

const StyledButton = styled.button<{
  x: number;
  y: number;
  width: number;
  height: number;
}>`
  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
  background-image: url("/ui/sprites/control-buttons.png");
  background-position: -${(props) => props.x}px -${(props) => props.y}px;
  background-repeat: no-repeat;
  border: none;
  /* cursor: pointer; */
  background-color: transparent;
  padding: 0;
  outline: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  scale: 1.4;
`;

const ControlButton: React.FC<ControlButtonProps> = ({
  buttonStyleType,
  onClick,
  className,
}) => {
  const [isPressed, setIsPressed] = useState(false);

  // 버튼 누름 상태에 따른 스프라이트 정보 선택
  const spriteState = isPressed ? "pressed" : "normal";
  const spriteInfo = buttonSpriteMap[buttonStyleType][spriteState];

  // 이벤트 처리를 단순화하고 최적화
  const handlePointerDown = () => {
    setIsPressed(true);
  };

  const handlePointerUp = () => {
    setIsPressed(false);
    // 버튼을 눌렀다가 뗄 때 onClick 핸들러 호출
    if (onClick) onClick();
  };

  const handlePointerLeave = () => {
    if (isPressed) setIsPressed(false);
  };

  return (
    <StyledButton
      x={spriteInfo.x}
      y={spriteInfo.y}
      width={spriteInfo.width}
      height={spriteInfo.height}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      className={className}
    />
  );
};

export default ControlButton;
