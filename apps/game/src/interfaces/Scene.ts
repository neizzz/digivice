import { ControlButtonType } from "../ui/types";
import { SceneKey } from "../SceneKey";
import { Game } from "../Game";

export interface Scene {
  update(deltaTime: number): void;
  onResize(width: number, height: number): void;
  handleControlButtonClick(buttonType: ControlButtonType): void;

  // Game 객체 참조를 설정하는 메소드로 변경
  setGameReference(game: Game): void;
}
