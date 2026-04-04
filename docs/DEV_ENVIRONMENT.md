# 개발 환경 가이드

이 프로젝트는 PC 브라우저와 Flutter 네이티브 환경을 분리하여 개발합니다.

## 빠른 시작

### PC에서 UI/게임 개발 (HMR 지원)

```bash
cd apps/client
pnpm dev
# 브라우저에서 localhost:5173 접속
```

### Flutter에서 네이티브 기능 테스트

**Watch 모드 (권장):**

```bash
# 터미널 1: 자동 빌드 (apps/game + apps/client 감시)
cd apps/client
pnpm dev:flutter

# 터미널 2: Flutter 실행
cd virtual_bridge
flutter run
# 코드 변경 후 'R' 키로 Hot Restart
```

> 💡 **apps/game과 apps/client 모두 자동 감지됩니다**  
> 어느 쪽을 수정해도 자동으로 재빌드 및 복사가 이루어집니다.

**수동 빌드:**

```bash
cd apps/client
pnpm build:flutter

cd virtual_bridge
flutter run
```

## 환경 구분

| 환경            | 특징                                                                     | 사용 시기          |
| --------------- | ------------------------------------------------------------------------ | ------------------ |
| **PC 브라우저** | ✅ HMR 지원<br>✅ 빠른 개발<br>❌ 네이티브 기능 없음                     | UI, 게임 로직 개발 |
| **Flutter 앱**  | ✅ 네이티브 기능 사용 가능<br>✅ 실제 환경 테스트<br>⚠️ Hot Restart 필요 | NFC, PiP 등 테스트 |

## 주요 특징

- ✅ **완전 오프라인 동작** — 네트워크 연결 불필요
- ✅ **User Agent 기반 환경 감지** — 런타임에 자동 구분
- ✅ **개발 환경 배지** — PC에서만 표시 (Flutter는 숨김)
- ✅ **네이티브 기능 경고** — PC에서 사용 시 명확한 안내
- ✅ **apps/game + apps/client 자동 감지** — 모노레포 전체 watch 지원

## 스크립트

| 명령어               | 설명                       |
| -------------------- | -------------------------- |
| `pnpm dev`           | PC 브라우저 개발 서버 시작 |
| `pnpm build:flutter` | Flutter용 빌드 (일회성)    |
| `pnpm dev:flutter`   | Watch 모드로 자동 재빌드   |

## 트러블슈팅

**웹뷰가 빈 화면인 경우:**

```bash
cd apps/client
pnpm build:flutter
cd ../virtual_bridge
flutter run
```

**NFC 기능 에러가 발생하는 경우:**

- PC 브라우저에서는 정상입니다 (경고 alert 표시)
- Flutter 앱에서 테스트하세요

**Watch 모드가 느린 경우:**

```bash
brew install fswatch  # 성능 향상
```

## 더 자세한 정보

자세한 아키텍처 및 구현 상세는 `/memories/repo/dev-environment-setup.md` 참고
