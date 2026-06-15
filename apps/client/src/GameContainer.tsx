import {
	type ControlButtonParams,
	ControlButtonType,
	Game,
	type GameDiagnosticsSnapshot,
	type MainCharacterInfoSnapshot,
	type MainSceneSfxKind,
	type MainSceneReentrySimulationStateChangeCallback,
	type NativeWorldDataUpdateForReentryCallback,
	getNativeSunTimes,
	hasLegacyMonsterBookState,
	migrateLegacyMonsterBookIfNeeded,
	MissingInitialGameDataError,
	SceneKey,
	TimeOfDay,
} from "@digivice/game";
import type React from "react";
import { flushSync } from "react-dom";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import ControlButtons from "./components/ControlButtons";
import PopupLayer from "./components/PopupLayer";
import { type SetupFormData, SetupLayer } from "./layers/SetupLayer";
import AlertLayer from "./layers/AlertLayer";
import FlappyBirdGameOverLayer from "./layers/FlappyBirdGameOverLayer";
import FlappyBirdSettingsLayer from "./layers/FlappyBirdSettingsLayer";
import MonsterInfoLayer from "./layers/MonsterInfoLayer";
import SettingMenuLayer from "./layers/SettingMenuLayer";
import useAlert from "./hooks/useAlert";
import { getGameSettings, updateGameSettings } from "./settings/gameSettings";
import {
	sanitizeStoredWorldData,
	type StoredWorldData,
} from "./utils/sanitizeStoredWorldData";
import { VibrationAdapter } from "./adapter/VibrationAdapter";
import {
	getDiagnosticsLoggerInfo,
	getDiagnosticsLogs,
	getImportantDiagnosticsLogs,
	logImportantDiagnostics,
	setDiagnosticsContextProvider,
} from "./diagnostics/diagnosticLogger";
import {
	type BootstrapSavedGameDataState,
	EntryFlowDiagnostics,
} from "./diagnostics/entryFlowDiagnostics";
import {
	createClientStorage,
	getClientStorageKind,
} from "./utils/clientStorage";
import type { SanitizeStoredWorldDataResult } from "./utils/sanitizeStoredWorldData";
import {
	readResetBootstrapMarker,
	shouldForceFreshWorldAfterReset,
	writeResetBootstrapMarker,
} from "./utils/resetBootstrapGuard";
import { useI18n } from "./i18n";
import { consumeTopPopupBackHandler } from "./popupBackNavigation";
import {
	playFoodThrowSound,
	playSyringeInsertSound,
	preloadUiSfx,
	resumeUiSfxFromGesture,
} from "./utils/uiSfx";
import {
	clearStoreSnapshotBridgeState,
	getStoreSnapshotConfig,
	resolveStoreSnapshotTimeOfDay,
	setStoreSnapshotBridgeState,
} from "./storeSnapshot";

const WORLD_DATA_STORAGE_KEY = "MainSceneWorldData";
const FLAPPY_BIRD_GAME_OVER_AD_COUNTER_STORAGE_KEY =
	"FlappyBirdGameOverAdCounter";
const FLAPPY_BIRD_GAME_OVER_AD_THRESHOLD = 15;
const FLAPPY_BIRD_GAME_OVER_AD_DELAY_MS = 500;
const FLAPPY_BIRD_GAME_OVER_AD_COOLDOWN_MS = 1;
const biteVibrationAdapter = new VibrationAdapter();
const RECOVERY_INSERT_VIBRATION_DURATION_MS = 50;
const RECOVERY_INSERT_VIBRATION_STRENGTH = 160;
const LOADING_TIMEOUT_MS = 30_000;
const isNativeFeatureDebugMode =
	import.meta.env.NATIVE_FEATURE_DEBUG_MODE === "true";
const isAndroidUserAgent =
	typeof navigator !== "undefined" &&
	/DigiviceApp-Android|Android/i.test(navigator.userAgent);
const KEYBOARD_VIEWPORT_HEIGHT_DELTA_THRESHOLD = 80;
const UNSUPPORTED_VIEWPORT_OVERLAY_SHOW_DEBOUNCE_MS = 180;
const UNSUPPORTED_SQUARE_VIEWPORT_RATIO = 0.8;

function getConfiguredInitialSceneKey(): SceneKey {
	if (import.meta.env.VITE_INITIAL_SCENE === SceneKey.FLAPPY_BIRD_GAME) {
		return SceneKey.FLAPPY_BIRD_GAME;
	}

	if (import.meta.env.VITE_INITIAL_SCENE === SceneKey.MONSTER_BOOK) {
		return SceneKey.MONSTER_BOOK;
	}

	return SceneKey.MAIN;
}

const CONFIGURED_INITIAL_SCENE_KEY = getConfiguredInitialSceneKey();

function isMissingInitialGameDataError(
	error: unknown,
): error is MissingInitialGameDataError {
	return (
		error instanceof MissingInitialGameDataError ||
		(error instanceof Error && error.name === MissingInitialGameDataError.name)
	);
}

function isNativeWorldDataUpdateCompleted(
	result: HomeWidgetNativeWorldDataUpdateResult | null | undefined,
): boolean {
	return (
		result?.status === "native_authoritative_completion_completed" ||
		result?.status === "flutter_world_data_update_completed"
	);
}

function summarizeNativeWorldDataUpdate(
	record: HomeWidgetNativeWorldDataUpdateRecord | null,
): Record<string, unknown> | null {
	if (!record) {
		return null;
	}

	return {
		source: record.source,
		status: record.result?.status ?? null,
		worldDataChanged: record.result?.worldDataChanged ?? null,
		hatched: record.result?.hatched ?? null,
		evolutionGageBefore: record.result?.evolutionGageBefore ?? null,
		evolutionGageAfter: record.result?.evolutionGageAfter ?? null,
		evolutionGageIncreased: record.result?.evolutionGageIncreased ?? null,
		evolved: record.result?.evolved ?? null,
		previousCharacterKey: record.result?.previousCharacterKey ?? null,
		nextCharacterKey: record.result?.nextCharacterKey ?? null,
		previousEvolutionPhase: record.result?.previousEvolutionPhase ?? null,
		nextEvolutionPhase: record.result?.nextEvolutionPhase ?? null,
		candidateKind: record.result?.candidateKind ?? null,
		mutationApplied: record.result?.mutationApplied ?? null,
		mutationRate: record.result?.mutationRate ?? null,
		mutationRoll: record.result?.mutationRoll ?? null,
		mutationTargetRoll: record.result?.mutationTargetRoll ?? null,
		evolutionRoll: record.result?.evolutionRoll ?? null,
		evolutionBlockReason: record.result?.evolutionBlockReason ?? null,
		previousCharacterState: record.result?.previousCharacterState ?? null,
		nextCharacterState: record.result?.nextCharacterState ?? null,
		selectedCharacterKey: record.result?.selectedCharacterKey ?? null,
		diseaseOccurred: record.result?.diseaseOccurred ?? null,
		diseaseCheckCount: record.result?.diseaseCheckCount ?? null,
		lastDiseasePerCheckProbability:
			record.result?.lastDiseasePerCheckProbability ?? null,
		lastDiseaseAggregatedProbability:
			record.result?.lastDiseaseAggregatedProbability ?? null,
		hatchSelectionDiagnostics: record.result?.hatchSelectionDiagnostics ?? null,
		inputWorldDataDiagnostics:
			record.result?.inputWorldDataDiagnostics ?? null,
		updatedWorldDataDiagnostics:
			record.result?.updatedWorldDataDiagnostics ?? null,
		hasAnyWidgets: record.result?.hasAnyWidgets ?? null,
		homeWidget1x1Count: record.result?.homeWidget1x1Count ?? null,
		homeWidget2x1Count: record.result?.homeWidget2x1Count ?? null,
	};
}

type UnsupportedViewportReason = "landscape" | "square" | null;

type UnsupportedViewportCheckOptions = {
	nativeKeyboardInset?: number;
};

type NativeViewportSyncDetail = {
	bottomInset?: number | null;
};

type GameDataSummary = {
	monsterName?: string;
	entityCount: number | "n/a";
	worldVersion?: string;
	useLocalTime?: boolean;
};

type DiagnosticsPayload = {
	generatedAt: string;
	appInfo: {
		project: "MonTTo";
		clientAppVersion: string;
		clientBuildNumber: number;
		appMode: string;
		debugEnabled: boolean;
		storageKind: "native" | "web";
		userAgent: string;
		language: string;
		timezone: string;
		currentSceneKey: string;
		logger: ReturnType<typeof getDiagnosticsLoggerInfo>;
		gameSettings: ReturnType<typeof getGameSettings>;
	};
	summary: GameDataSummary;
	logs: ReturnType<typeof getDiagnosticsLogs>;
	importantLogs: ReturnType<typeof getImportantDiagnosticsLogs>;
	currentGameData: GameDiagnosticsSnapshot["mainSceneData"];
	storedGameData: unknown | null;
	homeWidgetRefreshDiagnostics: Record<string, unknown> | null;
	nativeBridgeDiagnostics: Array<Record<string, unknown>>;
	latestGameData: unknown | null;
	latestGameDataSource: "current_game" | "stored_game" | "none";
	lastValidation: SanitizeStoredWorldDataResult["diagnostics"] | null;
	lastValidationAction: SanitizeStoredWorldDataResult["action"] | null;
	lastValidationResetReason: string | null;
};

type DiagnosticsAttachment = {
	fileName: string;
	text: string;
	mimeType: string;
};

type PendingDiagnosticsDraft = {
	subject: string;
	body: string;
	attachments: DiagnosticsAttachment[];
};

type LoadingFailureAlertState = {
	title: string;
	message: string;
};

type SetupLayerOpenReason =
	| "bootstrap_setup_required"
	| "bootstrap_loading_interrupted"
	| "user_reset"
	| "sanitize_reset"
	| "game_initialize_missing_initial_data"
	| "runtime_missing_initial_data_blocked";

type SceneTransitionLoadState = {
	requestId: number;
	phase: "idle" | "loading" | "core_ready";
	from?: SceneKey;
	to?: SceneKey;
};

type LoadingTimeoutContext = {
	phase: "game_initialize" | "scene_transition";
	startedAt: number;
	initializationAttemptId?: number;
	requestId?: number;
	from?: SceneKey | null;
	to?: SceneKey | null;
};

type RequestInitialGameDataOptions = {
	allowSetupLayer: boolean;
	source: "bootstrap" | "game_runtime";
};

type FlappyBirdGameOverState = {
	onRestart: () => void;
	onExit: () => void | Promise<void>;
};

type FlappyBirdSettingsMenuState = {
	isBgmEnabled: boolean;
	isSfxEnabled: boolean;
	onChangeBgm: (enabled: boolean) => void | Promise<void>;
	onChangeSfx: (enabled: boolean) => void | Promise<void>;
	selectedTimeOfDay?: TimeOfDay;
	onSelectTimeOfDay?: (timeOfDay: TimeOfDay) => void | Promise<void>;
	onResume: () => void | Promise<void>;
	onExit: () => void | Promise<void>;
};

type HomeWidgetLaunchMode = "default" | "widget_refresh";

type WorldDataBackgroundSyncResult = {
	status:
		| "completed"
		| "failed"
		| "skipped_missing_controller"
		| "skipped_no_world_data";
	reason: string;
	selectedSource: "stored" | "in_memory" | null;
	storedLastEcsSaved: number | null;
	inMemoryLastEcsSaved: number | null;
	syncResult?: Record<string, unknown> | null;
	error?: string;
};

function readNullableNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readWorldDataSyncSource(
	value: unknown,
): "stored" | "in_memory" | null {
	return value === "stored" || value === "in_memory" ? value : null;
}

type HomeWidgetNativeWorldDataUpdateResult = Awaited<
	ReturnType<WorldDataUpdateControllerBridge["completeNativeWorldDataUpdate"]>
>;

type HomeWidgetNativeWorldDataUpdateRecord = {
	source: Parameters<NativeWorldDataUpdateForReentryCallback>[0];
	result: HomeWidgetNativeWorldDataUpdateResult;
};

type FullscreenAdEventDetail = {
	state?: "showing" | "dismissed" | "failed";
};

type NativeAppLifecycleEventDetail = {
	state?: "resumed" | "inactive" | "hidden" | "paused" | "detached";
	timestamp?: string;
	launchMode?: string;
	hasAnyWidgets?: boolean;
	homeWidget1x1Count?: number;
	homeWidget2x1Count?: number;
};

const BACK_NAVIGATION_ALERT_ENTRY = "layer:alert";
const BACK_NAVIGATION_LOADING_FAILURE_ENTRY = "layer:loading-failure";
const BACK_NAVIGATION_DIAGNOSTICS_ENTRY = "layer:diagnostics-draft";
const BACK_NAVIGATION_MONSTER_INFO_ENTRY = "layer:monster-info";
const BACK_NAVIGATION_SETTING_MENU_ENTRY = "layer:setting-menu";
const BACK_NAVIGATION_SETTING_RESET_CONFIRM_ENTRY =
	"layer:setting-reset-confirm";
const BACK_NAVIGATION_SCENE_ENTRY_PREFIX = "scene:";
const ROOT_SCENE_HISTORY_STACK = [SceneKey.MAIN] as const;

type BackNavigationEntry =
	| typeof BACK_NAVIGATION_ALERT_ENTRY
	| typeof BACK_NAVIGATION_LOADING_FAILURE_ENTRY
	| typeof BACK_NAVIGATION_DIAGNOSTICS_ENTRY
	| typeof BACK_NAVIGATION_MONSTER_INFO_ENTRY
	| typeof BACK_NAVIGATION_SETTING_MENU_ENTRY
	| typeof BACK_NAVIGATION_SETTING_RESET_CONFIRM_ENTRY
	| `${typeof BACK_NAVIGATION_SCENE_ENTRY_PREFIX}${SceneKey}`;

type BackNavigationHistoryState = {
	__digiviceBackEntries?: BackNavigationEntry[];
};

function createSceneBackNavigationEntry(
	sceneKey: SceneKey,
): BackNavigationEntry {
	return `${BACK_NAVIGATION_SCENE_ENTRY_PREFIX}${sceneKey}`;
}

function parseSceneBackNavigationEntry(
	entry: BackNavigationEntry,
): SceneKey | null {
	if (!entry.startsWith(BACK_NAVIGATION_SCENE_ENTRY_PREFIX)) {
		return null;
	}

	return entry.slice(BACK_NAVIGATION_SCENE_ENTRY_PREFIX.length) as SceneKey;
}

function getTargetSceneKeyFromBackNavigationEntries(
	entries: BackNavigationEntry[],
): SceneKey {
	for (let index = entries.length - 1; index >= 0; index -= 1) {
		const sceneKey = parseSceneBackNavigationEntry(entries[index]);

		if (sceneKey) {
			return sceneKey;
		}
	}

	return SceneKey.MAIN;
}

function readBackNavigationEntriesFromHistoryState(
	state: unknown,
): BackNavigationEntry[] {
	if (!state || typeof state !== "object" || Array.isArray(state)) {
		return [];
	}

	const entries = (state as BackNavigationHistoryState).__digiviceBackEntries;

	if (!Array.isArray(entries)) {
		return [];
	}

	return entries.filter(
		(entry): entry is BackNavigationEntry => typeof entry === "string",
	);
}

function createBackNavigationHistoryState(
	state: unknown,
	entries: BackNavigationEntry[],
): Record<string, unknown> {
	const nextState =
		state && typeof state === "object" && !Array.isArray(state)
			? { ...(state as Record<string, unknown>) }
			: {};

	nextState.__digiviceBackEntries = [...entries];

	return nextState;
}

function areBackNavigationEntriesEqual(
	left: BackNavigationEntry[],
	right: BackNavigationEntry[],
): boolean {
	if (left.length !== right.length) {
		return false;
	}

	for (let index = 0; index < left.length; index += 1) {
		if (left[index] !== right[index]) {
			return false;
		}
	}

	return true;
}

function getStoredFlappyBirdBestScore(data: unknown): number {
	const bestScore = (data as StoredWorldData | null)?.world_metadata?.app_state
		?.mini_game_scores?.flappy_bird?.best_score;

	return typeof bestScore === "number" && Number.isFinite(bestScore)
		? Math.max(0, Math.floor(bestScore))
		: 0;
}

function withStoredFlappyBirdBestScore(
	data: StoredWorldData,
	bestScore: number,
): StoredWorldData {
	const nextBestScore = Math.max(0, Math.floor(bestScore));

	return {
		...data,
		world_metadata: {
			...data.world_metadata,
			app_state: {
				...data.world_metadata?.app_state,
				mini_game_scores: {
					...data.world_metadata?.app_state?.mini_game_scores,
					flappy_bird: {
						...data.world_metadata?.app_state?.mini_game_scores?.flappy_bird,
						best_score: nextBestScore,
					},
				},
			},
		},
	};
}

function getStoredFlappyBirdGameOverAdCount(data: unknown): number {
	if (typeof data === "number" && Number.isFinite(data)) {
		return Math.max(0, Math.floor(data));
	}

	if (data && typeof data === "object" && !Array.isArray(data)) {
		const count = (data as { count?: unknown }).count;

		if (typeof count === "number" && Number.isFinite(count)) {
			return Math.max(0, Math.floor(count));
		}
	}

	return 0;
}

function getSharedBackNavigationPrefixLength(
	left: BackNavigationEntry[],
	right: BackNavigationEntry[],
): number {
	const maxLength = Math.min(left.length, right.length);
	let prefixLength = 0;

	while (
		prefixLength < maxLength &&
		left[prefixLength] === right[prefixLength]
	) {
		prefixLength += 1;
	}

	return prefixLength;
}

function waitForAnimationFrame(): Promise<void> {
	return new Promise((resolve) => {
		window.requestAnimationFrame(() => resolve());
	});
}

function areMainCharacterGeneOutcomesEqual(
	left: MainCharacterInfoSnapshot["geneOutcomes"],
	right: MainCharacterInfoSnapshot["geneOutcomes"],
): boolean {
	if (left.length !== right.length) {
		return false;
	}

	return left.every((leftOutcome, index) => {
		const rightOutcome = right[index];

		return (
			rightOutcome !== undefined &&
			leftOutcome.kind === rightOutcome.kind &&
			leftOutcome.geneLine === rightOutcome.geneLine &&
			leftOutcome.level === rightOutcome.level &&
			leftOutcome.probability === rightOutcome.probability
		);
	});
}

function areMainCharacterInfoSnapshotsEqual(
	left: MainCharacterInfoSnapshot | null,
	right: MainCharacterInfoSnapshot | null,
): boolean {
	if (left === right) {
		return true;
	}

	if (!left || !right) {
		return false;
	}

	return (
		left.monsterName === right.monsterName &&
		left.isEgg === right.isEgg &&
		left.geneLine === right.geneLine &&
		areMainCharacterGeneOutcomesEqual(left.geneOutcomes, right.geneOutcomes) &&
		left.eggHatchRemainingMs === right.eggHatchRemainingMs &&
		left.evolutionPhase === right.evolutionPhase &&
		left.stamina === right.stamina &&
		left.maxStamina === right.maxStamina &&
		left.unhappyThreshold === right.unhappyThreshold &&
		left.boostedThreshold === right.boostedThreshold &&
		left.evolutionGauge === right.evolutionGauge &&
		left.maxEvolutionGauge === right.maxEvolutionGauge &&
		left.evolutionGaugeState === right.evolutionGaugeState
	);
}

async function waitForLayoutStabilization(): Promise<void> {
	await waitForAnimationFrame();
	await waitForAnimationFrame();
	await new Promise((resolve) => window.setTimeout(resolve, 250));
	await waitForAnimationFrame();
}

function getCurrentViewportHeight(): number {
	if (typeof window === "undefined") {
		return 0;
	}

	return Math.max(
		0,
		Math.round(window.visualViewport?.height ?? window.innerHeight),
	);
}

function setFrozenAppShellHeight(height: number | null): void {
	if (typeof document === "undefined") {
		return;
	}

	if (height && height > 0) {
		document.documentElement.style.setProperty(
			"--digivice-app-shell-height",
			`${height}px`,
		);
		return;
	}

	document.documentElement.style.removeProperty("--digivice-app-shell-height");
}

function isTextInputElement(element: Element | null): element is HTMLElement {
	return (
		element instanceof HTMLElement &&
		(element.tagName === "INPUT" ||
			element.tagName === "TEXTAREA" ||
			element.isContentEditable)
	);
}

function isKeyboardOpenForUnsupportedViewportCheck(
	options: UnsupportedViewportCheckOptions = {},
): boolean {
	if (typeof window === "undefined" || typeof document === "undefined") {
		return false;
	}

	const { nativeKeyboardInset = 0 } = options;
	if (nativeKeyboardInset > 0) {
		return true;
	}

	const visualViewport = window.visualViewport;

	if (!visualViewport) {
		return false;
	}

	const baseViewportHeight = Math.max(
		window.innerHeight,
		document.documentElement.clientHeight || 0,
	);
	const viewportHeightDelta = baseViewportHeight - visualViewport.height;

	return viewportHeightDelta >= KEYBOARD_VIEWPORT_HEIGHT_DELTA_THRESHOLD;
}

function getUnsupportedViewportReason(
	options: UnsupportedViewportCheckOptions = {},
): UnsupportedViewportReason {
	if (typeof window === "undefined") {
		return null;
	}

	const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
	const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

	if (viewportWidth <= 0 || viewportHeight <= 0) {
		return null;
	}

	if (isKeyboardOpenForUnsupportedViewportCheck(options)) {
		return null;
	}

	if (viewportWidth > viewportHeight) {
		return "landscape";
	}

	if (viewportWidth / viewportHeight >= UNSUPPORTED_SQUARE_VIEWPORT_RATIO) {
		return "square";
	}

	return null;
}

function summarizeSavedData(savedData: unknown): Record<string, unknown> {
	if (!savedData || typeof savedData !== "object") {
		return {
			hasData: Boolean(savedData),
			valueType: typeof savedData,
			isNull: savedData === null,
		};
	}

	const savedDataRecord = savedData as {
		world_metadata?: { monster_name?: string };
		entities?: unknown[];
	};

	return {
		hasData: true,
		valueType: typeof savedData,
		monsterName: savedDataRecord.world_metadata?.monster_name,
		entityCount: Array.isArray(savedDataRecord.entities)
			? savedDataRecord.entities.length
			: "n/a",
	};
}

function summarizeBrowserLocalStorageEntry(
	key: string,
): Record<string, unknown> {
	if (typeof window === "undefined") {
		return {
			available: false,
			reason: "window_unavailable",
		};
	}

	try {
		const rawValue = window.localStorage.getItem(key);

		if (rawValue === null) {
			return {
				available: true,
				hasKey: false,
			};
		}

		try {
			return {
				available: true,
				hasKey: true,
				rawLength: rawValue.length,
				parsedSummary: summarizeSavedData(JSON.parse(rawValue)),
			};
		} catch (error) {
			return {
				available: true,
				hasKey: true,
				rawLength: rawValue.length,
				parseError: error instanceof Error ? error.message : String(error),
			};
		}
	} catch (error) {
		return {
			available: false,
			reason: error instanceof Error ? error.message : String(error),
		};
	}
}

function summarizeGameData(data: unknown): GameDataSummary {
	if (!data || typeof data !== "object") {
		return {
			entityCount: "n/a",
		};
	}

	const record = data as {
		world_metadata?: {
			monster_name?: string;
			version?: string;
			app_state?: {
				use_local_time?: boolean;
			};
		};
		entities?: unknown[];
	};

	return {
		monsterName: record.world_metadata?.monster_name,
		entityCount: Array.isArray(record.entities)
			? record.entities.length
			: "n/a",
		worldVersion: record.world_metadata?.version,
		useLocalTime: record.world_metadata?.app_state?.use_local_time,
	};
}

function createDiagnosticsSubject(timestamp: string): string {
	return `[MonTTo][${getClientReleaseLabel()}] Diagnostics Report ${timestamp}`;
}

function createDiagnosticsBody(): string {
	return [
		`App version: ${getClientReleaseLabel()}`,
		"",
		"Please describe the issue or symptoms you observed.",
		"",
		"- What happened?",
		"- When did it happen?",
		"- What did you expect to happen?",
		"- How can it be reproduced?",
	].join("\n");
}

function createFlappyBirdLogsSubject(timestamp: string): string {
	return `[MonTTo][${getClientReleaseLabel()}] FlappyBird Logs ${timestamp}`;
}

function createFlappyBirdLogsBody(): string {
	return [
		`App version: ${getClientReleaseLabel()}`,
		"",
		"FlappyBird log files are attached.",
		"",
		"Please describe the minigame issue or symptoms you observed.",
		"",
		"- What happened during the game?",
		"- When did it happen?",
		"- What did you expect to happen?",
		"- How can it be reproduced?",
	].join("\n");
}

function getClientReleaseLabel(): string {
	return `${__APP_VERSION__}+${__APP_BUILD_NUMBER__}`;
}

function getClientReleaseFileLabel(): string {
	const sanitizedVersion = __APP_VERSION__.replace(/[^a-zA-Z0-9.-]+/g, "_");
	return `${sanitizedVersion}-build-${__APP_BUILD_NUMBER__}`;
}

function buildDiagnosticsTimestampSuffix(timestamp: string): string {
	return timestamp.replace(/\.\d{3}Z$/, "Z").replace(/[:]/g, "-");
}

function buildGmailComposeHref(subject: string, body: string): string {
	const gmailComposeUrl = new URL("https://mail.google.com/mail/");
	gmailComposeUrl.searchParams.set("view", "cm");
	gmailComposeUrl.searchParams.set("fs", "1");
	gmailComposeUrl.searchParams.set("to", "dev.chchh@gmail.com");
	gmailComposeUrl.searchParams.set("su", subject);
	gmailComposeUrl.searchParams.set("body", body);
	return gmailComposeUrl.toString();
}

async function openMailDraft(
	subject: string,
	body: string,
	attachments?: DiagnosticsAttachment[],
): Promise<
	"gmail_app" | "external_browser" | "browser_window" | "same_window"
> {
	const composeUrl = buildGmailComposeHref(subject, body);
	const recipient = "dev.chchh@gmail.com";

	if (
		typeof window !== "undefined" &&
		window.browserController &&
		typeof window.browserController.openGmailDraft === "function"
	) {
		try {
			await window.browserController.openGmailDraft(
				recipient,
				subject,
				body,
				attachments,
			);
			return "gmail_app";
		} catch (gmailError) {
			console.warn(
				"[GameContainer] Falling back to browser compose because Gmail app launch failed",
				gmailError,
			);
		}
	}

	if (
		typeof window !== "undefined" &&
		window.browserController &&
		typeof window.browserController.openExternalUrl === "function"
	) {
		await window.browserController.openExternalUrl(composeUrl);
		return "external_browser";
	}

	const openedWindow = window.open(composeUrl, "_blank", "noopener,noreferrer");
	if (openedWindow) {
		return "browser_window";
	}

	window.location.assign(composeUrl);
	return "same_window";
}

const GameContainer: React.FC = () => {
	const gameViewportRef = useRef<HTMLDivElement>(null);
	const gameContainerRef = useRef<HTMLDivElement>(null);
	const controlButtonsWrapperRef = useRef<HTMLDivElement>(null);
	const [gameInstance, setGameInstance] = useState<Game | null>(null);
	const [gameContainerSize, setGameContainerSize] = useState<number | null>(
		null,
	);
	const [unsupportedViewportReason, setUnsupportedViewportReason] =
		useState<UnsupportedViewportReason>(null);
	const [showSetupLayer, setShowSetupLayer] = useState<boolean>(false);
	const [isBootstrapping, setIsBootstrapping] = useState<boolean>(true);
	const { locale, setLocale, t } = useI18n();
	const { alertState, showAlert, hideAlert } = useAlert();
	const [loadingFailureAlert, setLoadingFailureAlert] =
		useState<LoadingFailureAlertState | null>(null);
	const [sanitizeResetAlert, setSanitizeResetAlert] = useState<{
		title: string;
		message: string;
	} | null>(null);
	const isInitializedRef = useRef<boolean>(false);
	const isInitializingGameRef = useRef(false);
	const initialSetupDataRef = useRef<SetupFormData | null>(null);
	const pendingInitialSetupPromiseRef = useRef<Promise<SetupFormData> | null>(
		null,
	);
	const pendingSetupResolverRef = useRef<
		((formData: SetupFormData) => void) | null
	>(null);
	const entryFlowDiagnostics = useMemo(() => new EntryFlowDiagnostics(), []);
	const shouldRestartFromSetupRef = useRef(false);
	const [sceneHistoryStack, setSceneHistoryStack] = useState<SceneKey[]>(() => [
		...ROOT_SCENE_HISTORY_STACK,
	]);
	const [monsterInfoState, setMonsterInfoState] =
		useState<MainCharacterInfoSnapshot | null>(null);
	const [showSettingMenu, setShowSettingMenu] = useState(false);
	const [showFinalResetConfirm, setShowFinalResetConfirm] = useState(false);
	const [gameSettings, setGameSettings] = useState(getGameSettings);
	const [gameSessionKey, setGameSessionKey] = useState(0);
	const [isSendingDiagnostics, setIsSendingDiagnostics] = useState(false);
	const [pendingDiagnosticsDraft, setPendingDiagnosticsDraft] =
		useState<PendingDiagnosticsDraft | null>(null);
	const [flappyBirdGameOverState, setFlappyBirdGameOverState] =
		useState<FlappyBirdGameOverState | null>(null);
	const [flappyBirdSettingsMenuState, setFlappyBirdSettingsMenuState] =
		useState<FlappyBirdSettingsMenuState | null>(null);
	const [buttonParams, setButtonParams] = useState<
		[ControlButtonParams, ControlButtonParams, ControlButtonParams] | null
	>(null);
	const [controlButtonSoundEnabled, setControlButtonSoundEnabled] =
		useState(true);
	const [sceneTransitionLoadState, setSceneTransitionLoadState] =
		useState<SceneTransitionLoadState>({
			requestId: 0,
			phase: "idle",
		});
	const [isResumeGuardVisible, setIsResumeGuardVisible] = useState(false);
	const [storeSnapshotAppliedTimeOfDay, setStoreSnapshotAppliedTimeOfDay] =
		useState<TimeOfDay | null>(null);
	const pendingSettingMenuOpenTimeoutRef = useRef<number | null>(null);
	const sceneTransitionRequestIdRef = useRef(0);
	const resumeGuardReleaseRequestIdRef = useRef(0);
	const gameInitializationAttemptIdRef = useRef(0);
	const pendingGameInitializationRef = useRef<{
		attemptId: number;
		game: Game;
	} | null>(null);
	const initializeGameStartTimeoutRef = useRef<number | null>(null);
	const loadingTimeoutIdRef = useRef<number | null>(null);
	const loadingTimeoutContextRef = useRef<LoadingTimeoutContext | null>(null);
	const flappyBirdGameOverAdTimeoutRef = useRef<number | null>(null);
	const nativeKeyboardInsetRef = useRef(0);
	const unsupportedViewportOverlayShowTimeoutRef = useRef<number | null>(null);
	const lastValidationResultRef = useRef<SanitizeStoredWorldDataResult | null>(
		null,
	);
	const isFullscreenAdLayoutFrozenRef = useRef(false);
	const isResumeGuardVisibleRef = useRef(false);
	const isResumeReentrySimulationRunningRef = useRef(false);
	const homeWidgetLaunchModeRef = useRef<HomeWidgetLaunchMode>("default");
	const homeWidgetPresenceRef = useRef<{
		hasAnyWidgets: boolean;
		homeWidget1x1Count: number | null;
		homeWidget2x1Count: number | null;
	}>({
		hasAnyWidgets: false,
		homeWidget1x1Count: null,
		homeWidget2x1Count: null,
	});
	const lastNativeWorldDataUpdateForReentryRef =
		useRef<HomeWidgetNativeWorldDataUpdateRecord | null>(null);
	const nativeBackgroundWidgetSyncTriggeredRef = useRef(false);
	const completeWidgetRefreshAfterInitReentryRef = useRef<
		| ((
				result: "completed" | "skipped" | "failed" | undefined,
		  ) => Promise<void>)
		| null
	>(null);
	const fullscreenAdLayoutReleaseTimeoutRef = useRef<number | null>(null);
	const fullscreenAdLayoutReleaseRafRef = useRef<number | null>(null);
	const activeBackNavigationEntriesRef = useRef<BackNavigationEntry[]>([]);
	const currentBackNavigationEntriesRef = useRef<BackNavigationEntry[]>([]);
	const pendingPopstateTargetEntriesRef = useRef<BackNavigationEntry[] | null>(
		null,
	);
	const pendingBrowserHistoryTargetEntriesRef = useRef<
		BackNavigationEntry[] | null
	>(null);
	const hasInitializedBackNavigationHistoryRef = useRef(false);
	const storeSnapshotConfig = useMemo(() => getStoreSnapshotConfig(), []);
	const storeSnapshotSceneRequestedRef = useRef<SceneKey | null>(null);
	const storeSnapshotMonsterInfoRequestedRef = useRef(false);

	const logSetupLayerVisibility = useCallback(
		(
			reason: SetupLayerOpenReason,
			payload: Record<string, unknown> = {},
			level: "log" | "warn" | "error" = "warn",
		) => {
			logImportantDiagnostics(
				level,
				"[ImportantDiagnostics][SetupLayerVisibility]",
				{
					reason,
					hasGameInstance: !!gameInstance,
					isInitialized: isInitializedRef.current,
					isInitializingGame: isInitializingGameRef.current,
					currentSceneKey: gameInstance?.getCurrentSceneKey() ?? null,
					sceneTransitionPhase: sceneTransitionLoadState.phase,
					sceneTransitionRequestId: sceneTransitionLoadState.requestId,
					sceneTransitionFrom: sceneTransitionLoadState.from ?? null,
					sceneTransitionTo: sceneTransitionLoadState.to ?? null,
					documentHidden:
						typeof document !== "undefined" ? document.hidden : null,
					...payload,
				},
			);
		},
		[gameInstance, sceneTransitionLoadState],
	);

	const presentSetupLayer = useCallback(
		(
			reason: Exclude<
				SetupLayerOpenReason,
				"runtime_missing_initial_data_blocked"
			>,
			payload: Record<string, unknown> = {},
		) => {
			logSetupLayerVisibility(reason, payload);
			setShowSetupLayer(true);
		},
		[logSetupLayerVisibility],
	);

	const clearPendingSettingMenuOpen = useCallback(() => {
		if (pendingSettingMenuOpenTimeoutRef.current === null) {
			return;
		}

		window.clearTimeout(pendingSettingMenuOpenTimeoutRef.current);
		pendingSettingMenuOpenTimeoutRef.current = null;
	}, []);

	const clearInitializeGameStartTimeout = useCallback(() => {
		if (initializeGameStartTimeoutRef.current === null) {
			return;
		}

		window.clearTimeout(initializeGameStartTimeoutRef.current);
		initializeGameStartTimeoutRef.current = null;
	}, []);

	const clearLoadingTimeout = useCallback(() => {
		if (loadingTimeoutIdRef.current !== null) {
			window.clearTimeout(loadingTimeoutIdRef.current);
			loadingTimeoutIdRef.current = null;
		}

		loadingTimeoutContextRef.current = null;
	}, []);

	const showResumeGuard = useCallback(
		(reason: string, options: { sync?: boolean } = {}) => {
			if (isFullscreenAdLayoutFrozenRef.current) {
				return;
			}

			resumeGuardReleaseRequestIdRef.current += 1;
			isResumeGuardVisibleRef.current = true;

			const applyVisibleState = () => {
				setIsResumeGuardVisible(true);
			};

			if (options.sync) {
				flushSync(applyVisibleState);
			} else {
				applyVisibleState();
			}

			logImportantDiagnostics("log", "[ImportantDiagnostics][ResumeGuard]", {
				state: "shown",
				reason,
				currentSceneKey: gameInstance?.getCurrentSceneKey() ?? null,
			});
		},
		[gameInstance],
	);

	const hideResumeGuardAfterLayout = useCallback((reason: string) => {
		if (!isResumeGuardVisibleRef.current) {
			return;
		}

		if (isResumeReentrySimulationRunningRef.current) {
			return;
		}

		const requestId = resumeGuardReleaseRequestIdRef.current + 1;
		resumeGuardReleaseRequestIdRef.current = requestId;

		void (async () => {
			await waitForLayoutStabilization();

			if (
				resumeGuardReleaseRequestIdRef.current !== requestId ||
				isResumeReentrySimulationRunningRef.current
			) {
				return;
			}

			isResumeGuardVisibleRef.current = false;
			setIsResumeGuardVisible(false);
			logImportantDiagnostics("log", "[ImportantDiagnostics][ResumeGuard]", {
				state: "hidden",
				reason,
			});
		})();
	}, []);

	const clearPendingFlappyBirdGameOverAd = useCallback(() => {
		if (flappyBirdGameOverAdTimeoutRef.current === null) {
			return;
		}

		window.clearTimeout(flappyBirdGameOverAdTimeoutRef.current);
		flappyBirdGameOverAdTimeoutRef.current = null;
	}, []);

	const cancelPendingGameInitialization = useCallback(
		(reason: string) => {
			clearInitializeGameStartTimeout();

			const pendingInitialization = pendingGameInitializationRef.current;
			pendingGameInitializationRef.current = null;
			isInitializingGameRef.current = false;

			if (!pendingInitialization) {
				return;
			}

			try {
				pendingInitialization.game.destroy();
			} catch (error) {
				console.warn(
					"[GameContainer] Failed to cancel a pending game initialization.",
					{
						reason,
						error,
					},
				);
			}
		},
		[clearInitializeGameStartTimeout],
	);

	const openSettingMenu = useCallback(() => {
		if (showSettingMenu || pendingSettingMenuOpenTimeoutRef.current !== null) {
			return;
		}

		pendingSettingMenuOpenTimeoutRef.current = window.setTimeout(() => {
			pendingSettingMenuOpenTimeoutRef.current = null;
			setShowSettingMenu(true);
		}, 0);
	}, [showSettingMenu]);

	const openMonsterInfo = useCallback(
		(snapshot: MainCharacterInfoSnapshot | null) => {
			if (!snapshot) {
				return;
			}

			setMonsterInfoState((previous) =>
				areMainCharacterInfoSnapshotsEqual(previous, snapshot)
					? previous
					: snapshot,
			);
		},
		[],
	);

	const closeMonsterInfo = useCallback(() => {
		setMonsterInfoState(null);
	}, []);

	const closeSettingMenu = useCallback(() => {
		clearPendingSettingMenuOpen();
		setShowFinalResetConfirm(false);
		setShowSettingMenu(false);
	}, [clearPendingSettingMenuOpen]);

	const closeResetConfirm = useCallback(() => {
		if (typeof document !== "undefined") {
			const activeElement = document.activeElement;

			if (isTextInputElement(activeElement)) {
				activeElement.blur();
			}
		}

		setShowFinalResetConfirm(false);
	}, []);

	const backNavigationEntries = useMemo(() => {
		const entries = sceneHistoryStack
			.slice(1)
			.map((sceneKey) => createSceneBackNavigationEntry(sceneKey));

		if (monsterInfoState) {
			entries.push(BACK_NAVIGATION_MONSTER_INFO_ENTRY);
		}

		if (showSettingMenu) {
			entries.push(BACK_NAVIGATION_SETTING_MENU_ENTRY);
		}

		if (showFinalResetConfirm) {
			entries.push(BACK_NAVIGATION_SETTING_RESET_CONFIRM_ENTRY);
		}

		if (alertState) {
			entries.push(BACK_NAVIGATION_ALERT_ENTRY);
		}

		if (loadingFailureAlert) {
			entries.push(BACK_NAVIGATION_LOADING_FAILURE_ENTRY);
		}

		if (pendingDiagnosticsDraft) {
			entries.push(BACK_NAVIGATION_DIAGNOSTICS_ENTRY);
		}

		return entries;
	}, [
		alertState,
		loadingFailureAlert,
		monsterInfoState,
		pendingDiagnosticsDraft,
		sceneHistoryStack,
		showFinalResetConfirm,
		showSettingMenu,
	]);

	const requestHistoryBackForEntry = useCallback(
		(entry: BackNavigationEntry, fallback: () => void) => {
			if (typeof window === "undefined") {
				fallback();
				return;
			}

			const currentEntries = activeBackNavigationEntriesRef.current;

			if (currentEntries[currentEntries.length - 1] !== entry) {
				fallback();
				return;
			}

			window.history.back();
		},
		[],
	);

	const dismissAlert = useCallback(() => {
		requestHistoryBackForEntry(BACK_NAVIGATION_ALERT_ENTRY, hideAlert);
	}, [hideAlert, requestHistoryBackForEntry]);

	const dismissLoadingFailureAlert = useCallback(() => {
		requestHistoryBackForEntry(BACK_NAVIGATION_LOADING_FAILURE_ENTRY, () => {
			setLoadingFailureAlert(null);
		});
	}, [requestHistoryBackForEntry]);

	const dismissDiagnosticsDraft = useCallback(() => {
		requestHistoryBackForEntry(BACK_NAVIGATION_DIAGNOSTICS_ENTRY, () => {
			setPendingDiagnosticsDraft(null);
		});
	}, [requestHistoryBackForEntry]);

	const dismissMonsterInfo = useCallback(() => {
		requestHistoryBackForEntry(BACK_NAVIGATION_MONSTER_INFO_ENTRY, () => {
			setMonsterInfoState(null);
		});
	}, [requestHistoryBackForEntry]);

	const dismissResetConfirm = useCallback(() => {
		requestHistoryBackForEntry(
			BACK_NAVIGATION_SETTING_RESET_CONFIRM_ENTRY,
			closeResetConfirm,
		);
	}, [closeResetConfirm, requestHistoryBackForEntry]);

	const dismissSettingMenu = useCallback(() => {
		requestHistoryBackForEntry(
			BACK_NAVIGATION_SETTING_MENU_ENTRY,
			closeSettingMenu,
		);
	}, [closeSettingMenu, requestHistoryBackForEntry]);

	const interruptLoadingFlow = useCallback(
		(reason: "back_navigation" | "app_hidden"): boolean => {
			if (
				sceneTransitionLoadState.phase === "loading" &&
				gameInstance &&
				sceneTransitionLoadState.from
			) {
				const interrupted = gameInstance.requestSceneTransitionInterruption({
					requestId: sceneTransitionLoadState.requestId,
					fallbackScene: sceneTransitionLoadState.from,
					reason,
				});

				if (interrupted) {
					logImportantDiagnostics(
						"warn",
						"[ImportantDiagnostics][LoadingInterruption]",
						{
							reason,
							loadingKind: "scene_transition_loading",
							requestId: sceneTransitionLoadState.requestId,
							from: sceneTransitionLoadState.from,
							to: sceneTransitionLoadState.to,
						},
					);
					return true;
				}
			}

			if (
				sceneTransitionLoadState.phase === "core_ready" &&
				gameInstance &&
				sceneTransitionLoadState.from
			) {
				logImportantDiagnostics(
					"warn",
					"[ImportantDiagnostics][LoadingInterruption]",
					{
						reason,
						loadingKind: "scene_transition_core_ready",
						requestId: sceneTransitionLoadState.requestId,
						from: sceneTransitionLoadState.from,
						to: sceneTransitionLoadState.to,
					},
				);
				clearLoadingTimeout();
				sceneTransitionRequestIdRef.current = 0;
				setSceneTransitionLoadState({ requestId: 0, phase: "idle" });
				setIsBootstrapping(false);
				void gameInstance.changeScene(sceneTransitionLoadState.from);
				return true;
			}

			if (isBootstrapping && !showSetupLayer) {
				logImportantDiagnostics(
					"warn",
					"[ImportantDiagnostics][LoadingInterruption]",
					{
						reason,
						loadingKind: "bootstrap_to_main",
						requestId: sceneTransitionLoadState.requestId,
						from: "setup_layer",
						to: SceneKey.MAIN,
					},
				);
				clearLoadingTimeout();
				cancelPendingGameInitialization(`loading_interrupted:${reason}`);
				sceneTransitionRequestIdRef.current = 0;
				setSceneTransitionLoadState({ requestId: 0, phase: "idle" });
				setLoadingFailureAlert(null);
				setButtonParams(null);
				isInitializedRef.current = false;

				if (gameInstance) {
					try {
						gameInstance.destroy();
					} catch (error) {
						console.warn(
							"[GameContainer] Failed to destroy the active game while interrupting bootstrap loading.",
							{
								reason,
								error,
							},
						);
					}
				}

				if (gameContainerRef.current) {
					gameContainerRef.current.innerHTML = "";
				}

				setGameInstance(null);
				setIsBootstrapping(false);

				if (reason === "back_navigation") {
					logImportantDiagnostics(
						"warn",
						"[ImportantDiagnostics][LoadingInterruption] Bootstrap interruption from back navigation will fall through to native exit handling.",
						{
							reason,
							loadingKind: "bootstrap_to_main_back_navigation_exit",
							requestId: sceneTransitionLoadState.requestId,
							sceneHistoryTop:
								sceneHistoryStack[sceneHistoryStack.length - 1] ?? null,
						},
					);
					return false;
				}

				presentSetupLayer("bootstrap_loading_interrupted", {
					triggerReason: reason,
				});
				return true;
			}

			return false;
		},
		[
			cancelPendingGameInitialization,
			clearLoadingTimeout,
			gameInstance,
			isBootstrapping,
			sceneHistoryStack,
			presentSetupLayer,
			sceneTransitionLoadState,
			showSetupLayer,
		],
	);

	const handleNativeBackNavigation = useCallback((): "consumed" | "exit" => {
		if (typeof window === "undefined") {
			return "consumed";
		}

		if (
			pendingBrowserHistoryTargetEntriesRef.current ||
			pendingPopstateTargetEntriesRef.current
		) {
			return "consumed";
		}

		if (consumeTopPopupBackHandler()) {
			return "consumed";
		}

		if (interruptLoadingFlow("back_navigation")) {
			return "consumed";
		}

		if (window.digiviceAdFallbackBridge?.isActive()) {
			return "consumed";
		}

		if (unsupportedViewportReason || showSetupLayer || sanitizeResetAlert) {
			return "consumed";
		}

		if (pendingDiagnosticsDraft) {
			setPendingDiagnosticsDraft(null);
			return "consumed";
		}

		if (flappyBirdSettingsMenuState) {
			const { onResume } = flappyBirdSettingsMenuState;
			setFlappyBirdSettingsMenuState(null);
			void Promise.resolve(onResume());
			return "consumed";
		}

		const currentSceneKey =
			gameInstance?.getCurrentSceneKey() ??
			sceneHistoryStack[sceneHistoryStack.length - 1] ??
			SceneKey.MAIN;

		if (
			currentSceneKey === SceneKey.FLAPPY_BIRD_GAME &&
			activeBackNavigationEntriesRef.current.length === 0
		) {
			gameInstance?.prepareCurrentSceneForNativeBackExit();
			return "exit";
		}

		if (
			flappyBirdGameOverState &&
			currentSceneKey !== SceneKey.FLAPPY_BIRD_GAME
		) {
			const { onExit } = flappyBirdGameOverState;
			setFlappyBirdGameOverState(null);
			void Promise.resolve(onExit());
			return "consumed";
		}

		if (activeBackNavigationEntriesRef.current.length === 0) {
			if (currentSceneKey !== SceneKey.MAIN) {
				if (gameInstance) {
					void gameInstance.changeScene(SceneKey.MAIN);
				}

				return "consumed";
			}

			return "exit";
		}

		window.history.back();
		return "consumed";
	}, [
		flappyBirdGameOverState,
		flappyBirdSettingsMenuState,
		gameInstance,
		isBootstrapping,
		pendingDiagnosticsDraft,
		sanitizeResetAlert,
		sceneHistoryStack,
		sceneTransitionLoadState.phase,
		setFlappyBirdGameOverState,
		setFlappyBirdSettingsMenuState,
		setPendingDiagnosticsDraft,
		showSetupLayer,
		unsupportedViewportReason,
		interruptLoadingFlow,
	]);

	const applyBackNavigationTarget = useCallback(
		async (targetEntries: BackNavigationEntry[]) => {
			const targetEntrySet = new Set(targetEntries);

			if (!targetEntrySet.has(BACK_NAVIGATION_DIAGNOSTICS_ENTRY)) {
				setPendingDiagnosticsDraft(null);
			}

			if (!targetEntrySet.has(BACK_NAVIGATION_ALERT_ENTRY)) {
				hideAlert();
			}

			if (!targetEntrySet.has(BACK_NAVIGATION_LOADING_FAILURE_ENTRY)) {
				setLoadingFailureAlert(null);
			}

			if (!targetEntrySet.has(BACK_NAVIGATION_MONSTER_INFO_ENTRY)) {
				closeMonsterInfo();
			}

			if (!targetEntrySet.has(BACK_NAVIGATION_SETTING_MENU_ENTRY)) {
				closeSettingMenu();
			} else if (
				!targetEntrySet.has(BACK_NAVIGATION_SETTING_RESET_CONFIRM_ENTRY)
			) {
				closeResetConfirm();
			}

			if (!gameInstance || sceneTransitionLoadState.phase !== "idle") {
				return;
			}

			const targetSceneKey =
				getTargetSceneKeyFromBackNavigationEntries(targetEntries);

			if (gameInstance.getCurrentSceneKey() === targetSceneKey) {
				return;
			}

			await gameInstance.changeScene(targetSceneKey);
		},
		[
			closeMonsterInfo,
			closeResetConfirm,
			closeSettingMenu,
			gameInstance,
			hideAlert,
			sceneTransitionLoadState.phase,
		],
	);

	const stopLoadingWithFailure = useCallback(
		({
			message,
			title = t("loading.errorTitle"),
			error,
			context,
		}: {
			message: string;
			title?: string;
			error?: unknown;
			context?: Record<string, unknown>;
		}) => {
			clearLoadingTimeout();
			cancelPendingGameInitialization("loading_failure");
			sceneTransitionRequestIdRef.current = 0;
			setSceneTransitionLoadState({ requestId: 0, phase: "idle" });
			setIsBootstrapping(false);

			const diagnosticsContext = {
				release: getClientReleaseLabel(),
				storageKind: getClientStorageKind(),
				sceneTransitionPhase: sceneTransitionLoadState.phase,
				currentSceneKey: gameInstance?.getCurrentSceneKey() ?? null,
				...context,
				error: error ?? null,
			};

			logImportantDiagnostics(
				"error",
				"[ImportantDiagnostics][GameContainer] Loading flow failed.",
				diagnosticsContext,
			);
			console.error("[GameContainer] Loading flow failed.", {
				message,
				...diagnosticsContext,
			});
			setLoadingFailureAlert({ title, message });
		},
		[
			cancelPendingGameInitialization,
			clearLoadingTimeout,
			gameInstance,
			sceneTransitionLoadState.phase,
			t,
		],
	);

	const armLoadingTimeout = useCallback(
		(
			context: Omit<LoadingTimeoutContext, "startedAt">,
			options: { resetStart?: boolean } = {},
		) => {
			const startedAt =
				!options.resetStart && loadingTimeoutContextRef.current
					? loadingTimeoutContextRef.current.startedAt
					: Date.now();

			loadingTimeoutContextRef.current = {
				...context,
				startedAt,
			};

			if (loadingTimeoutIdRef.current !== null) {
				window.clearTimeout(loadingTimeoutIdRef.current);
			}

			const elapsedMs = Date.now() - startedAt;
			const remainingMs = Math.max(0, LOADING_TIMEOUT_MS - elapsedMs);

			loadingTimeoutIdRef.current = window.setTimeout(() => {
				loadingTimeoutIdRef.current = null;

				const timeoutContext = loadingTimeoutContextRef.current;
				loadingTimeoutContextRef.current = null;

				if (!timeoutContext) {
					return;
				}

				stopLoadingWithFailure({
					title: t("loading.timeoutTitle"),
					message: t("loading.timeoutMessage"),
					context: {
						phase: "loading_timeout",
						loadingPhase: timeoutContext.phase,
						initializationAttemptId:
							timeoutContext.initializationAttemptId ?? null,
						requestId: timeoutContext.requestId ?? null,
						from: timeoutContext.from ?? null,
						to: timeoutContext.to ?? null,
						elapsedMs: Date.now() - timeoutContext.startedAt,
						timeoutMs: LOADING_TIMEOUT_MS,
					},
				});
			}, remainingMs);
		},
		[stopLoadingWithFailure, t],
	);

	useEffect(() => {
		preloadUiSfx();
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		let hasResumedUiSfx = false;

		const cleanupListeners = () => {
			window.removeEventListener("pointerdown", handlePointerDown, true);
			window.removeEventListener("touchstart", handleTouchStart, true);
			window.removeEventListener("keydown", handleKeyDown, true);
		};

		const handleFirstGesture = () => {
			if (hasResumedUiSfx) {
				return;
			}

			hasResumedUiSfx = true;
			resumeUiSfxFromGesture();
			cleanupListeners();
		};

		const handlePointerDown = () => {
			handleFirstGesture();
		};

		const handleTouchStart = () => {
			handleFirstGesture();
		};

		const handleKeyDown = () => {
			handleFirstGesture();
		};

		window.addEventListener("pointerdown", handlePointerDown, {
			capture: true,
			passive: true,
		});
		window.addEventListener("touchstart", handleTouchStart, {
			capture: true,
			passive: true,
		});
		window.addEventListener("keydown", handleKeyDown, true);

		return cleanupListeners;
	}, []);

	useEffect(() => {
		return () => {
			clearPendingSettingMenuOpen();
		};
	}, [clearPendingSettingMenuOpen]);

	useLayoutEffect(() => {
		activeBackNavigationEntriesRef.current = backNavigationEntries;
	}, [backNavigationEntries]);

	useLayoutEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const backBridge = {
			handleBackNavigation: handleNativeBackNavigation,
		};

		window.digiviceBackBridge = backBridge;

		return () => {
			if (window.digiviceBackBridge === backBridge) {
				window.digiviceBackBridge = undefined;
			}
		};
	}, [handleNativeBackNavigation]);

	useLayoutEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		if (!hasInitializedBackNavigationHistoryRef.current) {
			window.history.replaceState(
				createBackNavigationHistoryState(
					window.history.state,
					backNavigationEntries,
				),
				document.title,
			);
			currentBackNavigationEntriesRef.current = backNavigationEntries;
			hasInitializedBackNavigationHistoryRef.current = true;
			return;
		}

		if (pendingBrowserHistoryTargetEntriesRef.current) {
			return;
		}

		if (pendingPopstateTargetEntriesRef.current) {
			if (
				areBackNavigationEntriesEqual(
					pendingPopstateTargetEntriesRef.current,
					backNavigationEntries,
				)
			) {
				currentBackNavigationEntriesRef.current = backNavigationEntries;
				pendingPopstateTargetEntriesRef.current = null;
			}
			return;
		}

		const currentEntries = currentBackNavigationEntriesRef.current;

		if (areBackNavigationEntriesEqual(currentEntries, backNavigationEntries)) {
			const browserEntries = readBackNavigationEntriesFromHistoryState(
				window.history.state,
			);

			if (
				!areBackNavigationEntriesEqual(browserEntries, backNavigationEntries)
			) {
				window.history.replaceState(
					createBackNavigationHistoryState(
						window.history.state,
						backNavigationEntries,
					),
					document.title,
				);
			}

			return;
		}

		const sharedPrefixLength = getSharedBackNavigationPrefixLength(
			currentEntries,
			backNavigationEntries,
		);

		if (
			sharedPrefixLength === currentEntries.length &&
			backNavigationEntries.length > currentEntries.length
		) {
			for (
				let index = currentEntries.length + 1;
				index <= backNavigationEntries.length;
				index += 1
			) {
				window.history.pushState(
					createBackNavigationHistoryState(
						window.history.state,
						backNavigationEntries.slice(0, index),
					),
					document.title,
				);
			}

			currentBackNavigationEntriesRef.current = backNavigationEntries;
			return;
		}

		if (
			sharedPrefixLength === backNavigationEntries.length &&
			backNavigationEntries.length < currentEntries.length
		) {
			pendingBrowserHistoryTargetEntriesRef.current = backNavigationEntries;
			window.history.go(backNavigationEntries.length - currentEntries.length);
			return;
		}

		window.history.replaceState(
			createBackNavigationHistoryState(
				window.history.state,
				backNavigationEntries,
			),
			document.title,
		);
		currentBackNavigationEntriesRef.current = backNavigationEntries;
	}, [backNavigationEntries]);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const handlePopState = (event: PopStateEvent) => {
			const targetEntries = readBackNavigationEntriesFromHistoryState(
				event.state,
			);

			if (
				pendingBrowserHistoryTargetEntriesRef.current &&
				areBackNavigationEntriesEqual(
					pendingBrowserHistoryTargetEntriesRef.current,
					targetEntries,
				)
			) {
				pendingBrowserHistoryTargetEntriesRef.current = null;
				currentBackNavigationEntriesRef.current = targetEntries;
				return;
			}

			pendingPopstateTargetEntriesRef.current = targetEntries;

			if (sceneTransitionLoadState.phase !== "idle") {
				return;
			}

			void applyBackNavigationTarget(targetEntries);
		};

		window.addEventListener("popstate", handlePopState);

		return () => {
			window.removeEventListener("popstate", handlePopState);
		};
	}, [applyBackNavigationTarget, sceneTransitionLoadState.phase]);

	useEffect(() => {
		if (sceneTransitionLoadState.phase !== "idle") {
			return;
		}

		const targetEntries = pendingPopstateTargetEntriesRef.current;

		if (!targetEntries) {
			return;
		}

		void applyBackNavigationTarget(targetEntries);
	}, [applyBackNavigationTarget, sceneTransitionLoadState.phase]);

	const handleVibrationSettingChange = useCallback((enabled: boolean) => {
		setGameSettings(updateGameSettings({ vibrationEnabled: enabled }));
	}, []);

	const handleSfxSettingChange = useCallback((enabled: boolean) => {
		setGameSettings(updateGameSettings({ sfxEnabled: enabled }));
	}, []);

	useEffect(() => {
		setGameSettings(getGameSettings());
		gameInstance?.setLocale(locale);
	}, [gameInstance, locale]);

	useEffect(() => {
		setDiagnosticsContextProvider(() => ({
			scene:
				gameInstance?.getCurrentSceneKey() !== undefined
					? String(gameInstance.getCurrentSceneKey())
					: undefined,
			storageKind: getClientStorageKind(),
			appMode: import.meta.env.MODE,
			appVersion: __APP_VERSION__,
			buildNumber: __APP_BUILD_NUMBER__,
			debugEnabled: isNativeFeatureDebugMode,
		}));

		return () => {
			setDiagnosticsContextProvider(null);
		};
	}, [gameInstance]);

	const handleSceneTransitionStateChange = useCallback(
		(params: {
			requestId: number;
			from?: SceneKey;
			to: SceneKey;
			state: "loading" | "core_ready" | "failed" | "interrupted";
		}) => {
			if (params.state === "loading") {
				sceneTransitionRequestIdRef.current = params.requestId;
				armLoadingTimeout(
					{
						phase: "scene_transition",
						initializationAttemptId:
							pendingGameInitializationRef.current?.attemptId,
						requestId: params.requestId,
						from: params.from ?? null,
						to: params.to,
					},
					{ resetStart: false },
				);
				setSceneTransitionLoadState({
					requestId: params.requestId,
					phase: "loading",
					from: params.from,
					to: params.to,
				});
				setFlappyBirdSettingsMenuState(null);
				setFlappyBirdGameOverState(null);
				setButtonParams(null);
				return;
			}

			if (sceneTransitionRequestIdRef.current !== params.requestId) {
				return;
			}

			if (params.state === "failed") {
				stopLoadingWithFailure({
					message:
						"A scene failed to load. Tap Okay to dismiss this popup or Send Log to share diagnostics.",
					context: {
						phase: "scene_transition",
						requestId: params.requestId,
						from: params.from ?? null,
						to: params.to,
					},
				});
				return;
			}

			if (params.state === "interrupted") {
				clearLoadingTimeout();
				sceneTransitionRequestIdRef.current = 0;
				setSceneTransitionLoadState({ requestId: 0, phase: "idle" });
				setIsBootstrapping(false);
				return;
			}

			setSceneTransitionLoadState((previous) =>
				previous.requestId === params.requestId
					? { ...previous, phase: "core_ready" }
					: previous,
			);
			clearLoadingTimeout();
			setSceneHistoryStack((previous) => {
				if (params.to === SceneKey.FLAPPY_BIRD_GAME) {
					return previous;
				}

				if (previous[previous.length - 1] === params.to) {
					return previous;
				}

				const existingSceneIndex = previous.lastIndexOf(params.to);

				if (existingSceneIndex >= 0) {
					return previous.slice(0, existingSceneIndex + 1);
				}

				return [...previous, params.to];
			});
		},
		[armLoadingTimeout, clearLoadingTimeout, stopLoadingWithFailure],
	);

	const completeSceneTransitionLoading = useCallback(
		(requestId: number) => {
			if (sceneTransitionRequestIdRef.current !== requestId) {
				return;
			}

			clearLoadingTimeout();
			sceneTransitionRequestIdRef.current = 0;
			setSceneTransitionLoadState({ requestId: 0, phase: "idle" });
			setIsBootstrapping(false);
		},
		[clearLoadingTimeout],
	);

	const handleMainSceneReentrySimulationStateChange =
		useCallback<MainSceneReentrySimulationStateChangeCallback>(
			(params) => {
				if (params.source !== "app_resume" && params.source !== "init") {
					return;
				}

				if (params.phase === "started") {
					if (homeWidgetLaunchModeRef.current === "widget_refresh") {
						lastNativeWorldDataUpdateForReentryRef.current = null;
					}
					if (params.source === "app_resume") {
						isResumeReentrySimulationRunningRef.current = true;
						showResumeGuard("main_scene_reentry");
					}
					return;
				}

				if (params.source === "app_resume") {
					isResumeReentrySimulationRunningRef.current = false;
					hideResumeGuardAfterLayout(
						params.result === "failed"
							? "main_scene_reentry_failed"
							: "main_scene_reentry_finished",
					);
				}

				if (homeWidgetLaunchModeRef.current === "widget_refresh") {
					void completeWidgetRefreshAfterInitReentryRef.current?.(
						params.result,
					);
					return;
				}
			},
			[hideResumeGuardAfterLayout, showResumeGuard],
		);

	const handleNativeWorldDataUpdateForReentry =
		useCallback<NativeWorldDataUpdateForReentryCallback>(
			async (source, options) => {
				if (typeof window === "undefined") {
					throw new Error("native_world_data_update_unavailable");
				}

				const controller = window.worldDataUpdateController;

				if (typeof controller?.completeNativeWorldDataUpdate !== "function") {
					throw new Error("native_world_data_update_unavailable");
				}

				const nowMs =
					typeof options?.nowMs === "number" && Number.isFinite(options.nowMs)
						? Math.floor(options.nowMs)
						: undefined;
				const result = await controller.completeNativeWorldDataUpdate({
					source,
					...(nowMs !== undefined ? { nowMs } : {}),
				});
				const enrichedResult: HomeWidgetNativeWorldDataUpdateResult = {
					...result,
					hasAnyWidgets: homeWidgetPresenceRef.current.hasAnyWidgets,
					homeWidget1x1Count:
						homeWidgetPresenceRef.current.homeWidget1x1Count,
					homeWidget2x1Count:
						homeWidgetPresenceRef.current.homeWidget2x1Count,
				};
				lastNativeWorldDataUpdateForReentryRef.current = {
					source,
					result: enrichedResult,
				};

				logImportantDiagnostics(
					"log",
					"[ImportantDiagnostics][WorldDataSyncPayload]",
					{
						action: "native_world_data_update_for_reentry",
						source,
						status: enrichedResult?.status ?? null,
						worldDataChanged: enrichedResult?.worldDataChanged ?? null,
						hatched: enrichedResult?.hatched ?? null,
						evolutionGageBefore: enrichedResult?.evolutionGageBefore ?? null,
						evolutionGageAfter: enrichedResult?.evolutionGageAfter ?? null,
						evolutionGageIncreased:
							enrichedResult?.evolutionGageIncreased ?? null,
						evolved: enrichedResult?.evolved ?? null,
						previousCharacterKey: enrichedResult?.previousCharacterKey ?? null,
						nextCharacterKey: enrichedResult?.nextCharacterKey ?? null,
						previousEvolutionPhase:
							enrichedResult?.previousEvolutionPhase ?? null,
						nextEvolutionPhase: enrichedResult?.nextEvolutionPhase ?? null,
						candidateKind: enrichedResult?.candidateKind ?? null,
						mutationApplied: enrichedResult?.mutationApplied ?? null,
						mutationRate: enrichedResult?.mutationRate ?? null,
						mutationRoll: enrichedResult?.mutationRoll ?? null,
						mutationTargetRoll: enrichedResult?.mutationTargetRoll ?? null,
						evolutionRoll: enrichedResult?.evolutionRoll ?? null,
						evolutionBlockReason: enrichedResult?.evolutionBlockReason ?? null,
						previousCharacterState:
							enrichedResult?.previousCharacterState ?? null,
						nextCharacterState: enrichedResult?.nextCharacterState ?? null,
						selectedCharacterKey: enrichedResult?.selectedCharacterKey ?? null,
						hatchSelectionDiagnostics:
							enrichedResult?.hatchSelectionDiagnostics ?? null,
						hasAnyWidgets: enrichedResult.hasAnyWidgets ?? null,
						homeWidget1x1Count: enrichedResult.homeWidget1x1Count ?? null,
						homeWidget2x1Count: enrichedResult.homeWidget2x1Count ?? null,
					},
				);

				return enrichedResult;
			},
			[],
		);

	const loadHomeWidgetLaunchContext = useCallback(async () => {
		if (typeof window === "undefined") {
			return;
		}

		const controller =
			window.homeWidgetController ?? window.homeWidgetRefreshController;

		if (typeof controller?.getLaunchContext !== "function") {
			homeWidgetLaunchModeRef.current = "default";
			homeWidgetPresenceRef.current = {
				hasAnyWidgets: false,
				homeWidget1x1Count: null,
				homeWidget2x1Count: null,
			};
			return;
		}

		try {
			const context = await controller.getLaunchContext();
			const mode: HomeWidgetLaunchMode =
				context?.mode === "widget_refresh" ? "widget_refresh" : "default";
			const hasAnyWidgets = context?.hasAnyWidgets === true;
			const homeWidget1x1Count = readNullableNumber(
				context?.homeWidget1x1Count,
			);
			const homeWidget2x1Count = readNullableNumber(
				context?.homeWidget2x1Count,
			);

			homeWidgetLaunchModeRef.current = mode;
			homeWidgetPresenceRef.current = {
				hasAnyWidgets,
				homeWidget1x1Count,
				homeWidget2x1Count,
			};
			logImportantDiagnostics(
				"log",
				"[ImportantDiagnostics][WorldDataSyncPayload]",
				{
					action: "launch_context_loaded",
					launchMode: mode,
					hasAnyWidgets,
					homeWidget1x1Count,
					homeWidget2x1Count,
				},
			);
		} catch (error) {
			homeWidgetLaunchModeRef.current = "default";
			homeWidgetPresenceRef.current = {
				hasAnyWidgets: false,
				homeWidget1x1Count: null,
				homeWidget2x1Count: null,
			};
			logImportantDiagnostics(
				"warn",
				"[ImportantDiagnostics][WorldDataSyncPayload]",
				{
					action: "launch_context_failed",
					error:
						error instanceof Error
							? {
									name: error.name,
									message: error.message,
								}
							: String(error),
				},
			);
		}
	}, []);

	const updateGameContainerSize = useCallback((force = false) => {
		const viewportElement = gameViewportRef.current;

		if (!viewportElement) {
			return;
		}

		if (!force && isFullscreenAdLayoutFrozenRef.current) {
			return;
		}

		const controlButtonsHeight =
			controlButtonsWrapperRef.current?.getBoundingClientRect().height ?? 0;
		const availableHeight = Math.max(
			0,
			viewportElement.clientHeight - controlButtonsHeight,
		);
		const nextSize = Math.max(
			0,
			Math.floor(Math.min(viewportElement.clientWidth, availableHeight)),
		);

		setGameContainerSize((previous) =>
			previous === nextSize ? previous : nextSize,
		);
	}, []);

	const clearFullscreenAdLayoutRelease = useCallback(() => {
		if (fullscreenAdLayoutReleaseTimeoutRef.current !== null) {
			window.clearTimeout(fullscreenAdLayoutReleaseTimeoutRef.current);
			fullscreenAdLayoutReleaseTimeoutRef.current = null;
		}

		if (fullscreenAdLayoutReleaseRafRef.current !== null) {
			window.cancelAnimationFrame(fullscreenAdLayoutReleaseRafRef.current);
			fullscreenAdLayoutReleaseRafRef.current = null;
		}
	}, []);

	const clearPendingUnsupportedViewportOverlayShow = useCallback(() => {
		if (unsupportedViewportOverlayShowTimeoutRef.current !== null) {
			window.clearTimeout(unsupportedViewportOverlayShowTimeoutRef.current);
			unsupportedViewportOverlayShowTimeoutRef.current = null;
		}
	}, []);

	const updateUnsupportedViewportOverlay = useCallback(() => {
		const nextReason = getUnsupportedViewportReason({
			nativeKeyboardInset: nativeKeyboardInsetRef.current,
		});

		clearPendingUnsupportedViewportOverlayShow();

		if (nextReason === null) {
			setUnsupportedViewportReason(null);
			return;
		}

		unsupportedViewportOverlayShowTimeoutRef.current = window.setTimeout(() => {
			unsupportedViewportOverlayShowTimeoutRef.current = null;
			setUnsupportedViewportReason(
				getUnsupportedViewportReason({
					nativeKeyboardInset: nativeKeyboardInsetRef.current,
				}),
			);
		}, UNSUPPORTED_VIEWPORT_OVERLAY_SHOW_DEBOUNCE_MS);
	}, [clearPendingUnsupportedViewportOverlayShow]);

	const freezeLayoutForFullscreenAd = useCallback(() => {
		clearFullscreenAdLayoutRelease();
		isFullscreenAdLayoutFrozenRef.current = true;
		setFrozenAppShellHeight(getCurrentViewportHeight());
	}, [clearFullscreenAdLayoutRelease]);

	const releaseLayoutAfterFullscreenAd = useCallback(() => {
		clearFullscreenAdLayoutRelease();

		fullscreenAdLayoutReleaseTimeoutRef.current = window.setTimeout(() => {
			fullscreenAdLayoutReleaseRafRef.current = window.requestAnimationFrame(
				() => {
					fullscreenAdLayoutReleaseRafRef.current =
						window.requestAnimationFrame(() => {
							isFullscreenAdLayoutFrozenRef.current = false;
							setFrozenAppShellHeight(null);
							updateGameContainerSize(true);
						});
				},
			);
		}, 260);
	}, [clearFullscreenAdLayoutRelease, updateGameContainerSize]);

	const stopRecoveryVibration = useCallback(() => undefined, []);

	const triggerTransientVibration = useCallback(
		(params: { durationMs: number; strength: number }) => {
			void biteVibrationAdapter.vibrate(params.durationMs, params.strength);
		},
		[],
	);

	const triggerMainSceneSfx = useCallback((kind: MainSceneSfxKind) => {
		switch (kind) {
			case "food-throw":
				playFoodThrowSound();
				return;
			case "syringe-insert":
				playSyringeInsertSound();
				return;
		}
	}, []);

	const getFlappyBirdBestScore = useCallback(async (): Promise<number> => {
		try {
			const storage = createClientStorage();
			const storedData = await storage.getData(WORLD_DATA_STORAGE_KEY);
			return getStoredFlappyBirdBestScore(storedData);
		} catch (error) {
			console.warn(
				"[GameContainer] Failed to read FlappyBird best score from storage",
				error,
			);
			return 0;
		}
	}, []);

	const persistFlappyBirdBestScore = useCallback(async (score: number) => {
		const nextBestScore = Math.max(0, Math.floor(score));

		try {
			const storage = createClientStorage();
			const storedData = await storage.getData(WORLD_DATA_STORAGE_KEY);
			const sanitizedResult = sanitizeStoredWorldData(storedData);

			if (
				sanitizedResult.action === "reset_required" ||
				!sanitizedResult.sanitizedData
			) {
				return;
			}

			const currentBestScore = getStoredFlappyBirdBestScore(
				sanitizedResult.sanitizedData,
			);

			if (nextBestScore <= currentBestScore) {
				return;
			}

			await storage.setData(
				WORLD_DATA_STORAGE_KEY,
				withStoredFlappyBirdBestScore(
					sanitizedResult.sanitizedData,
					nextBestScore,
				),
			);
		} catch (error) {
			console.warn(
				"[GameContainer] Failed to persist FlappyBird best score",
				error,
			);
		}
	}, []);

	const incrementFlappyBirdGameOverAdCount = useCallback(async () => {
		try {
			const storage = createClientStorage();
			const storedData = await storage.getData(
				FLAPPY_BIRD_GAME_OVER_AD_COUNTER_STORAGE_KEY,
			);
			const nextCount = getStoredFlappyBirdGameOverAdCount(storedData) + 1;

			await storage.setData(
				FLAPPY_BIRD_GAME_OVER_AD_COUNTER_STORAGE_KEY,
				nextCount,
			);

			return nextCount;
		} catch (error) {
			console.warn(
				"[GameContainer] Failed to persist FlappyBird game-over ad count",
				error,
			);
			return null;
		}
	}, []);

	const scheduleFlappyBirdGameOverAd = useCallback(async () => {
		const nextCount = await incrementFlappyBirdGameOverAdCount();

		if (
			nextCount === null ||
			nextCount % FLAPPY_BIRD_GAME_OVER_AD_THRESHOLD !== 0
		) {
			return;
		}

		clearPendingFlappyBirdGameOverAd();
		flappyBirdGameOverAdTimeoutRef.current = window.setTimeout(() => {
			flappyBirdGameOverAdTimeoutRef.current = null;

			void (
				window.adManager?.requestAd("flappy_bird_game_over", {
					isCharacterUrgent: false,
					metadata: {
						trigger: "flappy_bird_game_over",
						gameOverCount: nextCount,
						threshold: FLAPPY_BIRD_GAME_OVER_AD_THRESHOLD,
						timestamp: Date.now(),
						cooldownMs: FLAPPY_BIRD_GAME_OVER_AD_COOLDOWN_MS,
					},
				}) ?? Promise.resolve(false)
			);
		}, FLAPPY_BIRD_GAME_OVER_AD_DELAY_MS);
	}, [clearPendingFlappyBirdGameOverAd, incrementFlappyBirdGameOverAdCount]);

	const handleFlappyBirdGameOverRestart = useCallback(() => {
		if (!flappyBirdGameOverState) {
			return;
		}

		setFlappyBirdGameOverState(null);
		flappyBirdGameOverState.onRestart();
	}, [flappyBirdGameOverState]);

	const handleFlappyBirdGameOverExit = useCallback(() => {
		if (!flappyBirdGameOverState) {
			return;
		}

		const { onExit } = flappyBirdGameOverState;
		setFlappyBirdGameOverState(null);
		void Promise.resolve(onExit());
	}, [flappyBirdGameOverState]);

	useEffect(() => {
		return () => {
			clearPendingFlappyBirdGameOverAd();
		};
	}, [clearPendingFlappyBirdGameOverAd]);

	const handleFlappyBirdSettingsMenuResume = useCallback(() => {
		if (!flappyBirdSettingsMenuState) {
			return;
		}

		const { onResume } = flappyBirdSettingsMenuState;
		setFlappyBirdSettingsMenuState(null);
		void Promise.resolve(onResume());
	}, [flappyBirdSettingsMenuState]);

	const handleFlappyBirdSettingsMenuChangeBgm = useCallback(
		(enabled: boolean) => {
			if (!flappyBirdSettingsMenuState) {
				return;
			}

			void Promise.resolve(flappyBirdSettingsMenuState.onChangeBgm(enabled));
		},
		[flappyBirdSettingsMenuState],
	);

	const handleFlappyBirdSettingsMenuChangeSfx = useCallback(
		(enabled: boolean) => {
			if (!flappyBirdSettingsMenuState) {
				return;
			}

			setControlButtonSoundEnabled(enabled);
			void Promise.resolve(flappyBirdSettingsMenuState.onChangeSfx(enabled));
		},
		[flappyBirdSettingsMenuState],
	);

	const handleFlappyBirdSettingsMenuSelectTimeOfDay = useCallback(
		(timeOfDay: TimeOfDay) => {
			if (!flappyBirdSettingsMenuState?.onSelectTimeOfDay) {
				return;
			}

			void Promise.resolve(
				flappyBirdSettingsMenuState.onSelectTimeOfDay(timeOfDay),
			);
		},
		[flappyBirdSettingsMenuState],
	);

	const handleFlappyBirdSettingsMenuExit = useCallback(() => {
		if (!flappyBirdSettingsMenuState) {
			return;
		}

		const { onExit } = flappyBirdSettingsMenuState;
		setFlappyBirdSettingsMenuState(null);
		void Promise.resolve(onExit());
	}, [flappyBirdSettingsMenuState]);

	const startRecoveryVibration = useCallback(() => {
		void biteVibrationAdapter.vibrate(
			RECOVERY_INSERT_VIBRATION_DURATION_MS,
			RECOVERY_INSERT_VIBRATION_STRENGTH,
		);
	}, []);

	useEffect(() => {
		if (sceneTransitionLoadState.phase !== "core_ready" || !gameInstance) {
			return;
		}

		const requestId = sceneTransitionLoadState.requestId;
		let cancelled = false;

		const finalizeSceneTransitionLoading = async () => {
			await waitForLayoutStabilization();

			if (cancelled) {
				return;
			}

			completeSceneTransitionLoading(requestId);
		};

		void finalizeSceneTransitionLoading();

		return () => {
			cancelled = true;
		};
	}, [completeSceneTransitionLoading, gameInstance, sceneTransitionLoadState]);

	useEffect(() => {
		if (typeof document === "undefined") {
			return;
		}

		const handleVisibilityChange = () => {
			if (!document.hidden) {
				return;
			}

			interruptLoadingFlow("app_hidden");
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [interruptLoadingFlow]);

	const prepareDiagnosticsDraft = useCallback(
		async (scope: "full" | "flappy_bird"): Promise<PendingDiagnosticsDraft> => {
			const storage = createClientStorage();
			const storedGameData = await storage.getData(WORLD_DATA_STORAGE_KEY);
			const snapshot = gameInstance?.getDiagnosticsSnapshot();
			const currentGameData = snapshot?.mainSceneData ?? null;
			const controller =
				window.homeWidgetController ?? window.homeWidgetRefreshController;
			const homeWidgetRefreshDiagnostics =
				typeof controller?.getRefreshDiagnostics === "function"
					? await controller.getRefreshDiagnostics().catch(() => null)
					: null;
			const nativeBridgeDiagnosticsBase = Array.isArray(
				window.__digiviceNativeBridgeDiagnostics,
			)
				? window.__digiviceNativeBridgeDiagnostics
				: [];
			const nativeBridgeDiagnostics = (
				homeWidgetRefreshDiagnostics &&
				typeof homeWidgetRefreshDiagnostics === "object" &&
				!Array.isArray(homeWidgetRefreshDiagnostics)
					? [
							...nativeBridgeDiagnosticsBase,
							{
								tag: "HomeWidgetRefreshDiagnostics",
								timestamp: new Date().toISOString(),
								...homeWidgetRefreshDiagnostics,
							},
						]
					: nativeBridgeDiagnosticsBase
			) as Array<Record<string, unknown>>;
			const latestGameData = currentGameData ?? storedGameData ?? null;
			const latestGameDataSource = currentGameData
				? "current_game"
				: storedGameData
					? "stored_game"
					: "none";
			const currentSceneKey = String(snapshot?.currentSceneKey ?? "unknown");
			const payload: DiagnosticsPayload = {
				generatedAt: new Date().toISOString(),
				appInfo: {
					project: "MonTTo",
					clientAppVersion: __APP_VERSION__,
					clientBuildNumber: __APP_BUILD_NUMBER__,
					appMode: import.meta.env.MODE,
					debugEnabled: isNativeFeatureDebugMode,
					storageKind: getClientStorageKind(),
					userAgent: navigator.userAgent,
					language: navigator.language,
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
					currentSceneKey,
					logger: getDiagnosticsLoggerInfo(),
					gameSettings,
				},
				summary: summarizeGameData(currentGameData ?? storedGameData),
				logs: getDiagnosticsLogs(),
				importantLogs: getImportantDiagnosticsLogs(),
				currentGameData,
				storedGameData,
				homeWidgetRefreshDiagnostics:
					homeWidgetRefreshDiagnostics &&
					typeof homeWidgetRefreshDiagnostics === "object" &&
					!Array.isArray(homeWidgetRefreshDiagnostics)
						? (homeWidgetRefreshDiagnostics as Record<string, unknown>)
						: null,
				nativeBridgeDiagnostics,
				latestGameData,
				latestGameDataSource,
				lastValidation: lastValidationResultRef.current?.diagnostics ?? null,
				lastValidationAction: lastValidationResultRef.current?.action ?? null,
				lastValidationResetReason:
					lastValidationResultRef.current?.resetReason ?? null,
			};

			const releaseFileLabel = getClientReleaseFileLabel();
			const timestampSuffix = buildDiagnosticsTimestampSuffix(
				payload.generatedAt,
			);

			if (scope === "flappy_bird") {
				return {
					subject: createFlappyBirdLogsSubject(payload.generatedAt),
					body: createFlappyBirdLogsBody(),
					attachments: [
						{
							fileName: `montto-native-bridge-diagnostics-${releaseFileLabel}-${timestampSuffix}.json`,
							text: JSON.stringify(payload.nativeBridgeDiagnostics, null, 2),
							mimeType: "application/json",
						},
					],
				};
			}

			const payloadText = JSON.stringify(payload, null, 2);

			return {
				subject: createDiagnosticsSubject(payload.generatedAt),
				body: createDiagnosticsBody(),
				attachments: [
					{
						fileName: `montto-diagnostics-${releaseFileLabel}-${timestampSuffix}.json`,
						text: payloadText,
						mimeType: "application/json",
					},
					{
						fileName: `montto-latest-game-data-${releaseFileLabel}-${timestampSuffix}.json`,
						text: JSON.stringify(latestGameData, null, 2),
						mimeType: "application/json",
					},
					{
						fileName: `montto-important-logs-${releaseFileLabel}-${timestampSuffix}.json`,
						text: JSON.stringify(payload.importantLogs, null, 2),
						mimeType: "application/json",
					},
					{
						fileName: `montto-native-bridge-diagnostics-${releaseFileLabel}-${timestampSuffix}.json`,
						text: JSON.stringify(payload.nativeBridgeDiagnostics, null, 2),
						mimeType: "application/json",
					},
				],
			};
		},
		[gameInstance, gameSettings],
	);

	const syncHomeWidgetForNativeBackground = useCallback(
		async (reason: string): Promise<WorldDataBackgroundSyncResult> => {
			if (typeof window === "undefined") {
				return {
					status: "failed",
					reason,
					selectedSource: null,
					storedLastEcsSaved: null,
					inMemoryLastEcsSaved: null,
					error: "window_unavailable",
				};
			}

			const controller =
				window.homeWidgetController ?? window.homeWidgetRefreshController;
			const currentSceneKey = gameInstance?.getCurrentSceneKey() ?? null;

			if (typeof controller?.syncFromWorldDataJson !== "function") {
				logImportantDiagnostics(
					"log",
					"[ImportantDiagnostics][WorldDataSyncPayload]",
					{
						reason,
						action: "skipped_missing_controller",
						hasGameInstance: !!gameInstance,
						currentSceneKey,
					},
				);
				return {
					status: "skipped_missing_controller",
					reason,
					selectedSource: null,
					storedLastEcsSaved: null,
					inMemoryLastEcsSaved: null,
				};
			}

			try {
				const flushedWorldData = gameInstance
					? await gameInstance.flushWorldDataSyncPayload()
					: null;
				const inMemoryWorldData =
					flushedWorldData ?? gameInstance?.getWorldDataSyncPayload() ?? null;
				const inMemoryRawWorldData = inMemoryWorldData
					? JSON.stringify(inMemoryWorldData)
					: null;
				const syncFromFlutterSourceOfTruth =
					typeof controller.syncFromStorageOrWorldDataJson === "function"
						? controller.syncFromStorageOrWorldDataJson.bind(controller)
						: null;

				logImportantDiagnostics(
					"log",
					"[ImportantDiagnostics][WorldDataSyncPayload]",
					{
						reason,
						action: "flush_completed",
						hasGameInstance: !!gameInstance,
						currentSceneKey,
						hasFlushedWorldData: !!flushedWorldData,
						hasInMemoryWorldData: !!inMemoryRawWorldData,
						flushedLastEcsSaved:
							typeof flushedWorldData?.world_metadata?.last_ecs_saved ===
							"number"
								? flushedWorldData.world_metadata.last_ecs_saved
								: null,
						inMemoryLastEcsSaved:
							typeof inMemoryWorldData?.world_metadata?.last_ecs_saved ===
							"number"
								? inMemoryWorldData.world_metadata.last_ecs_saved
								: null,
					},
				);

				if (!syncFromFlutterSourceOfTruth && !inMemoryRawWorldData) {
					logImportantDiagnostics(
						"log",
						"[ImportantDiagnostics][WorldDataSyncPayload]",
						{
							reason,
							action: "skipped_no_world_data",
							hasGameInstance: !!gameInstance,
							currentSceneKey,
							sourceOfTruth: "in_memory_fallback",
						},
					);
					return {
						status: "skipped_no_world_data",
						reason,
						selectedSource: null,
						storedLastEcsSaved: null,
						inMemoryLastEcsSaved: null,
					};
				}

				const syncPromise = syncFromFlutterSourceOfTruth
					? syncFromFlutterSourceOfTruth({
							inMemoryRawWorldData,
							reason,
						})
					: controller.syncFromWorldDataJson({
							rawWorldData: inMemoryRawWorldData,
							reason,
						});

				logImportantDiagnostics(
					"log",
					"[ImportantDiagnostics][WorldDataSyncPayload]",
					{
						reason,
						action: "dispatched",
						sourceOfTruth: syncFromFlutterSourceOfTruth
							? "flutter_storage_selection"
							: "in_memory_fallback",
						hasGameInstance: !!gameInstance,
						currentSceneKey,
						hasInMemoryWorldData: !!inMemoryRawWorldData,
					},
				);

				const syncResult = await syncPromise;
				const selectedSource = readWorldDataSyncSource(
					syncResult.selectedSource,
				);
				const storedLastEcsSaved = readNullableNumber(
					syncResult.storedLastEcsSaved,
				);
				const inMemoryLastEcsSaved = readNullableNumber(
					syncResult.inMemoryLastEcsSaved,
				);

				logImportantDiagnostics(
					"log",
					"[ImportantDiagnostics][WorldDataSyncPayload]",
					{
						reason,
						action: "completed",
						sourceOfTruth: syncFromFlutterSourceOfTruth
							? "flutter_storage_selection"
							: "in_memory_fallback",
						selectedSource,
						hasGameInstance: !!gameInstance,
						currentSceneKey,
						storedLastEcsSaved,
						inMemoryLastEcsSaved,
						syncStatus: syncResult.status,
					},
				);

				if (syncResult.status === "cleared" && selectedSource === null) {
					return {
						status: "skipped_no_world_data",
						reason,
						selectedSource,
						storedLastEcsSaved,
						inMemoryLastEcsSaved,
						syncResult,
					};
				}

				return {
					status: "completed",
					reason,
					selectedSource:
						selectedSource ?? (inMemoryRawWorldData ? "in_memory" : null),
					storedLastEcsSaved,
					inMemoryLastEcsSaved,
					syncResult,
				};
			} catch (error) {
				logImportantDiagnostics(
					"warn",
					"[ImportantDiagnostics][WorldDataSyncPayload]",
					{
						reason,
						action: "failed",
						hasGameInstance: !!gameInstance,
						currentSceneKey,
						error:
							error instanceof Error
								? {
										name: error.name,
										message: error.message,
									}
								: String(error),
					},
				);

				return {
					status: "failed",
					reason,
					selectedSource: null,
					storedLastEcsSaved: null,
					inMemoryLastEcsSaved: null,
					error:
						error instanceof Error
							? `${error.name}: ${error.message}`
							: String(error),
				};
			}
		},
		[gameInstance],
	);
	const completeWidgetRefreshAfterReentry = useCallback(
		async (result: "completed" | "skipped" | "failed" | undefined) => {
			if (typeof window === "undefined") {
				return;
			}

			const controller =
				window.homeWidgetController ?? window.homeWidgetRefreshController;
			const worldDataUpdateController = window.worldDataUpdateController;
			const reason = "main_scene_reentry_finished_init_widget_refresh";
			let completionResult = result ?? "failed";

			logImportantDiagnostics(
				"log",
				"[ImportantDiagnostics][WorldDataSyncPayload]",
				{
					action: "widget_refresh_started",
					reason,
					reentryResult: result ?? null,
					launchMode: homeWidgetLaunchModeRef.current,
					hasAnyWidgets: homeWidgetPresenceRef.current.hasAnyWidgets,
					homeWidget1x1Count:
						homeWidgetPresenceRef.current.homeWidget1x1Count,
					homeWidget2x1Count:
						homeWidgetPresenceRef.current.homeWidget2x1Count,
					hasGameInstance: !!gameInstance,
					currentSceneKey: gameInstance?.getCurrentSceneKey() ?? null,
				},
			);

			try {
				if (
					result === "skipped" &&
					!lastNativeWorldDataUpdateForReentryRef.current
				) {
					if (
						typeof worldDataUpdateController?.completeNativeWorldDataUpdate ===
						"function"
					) {
						try {
							const fallbackResult =
								await worldDataUpdateController.completeNativeWorldDataUpdate({
									source: "init",
								});
							const enrichedFallbackResult: HomeWidgetNativeWorldDataUpdateResult =
								{
									...fallbackResult,
									hasAnyWidgets: homeWidgetPresenceRef.current.hasAnyWidgets,
									homeWidget1x1Count:
										homeWidgetPresenceRef.current.homeWidget1x1Count,
									homeWidget2x1Count:
										homeWidgetPresenceRef.current.homeWidget2x1Count,
								};
							lastNativeWorldDataUpdateForReentryRef.current = {
								source: "init",
								result: enrichedFallbackResult,
							};
							completionResult = isNativeWorldDataUpdateCompleted(
								enrichedFallbackResult,
							)
								? "completed"
								: "failed";
							logImportantDiagnostics(
								"log",
								"[ImportantDiagnostics][WorldDataSyncPayload]",
								{
									action: "native_world_data_update_for_reentry_fallback",
									reason,
									reentryResult: result ?? null,
									nativeUpdate: summarizeNativeWorldDataUpdate(
										lastNativeWorldDataUpdateForReentryRef.current,
									),
								},
							);
						} catch (error) {
							completionResult = "failed";
							logImportantDiagnostics(
								"warn",
								"[ImportantDiagnostics][WorldDataSyncPayload]",
								{
									action: "widget_refresh_failed",
									reason,
									failureStage: "native_world_data_update_fallback",
									reentryResult: result ?? null,
									error:
										error instanceof Error
											? {
													name: error.name,
													message: error.message,
												}
											: String(error),
								},
							);
						}
					} else {
						completionResult = "failed";
						logImportantDiagnostics(
							"warn",
							"[ImportantDiagnostics][WorldDataSyncPayload]",
							{
								action: "widget_refresh_failed",
								reason,
								failureStage:
									"native_world_data_update_fallback_missing_controller",
								reentryResult: result ?? null,
							},
						);
					}
				} else if (result !== "completed") {
					completionResult = "failed";
					logImportantDiagnostics(
						"warn",
						"[ImportantDiagnostics][WorldDataSyncPayload]",
						{
							action: "widget_refresh_failed",
							reason,
							failureStage: "reentry",
							reentryResult: result ?? null,
							nativeUpdate: summarizeNativeWorldDataUpdate(
								lastNativeWorldDataUpdateForReentryRef.current,
							),
						},
					);
				}
			} finally {
				const nativeUpdate = summarizeNativeWorldDataUpdate(
					lastNativeWorldDataUpdateForReentryRef.current,
				);
				try {
					if (typeof controller?.completeRefresh === "function") {
						await controller.completeRefresh({
							result: completionResult,
							source: "main_scene_reentry_finished_widget_refresh",
							launchMode: homeWidgetLaunchModeRef.current,
							reentryResult: result ?? null,
							nativeUpdateSource: nativeUpdate?.source ?? "main_scene_reentry",
							nativeUpdateStatus: nativeUpdate?.status ?? null,
							nativeWorldDataChanged: nativeUpdate?.worldDataChanged ?? null,
							evolutionGageBefore: nativeUpdate?.evolutionGageBefore ?? null,
							evolutionGageAfter: nativeUpdate?.evolutionGageAfter ?? null,
							evolutionGageIncreased:
								nativeUpdate?.evolutionGageIncreased ?? null,
							evolutionBlockReason: nativeUpdate?.evolutionBlockReason ?? null,
						});
						logImportantDiagnostics(
							"log",
							"[ImportantDiagnostics][WorldDataSyncPayload]",
							{
								action: "widget_refresh_completed",
								reason,
								completionResult,
								reentryResult: result ?? null,
								nativeUpdate,
							},
						);
					} else {
						logImportantDiagnostics(
							"warn",
							"[ImportantDiagnostics][WorldDataSyncPayload]",
							{
								action: "widget_refresh_failed",
								reason,
								failureStage: "complete_refresh_missing_controller",
								reentryResult: result ?? null,
								nativeUpdate,
							},
						);
					}
				} catch (error) {
					logImportantDiagnostics(
						"warn",
						"[ImportantDiagnostics][WorldDataSyncPayload]",
						{
							action: "widget_refresh_failed",
							reason,
							failureStage: "complete_refresh",
							reentryResult: result ?? null,
							nativeUpdate,
							error:
								error instanceof Error
									? {
											name: error.name,
											message: error.message,
										}
									: String(error),
						},
					);
				} finally {
					homeWidgetLaunchModeRef.current = "default";
					lastNativeWorldDataUpdateForReentryRef.current = null;
				}
			}
		},
		[gameInstance],
	);
	completeWidgetRefreshAfterInitReentryRef.current =
		completeWidgetRefreshAfterReentry;

	const handleSendDiagnostics = useCallback(async () => {
		if (isSendingDiagnostics || pendingDiagnosticsDraft) {
			return;
		}

		setIsSendingDiagnostics(true);

		try {
			setPendingDiagnosticsDraft(await prepareDiagnosticsDraft("full"));
		} catch (error) {
			logImportantDiagnostics(
				"error",
				"[ImportantDiagnostics][GameContainer] Failed to prepare diagnostics payload",
				error,
			);
			console.error(
				"[GameContainer] Failed to prepare diagnostics payload",
				error,
			);
			showAlert(t("diagnostics.prepareFailed"), t("common.error"));
		} finally {
			setIsSendingDiagnostics(false);
		}
	}, [
		isSendingDiagnostics,
		pendingDiagnosticsDraft,
		prepareDiagnosticsDraft,
		showAlert,
		t,
	]);

	const handleSendFlappyBirdLogs = useCallback(async () => {
		if (isSendingDiagnostics || pendingDiagnosticsDraft) {
			return;
		}

		setIsSendingDiagnostics(true);

		try {
			setPendingDiagnosticsDraft(await prepareDiagnosticsDraft("flappy_bird"));
		} catch (error) {
			logImportantDiagnostics(
				"error",
				"[ImportantDiagnostics][GameContainer] Failed to prepare flappybird log payload",
				error,
			);
			console.error(
				"[GameContainer] Failed to prepare flappybird log payload",
				error,
			);
			showAlert(t("diagnostics.flappyPrepareFailed"), t("common.error"));
		} finally {
			setIsSendingDiagnostics(false);
		}
	}, [
		isSendingDiagnostics,
		pendingDiagnosticsDraft,
		prepareDiagnosticsDraft,
		showAlert,
		t,
	]);

	const handleShowOfflineAdFallback = useCallback(() => {
		const fallbackBridge =
			typeof window !== "undefined"
				? window.digiviceAdFallbackBridge
				: undefined;

		if (!fallbackBridge?.showOfflineInterstitialFallback) {
			console.warn("[GameContainer] Offline ad fallback bridge is unavailable");
			return;
		}

		void fallbackBridge
			.showOfflineInterstitialFallback({
				trigger: "debug_settings",
				cooldownMs: 0,
				timestamp: Date.now(),
			})
			.catch((error) => {
				console.warn("[GameContainer] Failed to show offline ad fallback", {
					error,
				});
			});
	}, []);

	const handleCancelDiagnosticsDraft = useCallback(() => {
		dismissDiagnosticsDraft();
	}, [dismissDiagnosticsDraft]);

	const handleConfirmDiagnosticsDraft = useCallback(async () => {
		if (!pendingDiagnosticsDraft) {
			return;
		}

		let followUpAlert: {
			title: string;
			message: string;
		} | null = null;

		try {
			const openRoute = await openMailDraft(
				pendingDiagnosticsDraft.subject,
				pendingDiagnosticsDraft.body,
				pendingDiagnosticsDraft.attachments,
			);

			if (openRoute !== "gmail_app") {
				followUpAlert = {
					title: t("common.notice"),
					message: t("diagnostics.gmailNotice"),
				};
			}
		} catch (error) {
			console.error("[GameContainer] Failed to open diagnostics draft", error);
			followUpAlert = {
				title: t("common.error"),
				message: t("diagnostics.gmailOpenFailed"),
			};
		} finally {
			setPendingDiagnosticsDraft(null);

			if (followUpAlert) {
				const alertToShow = followUpAlert;

				window.setTimeout(() => {
					showAlert(alertToShow.message, alertToShow.title);
				}, 0);
			}
		}
	}, [pendingDiagnosticsDraft, showAlert, t]);

	const resetGameData = useCallback(
		async (reason: "user_reset" | "sanitize_reset") => {
			console.warn("[GameContainer] resetGameData:start", {
				reason,
				hasGameInstance: !!gameInstance,
				storageKind: getClientStorageKind(),
			});

			try {
				const storage = createClientStorage();

				if (gameInstance) {
					await gameInstance.destroyForReset();
				} else {
					await storage.removeData(WORLD_DATA_STORAGE_KEY);
				}
				const resetMarker = await writeResetBootstrapMarker(storage, reason);

				if (gameContainerRef.current) {
					gameContainerRef.current.innerHTML = "";
				}

				clearLoadingTimeout();
				cancelPendingGameInitialization("reset_game_data");
				initialSetupDataRef.current = null;
				pendingInitialSetupPromiseRef.current = null;
				pendingSetupResolverRef.current = null;
				shouldRestartFromSetupRef.current = true;
				isInitializedRef.current = false;
				setSceneHistoryStack([...ROOT_SCENE_HISTORY_STACK]);
				setLoadingFailureAlert(null);
				setMonsterInfoState(null);
				setShowSettingMenu(false);
				setShowFinalResetConfirm(false);
				setButtonParams(null);
				presentSetupLayer(reason, {
					storageKind: getClientStorageKind(),
				});
				setIsBootstrapping(false);
				sceneTransitionRequestIdRef.current = 0;
				setSceneTransitionLoadState({ requestId: 0, phase: "idle" });
				setGameInstance(null);
				setSanitizeResetAlert(null);
				setFlappyBirdSettingsMenuState(null);
				setFlappyBirdGameOverState(null);
				console.warn("[GameContainer] resetGameData:success", {
					reason,
					storageKind: getClientStorageKind(),
					resetBootstrapMarkerId: resetMarker.resetId,
				});
			} catch (error) {
				console.error("[GameContainer] Failed to reset game data:", error);
				showAlert(t("diagnostics.resetFailed"), t("common.error"));
			}
		},
		[
			cancelPendingGameInitialization,
			clearLoadingTimeout,
			gameInstance,
			presentSetupLayer,
			showAlert,
			t,
		],
	);

	const handleResetGameData = useCallback(async () => {
		await resetGameData("user_reset");
	}, [resetGameData]);

	const handleSanitizeResetConfirm = useCallback(async () => {
		await resetGameData("sanitize_reset");
	}, [resetGameData]);

	const prepareSavedGameData =
		useCallback(async (): Promise<BootstrapSavedGameDataState> => {
			const startedAt = entryFlowDiagnostics.beginPrepareSavedGameData(
				getClientStorageKind(),
			);

			try {
				const storage = createClientStorage();
				const storageKind = getClientStorageKind();
				const savedData = await storage.getData(WORLD_DATA_STORAGE_KEY);
				const legacyMonsterBookDetected = hasLegacyMonsterBookState(savedData);
				const monsterBookMigrationResult =
					await migrateLegacyMonsterBookIfNeeded(storage, savedData);
				const savedDataSummary = summarizeSavedData(savedData);
				const resetBootstrapMarker = await readResetBootstrapMarker(storage);

				logImportantDiagnostics(
					"log",
					"[ImportantDiagnostics][GameDataBootstrap]",
					{
						key: WORLD_DATA_STORAGE_KEY,
						storageKind,
						activeStorageSummary: savedDataSummary,
						browserLocalStorageSummary: summarizeBrowserLocalStorageEntry(
							WORLD_DATA_STORAGE_KEY,
						),
					},
				);

				if (
					shouldForceFreshWorldAfterReset(
						resetBootstrapMarker,
						savedData as StoredWorldData | null,
					)
				) {
					await storage.removeData(WORLD_DATA_STORAGE_KEY);
					lastValidationResultRef.current = null;
					logImportantDiagnostics(
						"warn",
						"[ImportantDiagnostics][ResetBootstrapGuard]",
						{
							key: WORLD_DATA_STORAGE_KEY,
							storageKind,
							action: "stale_world_removed",
							resetBootstrapMarkerId: resetBootstrapMarker?.resetId ?? null,
							savedDataSummary,
						},
					);
					entryFlowDiagnostics.completePrepareSavedGameData({
						startedAt,
						storageKind,
						resultAction: "setup_required",
						savedDataSummary,
					});
					return "setup_required";
				}

				const result = sanitizeStoredWorldData(savedData);
				lastValidationResultRef.current = result;

				if (monsterBookMigrationResult.didMigrate) {
					logImportantDiagnostics(
						"warn",
						"[ImportantDiagnostics][MonsterBookMigration] Legacy monster book data was migrated to dedicated storage.",
						{
							key: WORLD_DATA_STORAGE_KEY,
							monsterBookStorageKey: "MonsterBookData",
							savedDataSummary,
						},
					);
				}

				if (result.changed || result.action !== "playable") {
					logImportantDiagnostics(
						result.action === "reset_required" ? "error" : "warn",
						"[ImportantDiagnostics][GameDataValidation]",
						{
							key: WORLD_DATA_STORAGE_KEY,
							storageKind,
							action: result.action,
							changed: result.changed,
							resetReason: result.resetReason ?? null,
							diagnostics: result.diagnostics,
							savedDataSummary,
						},
					);
				}

				if (
					(result.changed || legacyMonsterBookDetected) &&
					result.sanitizedData &&
					result.action !== "reset_required"
				) {
					await storage.setData(WORLD_DATA_STORAGE_KEY, result.sanitizedData);
					logImportantDiagnostics(
						"warn",
						"[ImportantDiagnostics][GameDataRepair] Saved data was repaired and written back.",
						{
							action: result.action,
							diagnostics: result.diagnostics,
						},
					);
				}

				if (result.action === "reset_required") {
					logImportantDiagnostics(
						"error",
						"[ImportantDiagnostics][GameDataRepair] Saved data is corrupted and requires reset.",
						{
							resetReason: result.resetReason ?? null,
							diagnostics: result.diagnostics,
						},
					);
					setSanitizeResetAlert({
						title: t("dataRecovery.title"),
						message: result.resetReason ?? t("dataRecovery.corruptedReset"),
					});
					setIsBootstrapping(false);
				}

				entryFlowDiagnostics.completePrepareSavedGameData({
					startedAt,
					storageKind,
					resultAction: result.action,
					savedDataSummary,
				});

				return result.action;
			} catch (error) {
				entryFlowDiagnostics.failPrepareSavedGameData({
					startedAt,
					storageKind: getClientStorageKind(),
					error,
				});
				logImportantDiagnostics(
					"error",
					"[ImportantDiagnostics][GameDataValidation] Failed to inspect saved game data.",
					{
						key: WORLD_DATA_STORAGE_KEY,
						storageKind: getClientStorageKind(),
						error,
					},
				);
				console.error("[GameContainer] Failed to inspect saved game data:", {
					key: WORLD_DATA_STORAGE_KEY,
					storageKind: getClientStorageKind(),
					error,
				});
				setSanitizeResetAlert({
					title: t("dataRecovery.title"),
					message: t("dataRecovery.readFailedReset"),
				});
				setIsBootstrapping(false);
				return "reset_required";
			}
		}, [entryFlowDiagnostics, t]);

	const hydrateInitialSetupData = useCallback(
		async (formData: SetupFormData): Promise<SetupFormData> => {
			const startedAt =
				entryFlowDiagnostics.beginHydrateInitialSetupData(formData);
			const resetBootstrapMarker = await readResetBootstrapMarker(
				createClientStorage(),
			).catch(() => null);
			const attachResetBootstrapMarker = (
				data: SetupFormData,
			): SetupFormData =>
				resetBootstrapMarker
					? {
							...data,
							resetBootstrapMarkerId: resetBootstrapMarker.resetId,
						}
					: data;

			if (!formData.useLocalTime || formData.cachedSunTimes) {
				entryFlowDiagnostics.skipHydrateInitialSetupData({
					startedAt,
					formData,
					reason: !formData.useLocalTime
						? "local_time_disabled"
						: "cached_sun_times_already_present",
				});
				return attachResetBootstrapMarker(formData);
			}

			const promptForPermission = false;
			const nativeSunTimesStartedAt =
				entryFlowDiagnostics.beginNativeSunTimesRequest(promptForPermission);

			try {
				const sunTimes = await getNativeSunTimes(promptForPermission, {
					...entryFlowDiagnostics.createNativeSunTimesTraceContext({
						source: "setup_loading",
						phase: "hydrate_initial_setup_data",
					}),
				});
				entryFlowDiagnostics.completeNativeSunTimesRequest(
					nativeSunTimesStartedAt,
					sunTimes,
					promptForPermission,
				);

				if (!sunTimes) {
					console.warn(
						"[GameContainer] Initial sun times were unavailable during setup loading. Continuing without cached sun times.",
					);
					entryFlowDiagnostics.completeHydrateInitialSetupData({
						startedAt,
						sunTimes: null,
					});
					return attachResetBootstrapMarker({
						...formData,
						cachedSunTimes: null,
					});
				}

				console.log(
					"[GameContainer] Initial sun times prepared during setup loading.",
					{
						date: sunTimes.date,
						locationSource: sunTimes.locationSource,
						hasLocationPermission: sunTimes.hasLocationPermission,
						sunriseAt: sunTimes.sunriseAt,
						sunsetAt: sunTimes.sunsetAt,
					},
				);

				entryFlowDiagnostics.completeHydrateInitialSetupData({
					startedAt,
					sunTimes,
				});

				return attachResetBootstrapMarker({
					...formData,
					cachedSunTimes: sunTimes,
				});
			} catch (error) {
				entryFlowDiagnostics.failNativeSunTimesRequest(
					nativeSunTimesStartedAt,
					error,
					promptForPermission,
				);
				console.warn(
					"[GameContainer] Failed to prepare initial sun times during setup loading. Continuing without cached sun times.",
					error,
				);
				entryFlowDiagnostics.failHydrateInitialSetupData(startedAt, error);
				return attachResetBootstrapMarker({
					...formData,
					cachedSunTimes: null,
				});
			}
		},
		[entryFlowDiagnostics],
	);

	const requestInitialGameData = useCallback(
		async (options: RequestInitialGameDataOptions): Promise<SetupFormData> => {
			const { allowSetupLayer, source } = options;

			if (initialSetupDataRef.current) {
				return initialSetupDataRef.current;
			}

			if (pendingInitialSetupPromiseRef.current) {
				return pendingInitialSetupPromiseRef.current;
			}

			if (!allowSetupLayer) {
				logSetupLayerVisibility(
					"runtime_missing_initial_data_blocked",
					{
						source,
					},
					"error",
				);
				throw new MissingInitialGameDataError();
			}

			setLoadingFailureAlert(null);
			setIsBootstrapping(false);
			presentSetupLayer("bootstrap_setup_required", {
				source,
			});
			entryFlowDiagnostics.markWaitingForSetupInput();

			const setupPromise = new Promise<SetupFormData>((resolve) => {
				pendingSetupResolverRef.current = (formData: SetupFormData) => {
					entryFlowDiagnostics.startSetupFlow("request_initial_game_data");
					setShowSetupLayer(false);
					setIsBootstrapping(true);
					pendingSetupResolverRef.current = null;
					entryFlowDiagnostics.logSetupConfirmed(formData);

					void (async () => {
						const hydratedFormData = await hydrateInitialSetupData(formData);
						initialSetupDataRef.current = hydratedFormData;
						pendingInitialSetupPromiseRef.current = null;
						entryFlowDiagnostics.logSetupDataReady(hydratedFormData);
						resolve(hydratedFormData);
					})();
				};
			});

			pendingInitialSetupPromiseRef.current = setupPromise;
			return setupPromise;
		},
		[
			entryFlowDiagnostics,
			hydrateInitialSetupData,
			logSetupLayerVisibility,
			presentSetupLayer,
		],
	);

	const initializeGame = useCallback(() => {
		if (!gameContainerRef.current) return;
		if (!gameContainerSize || gameContainerSize <= 0) return;
		if (isInitializedRef.current) return;
		if (isInitializingGameRef.current) return;

		setLoadingFailureAlert(null);
		setIsBootstrapping(true);

		const attemptId = gameInitializationAttemptIdRef.current + 1;
		gameInitializationAttemptIdRef.current = attemptId;
		isInitializingGameRef.current = true;
		entryFlowDiagnostics.beginInitializeGame(attemptId, gameContainerSize);

		const debugParentElement =
			gameContainerRef.current.closest("#app-container") ??
			gameContainerRef.current;

		const game = new Game({
			parentElement: gameContainerRef.current as HTMLDivElement,
			debugParentElement: debugParentElement as HTMLDivElement,
			debugMode: isNativeFeatureDebugMode,
			locale,
			initialSceneKey: CONFIGURED_INITIAL_SCENE_KEY,
			onCreateInitialGameData: async () => {
				return (
					initialSetupDataRef.current ??
					(await requestInitialGameData({
						allowSetupLayer: false,
						source: "game_runtime",
					}))
				);
			},
			showAlert: (message: string, title?: string) => {
				showAlert(message, title);
			},
			showSettings: () => {
				openSettingMenu();
			},
			showMonsterInfo: () => {
				openMonsterInfo(game.getMainCharacterInfoSnapshot());
			},
			triggerBiteVibration: () => {
				void biteVibrationAdapter.vibrate();
			},
			triggerMainSceneSfx,
			triggerTransientVibration,
			startRecoveryVibration,
			stopRecoveryVibration,
			getFlappyBirdBestScore,
			persistFlappyBirdBestScore,
			showFlappyBirdGameOver: (params) => {
				setFlappyBirdGameOverState(params);
				void scheduleFlappyBirdGameOverAd();
			},
			hideFlappyBirdGameOver: () => {
				setFlappyBirdGameOverState(null);
			},
			showFlappyBirdSettingsMenu: (params) => {
				setControlButtonSoundEnabled(params.isSfxEnabled);
				setFlappyBirdSettingsMenuState(params);
			},
			hideFlappyBirdSettingsMenu: () => {
				setFlappyBirdSettingsMenuState(null);
			},
			onSceneTransitionStateChange: handleSceneTransitionStateChange,
			onMainSceneReentrySimulationStateChange:
				handleMainSceneReentrySimulationStateChange,
			onNativeWorldDataUpdateForReentry: handleNativeWorldDataUpdateForReentry,
			loadingTraceContext:
				entryFlowDiagnostics.createGameLoadingTraceContext(attemptId),
			changeControlButtons: (controlButtonParams) => {
				if (!controlButtonParams) {
					setButtonParams(null);
					setControlButtonSoundEnabled(true);
					return;
				}

				const hasMiniGameJumpButton = controlButtonParams.some(
					(buttonParam) =>
						buttonParam.type === ControlButtonType.Jump ||
						buttonParam.type === ControlButtonType.DoubleJump,
				);

				if (!hasMiniGameJumpButton) {
					setControlButtonSoundEnabled(true);
				}

				setButtonParams((previous) => {
					if (
						previous &&
						previous.every(
							(buttonParam, index) =>
								buttonParam.type === controlButtonParams[index].type &&
								buttonParam.initialSliderValue ===
									controlButtonParams[index].initialSliderValue &&
								buttonParam.sliderSessionKey ===
									controlButtonParams[index].sliderSessionKey &&
								buttonParam.hasCleaningTarget ===
									controlButtonParams[index].hasCleaningTarget,
						)
					) {
						return previous;
					}

					return controlButtonParams;
				});
			},
		});

		pendingGameInitializationRef.current = { attemptId, game };
		armLoadingTimeout(
			{
				phase: "game_initialize",
				initializationAttemptId: attemptId,
			},
			{ resetStart: true },
		);

		clearInitializeGameStartTimeout();

		initializeGameStartTimeoutRef.current = window.setTimeout(() => {
			initializeGameStartTimeoutRef.current = null;

			if (pendingGameInitializationRef.current?.attemptId !== attemptId) {
				return;
			}

			void game
				.initialize()
				.then(() => {
					if (pendingGameInitializationRef.current?.attemptId !== attemptId) {
						return;
					}

					entryFlowDiagnostics.completeInitializeGame(attemptId);
					pendingGameInitializationRef.current = null;
					isInitializingGameRef.current = false;
					isInitializedRef.current = true;
					setGameInstance(game);
				})
				.catch((error) => {
					if (pendingGameInitializationRef.current?.attemptId !== attemptId) {
						return;
					}

					entryFlowDiagnostics.failInitializeGame(attemptId, error);
					pendingGameInitializationRef.current = null;
					isInitializingGameRef.current = false;
					setGameInstance(null);

					try {
						game.destroy();
					} catch (destroyError) {
						console.warn(
							"[GameContainer] Failed to clean up a partially initialized game instance.",
							destroyError,
						);
					}

					if (isMissingInitialGameDataError(error)) {
						console.warn(
							"[GameContainer] Initial setup data is missing. Returning to setup flow.",
							{
								error,
								storageKind: getClientStorageKind(),
							},
						);
						clearLoadingTimeout();
						sceneTransitionRequestIdRef.current = 0;
						setSceneTransitionLoadState({ requestId: 0, phase: "idle" });
						initialSetupDataRef.current = null;
						pendingInitialSetupPromiseRef.current = null;
						pendingSetupResolverRef.current = null;
						shouldRestartFromSetupRef.current = true;
						setLoadingFailureAlert(null);
						presentSetupLayer("game_initialize_missing_initial_data", {
							storageKind: getClientStorageKind(),
						});
						setIsBootstrapping(false);
						return;
					}

					stopLoadingWithFailure({
						message: t("loading.finishFailed"),
						error,
						context: {
							phase: "game_initialize",
						},
					});
				});
		});
	}, [
		armLoadingTimeout,
		clearLoadingTimeout,
		clearInitializeGameStartTimeout,
		gameContainerSize,
		locale,
		getFlappyBirdBestScore,
		handleMainSceneReentrySimulationStateChange,
		handleNativeWorldDataUpdateForReentry,
		handleSceneTransitionStateChange,
		openMonsterInfo,
		openSettingMenu,
		persistFlappyBirdBestScore,
		requestInitialGameData,
		startRecoveryVibration,
		presentSetupLayer,
		stopLoadingWithFailure,
		stopRecoveryVibration,
		showAlert,
		entryFlowDiagnostics,
		triggerMainSceneSfx,
		triggerTransientVibration,
		t,
	]);

	// Game 인스턴스 생성은 한 번만 실행되도록 보장
	useEffect(() => {
		const viewportElement = gameViewportRef.current;

		if (!viewportElement) {
			return;
		}

		updateGameContainerSize();

		if (typeof ResizeObserver === "undefined") {
			const handleWindowResize = () => {
				updateGameContainerSize();
			};

			window.addEventListener("resize", handleWindowResize);
			return () => {
				window.removeEventListener("resize", handleWindowResize);
			};
		}

		const resizeObserver = new ResizeObserver(() => {
			updateGameContainerSize();
		});
		resizeObserver.observe(viewportElement);
		if (controlButtonsWrapperRef.current) {
			resizeObserver.observe(controlButtonsWrapperRef.current);
		}

		return () => {
			resizeObserver.disconnect();
		};
	}, [buttonParams, updateGameContainerSize]);

	useEffect(() => {
		if (!isAndroidUserAgent) {
			return;
		}

		const handleNativeViewportSync = (event: Event) => {
			const detail = (event as CustomEvent<NativeViewportSyncDetail>).detail;

			nativeKeyboardInsetRef.current = Math.max(0, detail?.bottomInset ?? 0);
			updateUnsupportedViewportOverlay();
		};

		updateUnsupportedViewportOverlay();

		window.addEventListener("resize", updateUnsupportedViewportOverlay);
		window.addEventListener(
			"orientationchange",
			updateUnsupportedViewportOverlay,
		);
		window.visualViewport?.addEventListener(
			"resize",
			updateUnsupportedViewportOverlay,
		);
		window.addEventListener(
			"digivice:native-viewport-sync",
			handleNativeViewportSync as EventListener,
		);

		return () => {
			clearPendingUnsupportedViewportOverlayShow();
			window.removeEventListener("resize", updateUnsupportedViewportOverlay);
			window.removeEventListener(
				"orientationchange",
				updateUnsupportedViewportOverlay,
			);
			window.visualViewport?.removeEventListener(
				"resize",
				updateUnsupportedViewportOverlay,
			);
			window.removeEventListener(
				"digivice:native-viewport-sync",
				handleNativeViewportSync as EventListener,
			);
		};
	}, [
		clearPendingUnsupportedViewportOverlayShow,
		updateUnsupportedViewportOverlay,
	]);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const handleFullscreenAdState = (event: Event) => {
			const detail = (event as CustomEvent<FullscreenAdEventDetail>).detail;
			const state = detail?.state;

			if (state === "showing") {
				freezeLayoutForFullscreenAd();
				return;
			}

			if (state === "dismissed" || state === "failed") {
				releaseLayoutAfterFullscreenAd();
			}
		};

		window.addEventListener(
			"digivice:fullscreen-ad",
			handleFullscreenAdState as EventListener,
		);

		return () => {
			window.removeEventListener(
				"digivice:fullscreen-ad",
				handleFullscreenAdState as EventListener,
			);
			clearFullscreenAdLayoutRelease();
			isFullscreenAdLayoutFrozenRef.current = false;
			setFrozenAppShellHeight(null);
		};
	}, [
		clearFullscreenAdLayoutRelease,
		freezeLayoutForFullscreenAd,
		releaseLayoutAfterFullscreenAd,
	]);

	useEffect(() => {
		if (typeof window === "undefined" || typeof document === "undefined") {
			return;
		}

		const handleBackgroundEntry = (reason: string) => {
			showResumeGuard(reason, { sync: true });
		};

		const handleForegroundEntry = (reason: string) => {
			hideResumeGuardAfterLayout(reason);
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				handleBackgroundEntry("document_hidden");
				return;
			}

			if (document.visibilityState === "visible") {
				handleForegroundEntry("document_visible");
			}
		};

		const handlePageHide = () => {
			handleBackgroundEntry("pagehide");
		};

		const handlePageShow = () => {
			handleForegroundEntry("pageshow");
		};

		const handleFocus = () => {
			handleForegroundEntry("window_focus");
		};

		const handleNativeAppLifecycle = (event: Event) => {
			const detail = (event as CustomEvent<NativeAppLifecycleEventDetail>)
				.detail;
			const state = detail?.state;
			const launchMode =
				detail?.launchMode === "widget_refresh" ? "widget_refresh" : "default";
			if (
				typeof detail?.hasAnyWidgets === "boolean" ||
				typeof detail?.homeWidget1x1Count === "number" ||
				typeof detail?.homeWidget2x1Count === "number"
			) {
				homeWidgetPresenceRef.current = {
					hasAnyWidgets: detail.hasAnyWidgets === true,
					homeWidget1x1Count: readNullableNumber(
						detail.homeWidget1x1Count,
					),
					homeWidget2x1Count: readNullableNumber(
						detail.homeWidget2x1Count,
					),
				};
			}

			if (launchMode === "widget_refresh") {
				homeWidgetLaunchModeRef.current = "widget_refresh";
				logImportantDiagnostics(
					"log",
					"[ImportantDiagnostics][WorldDataSyncPayload]",
					{
						action: "launch_context_lifecycle",
						launchMode,
						state: state ?? null,
						hasAnyWidgets: homeWidgetPresenceRef.current.hasAnyWidgets,
						homeWidget1x1Count:
							homeWidgetPresenceRef.current.homeWidget1x1Count,
						homeWidget2x1Count:
							homeWidgetPresenceRef.current.homeWidget2x1Count,
					},
				);
			}

			if (state === "inactive" || state === "hidden" || state === "paused") {
				const reason = `native_${state}`;
				handleBackgroundEntry(reason);

				if (nativeBackgroundWidgetSyncTriggeredRef.current) {
					logImportantDiagnostics(
						"log",
						"[ImportantDiagnostics][WorldDataSyncPayload]",
						{
							reason,
							action: "skipped_duplicate_burst",
						},
					);
					return;
				}

				nativeBackgroundWidgetSyncTriggeredRef.current = true;
				void syncHomeWidgetForNativeBackground(reason);
				return;
			}

			if (state === "resumed") {
				nativeBackgroundWidgetSyncTriggeredRef.current = false;
				handleForegroundEntry("native_resumed");
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		window.addEventListener("pagehide", handlePageHide);
		window.addEventListener("pageshow", handlePageShow);
		window.addEventListener("focus", handleFocus);
		window.addEventListener(
			"digivice:native-app-lifecycle",
			handleNativeAppLifecycle as EventListener,
		);

		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			window.removeEventListener("pagehide", handlePageHide);
			window.removeEventListener("pageshow", handlePageShow);
			window.removeEventListener("focus", handleFocus);
			window.removeEventListener(
				"digivice:native-app-lifecycle",
				handleNativeAppLifecycle as EventListener,
			);
		};
	}, [
		hideResumeGuardAfterLayout,
		showResumeGuard,
		syncHomeWidgetForNativeBackground,
	]);

	useEffect(() => {
		let isMounted = true;

		const bootstrap = async () => {
			if (!gameContainerRef.current) return;
			if (!gameContainerSize || gameContainerSize <= 0) return;
			if (isInitializedRef.current) return;

			await loadHomeWidgetLaunchContext();
			if (!isMounted) return;

			if (CONFIGURED_INITIAL_SCENE_KEY !== SceneKey.MAIN) {
				initializeGame();
				return;
			}

			entryFlowDiagnostics.beginBootstrap(gameContainerSize);
			const savedGameDataState = await prepareSavedGameData();
			if (!isMounted) return;

			if (savedGameDataState === "reset_required") {
				return;
			}

			if (savedGameDataState === "setup_required") {
				const initialGameDataStartedAt =
					entryFlowDiagnostics.beginRequestInitialGameData();
				await requestInitialGameData({
					allowSetupLayer: true,
					source: "bootstrap",
				});
				if (!isMounted) return;
				entryFlowDiagnostics.completeRequestInitialGameData(
					initialGameDataStartedAt,
					!!initialSetupDataRef.current,
				);
				const layoutStabilizationStartedAt =
					entryFlowDiagnostics.beginLayoutStabilization();
				await waitForLayoutStabilization();
				if (!isMounted) return;
				entryFlowDiagnostics.completeLayoutStabilization(
					layoutStabilizationStartedAt,
					getCurrentViewportHeight(),
				);
			}

			initializeGame();
		};

		void bootstrap();

		return () => {
			isMounted = false;
			stopRecoveryVibration();
		};
	}, [
		gameContainerSize,
		gameSessionKey,
		initializeGame,
		entryFlowDiagnostics,
		loadHomeWidgetLaunchContext,
		prepareSavedGameData,
		requestInitialGameData,
		stopRecoveryVibration,
	]);

	useEffect(() => {
		return () => {
			resumeGuardReleaseRequestIdRef.current += 1;
			isResumeGuardVisibleRef.current = false;
			isResumeReentrySimulationRunningRef.current = false;
			clearLoadingTimeout();
			cancelPendingGameInitialization("component_unmount");
			pendingInitialSetupPromiseRef.current = null;
			pendingSetupResolverRef.current = null;
			stopRecoveryVibration();
		};
	}, [
		cancelPendingGameInitialization,
		clearLoadingTimeout,
		stopRecoveryVibration,
	]);

	useEffect(() => {
		if (!gameInstance) {
			return;
		}

		if (sceneTransitionLoadState.phase !== "idle") {
			return;
		}

		if (gameInstance.getCurrentSceneKey() !== SceneKey.MAIN) {
			return;
		}

		let cancelled = false;

		const preloadMiniGameAssets = async () => {
			try {
				await gameInstance.preloadSceneAssets(SceneKey.FLAPPY_BIRD_GAME);
			} catch (error) {
				if (cancelled) {
					return;
				}

				console.warn(
					"[GameContainer] Failed to preload mini game assets",
					error,
				);
			}
		};

		void preloadMiniGameAssets();

		return () => {
			cancelled = true;
		};
	}, [gameInstance, sceneTransitionLoadState.phase]);

	// 버튼 클릭 핸들러 - Game 인스턴스에 버튼 타입만 전달
	const handleButtonPress = useCallback(
		(buttonType: ControlButtonType) => {
			if (
				buttonType === ControlButtonType.Settings &&
				gameInstance?.getCurrentSceneKey() !== SceneKey.FLAPPY_BIRD_GAME
			) {
				openSettingMenu();
				return;
			}

			if (gameInstance) {
				gameInstance.handleControlButtonClick(buttonType);
			}
		},
		[gameInstance, openSettingMenu],
	);

	// 슬라이더 값 변경 핸들러 추가
	const handleSliderChange = useCallback(
		(value: number) => {
			if (gameInstance?.handleSliderValueChange) {
				// 게임 인스턴스에 슬라이더 값 전달
				gameInstance.handleSliderValueChange(value);
			}
		},
		[gameInstance],
	);

	// 슬라이더 종료 핸들러 추가
	const handleSliderEnd = useCallback(() => {
		if (gameInstance?.handleSliderEnd) {
			// 게임 인스턴스에 슬라이더 종료 이벤트 전달
			gameInstance.handleSliderEnd();
		}
	}, [gameInstance]);

	// SetupLayer 완료 핸들러
	const handleSetupComplete = useCallback(
		(formData: SetupFormData) => {
			const pendingResolver = pendingSetupResolverRef.current;

			if (pendingResolver) {
				pendingResolver(formData);
				return;
			}

			entryFlowDiagnostics.startSetupFlow("handle_setup_complete");
			setShowSetupLayer(false);
			setLoadingFailureAlert(null);
			setIsBootstrapping(true);
			entryFlowDiagnostics.logSetupConfirmed(formData);

			void (async () => {
				const hydratedFormData = await hydrateInitialSetupData(formData);
				initialSetupDataRef.current = hydratedFormData;
				entryFlowDiagnostics.logSetupDataReady(hydratedFormData);

				if (shouldRestartFromSetupRef.current) {
					shouldRestartFromSetupRef.current = false;
					setGameSessionKey((previous) => previous + 1);
					return;
				}

				setIsBootstrapping(false);
			})();
		},
		[entryFlowDiagnostics, hydrateInitialSetupData],
	);

	useEffect(() => {
		storeSnapshotSceneRequestedRef.current = null;
		storeSnapshotMonsterInfoRequestedRef.current = false;
		setStoreSnapshotAppliedTimeOfDay(null);
	}, [gameSessionKey]);

	useEffect(() => {
		if (!monsterInfoState) {
			return;
		}

		if (!gameInstance) {
			setMonsterInfoState(null);
			return;
		}

		let rafId = 0;
		let cancelled = false;

		const pollSnapshot = () => {
			if (cancelled) {
				return;
			}

			const nextSnapshot = gameInstance.getMainCharacterInfoSnapshot();

			if (!nextSnapshot) {
				setMonsterInfoState(null);
				return;
			}

			setMonsterInfoState((previous) =>
				areMainCharacterInfoSnapshotsEqual(previous, nextSnapshot)
					? previous
					: nextSnapshot,
			);

			rafId = window.requestAnimationFrame(pollSnapshot);
		};

		rafId = window.requestAnimationFrame(pollSnapshot);

		return () => {
			cancelled = true;
			window.cancelAnimationFrame(rafId);
		};
	}, [gameInstance, monsterInfoState]);

	const handleSendLoadingFailureLogs = useCallback(() => {
		setLoadingFailureAlert(null);
		window.setTimeout(() => {
			void handleSendDiagnostics();
		}, 0);
	}, [handleSendDiagnostics]);

	const isLoading =
		isBootstrapping ||
		isResumeGuardVisible ||
		sceneTransitionLoadState.phase === "loading" ||
		sceneTransitionLoadState.phase === "core_ready";
	const storeSnapshotTargetScene = storeSnapshotConfig.enabled
		? storeSnapshotConfig.scene
		: null;
	const storeSnapshotTargetTimeOfDay = resolveStoreSnapshotTimeOfDay(
		storeSnapshotConfig.timeOfDay,
	);
	const storeSnapshotCurrentScene = gameInstance?.getCurrentSceneKey() ?? null;
	const storeSnapshotCurrentTimeOfDay =
		storeSnapshotCurrentScene === SceneKey.MAIN
			? (storeSnapshotAppliedTimeOfDay ??
				gameInstance?.getMainSceneTimeOfDay() ??
				null)
			: null;
	const storeSnapshotReadyReason = !storeSnapshotConfig.enabled
		? "disabled"
		: !gameInstance
			? "game_unavailable"
			: showSetupLayer
				? "setup_visible"
				: isLoading
					? "loading"
					: storeSnapshotCurrentScene !== storeSnapshotConfig.scene
						? "waiting_scene"
						: storeSnapshotTargetTimeOfDay !== null &&
								storeSnapshotCurrentScene === SceneKey.MAIN &&
								storeSnapshotCurrentTimeOfDay !== storeSnapshotTargetTimeOfDay
							? "waiting_time_of_day"
							: storeSnapshotConfig.overlay === "monster-info" &&
									!monsterInfoState
								? "waiting_monster_info"
								: "ready";
	const isStoreSnapshotReady = storeSnapshotReadyReason === "ready";

	useEffect(() => {
		if (!storeSnapshotConfig.enabled) {
			clearStoreSnapshotBridgeState();
			return;
		}

		setStoreSnapshotBridgeState({
			enabled: true,
			shot: storeSnapshotConfig.shot,
			targetScene: storeSnapshotTargetScene,
			currentScene: storeSnapshotCurrentScene,
			overlay: storeSnapshotConfig.overlay,
			timeOfDay: storeSnapshotConfig.timeOfDay,
			isLoading,
			isBootstrapping,
			showSetupLayer,
			gameContainerSize,
			loadingFailureMessage: loadingFailureAlert?.message ?? null,
			unsupportedViewportReason,
			ready: isStoreSnapshotReady,
			reason: storeSnapshotReadyReason,
			monsterInfoOpen: monsterInfoState !== null,
		});
	}, [
		gameContainerSize,
		isBootstrapping,
		isLoading,
		isStoreSnapshotReady,
		loadingFailureAlert,
		monsterInfoState,
		showSetupLayer,
		storeSnapshotConfig.enabled,
		storeSnapshotConfig.overlay,
		storeSnapshotConfig.shot,
		storeSnapshotConfig.timeOfDay,
		storeSnapshotCurrentScene,
		storeSnapshotReadyReason,
		storeSnapshotTargetScene,
		unsupportedViewportReason,
	]);

	useEffect(() => {
		return () => {
			clearStoreSnapshotBridgeState();
		};
	}, []);

	useEffect(() => {
		if (!storeSnapshotConfig.enabled || !gameInstance) {
			return;
		}

		if (showSetupLayer || isLoading) {
			return;
		}

		if (sceneTransitionLoadState.phase !== "idle") {
			return;
		}

		if (storeSnapshotCurrentScene !== storeSnapshotConfig.scene) {
			if (
				storeSnapshotSceneRequestedRef.current === storeSnapshotConfig.scene
			) {
				return;
			}

			storeSnapshotSceneRequestedRef.current = storeSnapshotConfig.scene;
			setMonsterInfoState(null);
			void gameInstance.changeScene(storeSnapshotConfig.scene);
			return;
		}

		storeSnapshotSceneRequestedRef.current = storeSnapshotConfig.scene;

		if (
			storeSnapshotCurrentScene === SceneKey.MAIN &&
			storeSnapshotTargetTimeOfDay !== null
		) {
			if (storeSnapshotCurrentTimeOfDay !== storeSnapshotTargetTimeOfDay) {
				gameInstance.setMainSceneTimeOfDay(storeSnapshotTargetTimeOfDay);
				setStoreSnapshotAppliedTimeOfDay(storeSnapshotTargetTimeOfDay);
				return;
			}
		}

		if (
			storeSnapshotCurrentScene !== SceneKey.MAIN ||
			storeSnapshotConfig.overlay !== "monster-info" ||
			monsterInfoState
		) {
			return;
		}

		if (storeSnapshotMonsterInfoRequestedRef.current) {
			return;
		}

		const nextSnapshot = gameInstance.getMainCharacterInfoSnapshot();
		if (!nextSnapshot) {
			return;
		}

		storeSnapshotMonsterInfoRequestedRef.current = true;
		openMonsterInfo(nextSnapshot);
	}, [
		gameInstance,
		isLoading,
		monsterInfoState,
		openMonsterInfo,
		sceneTransitionLoadState.phase,
		showSetupLayer,
		storeSnapshotConfig.enabled,
		storeSnapshotConfig.overlay,
		storeSnapshotConfig.scene,
		storeSnapshotCurrentScene,
		storeSnapshotCurrentTimeOfDay,
		storeSnapshotTargetTimeOfDay,
	]);

	return (
		<div
			className={"relative flex h-full min-h-0 w-full flex-col overflow-hidden"}
		>
			<div
				ref={gameViewportRef}
				className={"grid min-h-0 min-w-0 flex-1 overflow-hidden"}
				style={{
					gridTemplateRows: buttonParams
						? "minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr)"
						: "minmax(0, 1fr) auto minmax(0, 1fr)",
				}}
			>
				<div aria-hidden="true" className="min-h-0" />
				<div className={"flex min-h-0 min-w-0 justify-center overflow-hidden"}>
					<div
						className={"relative m-0 shrink-0 p-0"}
						style={
							gameContainerSize
								? {
										width: `${gameContainerSize}px`,
										height: `${gameContainerSize}px`,
									}
								: undefined
						}
					>
						<div
							id="game-container"
							ref={gameContainerRef}
							className={"absolute inset-0 m-0 p-0"}
						>
							{/* 게임 캔버스가 여기에 렌더링됨 */}
						</div>
					</div>
				</div>
				<div aria-hidden="true" className="min-h-0" />

				{buttonParams && (
					<div ref={controlButtonsWrapperRef} className={"z-10 w-full"}>
						<ControlButtons
							buttonParams={buttonParams}
							soundEnabled={controlButtonSoundEnabled}
							onButtonPress={handleButtonPress}
							onSliderChange={handleSliderChange}
							onSliderEnd={handleSliderEnd}
						/>
					</div>
				)}
				{buttonParams && <div aria-hidden="true" className="min-h-0" />}
			</div>
			{isLoading && (
				<div className="absolute inset-0 z-50 flex items-center justify-center bg-black text-white">
					<div className="text-center text-[2.25rem] tracking-[0.12em]">
						{t("loading.label")}
					</div>
				</div>
			)}
			{unsupportedViewportReason && (
				<div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black text-white">
					<div className="px-6 text-center">
						<div className="text-lg tracking-[0.12em]">
							{t("viewport.portraitOnly")}
						</div>
						<div className="mt-6 text-[10px] leading-6 tracking-[0.12em]">
							{unsupportedViewportReason === "landscape" ? (
								<>
									{t("viewport.rotateDevice")}
									<br />
									{t("viewport.backToPortrait")}
								</>
							) : (
								<>
									{t("viewport.unsupportedRatio")}
									<br />
									{t("viewport.useTallerPortrait")}
								</>
							)}
						</div>
					</div>
				</div>
			)}
			{showSetupLayer && <SetupLayer onComplete={handleSetupComplete} />}
			{monsterInfoState && (
				<MonsterInfoLayer
					snapshot={monsterInfoState}
					onClose={dismissMonsterInfo}
					onBack={closeMonsterInfo}
				/>
			)}
			{showSettingMenu && (
				<SettingMenuLayer
					releaseLabel={getClientReleaseLabel()}
					vibrationEnabled={gameSettings.vibrationEnabled}
					sfxEnabled={gameSettings.sfxEnabled}
					locale={locale}
					onChangeVibration={handleVibrationSettingChange}
					onChangeSfx={handleSfxSettingChange}
					onChangeLocale={setLocale}
					onSendDiagnostics={handleSendDiagnostics}
					isSendingDiagnostics={isSendingDiagnostics}
					showFinalResetConfirm={showFinalResetConfirm}
					onOpenResetConfirm={() => setShowFinalResetConfirm(true)}
					onCloseResetConfirm={dismissResetConfirm}
					onResetConfirmBack={closeResetConfirm}
					onResetGameData={handleResetGameData}
					onClose={dismissSettingMenu}
					onBack={closeSettingMenu}
					onShowOfflineAdFallback={handleShowOfflineAdFallback}
					onRequestPinHomeWidget={async (size) => {
						const controller =
							window.homeWidgetController ?? window.homeWidgetRefreshController;

						const requestPinWidget =
							size === "1x1"
								? controller?.requestPinWidget1x1
								: (controller?.requestPinWidget2x1 ??
									controller?.requestPinWidget);

						if (!requestPinWidget) {
							return { status: "unavailable" as const };
						}

						try {
							const rawResult = await requestPinWidget();
							const parsedResult =
								typeof rawResult === "string"
									? JSON.parse(rawResult)
									: rawResult;
							const status =
								typeof parsedResult?.status === "string"
									? parsedResult.status
									: "failed";

							if (
								status === "requested" ||
								status === "unavailable" ||
								status === "unsupported_api" ||
								status === "unsupported_launcher"
							) {
								return { status };
							}

							return { status: "failed" as const };
						} catch {
							return { status: "failed" as const };
						}
					}}
				/>
			)}
			{alertState && (
				<AlertLayer
					title={alertState.title}
					message={alertState.message}
					onClose={dismissAlert}
					onBack={hideAlert}
				/>
			)}
			{loadingFailureAlert && (
				<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
					<PopupLayer
						title={loadingFailureAlert.title}
						content={
							<div className="text-left leading-[1.6]">
								{loadingFailureAlert.message}
							</div>
						}
						onConfirm={dismissLoadingFailureAlert}
						onCancel={handleSendLoadingFailureLogs}
						onBack={() => {
							setLoadingFailureAlert(null);
						}}
						confirmText={t("common.okay")}
						cancelText={t("diagnostics.sendLog")}
					/>
				</div>
			)}
			{sanitizeResetAlert && (
				<AlertLayer
					title={sanitizeResetAlert.title}
					message={sanitizeResetAlert.message}
					onClose={handleSanitizeResetConfirm}
					onCancel={() => {
						void handleSendDiagnostics();
					}}
					cancelText={
						isSendingDiagnostics
							? t("settings.sending")
							: t("diagnostics.sendLogs")
					}
				/>
			)}
			{pendingDiagnosticsDraft && (
				<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
					<PopupLayer
						title={t("diagnostics.openGmail")}
						content={
							<div className="text-left leading-[1.6]">
								<div>{t("diagnostics.gmailWillOpen")}</div>
								<div className="mt-2">{t("diagnostics.gmailAttachments")}</div>
							</div>
						}
						onConfirm={handleConfirmDiagnosticsDraft}
						onCancel={handleCancelDiagnosticsDraft}
						onBack={() => {
							setPendingDiagnosticsDraft(null);
						}}
						confirmText={t("common.confirmUpper")}
						cancelText={t("common.cancel")}
					/>
				</div>
			)}
			{flappyBirdGameOverState && (
				<FlappyBirdGameOverLayer
					onRestart={handleFlappyBirdGameOverRestart}
					onExit={handleFlappyBirdGameOverExit}
				/>
			)}
			{flappyBirdSettingsMenuState && (
				<FlappyBirdSettingsLayer
					isBgmEnabled={flappyBirdSettingsMenuState.isBgmEnabled}
					isSfxEnabled={flappyBirdSettingsMenuState.isSfxEnabled}
					onChangeBgm={handleFlappyBirdSettingsMenuChangeBgm}
					onChangeSfx={handleFlappyBirdSettingsMenuChangeSfx}
					selectedTimeOfDay={flappyBirdSettingsMenuState.selectedTimeOfDay}
					onSelectTimeOfDay={handleFlappyBirdSettingsMenuSelectTimeOfDay}
					onSendLogs={handleSendFlappyBirdLogs}
					isSendingLogs={
						isSendingDiagnostics || pendingDiagnosticsDraft !== null
					}
					onResume={handleFlappyBirdSettingsMenuResume}
					onExit={handleFlappyBirdSettingsMenuExit}
				/>
			)}
		</div>
	);
};

export default GameContainer;
