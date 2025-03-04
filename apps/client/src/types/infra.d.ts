declare global {
  interface Window {
    PipController?: {
      enterPipMode: () => Promise<void>;
      exitPipMode: () => Promise<void>;
    };
    WebViewStreamingAPI?: {
      startStreaming: () => string;
      stopStreaming: () => string;
      getStreamingUrl: () => string;
    };
  }
}

export {};
