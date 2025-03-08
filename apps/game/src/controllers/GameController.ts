import {
  ButtonType,
  GameController,
  GameControllerListener,
} from "../types/GameControllerTypes";

export class GameControllerClass implements GameController {
  private listeners: Set<GameControllerListener> = new Set();
  private pressedButtons: Set<ButtonType> = new Set();

  constructor() {
    // 키보드 이벤트와 매핑 설정
    this.setupKeyboardEvents();
  }

  private setupKeyboardEvents(): void {
    // 키보드 키와 게임 버튼 간의 매핑
    const keyToButtonMap: Record<string, ButtonType> = {
      a: ButtonType.A,
      s: ButtonType.B,
      d: ButtonType.C,
    };

    window.addEventListener("keydown", (event) => {
      const button = keyToButtonMap[event.key.toLowerCase()];
      if (button && !this.pressedButtons.has(button)) {
        this.pressedButtons.add(button);
        this.simulateButtonPress(button);
      }
    });

    window.addEventListener("keyup", (event) => {
      const button = keyToButtonMap[event.key.toLowerCase()];
      if (button) {
        this.pressedButtons.delete(button);
        this.simulateButtonRelease(button);
      }
    });
  }

  public addListener(listener: GameControllerListener): void {
    this.listeners.add(listener);
  }

  public removeListener(listener: GameControllerListener): void {
    this.listeners.delete(listener);
  }

  public simulateButtonPress(button: ButtonType): void {
    this.listeners.forEach((listener) => {
      listener.onButtonPress(button);
    });
  }

  public simulateButtonRelease(button: ButtonType): void {
    this.listeners.forEach((listener) => {
      listener.onButtonRelease(button);
    });
  }
}

// 싱글톤 인스턴스 생성
export const gameController = new GameControllerClass();
