# Release Notes v0.4.0+7

## Highlights

- 플래피버드 미니게임의 체감 플레이를 크게 다듬었습니다. 고득점 구간 파이프 패턴과 near-miss 점수 체계를 확장했고, 지면 충돌·파이프 생성 타이밍·오디오 밸런스·성능까지 함께 보정했습니다.
- 메인 씬 생존/회복 밸런스와 상태 UI를 정리했습니다. 스테미나·진화 게이지 기준을 다시 맞추고, 질병 판정과 수면 회복 흐름을 손봤으며, 상태 아이콘 레이어링과 스테미나 게이지 bevel 표현을 개선했습니다.
- 설정 및 디버그 UI를 정리했습니다. 설정 메뉴 표시와 디버그 뱃지/팝업 흐름을 조정해 플레이 중 표시 일관성을 높였습니다.
- Android 15 대응을 보강했습니다. 시스템 바 deprecated API 경고 우회를 넘어, patched Flutter embedding 패키징과 검증 절차까지 정리해 virtual bridge debug 빌드 안정성을 높였습니다.
- 릴리즈 준비 작업을 반영했습니다. 앱 버전을 0.4.0+7로 동기화했고, green slime A1 스프라이트와 Flutter Web 자산을 최신 상태로 다시 맞췄습니다.

## Included Commits

- 922e5bc fix: Android 15 시스템 바 deprecated API 경고 우회
- 94662c7 fix: FlappyBird 미니게임 렉 완화
- 6764886 fix: FlappyBird BGM 가속 완화
- 47ec8a7 fix: 메인 씬 스테미나·진화 밸런스 조정
- 90968c8 feat: FlappyBird 고득점 파이프 패턴 확장
- ac3edaa feat: FlappyBird near-miss 점수 체계 확장
- f2fe04f fix: 수면 Z 폰트 렌더링 보정
- eb4f6ef fix: 피로도 기반 질병 판정과 수면 회복 보정
- 8d54b5d fix: FlappyBird 지면과 near-miss 표시 보정
- ce5db5c fix: 설정 UI와 디버그 표시 조정
- ff67bea fix: 수면 중 미니게임 진입과 야간 재수면 보정
- fa01de8 fix: FlappyBird 설정 복귀 후 파이프 생성 타이밍 보정
- 8b7376b fix: FlappyBird 미니게임 오디오 볼륨 상향
- 0abb4d7 fix: 상태 아이콘 전면 레이어와 이동 깜빡임 보정
- 21bda3e fix: Android 15 Flutter embedding 패치 패키징 수정
- 6c45f1b fix: 스테미나 게이지 상단 bevel 대칭화
- 12e53ea chore: virtual bridge 웹 에셋 동기화
- a08cfd1 chore: green slime A1 스프라이트 갱신
- 2f2a519 chore: sync app version to 0.4.0+7
- ac1731a chore: sync flutter web assets

## Validation

- node ./apps/game/scripts/run-tests.mjs
- pnpm build
- ./gradlew app:assembleDebug

## Tag

- v0.4.0+7
