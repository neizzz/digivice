import type { CharacterKey } from "types/CharacterKey";

export interface GameData {
	character: {
		key: CharacterKey;
		// TODO:
	};
}

class GameDataManager {
	private data: GameData | null = null;

	public saveData(data: GameData): GameData {
		this.data = Object.freeze(data);
		localStorage.setItem("gameData", JSON.stringify(data));
		return this.data;
	}

	public loadData(): GameData | null {
		// FIXME: 임시. 아래 주석처리한 부분이 원래 코드
		return {
			character: {
				// @ts-ignore
				key: "green-slime",
			},
		};

		// if (this.data) {
		// 	return this.data;
		// }
		// const savedData = localStorage.getItem("gameData");
		// if (savedData) {
		// 	this.data = Object.freeze(JSON.parse(savedData)); // 데이터 수정 불가 처리
		// 	return this.data;
		// }
		// return null;
	}
}

export default new GameDataManager();
