# Web Resource Loading Flow (Flutter WebView)

## 목적
이 문서는 현재 프로젝트에서 웹 리소스가 생성, 복사, 패키징, 런타임 서빙되는 실제 흐름을 정리합니다.

## 전체 파이프라인 요약
1. 게임 에셋 동기화
2. 클라이언트 번들 빌드
3. Flutter용 경로 정규화(/assets 하위)
4. virtual_bridge/assets/web로 원자적 복사
5. Flutter 에셋 번들 포함(pubspec)
6. 앱 런타임에서 로컬 HTTP 서버(127.0.0.1)로 WebView 서빙

---

## 1) 소스 에셋 동기화
기준 파일: apps/game/package.json

- sync-assets 스크립트가 apps/game/assets 를 apps/client/public/game 로 동기화합니다.
- 현재 스크립트는 아래 방식입니다.
  - rsync -aL --delete
- 의미:
  - -aL: 심볼릭 링크를 실제 파일로 복사
  - --delete: 삭제된 에셋도 public 쪽에서 정리

결과:
- 게임 원본 에셋 변경이 클라이언트 public 경로에 반영됩니다.

---

## 2) 클라이언트 빌드
기준 파일: apps/client/package.json

- build 명령은 아래 순서로 실행됩니다.
  1) @digivice/game sync-assets
  2) tsc -b
  3) vite build

결과:
- apps/client/dist 생성
- 정적 리소스(JS/CSS, public 파일)가 dist에 포함

---

## 3) Flutter용 경로 정규화
기준 파일:
- scripts/build-for-flutter.sh
- scripts/watch-and-copy.sh

핵심 규칙:
- 런타임 요청 경로를 /assets/game/**, /assets/ui/** 로 통일
- dist/game, dist/ui 리소스를 dist/assets/game, dist/assets/ui 로 이동

이유:
- Flutter 번들/런타임 경로를 단일 규칙으로 유지하기 위함

---

## 4) Flutter 웹 자산 복사 (원자적 교체)
기준 파일:
- scripts/build-for-flutter.sh
- scripts/watch-and-copy.sh

동작:
1. 임시 디렉터리 web.__tmp__ 에 먼저 복사
2. 완료 후 web 디렉터리로 교체(mv)

이유:
- watch 중간에 web 디렉터리가 비어 404가 나는 타이밍 이슈 방지

---

## 5) Flutter 에셋 패키징
기준 파일: virtual_bridge/pubspec.yaml

등록 경로:
- assets/web/
- assets/web/assets/
- assets/web/assets/game/**
- assets/web/assets/ui/**
- 일부 몬스터 스프라이트 파일은 명시 등록(누락 방지)

주의:
- pubspec 변경 후에는 반드시 flutter clean + flutter pub get + 재실행 필요

---

## 6) 앱 런타임 서빙 (WebView)
기준 파일: virtual_bridge/lib/main.dart

동작:
1. 앱 시작 시 HttpServer를 127.0.0.1 임의 포트로 바인딩
2. WebView가 http://127.0.0.1:{port}/index.html 로 진입
3. 요청 path를 rootBundle 키 후보로 변환 후 순차 로드

현재 후보 규칙:
- 기본: assets/web{requestPath}
- requestPath가 /assets/ 로 시작하면 추가 후보:
  - assets/web/assets{requestPath에서 /assets 제거한 경로}
  - assets/web{requestPath에서 /assets 제거한 경로}

특수 처리:
- /favicon.ico 는 204 응답(필수 리소스 아님)
- SPA 라우팅 path(확장자 없음)는 index.html 폴백

---

## 7) 404 디버깅 로그
기준 파일: virtual_bridge/lib/main.dart

로그 마커:
- @@ASSET404@@ request=... tried=...

특징:
- 동일 path는 1회만 출력(Set dedupe)
- WebView 콘솔 포워딩은 기본 비활성화(터미널 폭주 방지)

옵션:
- _stopAppOnAsset404 를 true로 두면 첫 404에서 즉시 종료하여 원인 파악 가능

---

## 8) 자주 발생한 실제 원인
1. JSON의 image 파일명 오타
- 예: foods.json 이 food.png 를 가리킴 (실파일은 foods.png)

2. watch 복사 중간 타이밍
- 디렉터리 비우는 순간 WebView가 요청해 404
- 원자적 교체로 해결

3. 경로 규칙 혼용
- /game, /ui, /assets/game, /assets/ui 혼재
- 현재는 /assets 하위로 통일

---

## 9) 문제 발생 시 체크리스트
1. apps/client 에서 build:flutter 다시 수행
2. virtual_bridge 에서 flutter clean
3. virtual_bridge 에서 flutter pub get
4. flutter run 재실행
5. @@ASSET404@@ 로그에서 request, tried 확인
6. tried 경로 중 실제 파일 존재 여부를 source -> public -> dist -> virtual_bridge/assets/web 순서로 점검

---

## 10) 운영 권장
- 평소에는 _stopAppOnAsset404 = false
- 집중 디버깅 시에만 true
- console 포워딩은 기본 false 유지
