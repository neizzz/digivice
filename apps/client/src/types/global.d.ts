declare global {
  interface Window {
    errorLogs: string[];
    vibrationController?: {
      vibrate: (duration?: number, strength?: number) => Promise<string>;
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
}

export {};
