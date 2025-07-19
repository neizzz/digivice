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

export interface ControlButtonParams {
  type: ControlButtonType;
}

export enum ControlButtonType {
  Clean = "clean",
  Jump = "jump",
  DoubleJump = "double-jump",
  Attack = "attack",
  Settings = "settings",
  Next = "next",
  Confirm = "confirm",
  Cancel = "cancel",
}
