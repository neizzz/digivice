declare global {
  interface Window {
    errorLogs: string[];
    vibrationController?: {
      vibrate: (duration?: number, strength?: number) => Promise<string>;
    };
  }
}

export {};
