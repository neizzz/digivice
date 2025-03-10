import { NavigationAction, NavigationActionPayload } from "../types";
import { GameMenuItem, GameMenuItemType } from "./GameMenuItem";
import "./style.css";

// 이벤트 콜백 타입
export type UIEventCallback = () => void;

export interface GameMenuOptions {
  onTypeASelect?: () => void;
  onTypeBSelect?: () => void;
  onTypeCSelect?: () => void;
  onTypeDSelect?: () => void;
  onTypeESelect?: () => void;
  onTypeFSelect?: () => void;
  onCancel?: () => void;
  onNavigationProcessed?: () => void;
}

export class GameMenu {
  private container: HTMLDivElement;
  private menuItems: GameMenuItemType[] = [
    GameMenuItemType.TYPE_A,
    GameMenuItemType.TYPE_B,
    GameMenuItemType.TYPE_C,
    GameMenuItemType.TYPE_D,
    GameMenuItemType.TYPE_E,
    GameMenuItemType.TYPE_F,
  ];
  private focusedIndex: number | null = null;
  private lastProcessedIndex = -1;
  private menuItemElements: GameMenuItem[] = [];
  private options: GameMenuOptions;

  constructor(parentElement: HTMLElement, options: GameMenuOptions = {}) {
    console.log("✅");
    this.options = options;

    // 컨테이너 생성
    this.container = document.createElement("div");
    this.container.className = "game-menu-container";

    this.initializeMenuItems();
    parentElement.appendChild(this.container);
  }

  private initializeMenuItems(): void {
    this.menuItems.forEach((itemType, index) => {
      const menuItem = new GameMenuItem(itemType);
      this.menuItemElements.push(menuItem);
      this.container.appendChild(menuItem.getElement());
    });
  }

  public processNavigationAction(action: NavigationActionPayload): void {
    if (
      !action ||
      action.type === NavigationAction.NONE ||
      action.index === this.lastProcessedIndex
    ) {
      return;
    }

    this.lastProcessedIndex = action.index;

    switch (action.type) {
      case NavigationAction.NEXT:
        this.processSingleNextAction();
        break;
      case NavigationAction.CANCEL:
        this.handleCancelAction();
        break;
      case NavigationAction.SELECT:
        if (this.focusedIndex !== null) {
          this.handleSelectAction(this.focusedIndex);
        }
        break;
    }

    if (this.options.onNavigationProcessed) {
      this.options.onNavigationProcessed();
    }
  }

  private processSingleNextAction(): void {
    if (this.focusedIndex === null) {
      this.setFocusedIndex(0);
    } else if (this.focusedIndex >= this.menuItems.length - 1) {
      this.setFocusedIndex(null);
    } else {
      this.setFocusedIndex(this.focusedIndex + 1);
    }
  }

  private handleCancelAction(): void {
    this.setFocusedIndex(null);
    if (this.options.onCancel) {
      this.options.onCancel();
    }
  }

  private handleSelectAction(index: number | null): void {
    if (index === null) return;

    const selectedMenu = this.menuItems[index];
    switch (selectedMenu) {
      case MenuItemType.TYPE_A:
        if (this.options.onTypeASelect) this.options.onTypeASelect();
        break;
      case MenuItemType.TYPE_B:
        if (this.options.onTypeBSelect) this.options.onTypeBSelect();
        break;
      case MenuItemType.TYPE_C:
        if (this.options.onTypeCSelect) this.options.onTypeCSelect();
        break;
      case MenuItemType.TYPE_D:
        if (this.options.onTypeDSelect) this.options.onTypeDSelect();
        break;
      case MenuItemType.TYPE_E:
        if (this.options.onTypeESelect) this.options.onTypeESelect();
        break;
      case MenuItemType.TYPE_F:
        if (this.options.onTypeFSelect) this.options.onTypeFSelect();
        break;
    }
  }

  private setFocusedIndex(index: number | null): void {
    // 이전 포커스 제거
    if (
      this.focusedIndex !== null &&
      this.focusedIndex < this.menuItemElements.length
    ) {
      this.menuItemElements[this.focusedIndex].setFocused(false);
    }

    this.focusedIndex = index;

    // 새 포커스 설정
    if (
      this.focusedIndex !== null &&
      this.focusedIndex < this.menuItemElements.length
    ) {
      this.menuItemElements[this.focusedIndex].setFocused(true);
    }
  }

  public destroy(): void {
    // 메모리 해제 및 이벤트 리스너 제거
    this.menuItemElements.forEach((item) => item.destroy());
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}
