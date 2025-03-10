/// <reference types="vite/client" />

// 게임 에셋 타입 확장
declare module "@game-assets/*" {
  const content: string;
  export default content;
}
