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
  sickness: boolean;
  evolutionGauge: number; // 진화 게이지 (0-100)
  timeOfZeroStamina?: number; // 스태미나가 0이 된 시점
  // timeOfSickness?: number; // 병에 걸린 시점. sick이 true일 때만 존재
  // timeOfUnderEvolutionGaugeStaminaThreshold?: number; // 진화 게이지가 오르지 않는 스태미나에 도달한 시점
  // fatigue: number;
  // hunger: number;
  // happiness: number;
};

export interface GameData {
  _createdAt: number;
  _savedAt: number;
  name: string;
  character: {
    key: CharacterKey | "egg";
    eggTextureKey?: string;
    status: CharacterStatusData;
    _evolvedAt: number;
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
