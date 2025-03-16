import { ControlButtonType } from "../ui/types";
import { SceneKey } from "../SceneKey";

export interface Scene {
  update(deltaTime: number): void;
  onResize(width: number, height: number): void;
  handleControlButtonClick(buttonType: ControlButtonType): void;

  setSceneChangeCallback(callback: (key: SceneKey) => void): void;
}
