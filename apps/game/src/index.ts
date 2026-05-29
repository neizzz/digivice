export { Game } from "./Game";
export type {
	GameDiagnosticsSnapshot,
	MainCharacterInfoSnapshot,
	MainSceneSfxKind,
	MainSceneReentrySimulationStateChangeCallback,
} from "./Game";
export { SceneKey } from "./SceneKey";
export { MissingInitialGameDataError } from "./scenes/MainScene/world";
export {
	MONSTER_BOOK_STORAGE_KEY,
	getLegacyMonsterBookState,
	hasLegacyMonsterBookState,
	loadMonsterBookState,
	migrateLegacyMonsterBookIfNeeded,
	removeMonsterBookState,
	saveMonsterBookState,
} from "./scenes/MainScene/monsterBookStorage";
// export * from "./managers/GameDataManager";

export * from "./ui/types";
export * from "./types/Character";
export { getNativeSunTimes } from "./scenes/MainScene/sunTimes";
export * from "./scenes/MainScene/evolutionAdmin";
export {
	getEvolutionPhaseDurationEstimate,
} from "./scenes/MainScene/evolutionConfig";
export type {
	EvolutionPhaseDurationEstimate,
} from "./scenes/MainScene/evolutionConfig";
export {
	getTimeOfDayLabel,
	TIME_OF_DAY_OPTIONS,
	TimeOfDay,
} from "./scenes/MainScene/timeOfDay";
export type { SunTimesPayload } from "./scenes/MainScene/timeOfDay";
export * from "./utils/nameLabel";
