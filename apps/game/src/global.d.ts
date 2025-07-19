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
  }

  interface ImportMetaEnv {
    readonly DEV: boolean;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};
