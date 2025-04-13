import type { GameData } from "@digivice/game";
import { CharacterKey } from "@digivice/game";

export const createInitialGameData = (params: { name: string }): GameData => {
	const { name } = params;

	const getRandomInitialCharacterKey = (): CharacterKey => {
		/** 기본 몬스터 키 */
		const characterKeys: CharacterKey[] = [
			CharacterKey.GreenSlime,
			// "mushroom2",
		];
		return characterKeys[Math.floor(Math.random() * characterKeys.length)];
	};

	return {
		name,
		character: {
			key: getRandomInitialCharacterKey(),
		},
		lastPlayedAt: Date.now(),
		lastPosition: {
			x: 0,
			y: 0,
		},
		coin: 5,
		status: {
			dead: false,
			sick: false,
			hunger: 0,
			happiness: 100,
		},
	};
};
