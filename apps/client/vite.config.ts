import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isBuildOutputForFlutter = process.env.BUILD_FOR_FLUTTER === "true";
  const env = loadEnv(mode, __dirname, ["NATIVE_FEATURE_", "APP_"]);
  const isDebugBuild =
    env.NATIVE_FEATURE_DEBUG_MODE === "true" ||
    process.env.NATIVE_FEATURE_DEBUG_MODE === "true";
  const versionConfig = JSON.parse(
    readFileSync(resolve(__dirname, "../../versions/app.json"), "utf-8"),
  ) as { appVersion?: string; buildNumber?: number };

  if (
    typeof versionConfig.appVersion !== "string" ||
    versionConfig.appVersion.trim().length === 0
  ) {
    throw new Error("versions/app.json must define a non-empty appVersion");
  }

  const appBuildNumber = versionConfig.buildNumber;

  if (
    typeof appBuildNumber !== "number" ||
    !Number.isInteger(appBuildNumber) ||
    appBuildNumber <= 0
  ) {
    throw new Error(
      "versions/app.json must define a positive integer buildNumber",
    );
  }

  const appVersion = versionConfig.appVersion;
  const htmlInputs = {
    index: resolve(__dirname, "index.html"),
    "monster-animations": resolve(__dirname, "monster-animations.html"),
  };
  const appVersionLabel = isDebugBuild ? `${appVersion}-debug` : appVersion;
  const appLogoText = (
    env.APP_LOGO_TEXT ||
    process.env.APP_LOGO_TEXT ||
    ""
  ).trim();
  const rewritePublicAssetPath = (url: string): string => {
    if (url.startsWith("/assets/game/")) {
      return url.replace(/^\/assets\/game\//, "/game/");
    }

    if (url.startsWith("/assets/ui/")) {
      return url.replace(/^\/assets\/ui\//, "/ui/");
    }

    return url;
  };

  return {
    // Flutter WebView(file://)에서 번들 리소스를 상대 경로로 로드하기 위해
    // Flutter 자산 빌드에서는 base를 './'로 설정합니다.
    base: isBuildOutputForFlutter ? "./" : "/",
    envPrefix: ["VITE_", "NATIVE_FEATURE_", "APP_"],
    plugins: [
      react(),
      tailwindcss(),
      tsconfigPaths(),
      {
        name: "rewrite-public-asset-paths-for-dev",
        apply: "serve",
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (!req.url) {
              next();
              return;
            }

            req.url = rewritePublicAssetPath(req.url);

            next();
          });
        },
      },
      {
        name: "rewrite-public-asset-paths-for-preview",
        configurePreviewServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (!req.url) {
              next();
              return;
            }

            req.url = rewritePublicAssetPath(req.url);

            next();
          });
        },
      },
      {
        name: "strip-crossorigin-for-flutter-webview",
        apply: "build",
        transformIndexHtml(html) {
          return html.replace(/\s+crossorigin(?=[\s>])/g, "");
        },
      },
    ],
    define: {
      __APP_VERSION__: JSON.stringify(appVersionLabel),
      __APP_BUILD_NUMBER__: JSON.stringify(appBuildNumber),
      __APP_LOGO_TEXT__: JSON.stringify(appLogoText),
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
            input: htmlInputs,
            output: {
              entryFileNames: "assets/[name].js",
              chunkFileNames: "assets/[name].js",
              assetFileNames: "assets/[name][extname]",
            },
          },
        }
      : {
          rollupOptions: {
            input: htmlInputs,
          },
        },
  };
});
