/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NATIVE_FEATURE_DEBUG_MODE?: string;
  readonly APP_LOGO_TEXT?: string;
}

declare const __APP_VERSION__: string;
declare const __APP_LOGO_TEXT__: string;

// 게임 에셋 타입 확장
declare module "@game-assets/*" {
  const content: string;
  export default content;
}
