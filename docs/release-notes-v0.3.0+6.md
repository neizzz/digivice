# Release Notes v0.3.0+6

## Highlights

- 메인 씬 표현과 상태 UI를 확장했습니다. 스태미나 게이지와 알 부화 금 렌더링을 추가했고, 잔디 타일 바닥색을 단일 톤으로 정리했습니다.
- 캐릭터 회복과 이동 흐름을 다듬었습니다. 수면·회복 오버레이를 개선하고 reentry 자유 이동 경계 반사를 보정했습니다.
- 팝업과 텍스트 UI를 정리했습니다. NeoDunggeunmo 폰트와 팝업 타이포그래피를 적용하고, 설정 팝업 동작·문구와 SetupLayer 이름 입력 UI를 조정했습니다.
- 플래피버드 미니게임의 밸런스와 오디오 전환을 조정했습니다. 난이도 곡선과 BGM 전환감을 함께 보강했습니다.
- 릴리즈 준비 작업을 정리했습니다. 앱 버전을 0.3.0+6으로 동기화하고 Flutter Web 자산을 최신 client, game 변경 기준으로 재동기화했습니다.

## Included Commits

- b177230 fix: 잔디 타일 바닥색 단일 톤으로 통일
- 36f76b4 fix: reentry 자유 이동 경계 반사 보정
- 0462348 feat: 메인 씬 스태미나 게이지 추가
- b4222cd feat: 알 부화 금 렌더링 추가
- 473e0b0 fix: 메인 씬 수면·회복 흐름과 오버레이 개선
- 3d4c0b8 fix: 설정 팝업 동작과 문구 정리
- 042e431 chore: flutter web 자산 동기화
- e0e28c1 feat: apply NeoDunggeunmo font and popup typography
- 6dbeefb feat: tune FlappyBird difficulty and BGM transitions
- ab65d90 chore: sync app version to 0.3.0+6
- 7db40c6 chore: sync flutter web assets
- 2a4ddbc chore: normalize MainScene formatting cleanups
- a2b1c99 fix: SetupLayer 이름 입력 UI 조정

## Validation

- pnpm build
- pnpm --filter @digivice/game test
- flutter analyze lib/main.dart
- flutter build apk --debug

## Tag

- v0.3.0+6
