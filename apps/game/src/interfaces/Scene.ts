import { ControlButtonType } from "..";

export interface Scene {
  // name: string;
  init: () => void;
  update: (delta: number) => void;
  destroy: () => void;
  handleControlButtonClick: (buttonType: ControlButtonType) => void;
  handleSliderValueChange: (value: number /** 0.0 ~ 1.0 */) => void;
  handleSliderEnd: () => void;
}
