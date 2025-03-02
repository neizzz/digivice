interface Window {
  errorLogs: string[];
  __initJavascriptInterfaces: {
    postMessage: (message: string) => void;
  };
}

declare interface MiniViewServiceResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

declare interface StreamingServiceResult {
  success: boolean;
  message?: string;
  status?: string;
  data?: unknown;
}

declare interface StreamingOptions {
  quality: string;
  fps: number;
}
