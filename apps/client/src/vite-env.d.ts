/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NATIVE_FEATURE_DEBUG_MODE?: string;
}

// 게임 에셋 타입 확장
declare module "@game-assets/*" {
  const content: string;
  export default content;
}
