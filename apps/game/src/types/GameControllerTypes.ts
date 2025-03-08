export enum ButtonType {
  A = "A",
  B = "B",
  C = "C",
}

export interface ButtonEvent {
  type: "press" | "release";
  button: ButtonType;
  timestamp: number;
}

export interface GameControllerListener {
  onButtonPress: (button: ButtonType) => void;
  onButtonRelease: (button: ButtonType) => void;
}

export interface GameController {
  addListener: (listener: GameControllerListener) => void;
  removeListener: (listener: GameControllerListener) => void;
  simulateButtonPress: (button: ButtonType) => void;
  simulateButtonRelease: (button: ButtonType) => void;
}
