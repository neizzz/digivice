// TypeScript에서 window 객체 타입 확장
declare global {
  interface Window {
    debug?: {
      togglePreventEating: () => boolean;
      showFlags: () => void;
    };
  }

  interface ImportMetaEnv {
    readonly DEV: boolean;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};
