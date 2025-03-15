export enum NavigationAction {
  NONE = "none",
  NEXT = "next",
  CANCEL = "cancel",
  SELECT = "select",
}

// 액션 페이로드 인터페이스
export interface NavigationActionPayload {
  type: NavigationAction;
  index: number;
}

// 컨트롤 버튼 타입
export enum ControlButtonType {
  LEFT = "left",
  CENTER = "center",
  RIGHT = "right",
}

// 버튼 스타일 타입
export enum ControlButtonStyleType {
  ORANGE = "orange",
  GREEN = "green",
  GRAY = "gray",
  PINK = "pink",
}

// 게임 메뉴 아이템 타입은 GameMenuItem.ts로 이동되어 이 파일에서는 제거
