declare global {
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
      showInterstitial: () => Promise<string>;
      canShowAd: () => Promise<string>;
      showTestInterstitial?: () => Promise<string>;
      getAdDebugState?: () => Promise<string>;
    };
  }
}

export {};
