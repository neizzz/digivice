import React from "react";
import styled from "styled-components";

// 메뉴 아이템 타입 정의
export enum GameMenuItemType {
  TYPE_A = "typeA",
  TYPE_B = "typeB",
  TYPE_C = "typeC",
  TYPE_D = "typeD",
  TYPE_E = "typeE",
  TYPE_F = "typeF",
}

// 각 메뉴 아이템 타입에 대한 스프라이트 좌표 매핑 (focused 상태 제거)
const menuItemSpriteMap: Record<
  GameMenuItemType,
  { x: number; y: number; width: number; height: number }
> = {
  [GameMenuItemType.TYPE_A]: { x: 0, y: 0, width: 68, height: 68 },
  [GameMenuItemType.TYPE_B]: { x: 68, y: 0, width: 68, height: 68 },
  [GameMenuItemType.TYPE_C]: { x: 136, y: 0, width: 68, height: 68 },
  [GameMenuItemType.TYPE_D]: { x: 204, y: 0, width: 68, height: 68 },
  [GameMenuItemType.TYPE_E]: { x: 272, y: 0, width: 68, height: 68 },
  [GameMenuItemType.TYPE_F]: { x: 340, y: 0, width: 68, height: 68 },
};

interface GameMenuItemProps {
  itemType: GameMenuItemType;
  isFocused: boolean;
  className?: string;
}

const StyledItem = styled.div<{
  x: number;
  y: number;
  width: number;
  height: number;
  isFocused: boolean;
}>`
  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
  background-image: url("/ui/sprites/menu-items.png");
  background-position: -${(props) => props.x}px -${(props) => props.y}px;
  background-repeat: no-repeat;
  background-color: transparent;
  user-select: none;
  scale: 0.5;
  opacity: 0.6;

  /* 포커스 상태에 따른 스타일링 (애니메이션 제거) */
  ${(props) =>
    props.isFocused &&
    `
    opacity: 1;
    transform: scale(1.1);
    filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 5px rgba(255, 255, 255, 0.7));
    z-index: 1;
  `}
`;

const GameMenuItem: React.FC<GameMenuItemProps> = ({
  itemType,
  isFocused,
  className,
}) => {
  // 스프라이트 정보 선택
  const spriteInfo = menuItemSpriteMap[itemType];

  return (
    <StyledItem
      x={spriteInfo.x}
      y={spriteInfo.y}
      width={spriteInfo.width}
      height={spriteInfo.height}
      isFocused={isFocused}
      className={className}
    />
  );
};

export default GameMenuItem;
