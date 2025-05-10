import type { CharacterKey } from "../types/Character";

/**
 * 진화 단계를 나타내는 기본 클래스
 */
export abstract class EvolutionStage {
  // 진화 단계 번호
  abstract readonly stage: number;

  // 해당 단계의 캐릭터 키
  abstract readonly characterKey: CharacterKey;

  // 진화에 필요한 시간 (ms)
  abstract readonly evolutionTime: number;

  // 다음 진화 단계 반환
  abstract getNextStage(): EvolutionStage | null;

  // 진화 조건 충족 여부 확인
  abstract canEvolve(character: any): boolean;

  // 진화 시작 타임스탬프 설정
  setEvolutionStartTime(character: any, startTime: number): void {
    if (!character.evolution) {
      character.evolution = {};
    }
    character.evolution.startTime = startTime;
  }

  // 진화 완료 시간 계산
  getEvolutionEndTime(startTime: number): number {
    return startTime + this.evolutionTime;
  }

  // 진화 프로세스 완료
  completeEvolution(character: any): void {
    const nextStage = this.getNextStage();
    if (!nextStage) return;

    // 캐릭터 상태 업데이트
    character.status.stage = nextStage.stage;
    character.key = nextStage.characterKey;
    character.evolution = null; // 진화 정보 초기화
  }
}
