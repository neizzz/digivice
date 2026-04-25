class AndroidOverlayController {
  AndroidOverlayController() {
    // PIP/overlay 기능은 현재 미사용 상태입니다.
    // 기존 JS bridge 구조를 유지하기 위해 controller 코드만 남겨둡니다.
  }

  /// PIP/overlay 의존성을 제거한 상태에서는 no-op입니다.
  Future<void> showOverlay() async {}

  Future<void> closeOverlay() async {}
}
