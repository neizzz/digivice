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

// 버튼 타입 정의 (새로운 색상으로 업데이트)
export enum ControlButtonStyleType {
  ORANGE = "orange",
  GREEN = "green",
  GRAY = "gray",
  PINK = "pink",
}
