import type { CharacterKey, CharacterState } from "./Character";
import type { Position } from "./Position";

export enum ObjectType {
  Food = "food",
  Poob = "poob",
}

export type ObjectData = {
  [ObjectType.Food]: {
    id: string;
    position: Position;
    createdAt: number;
    textureKey: string;
  };
  [ObjectType.Poob]: {
    id: string;
    position: Position;
  };
};

export type CoinData = {
  key: string;
};

export type CharacterStatusData = {
  position: Position;
  state: CharacterState;
  stamina: number;
  sick: boolean;
  // fatigue: number;
  // hunger: number;
  // happiness: number;
};

export interface GameData {
  name: string;
  createdAt: number;
  savedAt: number;
  character: {
    key: CharacterKey | "egg";
    eggTextureKey?: string;
    evolvedAt?: number;
    status: CharacterStatusData;
  };
  objectsMap: {
    [ObjectType.Food]: ObjectData[ObjectType.Food][];
    [ObjectType.Poob]: ObjectData[ObjectType.Poob][];
  };
  coins: CoinData[];
  minigame: {
    flappyBird: {
      highScore: number;
    };
  };
  // achievements: string[];
}
