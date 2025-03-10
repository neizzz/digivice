import { defineConfig, loadEnv, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import fs from "fs";

// 디버그 플러그인 생성
const createDebugPlugin = (): Plugin => ({
  name: "debug-plugin",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      console.log(`[Debug] Request: ${req.method} ${req.url}`);
      if (req.url?.startsWith("/game/")) {
        console.log(`[Asset] Loading game asset: ${req.url}`);

        // 파일 존재 확인
        const filePath = resolve(__dirname, "public", req.url);
        if (fs.existsSync(filePath)) {
          console.log(`[Asset] File exists at: ${filePath}`);
        } else {
          console.error(`[Asset] File not found: ${filePath}`);
        }
      }
      next();
    });
  },
});

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 환경변수 로드
  const env = loadEnv(mode, process.cwd());

  // 테스트 모드 확인
  const isTestMode = env.NATIVE_FEATURE_TEST_MODE === "true";

  console.log(`Building in ${isTestMode ? "TEST" : "NORMAL"} mode`);

  // 에셋 디버깅: 공용 폴더 내용 확인
  const publicDir = resolve(__dirname, "public");
  const gameDir = resolve(publicDir, "game");

  console.log(">>> Checking directories at startup:");

  if (fs.existsSync(publicDir)) {
    console.log(`Public dir exists: ${publicDir}`);
    console.log(`Contents: ${fs.readdirSync(publicDir).join(", ")}`);
  } else {
    console.error(`Public dir missing: ${publicDir}`);
    // 필요한 경우 디렉토리 생성
    fs.mkdirSync(publicDir, { recursive: true });
    console.log("Created public directory");
  }

  if (fs.existsSync(gameDir)) {
    console.log(`Game dir exists: ${gameDir}`);
    console.log(`Contents: ${fs.readdirSync(gameDir).join(", ")}`);

    // sprites 폴더 확인
    const spritesDir = resolve(gameDir, "sprites");
    if (fs.existsSync(spritesDir)) {
      console.log(`Sprites dir exists: ${spritesDir}`);
      console.log(`Contents: ${fs.readdirSync(spritesDir).join(", ")}`);

      // test-slime 폴더 확인
      const slimeDir = resolve(spritesDir, "test-slime");
      if (fs.existsSync(slimeDir)) {
        console.log(`Slime dir exists: ${slimeDir}`);
        console.log(`Contents: ${fs.readdirSync(slimeDir).join(", ")}`);
      } else {
        console.error(`Slime dir missing: ${slimeDir}`);
      }
    } else {
      console.error(`Sprites dir missing: ${spritesDir}`);
    }
  } else {
    console.error(`Game dir missing: ${gameDir}`);
    // 필요한 경우 게임 디렉토리 생성
    fs.mkdirSync(gameDir, { recursive: true });
    console.log("Created game directory");
  }

  return {
    plugins: [react(), createDebugPlugin()],
    define: {
      __TEST_MODE__: isTestMode,
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
