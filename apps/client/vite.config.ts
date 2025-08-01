import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 환경변수 로드
  // const env = loadEnv(mode, process.cwd());
  // const isDebugMode = env.DEBUG === "true";
  // const isNativeTestMode = env.NATIVE_FEATURE_TEST_MODE === "true";

  return {
    plugins: [react(), tailwindcss(), tsconfigPaths()],
    define: {
      // __NATIVE_TEST_MODE__: isNativeTestMode,

      /** for "apps/game" */
      ECS_NULL_VALUE: 0,
      ECS_CHARACTER_STATUS_LENGTH: 4,
    },
    resolve: {
      alias: {
        "@digivice/game": resolve(__dirname, "../game/src"),
      },
    },
    // 정적 파일 디렉토리 명시적 설정
    publicDir: "public",
    optimizeDeps: {
      include: ["pixi.js", "matter-js"],
      esbuildOptions: {
        loader: {
          ".ts": "tsx",
        },
      },
    },
    server: {
      watch: {
        ignored: ["!**/node_modules/**"],
      },
    },
  };
});
