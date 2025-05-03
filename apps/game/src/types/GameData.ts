import type { CharacterKey } from "./Character";

type Coin = {
  key: string;
};

export interface GameData {
  name: string;
  character: {
    key: CharacterKey;
  };
  lastSavedAt: number;
  lastPosition: {
    x: number;
    y: number;
  };
  coins: Coin[];
  status: {
    stamina: number;
    dead: boolean;
    sick: boolean;
    // fatigue: number;
    // hunger: number;
    // happiness: number;
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
