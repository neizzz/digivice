declare global {
  interface Window {
    errorLogs: string[];
    setLogs: (logs: string[]) => string[];
    pipController?: {
      enterPipMode: () => Promise<void>;
      exitPipMode: () => Promise<void>;
    };
    MiniViewController?: {
      postMessage: (message: string) => void;
    };
    WebViewStreamingAPI?: {
      startStreaming: () => string;
      stopStreaming: () => string;
      getStreamingUrl: () => string;
    };
  }
}

export {};
