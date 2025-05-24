import type { Container } from "pixi.js";
import type { ControlButtonType } from "../ui/types";

export interface Scene extends Container {
  update(deltaTime: number): void;
  onResize(width: number, height: number): void;
  handleControlButtonClick: (buttonType: ControlButtonType) => void;
  handleSliderValueChange?: (value: number) => void;
  handleSliderEnd?: () => void;
  destroy(): void;
}
