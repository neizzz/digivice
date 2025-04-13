import { FlutterStorage, type Storage, WebLocalStorage } from "@shared/storage";
import type { GameData } from "types/GameData";

class _GameDataManager {
	private data: GameData | null = null;
	private storage: Storage;
	private readonly GAME_DATA_KEY = "digivice_game_data";

	constructor() {
		if (typeof window !== "undefined" && "storageController" in window) {
			this.storage = new FlutterStorage();
		} else {
			this.storage = new WebLocalStorage();
		}
	}

	public async saveData(data: GameData): Promise<GameData> {
		this.data = Object.freeze(data);
		await this.storage.setItem(this.GAME_DATA_KEY, JSON.stringify(data));
		return this.data;
	}

	public async loadData(): Promise<GameData | undefined> {
		if (this.data) return this.data;

		const savedData = await this.storage.getItem(this.GAME_DATA_KEY);

		if (!savedData) {
			console.warn("게임 데이터가 없습니다.");
			return undefined;
		}

		try {
			this.data = Object.freeze(JSON.parse(savedData) as GameData);
			return this.data;
		} catch (e) {
			throw new Error(`게임 데이터 로드 실패: ${e}`);
		}
	}

	public async updateData(partialData: Partial<GameData>): Promise<GameData> {
		const currentData = await this.loadData();
		const updatedData = { ...currentData, ...partialData } as GameData;
		return this.saveData(updatedData);
	}

	public async clearData(): Promise<void> {
		this.data = null;
		await this.storage.removeItem(this.GAME_DATA_KEY);
	}
}

export const GameDataManager = new _GameDataManager();
