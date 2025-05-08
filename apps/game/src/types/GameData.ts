import type { FoodFreshness } from "entities/Food";
import type { CharacterKey, CharacterState } from "./Character";

export enum ObjectType {
  Food = "food",
  Poob = "poob",
}

type ObjectData = {
  [ObjectType.Food]: {
    position: {
      x: number;
      y: number;
    };
    createdAt: number;
    textureKey: string;
    freshness: FoodFreshness;
  };
  [ObjectType.Poob]?: {
    position: {
      x: number;
      y: number;
    };
  };
};

type Coin = {
  key: string;
};

export interface GameData {
  name: string;
  createdAt: number;
  lastSavedAt: number;
  character: {
    key: CharacterKey | "egg";
    eggTextureKey?: string;
    evolvedAt?: number;
  };
  objectsMap: {
    [ObjectType.Food]: ObjectData[ObjectType.Food][];
    [ObjectType.Poob]: ObjectData[ObjectType.Poob][];
  };
  coins: Coin[];
  status: {
    lastPosition: {
      x: number;
      y: number;
    };
    lastState: CharacterState;
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
