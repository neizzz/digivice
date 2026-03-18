/**
 * 게임 상태 제공자
 * 광고 정책이 필요한 게임 상태를 제공
 */
export class GameStateProvider {
  /**
   * 캐릭터가 위급 상태인지 확인
   * TODO: 실제 게임 상태와 연결 필요
   */
  static isCharacterUrgent(): boolean {
    // TODO: Game 인스턴스에서 캐릭터 상태 가져오기
    // 예: window.gameInstance?.getCharacterUrgentState()

    // 임시로 false 반환
    return false;
  }

  /**
   * 캐릭터 전체 상태 가져오기
   * TODO: 실제 게임 상태와 연결 필요
   */
  static getCharacterStatus(): {
    isUrgent: boolean;
    stamina?: number;
    health?: number;
  } {
    return {
      isUrgent: this.isCharacterUrgent(),
    };
  }

  /**
   * 게임 메타데이터 가져오기
   * TODO: 필요한 정보 추가
   */
  static getGameMetadata(): Record<string, unknown> {
    return {
      timestamp: Date.now(),
    };
  }
}
