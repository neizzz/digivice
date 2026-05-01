#!/bin/bash

# 빌드 및 Flutter 자산 복사 스크립트
# PC와 Flutter 환경을 분리하여 개발하기 위한 빌드 자동화

set -e

echo "🔨 Building client for Flutter..."

BUILD_MODE="${1:-development}"
DEBUG_BUILD_MODE="${2:-normal}"

if [ "$BUILD_MODE" = "development" ]; then
  DEBUG_BUILD_MODE="debug"
fi

if [ "$BUILD_MODE" = "production" ]; then
  NODE_ENV_VALUE="production"
else
  NODE_ENV_VALUE="development"
fi

if [ "$DEBUG_BUILD_MODE" = "debug" ]; then
  NATIVE_FEATURE_DEBUG_MODE_VALUE="true"
else
  NATIVE_FEATURE_DEBUG_MODE_VALUE="false"
fi

APP_LOGO_TEXT_VALUE="${APP_LOGO_TEXT:-}"

if [ "$NATIVE_FEATURE_DEBUG_MODE_VALUE" = "true" ] && [ -z "$APP_LOGO_TEXT_VALUE" ]; then
  APP_LOGO_TEXT_VALUE="DEBUG"
fi

# 프로젝트 루트 디렉터리로 이동
cd "$(dirname "$0")/.."

echo "🔁 Syncing Flutter app version..."
node ./scripts/sync-app-version.mjs

# apps/client 빌드
echo "📦 Building apps/client..."
cd apps/client
pnpm --filter @digivice/game sync-assets && tsc -b && BUILD_FOR_FLUTTER=true NODE_ENV="$NODE_ENV_VALUE" NATIVE_FEATURE_DEBUG_MODE="$NATIVE_FEATURE_DEBUG_MODE_VALUE" APP_LOGO_TEXT="$APP_LOGO_TEXT_VALUE" vite build --mode "$BUILD_MODE"

# 빌드 결과 확인
if [ ! -d "dist" ]; then
  echo "❌ Build failed: dist directory not found"
  exit 1
fi

# Flutter는 assets/web/assets/** 경로를 안정적으로 번들링하므로
# public의 절대경로(/ui, /game) 리소스를 assets 하위 단일 경로로 이동합니다.
mkdir -p dist/assets/ui dist/assets/game
if [ -d "dist/ui" ]; then
  rsync -aL dist/ui/ dist/assets/ui/
  rm -rf dist/ui
fi
if [ -d "dist/game" ]; then
  rsync -aL dist/game/ dist/assets/game/
  rm -rf dist/game
fi

# Flutter assets 디렉터리 경로
FLUTTER_WEB_DIR="../../virtual_bridge/assets/web"
FLUTTER_WEB_TMP_DIR="../../virtual_bridge/assets/web.__tmp__"

# 기존 파일 정리
echo "🧹 Cleaning previous build..."
rm -rf "$FLUTTER_WEB_TMP_DIR"
mkdir -p "$FLUTTER_WEB_TMP_DIR"

# 빌드 결과 복사
echo "📋 Copying build output to Flutter assets..."
# -L: 심볼릭 링크를 실제 파일/디렉터리로 복사
rsync -aL dist/ "$FLUTTER_WEB_TMP_DIR/"

# 원자적 교체: 런타임 중간 상태(비어있는 web 디렉터리) 방지
rm -rf "$FLUTTER_WEB_DIR"
mv "$FLUTTER_WEB_TMP_DIR" "$FLUTTER_WEB_DIR"

echo "✅ Build complete! Files copied to virtual_bridge/assets/web/"
echo "   Mode: $BUILD_MODE"
echo "   Debug features: $NATIVE_FEATURE_DEBUG_MODE_VALUE"
echo "   App logo text: ${APP_LOGO_TEXT_VALUE:-<empty>}"
echo ""
echo "Next steps:"
echo "  1. Run 'flutter run' from virtual_bridge directory"
echo "  2. Or run 'pnpm dev:flutter' to watch for changes"
