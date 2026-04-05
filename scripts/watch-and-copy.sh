#!/bin/bash

# Watch 모드로 빌드하고 자동으로 Flutter 자산에 복사하는 스크립트
# apps/game과 apps/client 파일 변경 시 자동으로 재빌드 및 복사가 이루어집니다

set -e

echo "👀 Starting watch mode for Flutter development..."
echo ""
echo "This will:"
echo "  1. Watch for changes in apps/game and apps/client"
echo "  2. Automatically rebuild and copy to virtual_bridge/assets/web/"
echo "  3. Use Flutter hot restart (press 'R' in flutter run) to see changes"
echo ""

# 프로젝트 루트 디렉터리로 이동
cd "$(dirname "$0")/.."

# Flutter assets 디렉터리 경로
FLUTTER_WEB_DIR="virtual_bridge/assets/web"
FLUTTER_WEB_TMP_DIR="virtual_bridge/assets/web.__tmp__"

# 빌드 함수
build_and_copy() {
  echo "🔨 Building..."
  cd apps/client
  
  if pnpm build:flutter:dev 2>&1; then
    cd ../..
    
    # 빌드 결과 존재 확인
    if [ -d "apps/client/dist" ]; then
      # Flutter 번들 안정성을 위해 /ui, /game 리소스를 assets 하위 단일 경로로 이동
      mkdir -p apps/client/dist/assets/ui apps/client/dist/assets/game
      if [ -d "apps/client/dist/ui" ]; then
        rsync -aL apps/client/dist/ui/ apps/client/dist/assets/ui/
        rm -rf apps/client/dist/ui
      fi
      if [ -d "apps/client/dist/game" ]; then
        rsync -aL apps/client/dist/game/ apps/client/dist/assets/game/
        rm -rf apps/client/dist/game
      fi

      echo "📋 Copying to Flutter assets..."
      rm -rf "$FLUTTER_WEB_TMP_DIR"
      mkdir -p "$FLUTTER_WEB_TMP_DIR"
      # -L: 심볼릭 링크를 실제 파일/디렉터리로 복사
      rsync -aL apps/client/dist/ "$FLUTTER_WEB_TMP_DIR/"
      rm -rf "$FLUTTER_WEB_DIR"
      mv "$FLUTTER_WEB_TMP_DIR" "$FLUTTER_WEB_DIR"
      echo "✅ Build complete at $(date '+%H:%M:%S')"
    else
      echo "❌ Build output not found"
    fi
  else
    cd ../..
    echo "❌ Build failed at $(date '+%H:%M:%S')"
  fi
}

# 초기 빌드
echo "🔨 Initial build..."
build_and_copy

echo ""
echo "👀 Watching for changes in apps/game and apps/client..."
echo "   (Press Ctrl+C to stop)"
echo ""

# fswatch가 있으면 사용, 없으면 폴백
if command -v fswatch &> /dev/null; then
  echo "Using fswatch for file watching..."
  echo ""
  
  # apps/game/src와 apps/client/src 감시
  # node_modules, dist 등 제외
  fswatch -r \
    -e "node_modules" \
    -e "dist" \
    -e "\.git" \
    -e "\.DS_Store" \
    apps/game/src \
    apps/client/src | while read file; do
    
    echo ""
    echo "🔄 Change detected: $file"
    build_and_copy
  done
  
else
  # fswatch가 없으면 주기적으로 체크 (폴백)
  echo "⚠️  fswatch not found, using polling mode (slower)"
  echo "   Install with: brew install fswatch"
  echo ""
  
  # 마지막 수정 시간 추적
  get_last_mtime() {
    find apps/game/src apps/client/src -type f -name "*.ts" -o -name "*.tsx" -o -name "*.css" 2>/dev/null | \
      xargs stat -f "%m" 2>/dev/null | sort -n | tail -1
  }
  
  LAST_MTIME=$(get_last_mtime)
  
  while true; do
    sleep 3
    CURRENT_MTIME=$(get_last_mtime)
    
    if [ "$CURRENT_MTIME" != "$LAST_MTIME" ]; then
      echo ""
      echo "🔄 Change detected"
      build_and_copy
      LAST_MTIME=$CURRENT_MTIME
    fi
  done
fi
