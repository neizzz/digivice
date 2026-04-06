import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig(() => {
  const isBuildOutputForFlutter = process.env.BUILD_FOR_FLUTTER === "true";

  return {
    // Flutter WebView(file://)에서 번들 리소스를 상대 경로로 로드하기 위해
    // Flutter 자산 빌드에서는 base를 './'로 설정합니다.
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
    build: isBuildOutputForFlutter
      ? {
          minify: false,
          cssMinify: false,
          sourcemap: true,
          // Flutter debug asset bundle은 새로 추가된 해시 파일명을 즉시 인식하지 못할 수 있어
          // Flutter 자산 빌드에서는 파일명을 고정해 hot reload/restart 시 재로딩을 안정화합니다.
          rollupOptions: {
            output: {
              entryFileNames: "assets/[name].js",
              chunkFileNames: "assets/[name].js",
              assetFileNames: "assets/[name][extname]",
            },
          },
        }
      : undefined,
  };
});
