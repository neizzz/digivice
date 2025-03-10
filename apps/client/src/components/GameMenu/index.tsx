import React, { useState, useEffect, useCallback, memo } from "react";
import styled from "styled-components";
import GameMenuItem, { GameMenuItemType } from "./GameMenuItem";

// 네비게이션 액션 타입 정의
export enum NavigationAction {
  NONE = "none",
  NEXT = "next",
  CANCEL = "cancel",
  SELECT = "select",
}

// 액션 인터페이스 수정 - 인덱스 사용
export interface NavigationActionPayload {
  type: NavigationAction;
  index: number; // ref 대신 단순 인덱스 사용
}

interface GameMenuProps {
  onTypeASelect?: () => void;
  onTypeBSelect?: () => void;
  onTypeCSelect?: () => void;
  onTypeDSelect?: () => void;
  onTypeESelect?: () => void;
  onTypeFSelect?: () => void;
  navigationAction?: NavigationActionPayload; // 수정된 타입 적용
  onCancel?: () => void;
  onNavigationProcessed?: () => void;
}

const MenuContainer = styled.div`
  position: absolute;
  bottom: 0;
  display: flex;
  justify-content: space-around;
  width: 100%;
  margin: 0 auto;
  padding: 10px 0;
`;

const menuItems = [
  GameMenuItemType.TYPE_A,
  GameMenuItemType.TYPE_B,
  GameMenuItemType.TYPE_C,
  GameMenuItemType.TYPE_D,
  GameMenuItemType.TYPE_E,
  GameMenuItemType.TYPE_F,
];

const GameMenu: React.FC<GameMenuProps> = ({
  onTypeASelect,
  onTypeBSelect,
  onTypeCSelect,
  onTypeDSelect,
  onTypeESelect,
  onTypeFSelect,
  navigationAction,
  onCancel,
  onNavigationProcessed,
}) => {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [lastProcessedIndex, setLastProcessedIndex] = useState<number>(-1); // ref 대신 state 사용

  // Next 액션 처리 함수 - 다음 항목으로 즉시 이동
  const processSingleNextAction = useCallback(() => {
    setFocusedIndex((prev) => {
      if (prev === null) return 0;
      if (prev >= menuItems.length - 1) return null;
      return prev + 1;
    });
  }, []);

  // Cancel 버튼 처리 함수
  const handleCancelAction = useCallback(() => {
    setFocusedIndex(null);
    if (onCancel) onCancel();
  }, [onCancel]);

  // Select 버튼 처리 함수
  const handleSelectAction = useCallback(
    (index: number | null) => {
      if (index === null) return;

      const selectedMenu = menuItems[index];
      switch (selectedMenu) {
        case GameMenuItemType.TYPE_A:
          if (onTypeASelect) onTypeASelect();
          break;
        case GameMenuItemType.TYPE_B:
          if (onTypeBSelect) onTypeBSelect();
          break;
        case GameMenuItemType.TYPE_C:
          if (onTypeCSelect) onTypeCSelect();
          break;
        case GameMenuItemType.TYPE_D:
          if (onTypeDSelect) onTypeDSelect();
          break;
        case GameMenuItemType.TYPE_E:
          if (onTypeESelect) onTypeESelect();
          break;
        case GameMenuItemType.TYPE_F:
          if (onTypeFSelect) onTypeFSelect();
          break;
      }
    },
    [
      onTypeASelect,
      onTypeBSelect,
      onTypeCSelect,
      onTypeDSelect,
      onTypeESelect,
      onTypeFSelect,
    ]
  );

  // 액션 변경 감지 및 즉시 처리
  useEffect(() => {
    // 액션이 없거나 이미 처리된 인덱스면 무시
    if (
      !navigationAction ||
      navigationAction.type === NavigationAction.NONE ||
      navigationAction.index === lastProcessedIndex
    ) {
      return;
    }

    // 현재 액션 인덱스 저장 (state 업데이트)
    setLastProcessedIndex(navigationAction.index);

    // 즉시 액션 처리
    switch (navigationAction.type) {
      case NavigationAction.NEXT:
        processSingleNextAction();
        break;
      case NavigationAction.CANCEL:
        handleCancelAction();
        break;
      case NavigationAction.SELECT:
        if (focusedIndex !== null) {
          handleSelectAction(focusedIndex);
        }
        break;
    }

    // 네비게이션 처리 완료 알림
    if (onNavigationProcessed) {
      onNavigationProcessed();
    }
  }, [
    navigationAction,
    lastProcessedIndex,
    focusedIndex,
    processSingleNextAction,
    handleCancelAction,
    handleSelectAction,
    onNavigationProcessed,
  ]);

  return (
    <MenuContainer>
      {menuItems.map((menuType, index) => (
        <GameMenuItem
          key={menuType}
          itemType={menuType}
          isFocused={focusedIndex === index}
        />
      ))}
    </MenuContainer>
  );
};

// React.memo를 사용하여 불필요한 리렌더링 방지
export default memo(GameMenu);
