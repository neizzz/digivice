// 모든 게임 관련 타입과 클래스를 이 파일에서 export

import { DebugFlags } from "./utils/DebugFlags";

// Game 클래스와 관련 타입 export
export { Game } from "./Game";
export { SceneKey } from "./SceneKey";
export * from "./utils/GameDataManager";

export * from "./ui/types";
export * from "./types/GameData";
export * from "./types/Character";

// from "@digivice/client"
if (import.meta.env.DEV === true) {
  DebugFlags.getInstance(); // 인스턴스 생성
}
