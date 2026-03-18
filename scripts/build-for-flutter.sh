#!/bin/bash

# 빌드 및 Flutter 자산 복사 스크립트
# PC와 Flutter 환경을 분리하여 개발하기 위한 빌드 자동화

set -e

echo "🔨 Building client for Flutter..."

# 프로젝트 루트 디렉터리로 이동
cd "$(dirname "$0")/.."

# apps/client 빌드
echo "📦 Building apps/client..."
cd apps/client
pnpm build

# 빌드 결과 확인
if [ ! -d "dist" ]; then
  echo "❌ Build failed: dist directory not found"
  exit 1
fi

# Flutter assets 디렉터리 경로
FLUTTER_WEB_DIR="../../virtual_bridge/assets/web"

# 기존 파일 정리
echo "🧹 Cleaning previous build..."
rm -rf "$FLUTTER_WEB_DIR"
mkdir -p "$FLUTTER_WEB_DIR"

# 빌드 결과 복사
echo "📋 Copying build output to Flutter assets..."
cp -r dist/* "$FLUTTER_WEB_DIR/"

echo "✅ Build complete! Files copied to virtual_bridge/assets/web/"
echo ""
echo "Next steps:"
echo "  1. Run 'flutter run' from virtual_bridge directory"
echo "  2. Or run 'pnpm dev:flutter' to watch for changes"
