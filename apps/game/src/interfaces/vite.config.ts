import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 환경변수 로드
  const env = loadEnv(mode, process.cwd());

  // 테스트 모드 확인
  const isTestMode = env.NATIVE_FEATURE_TEST_MODE === "true";
  const isDev = mode === "development";

  console.log(`Building in ${isTestMode ? "TEST" : "NORMAL"} mode`);

  return {
    plugins: [react()],
    define: {
      // 클라이언트에서 사용하기 위해 전역 변수로 설정 (선택사항)
      __TEST_MODE__: isTestMode,
    },
    // game 라이브러리와의 통합을 위한 설정
    resolve: {
      alias: {
        // 개발환경에서는 소스 코드 직접 참조, 프로덕션에서는 빌드된 버전 사용
        "@digivice/game": isDev
          ? resolve(__dirname, "../game/src")
          : resolve(__dirname, "../game/dist"),
      },
    },
    optimizeDeps: {
      // TypeScript 파일을 직접 포함
      include: ["pixi.js", "matter-js"],
      esbuildOptions: {
        // .ts 파일도 처리하도록 설정
        loader: {
          ".ts": "tsx",
        },
      },
    },
    server: {
      watch: {
        // game 패키지의 변경사항 감지
        ignored: ["!**/node_modules/**"],
      },
    },
  };
});
