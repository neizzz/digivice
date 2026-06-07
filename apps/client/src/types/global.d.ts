type DigiviceMainSceneAdMenu = "feed" | "clean" | "hospital";

type AdControllerShowOptions = {
	cooldownMs?: number;
};

type OfflineInterstitialFallbackRequest = {
	trigger: string;
	cooldownMs: number;
	timestamp: number;
};

type MainSceneMenuAdRequest = {
	menu: DigiviceMainSceneAdMenu;
	cooldownMs: number;
	threshold: number;
	queuedAt: number;
	deepNight: boolean;
	menuUseCount: number;
	onlineRetry: boolean;
};

declare global {
	type NativeWorldDataUpdateResult = {
		status?: string;
		updatedRawWorldData?: string | null;
		worldDataChanged?: boolean;
		hatched?: boolean;
		evolutionDiagnostics?: Record<string, unknown> | null;
		evolutionGageBefore?: number | null;
		evolutionGageAfter?: number | null;
		evolutionGageIncreased?: boolean | null;
		evolutionBlockReason?: string | null;
		previousCharacterState?: number | null;
		nextCharacterState?: number | null;
		selectedCharacterKey?: number | null;
		error?: unknown;
		[key: string]: unknown;
	};

	type WorldDataUpdateControllerBridge = {
		completeNativeWorldDataUpdate: (payload: {
			source?: "init" | "app_resume";
		}) => Promise<NativeWorldDataUpdateResult>;
	};

	type HomeWidgetControllerBridge = {
		requestPinWidget: () => Promise<string>;
		requestPinWidget1x1: () => Promise<string>;
		requestPinWidget2x1: () => Promise<string>;
		getLaunchContext?: () => Promise<{
			mode?: string;
		}>;
		syncFromWorldDataJson: (payload: {
			rawWorldData?: string | null;
			reason?: string;
		}) => Promise<Record<string, unknown>>;
		syncFromStorageOrWorldDataJson?: (payload: {
			inMemoryRawWorldData?: string | null;
			reason?: string;
		}) => Promise<Record<string, unknown>>;
		completeRefresh?: (payload: {
			result?: string;
			source?: string;
			[key: string]: unknown;
		}) => Promise<{
			status?: string;
		}>;
		getRefreshDiagnostics?: () => Promise<Record<string, unknown>>;
	};

	interface Window {
		errorLogs: string[];
		vibrationController?: {
			vibrate: (duration?: number, strength?: number) => Promise<string>;
		};
		browserController?: {
			openExternalUrl: (url: string) => Promise<string>;
			openGmailDraft: (
				to: string,
				subject: string,
				body: string,
				attachments?: Array<{
					fileName: string;
					text: string;
					mimeType?: string;
				}>,
			) => Promise<string>;
		};
		sunController?: {
			getSunTimes: (
				promptForPermission?: boolean,
				traceContext?: {
					source?: string;
					phase?: string;
					setupFlowId?: string | null;
					initializationAttemptId?: number | null;
				} | null,
			) => Promise<{
				sunriseAt: string;
				sunsetAt: string;
				date: string;
				timezone: string;
				timezoneOffsetMinutes: number;
				fetchedAt: string;
				locationSource: "device" | "fallback";
				hasLocationPermission: boolean;
			} | null>;
			requestLocationPermission: () => Promise<{
				granted: boolean;
			} | null>;
		};
		adController?: {
			showInterstitial: (options?: AdControllerShowOptions) => Promise<string>;
			canShowAd: (options?: AdControllerShowOptions) => Promise<string>;
			showTestInterstitial?: () => Promise<string>;
			getAdDebugState?: () => Promise<string>;
		};
		trustedTimeController?: {
			getSnapshot: (options?: { forceRefresh?: boolean }) => Promise<{
				trustedUtcMs: number;
				osUptimeMs: number;
				source: "ntp" | "cached-uptime" | "web-dev-fallback";
				uncertaintyMs: number;
				capturedWallMs: number;
			} | null>;
		};
		digiviceAdBridge?: {
			requestMainSceneMenuAd: (
				request: MainSceneMenuAdRequest,
			) => Promise<boolean>;
			hasPendingOnlineAdRetry: () => boolean;
		};
		digiviceAdFallbackBridge?: {
			showOfflineInterstitialFallback: (
				request: OfflineInterstitialFallbackRequest,
			) => Promise<boolean>;
			completeOfflineInterstitialFallback: (completed?: boolean) => void;
			isActive: () => boolean;
		};
		digivicePopupBackBridge?: {
			handleBackNavigation: () => boolean;
		};
		digiviceBackBridge?: {
			handleBackNavigation: () => "consumed" | "exit";
		};
		homeWidgetController?: HomeWidgetControllerBridge;
		homeWidgetRefreshController?: HomeWidgetControllerBridge;
		worldDataUpdateController?: WorldDataUpdateControllerBridge;
		nativeDebugLogger?: {
			log: (payload: unknown) => void;
		};
		__digiviceNativeBridgeDiagnostics?: Array<Record<string, unknown>>;
	}
}

export {};
