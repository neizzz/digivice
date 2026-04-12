export enum GameMenuItemType {
  MiniGame = "mini-game",
  Feed = "feed",
  Versus = "versus",
  Drug = "drug",
  Clean = "clean",
  Hospital = "hospital",
  // Information = "information",
  // Training = "training",
}

const MENU_SPRITE_SLOT_COUNT = 8;
const MENU_ITEM_SIZE_MIN = 40;
const MENU_ITEM_SIZE_MAX = 48;
const MENU_ITEM_SIZE_MAX_VIEWPORT = 360;

const MENU_SPRITE_FINE_TUNE_X: Partial<Record<GameMenuItemType, number>> = {
  [GameMenuItemType.Drug]: 1,
};

const MENU_SPRITE_SIZE_DELTA: Partial<Record<GameMenuItemType, number>> = {
  [GameMenuItemType.Hospital]: 4,
};

const getSpriteSlotIndex = (type: GameMenuItemType): number => {
  switch (type) {
    case GameMenuItemType.MiniGame:
      return 0;
    case GameMenuItemType.Feed:
      return 1;
    case GameMenuItemType.Versus:
      return 2;
    case GameMenuItemType.Drug:
      return 3;
    case GameMenuItemType.Clean:
      return 4;
    case GameMenuItemType.Hospital:
      return 7;
    default:
      throw new Error(`Unknown menu item type: ${type}`);
  }
};

const getBackgroundPosition = (
  type: GameMenuItemType,
  containerSize: number,
  spriteSize: number,
) => {
  const fineTuneX = MENU_SPRITE_FINE_TUNE_X[type] ?? 0;
  const slotIndex = getSpriteSlotIndex(type);
  const centerOffset = Math.floor((containerSize - spriteSize) / 2);

  return `${-slotIndex * spriteSize + centerOffset + fineTuneX}px ${centerOffset}px`;
};

const getResponsiveMenuItemSize = (availableWidth: number): number => {
  if (availableWidth >= MENU_ITEM_SIZE_MAX_VIEWPORT) {
    return MENU_ITEM_SIZE_MAX;
  }

  return MENU_ITEM_SIZE_MIN;
};

export class GameMenuItem {
  private element: HTMLDivElement;
  private itemType: GameMenuItemType;
  private isFocused = false;
  private isDisabled = false;

  constructor(itemType: GameMenuItemType) {
    this.itemType = itemType;
    this.element = document.createElement("div");
    this.element.className = "game-menu-item";

    // 타입별 클래스 추가 - 이미 kebab-case로 변경되어 있으므로 그대로 사용
    this.element.classList.add(`type-${itemType}`);

    this.updateSize();

    // 초기 포커스 상태 설정
    this.updateFocusState();
  }

  public setFocused(focused: boolean): void {
    if (this.isDisabled) return; // 비활성화된 경우 포커스 설정 불가

    if (this.isFocused === focused) return; // 상태가 변경되지 않으면 리턴

    this.isFocused = focused;
    this.updateFocusState();
  }

  public setDisabled(disabled: boolean): void {
    if (this.isDisabled === disabled) return; // 상태가 변경되지 않으면 리턴

    this.isDisabled = disabled;

    // 비활성화 시 포커스 제거
    if (disabled && this.isFocused) {
      this.isFocused = false;
    }

    this.updateDisabledState();
    this.updateFocusState();
  }

  public isMenuDisabled(): boolean {
    return this.isDisabled;
  }

  private updateFocusState(): void {
    if (this.isFocused) {
      this.element.classList.add("focused");
    } else {
      this.element.classList.remove("focused");
    }
  }

  private updateDisabledState(): void {
    if (this.isDisabled) {
      this.element.classList.add("disabled");
    } else {
      this.element.classList.remove("disabled");
    }
  }

  public getElement(): HTMLDivElement {
    return this.element;
  }

  public getSize(): number {
    return Number.parseInt(this.element.style.height);
  }

  public updateSize(availableWidth?: number): void {
    const size = getResponsiveMenuItemSize(
      availableWidth ?? document.body.clientWidth,
    );
    const spriteSize = size + (MENU_SPRITE_SIZE_DELTA[this.itemType] ?? 0);

    this.element.style.width = `${size}px`;
    this.element.style.height = `${size}px`;
    this.element.style.backgroundPosition = getBackgroundPosition(
      this.itemType,
      size,
      spriteSize,
    );
    this.element.style.backgroundSize = `${spriteSize * MENU_SPRITE_SLOT_COUNT}px ${spriteSize}px`;
  }

  public destroy(): void {
    // 메모리 해제 작업 (이벤트 리스너가 있다면 제거)
  }
}
