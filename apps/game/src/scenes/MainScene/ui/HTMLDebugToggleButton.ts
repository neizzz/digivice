export class HTMLDebugToggleButton {
  private button: HTMLButtonElement;
  private onToggle: () => boolean; // 디버그 상태를 반환하는 콜백
  private isDebugVisible: boolean = false;

  constructor(onToggle: () => boolean, parentElement: HTMLElement) {
    this.onToggle = onToggle;
    this.button = this.createButton();
    this.updateButtonAppearance();
    parentElement.appendChild(this.button);
  }

  private createButton(): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = "DEBUG";
    button.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      width: 80px;
      height: 30px;
      background: rgba(68, 68, 68, 0.9);
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      cursor: pointer;
      z-index: 1000;
      font-family: 'Arial', sans-serif;
      transition: background-color 0.2s;
    `;

    button.addEventListener("mouseenter", () => {
      if (this.isDebugVisible) {
        button.style.backgroundColor = "rgba(0, 170, 0, 0.9)"; // 더 밝은 녹색
      } else {
        button.style.backgroundColor = "rgba(85, 85, 85, 0.9)"; // 더 밝은 회색
      }
    });

    button.addEventListener("mouseleave", () => {
      this.updateButtonAppearance(); // 원래 상태로 복원
    });

    button.addEventListener("click", () => {
      this.toggle();
    });

    return button;
  }

  private updateButtonAppearance(): void {
    if (this.isDebugVisible) {
      this.button.textContent = "DEBUG ON";
      this.button.style.backgroundColor = "rgba(0, 150, 0, 0.9)"; // 녹색
    } else {
      this.button.textContent = "DEBUG";
      this.button.style.backgroundColor = "rgba(68, 68, 68, 0.9)"; // 기본 회색
    }
  }

  private toggle(): void {
    const newState = this.onToggle();
    this.isDebugVisible = newState;
    this.updateButtonAppearance();
  }

  public updateState(isVisible: boolean): void {
    if (this.isDebugVisible !== isVisible) {
      this.isDebugVisible = isVisible;
      this.updateButtonAppearance();
    }
  }

  public destroy(): void {
    if (this.button.parentElement) {
      this.button.parentElement.removeChild(this.button);
    }
  }
}
