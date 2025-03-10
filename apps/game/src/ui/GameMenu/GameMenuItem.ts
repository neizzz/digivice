// 메뉴 아이템 타입 (마이그레이션됨)
export enum GameMenuItemType {
  TYPE_A = "TYPE_A",
  TYPE_B = "TYPE_B",
  TYPE_C = "TYPE_C",
  TYPE_D = "TYPE_D",
  TYPE_E = "TYPE_E",
  TYPE_F = "TYPE_F",
}

// 각 메뉴 아이템 타입에 대한 스프라이트 좌표 매핑
const menuItemSpriteMap: Record<
  GameMenuItemType,
  { x: number; y: number; width: number; height: number }
> = {
  [GameMenuItemType.TYPE_A]: { x: 0, y: 0, width: 68, height: 68 },
  [GameMenuItemType.TYPE_B]: { x: 68, y: 0, width: 68, height: 68 },
  [GameMenuItemType.TYPE_C]: { x: 136, y: 0, width: 68, height: 68 },
  [GameMenuItemType.TYPE_D]: { x: 204, y: 0, width: 68, height: 68 },
  [GameMenuItemType.TYPE_E]: { x: 272, y: 0, width: 68, height: 68 },
  [GameMenuItemType.TYPE_F]: { x: 340, y: 0, width: 68, height: 68 },
};

export class GameMenuItem {
  private element: HTMLDivElement;
  private itemType: GameMenuItemType;
  private isFocused: boolean = false;

  constructor(itemType: GameMenuItemType) {
    this.itemType = itemType;
    this.element = document.createElement("div");
    this.element.className = "game-menu-item";

    // 타입별 클래스 추가
    this.element.classList.add(`type-${itemType.toLowerCase()}`);

    // 스프라이트 정보 가져오기
    const spriteInfo = menuItemSpriteMap[this.itemType];

    // 스프라이트 위치 설정
    this.element.style.width = `${spriteInfo.width}px`;
    this.element.style.height = `${spriteInfo.height}px`;
    this.element.style.backgroundPosition = `-${spriteInfo.x}px -${spriteInfo.y}px`;

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
