declare global {
  interface Window {
    errorLogs: string[];
    vibrationController?: {
      vibrate: (duration?: number) => Promise<string>;
    };
  }
}

export {};
