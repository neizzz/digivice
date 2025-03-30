import { ControlButtonType } from "@digivice/game";
import type React from "react";
import { useState } from "react";
import styled from "styled-components";

interface ControlButtonProps {
	type: ControlButtonType;
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
}) => {
	const [isPressed, setIsPressed] = useState(false);

	// 버튼 누름 상태에 따른 스프라이트 정보 선택
	const size = 64;
	const spriteState = isPressed ? "pressed" : "normal";
	const spriteInfo = spriteInfoMap[type][spriteState];

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
			width={size}
			height={size}
			onPointerDown={handlePointerDown}
			onPointerUp={handlePointerUp}
			onPointerLeave={handlePointerLeave}
			className={className}
		/>
	);
};

export default ControlButton;
