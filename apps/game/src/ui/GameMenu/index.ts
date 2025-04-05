import { NavigationAction, type NavigationActionPayload } from "../types";
import { GameMenuItem, GameMenuItemType } from "./GameMenuItem";
import "./style.css";
import { AssetLoader } from "../../utils/AssetLoader";
import { ThrowSprite } from "../../utils/ThrowSprite";

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
		GameMenuItemType.Feed,
		GameMenuItemType.Versus,
		GameMenuItemType.Drug,
		GameMenuItemType.Clean,
		GameMenuItemType.Training,
	];
	private focusedIndex: number | null = null;
	private lastProcessedIndex = -1;
	private menuItemElements: GameMenuItem[] = [];
	private options: GameMenuOptions;

	constructor(parentElement: HTMLElement, options: GameMenuOptions = {}) {
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
