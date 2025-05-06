import { NavigationAction, type NavigationActionPayload } from "../types";
import { GameMenuItem, GameMenuItemType } from "./GameMenuItem";
import "./style.css";

export interface GameMenuOptions {
  onMiniGameSelect?: () => void;
  onFeedSelect?: () => void;
  onVersusSelect?: () => void;
  onDrugSelect?: () => void;
  onCleanSelect?: () => void;
  onTrainingSelect?: () => void;
  onInformationSelect?: () => void;
  onCancel?: () => void;
  onNavigationProcessed?: () => void;
  onFocusChange?: (focusedIndex: number | null) => void;
}

export class GameMenu {
  private container: HTMLDivElement;
  // 메뉴 아이템 순서 반영 배열
  private menuItems: GameMenuItemType[] = [
    GameMenuItemType.Information,
    GameMenuItemType.MiniGame,
    GameMenuItemType.Versus,
    GameMenuItemType.Feed,
    GameMenuItemType.Clean,
    GameMenuItemType.Drug,
    // GameMenuItemType.Training,
  ];
  private focusedIndex: number | null = null;
  private lastProcessedIndex = -1;
  private menuItemElements: GameMenuItem[] = [];
  private options: GameMenuOptions;
  private disabledMenuItems: Set<GameMenuItemType> = new Set();

  constructor(parentElement: HTMLElement, options: GameMenuOptions = {}) {
    this.options = options;

    // 컨테이너 생성
    this.container = document.createElement("div");
    this.container.className = "game-menu-container";

    // 기본적으로 대결 메뉴 비활성화
    this.disabledMenuItems.add(GameMenuItemType.Versus);

    this.initializeMenuItems();
    parentElement.appendChild(this.container);
  }

  private initializeMenuItems(): void {
    this.menuItems.forEach((itemType) => {
      const menuItem = new GameMenuItem(itemType);
      this.menuItemElements.push(menuItem);
      this.container.appendChild(menuItem.getElement());

      // 비활성화된 메뉴 항목 설정
      if (this.disabledMenuItems.has(itemType)) {
        menuItem.setDisabled(true);
      }
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
      // 첫 번째 활성화된 메뉴 항목 찾기
      this.setFocusedIndex(this.findNextEnabledMenuIndex(-1));
    } else if (this.focusedIndex >= this.menuItems.length - 1) {
      this.setFocusedIndex(null);
    } else {
      // 다음 활성화된 메뉴 항목 찾기
      const nextIndex = this.findNextEnabledMenuIndex(this.focusedIndex);
      if (nextIndex === -1) {
        this.setFocusedIndex(null);
      } else {
        this.setFocusedIndex(nextIndex);
      }
    }
  }

  private findNextEnabledMenuIndex(currentIndex: number): number {
    for (let i = currentIndex + 1; i < this.menuItemElements.length; i++) {
      if (!this.menuItemElements[i].isMenuDisabled()) {
        return i;
      }
    }
    return -1; // 활성화된 메뉴가 더 없음
  }

  private handleCancelAction(): void {
    this.setFocusedIndex(null);
    if (this.options.onCancel) {
      this.options.onCancel();
    }
  }

  private handleSelectAction(index: number | null): void {
    if (index === null) return;

    // 비활성화된 메뉴 항목 클릭 무시
    if (this.menuItemElements[index].isMenuDisabled()) {
      return;
    }

    const selectedMenu = this.menuItems[index];
    switch (selectedMenu) {
      case GameMenuItemType.MiniGame:
        if (this.options.onMiniGameSelect) this.options.onMiniGameSelect();
        break;
      case GameMenuItemType.Feed:
        if (this.options.onFeedSelect) this.options.onFeedSelect(); // 외부 주입된 메서드 호출
        break;
      case GameMenuItemType.Versus:
        if (this.options.onVersusSelect) this.options.onVersusSelect();
        break;
      case GameMenuItemType.Drug:
        if (this.options.onDrugSelect) this.options.onDrugSelect();
        break;
      case GameMenuItemType.Clean:
        if (this.options.onCleanSelect) this.options.onCleanSelect();
        break;
      case GameMenuItemType.Training:
        if (this.options.onTrainingSelect) this.options.onTrainingSelect();
        break;
      case GameMenuItemType.Information:
        if (this.options.onInformationSelect)
          this.options.onInformationSelect();
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

    // onFocusChange 콜백 호출
    if (this.options.onFocusChange) {
      this.options.onFocusChange(this.focusedIndex);
    }
  }

  // 메뉴 항목 활성화/비활성화 메서드 추가
  public setMenuItemDisabled(
    itemType: GameMenuItemType,
    disabled: boolean
  ): void {
    // 내부 Set에 상태 업데이트
    if (disabled) {
      this.disabledMenuItems.add(itemType);
    } else {
      this.disabledMenuItems.delete(itemType);
    }

    // 메뉴 항목 찾아서 상태 변경
    const index = this.menuItems.findIndex((type) => type === itemType);
    if (index !== -1 && index < this.menuItemElements.length) {
      this.menuItemElements[index].setDisabled(disabled);

      // 현재 비활성화된 항목에 포커스가 있다면 포커스 제거
      if (disabled && this.focusedIndex === index) {
        this.setFocusedIndex(null);
      }
    }
  }

  public destroy(): void {
    // 메모리 해제 및 이벤트 리스너 제거
    for (const index in this.menuItemElements) {
      this.menuItemElements[index]?.destroy();
    }
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}
