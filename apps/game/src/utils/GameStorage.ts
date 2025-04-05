import { FlutterStorage, type Storage, WebLocalStorage } from "@shared/storage";

/**
 * 게임 데이터의 타입 정의
 */
export interface GameData {
	lastPlayedAt: number;
	characterName: string;
	level: number;
	experience: number;
	hunger: number;
	happiness: number;
	energy: number;
	inventory: GameInventory;
	achievements: string[];
}

/**
 * 게임 인벤토리 타입 정의
 */
export interface GameInventory {
	items: GameItem[];
	gold: number;
}

/**
 * 게임 아이템 타입 정의
 */
export interface GameItem {
	id: string;
	name: string;
	quantity: number;
	type: "food" | "toy" | "medicine" | "accessory";
}

/**
 * 게임 데이터의 기본값
 */
export const DEFAULT_GAME_DATA: GameData = {
	lastPlayedAt: Date.now(),
	characterName: "디지몬",
	level: 1,
	experience: 0,
	hunger: 100,
	happiness: 100,
	energy: 100,
	inventory: {
		items: [],
		gold: 100,
	},
	achievements: [],
};

/**
 * 게임 데이터를 관리하는 스토리지 클래스
 */
export class GameStorage {
	private storage: Storage;
	private readonly GAME_DATA_KEY = "digivice_game_data";

	/**
	 * 현재 환경에 맞는 스토리지를 선택하여 초기화합니다.
	 */
	constructor() {
		// window.storageController가 있으면 Flutter 환경으로 판단
		if (typeof window !== "undefined" && "storageController" in window) {
			this.storage = new FlutterStorage();
		} else {
			this.storage = new WebLocalStorage();
		}
	}

	/**
	 * 게임 데이터를 저장합니다.
	 */
	async saveGameData(data: GameData): Promise<void> {
		await this.storage.setItem(this.GAME_DATA_KEY, JSON.stringify(data));
	}

	/**
	 * 게임 데이터를 불러옵니다.
	 * 저장된 데이터가 없는 경우 기본 데이터를 반환합니다.
	 */
	async loadGameData(): Promise<GameData> {
		const data = await this.storage.getItem(this.GAME_DATA_KEY);
		if (!data) return { ...DEFAULT_GAME_DATA };

		try {
			return JSON.parse(data) as GameData;
		} catch (e) {
			console.error("게임 데이터 파싱 오류:", e);
			return { ...DEFAULT_GAME_DATA };
		}
	}

	/**
	 * 특정 게임 데이터 필드만 업데이트합니다.
	 */
	async updateGameData(partialData: Partial<GameData>): Promise<GameData> {
		const currentData = await this.loadGameData();
		const updatedData = { ...currentData, ...partialData };
		await this.saveGameData(updatedData);
		return updatedData;
	}

	/**
	 * 게임 인벤토리에 아이템을 추가하거나 업데이트합니다.
	 */
	async addItemToInventory(item: GameItem): Promise<void> {
		const gameData = await this.loadGameData();
		const existingItemIndex = gameData.inventory.items.findIndex(
			(i) => i.id === item.id,
		);

		if (existingItemIndex >= 0) {
			// 기존 아이템이 있으면 수량만 증가
			gameData.inventory.items[existingItemIndex].quantity += item.quantity;
		} else {
			// 없으면 새로 추가
			gameData.inventory.items.push({ ...item });
		}

		await this.saveGameData(gameData);
	}

	/**
	 * 게임 데이터를 초기화합니다.
	 */
	async resetGameData(): Promise<void> {
		await this.saveGameData({ ...DEFAULT_GAME_DATA });
	}

	/**
	 * 게임 데이터를 삭제합니다.
	 */
	async clearGameData(): Promise<void> {
		await this.storage.removeItem(this.GAME_DATA_KEY);
	}
}

// 싱글톤 인스턴스 제공
export const gameStorage = new GameStorage();
