# Release Notes v0.2.0+5

## Highlights

- 플래피버드 미니게임 UX를 확장했습니다. 게임오버 레이어, 설정 레이어, 카운트다운, 단계형 난이도, BGM/SFX 제어, 최고 점수 저장과 광고 연동을 추가했습니다.
- 메인씬 월드 복원과 시간대 연출을 보강했습니다. 저장 데이터 sanitize에 mini_game_scores를 포함하고, 캐릭터 자유 이동 복원, 똥 배치 폴백, 병원 회복 후 stale destination 정리, 상태 아이콘 렌더 검증을 추가했습니다.
- 시간대별 grass tile과 배경 텍스처를 추가하고, 해 뜸/해 짐 전환 창을 20분에서 60분으로 확장했습니다.
- 네이티브 브리지 릴리즈 설정을 정리했습니다. 앱 버전을 0.2.0+5로 동기화하고, release에서 Android WebView 디버깅을 비활성화했으며, iOS Release/Profile plist를 분리하고 뒤로가기 처리를 웹 앱 우선으로 위임합니다.
- Flutter WebView 번들과 복제 자산을 최신 client, game 변경 기준으로 재동기화했습니다.

## Included Commits

- 13258b1 feat: 플래피버드 미니게임 UX 확장
- f0ca800 fix: 메인씬 월드 복원과 시간대 배경 보정
- f6e0d7e fix: 네이티브 브리지 릴리즈 설정 보정
- 0446695 chore: flutter web assets 동기화

## Validation

- pnpm build
- pnpm --filter @digivice/game test
- flutter analyze lib/main.dart

## Tag

- v0.2.0+5