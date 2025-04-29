/**
 * 게임 디버깅을 위한 플래그 관리 클래스
 */
export class DebugFlags {
  private static instance: DebugFlags;

  // 디버그 플래그 정의
  private flags: {
    preventEating: boolean; // 캐릭터가 음식을 먹지 못하게 함
  };

  // 디버그 플래그 저장용 스토리지 키
  private static readonly STORAGE_KEY = "digivice_debug_flags";

  private constructor() {
    this.flags = {
      preventEating: false,
    };

    // 저장된 설정이 있으면 로드
    this.loadFlags();
    // 콘솔 명령어 설정
    this.setupConsoleCommands();
  }

  /**
   * DebugFlags 싱글톤 인스턴스를 반환
   */
  public static getInstance(): DebugFlags {
    if (!DebugFlags.instance) {
      DebugFlags.instance = new DebugFlags();
    }
    return DebugFlags.instance;
  }

  /**
   * 디버그 콘솔 명령어 설정
   */
  private setupConsoleCommands(): void {
    console.log("디버그 명령어 설정 완료. window.debug 객체를 사용하세요.");
    window.debug = {
      togglePreventEating: () => {
        this.setPreventEating(!this.flags.preventEating);
        return this.flags.preventEating;
      },
      showFlags: () => {
        console.log("현재 디버그 플래그 설정:", this.flags);
      },
    };
  }

  /**
   * 저장된 플래그 설정 로드
   */
  private loadFlags(): void {
    try {
      // 별도의 스토리지 키에서 디버그 플래그 설정 가져오기
      const savedData = localStorage.getItem(DebugFlags.STORAGE_KEY);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        // 저장된 각 플래그 설정을 현재 상태에 적용
        if (parsedData && typeof parsedData === "object") {
          if (typeof parsedData.preventEating === "boolean") {
            this.flags.preventEating = parsedData.preventEating;
          }
          // 새로운 플래그가 추가될 때마다 여기에 로드 로직을 추가
        }
        console.log("디버그 설정을 로드했습니다:", this.flags);
      }
    } catch (error) {
      console.error("디버그 설정을 로드하는 중 오류 발생:", error);
    }
  }

  /**
   * 현재 플래그 설정 저장
   */
  private saveFlags(): void {
    try {
      // 별도의 스토리지 키에 현재 플래그 상태를 저장
      localStorage.setItem(DebugFlags.STORAGE_KEY, JSON.stringify(this.flags));
      console.log("디버그 설정을 저장했습니다.");
    } catch (error) {
      console.error("디버그 설정을 저장하는 중 오류 발생:", error);
    }
  }

  /**
   * 캐릭터 음식 먹기 방지 플래그 확인
   */
  public isEatingPrevented(): boolean {
    return this.flags.preventEating;
  }

  /**
   * 캐릭터 음식 먹기 방지 플래그 설정
   */
  public setPreventEating(value: boolean): void {
    this.flags.preventEating = value;
    console.log(`캐릭터 음식 먹기 방지: ${value ? "활성화" : "비활성화"}`);
    this.saveFlags();
  }
}
