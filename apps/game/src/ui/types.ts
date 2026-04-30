export enum NavigationAction {
  NONE = "none",
  NEXT = "next",
  CANCEL = "cancel",
  SELECT = "select",
  SETTING = "setting",
}

// 액션 페이로드 인터페이스
export interface NavigationActionPayload {
  type: NavigationAction;
  index: number;
}

export interface ControlButtonParams {
  type: ControlButtonType;
  initialSliderValue?: number;
  sliderSessionKey?: number;
  hasCleaningTarget?: boolean;
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
