// TypeScript에서 window 객체 타입 확장
declare global {
	// "apps/client" vite.config.ts define필드 참고
	declare const ECS_NULL_VALUE = 0;
	declare const ECS_CHARACTER_STATUS_LENGTH = 4;

	interface Window {
		debug?: {
			togglePreventEating: () => boolean;
			showFlags: () => void;
		};
		sunController?: {
			getSunTimes: (
				promptForPermission?: boolean,
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
	}

	interface ImportMetaEnv {
		readonly DEV: boolean;
		readonly NATIVE_FEATURE_DEBUG_MODE?: string;
	}
	interface ImportMeta {
		readonly env: ImportMetaEnv;
	}
}

export {};
