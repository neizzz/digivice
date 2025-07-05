import type { CharacterKey, CharacterState } from "./Character";
import type { FutureEvent } from "../utils/EventBus";

export enum ObjectType {
  Food = "food",
  Poob = "poob",
  Pill = "pill",
}

export type ObjectData = {
  [ObjectType.Food]: {
    id: string;
    position: Position;
    textureKey: string;
    _createdAt: number;
  };
  [ObjectType.Pill]: {
    id: string;
    position: Position;
    textureKey: string;
    _createdAt: number;
  };
  [ObjectType.Poob]: {
    id: string;
    position: Position;
    _createdAt: number;
  };
};

export type CoinData = {
  key: string;
};

export type CharacterStatusData = {
  position: Position;
  state: CharacterState;
  stamina: number;
  evolutionGauge: number; // 진화 게이지 (0-100)
  timeOfZeroStamina?: number; // 스태미나가 0이 된 시점
  digestionLevel: number; // 소화기관 수치
  // timeOfSickness?: number; // 병에 걸린 시점. sick이 true일 때만 존재
  // timeOfUnderEvolutionGaugeStaminaThreshold?: number; // 진화 게이지가 오르지 않는 스태미나에 도달한 시점
  // fatigue: number;
  // hunger: number;
  // happiness: number;
};

// MainScene에서 사용하는 데이터
export interface GameData {
  _createdAt: number;
  _savedAt: number;
  name: string;
  character: {
    _evolvedAt: number;
    key: CharacterKey | "egg";
    eggTextureKey?: string;
    status: CharacterStatusData;
  };
  futureEvents: FutureEvent[];
  objectsMap: {
    [ObjectType.Food]: ObjectData[ObjectType.Food][];
    [ObjectType.Poob]: ObjectData[ObjectType.Poob][];
    [ObjectType.Pill]?: ObjectData[ObjectType.Pill][];
  };
  coins: CoinData[];
  minigame: {
    flappyBird: {
      highScore: number;
    };
  };
  // achievements: string[];
}
