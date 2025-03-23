export enum GameMenuItemType {
  MiniGame = "mini-game",
  Feed = "feed",
  Versus = "versus",
  Drug = "drug",
  Clean = "clean",
  Information = "information",
  Training = "training",
}

export class GameMenuItem {
  private element: HTMLDivElement;
  private itemType: GameMenuItemType;
  private isFocused: boolean = false;

  constructor(itemType: GameMenuItemType, index: number) {
    this.itemType = itemType;
    this.element = document.createElement("div");
    this.element.className = "game-menu-item";

    // 타입별 클래스 추가 - 이미 kebab-case로 변경되어 있으므로 그대로 사용
    this.element.classList.add(`type-${itemType}`);

    // 스프라이트 위치 설정
    const size = document.body.clientWidth / 7;
    this.element.style.width = `${size}px`;
    this.element.style.height = `${size}px`;
    this.element.style.backgroundPosition = `-${index * size}px 0px`;

    // 초기 포커스 상태 설정
    this.updateFocusState();
  }

  public setFocused(focused: boolean): void {
    if (this.isFocused === focused) return; // 상태가 변경되지 않으면 리턴

    this.isFocused = focused;
    this.updateFocusState();
  }

  private updateFocusState(): void {
    if (this.isFocused) {
      this.element.classList.add("focused");
    } else {
      this.element.classList.remove("focused");
    }
  }

  public getElement(): HTMLDivElement {
    return this.element;
  }

  public destroy(): void {
    // 메모리 해제 작업 (이벤트 리스너가 있다면 제거)
  }
}
