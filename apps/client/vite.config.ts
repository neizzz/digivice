import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 환경변수 로드
  // const env = loadEnv(mode, process.cwd());
  // const isDebugMode = env.DEBUG === "true";
  // const isNativeTestMode = env.NATIVE_FEATURE_TEST_MODE === "true";
  const isFlutterDevMode = mode === "flutter-dev";
  const isBuildOutputForFlutter = mode === "production" || isFlutterDevMode;

  return {
    // Flutter WebView(file://)에서 번들 리소스를 상대 경로로 로드하기 위해
    // production/flutter-dev build 시 base를 './'로 설정합니다.
    base: isBuildOutputForFlutter ? "./" : "/",
    plugins: [
      react(),
      tailwindcss(),
      tsconfigPaths(),
      {
        name: "strip-crossorigin-for-flutter-webview",
        apply: "build",
        transformIndexHtml(html) {
          return html.replace(/\s+crossorigin(?=[\s>])/g, "");
        },
      },
    ],
    define: {
      // __NATIVE_TEST_MODE__: isNativeTestMode,

      /** for "apps/game" */
      ECS_NULL_VALUE: 0,
      ECS_CHARACTER_STATUS_LENGTH: 4,
    },
    resolve: {
      alias: {
        "@digivice/game": resolve(__dirname, "../game/src"),
        "@shared/storage": resolve(__dirname, "../../shared/storage/src"),
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
    build: isFlutterDevMode
      ? {
          minify: false,
          cssMinify: false,
          sourcemap: true,
        }
      : undefined,
  };
});
