import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 환경변수 로드
  const env = loadEnv(mode, process.cwd());

  // 테스트 모드 확인
  const isTestMode = env.NATIVE_FEATURE_TEST_MODE === "true";

  console.log(`Building in ${isTestMode ? "TEST" : "NORMAL"} mode`);

  return {
    plugins: [react()],
    define: {
      // 클라이언트에서 사용하기 위해 전역 변수로 설정 (선택사항)
      __TEST_MODE__: isTestMode,
    },
  };
});
