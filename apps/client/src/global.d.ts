declare global {
  interface Window {
    errorLogs: string[];
    setLogs: (logs: string[]) => string[];
  }
}

export {};
