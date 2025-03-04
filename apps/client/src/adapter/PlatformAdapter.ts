/**
 * 네이티브 플랫폼 정보에 접근하는 어댑터 클래스
 * User Agent 문자열을 파싱하여 플랫폼을 감지합니다.
 */
export class PlatformAdapter {
  private readonly userAgent: string;

  constructor() {
    this.userAgent = navigator.userAgent;
  }

  /**
   * 현재 플랫폼이 Android인지 확인
   */
  isAndroid(): boolean {
    return this.userAgent.includes("DigiviceApp-Android");
  }

  /**
   * 현재 플랫폼이 iOS인지 확인
   */
  isIOS(): boolean {
    return this.userAgent.includes("DigiviceApp-iOS");
  }

  /**
   * 현재 플랫폼 이름 반환
   * User Agent 문자열에서 DigiviceApp- 뒤의 플랫폼 이름을 추출합니다.
   */
  getPlatformName(): string {
    const matches = this.userAgent.match(/DigiviceApp-([^;]+)/);
    return matches ? matches[1] : "unknown";
  }

  /**
   * 웹앱이 Flutter 웹뷰 내에서 실행 중인지 확인
   */
  isRunningInNativeApp(): boolean {
    return this.userAgent.includes("DigiviceApp");
  }
}
