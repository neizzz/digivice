import type { CharacterKey } from "./Character";

export interface GameData {
	name: string;
	character: {
		key: CharacterKey;
	};
	lastPlayedAt: number;
	lastPosition: {
		x: number;
		y: number;
	};
	coin: number;
	status: {
		dead: boolean;
		sick: boolean;
		// fatigue: number;
		hunger: number;
		happiness: number;
	};
	minigame: {
		flappyBird: {
			highScore: number;
		};
	};
	// experience: number;
	// energy: number;
	// inventory: GameInventory;
	// achievements: string[];
}
