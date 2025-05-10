import type { EvolutionStage } from "./EvolutionStage";
import { EggStage } from "./stages/EggStage";
import { AStage } from "./stages/AStage";
import { EventBus, EventTypes } from "../utils/EventBus";
import { GameDataManager } from "../managers/GameDataManager";

/**
 * 진화 과정을 관리하는 매니저 클래스
 */
export class EvolutionManager {
  private static instance: EvolutionManager;

  // 진화 단계 매핑
  private stageMap: Map<number, EvolutionStage>;

  /**
   * 생성자 - 싱글톤 패턴으로 구현
   */
  private constructor() {
    // 각 진화 단계 등록
    this.stageMap = new Map<number, EvolutionStage>();
    this.registerStage(new EggStage());
    this.registerStage(new AStage());

    // 나머지 단계들 (B, C, D)는 추후 구현 예정
  }

  /**
   * 싱글톤 인스턴스 반환
   */
  public static getInstance(): EvolutionManager {
    if (!EvolutionManager.instance) {
      EvolutionManager.instance = new EvolutionManager();
    }
    return EvolutionManager.instance;
  }

  /**
   * 진화 단계를 맵에 등록
   */
  private registerStage(stage: EvolutionStage): void {
    this.stageMap.set(stage.stage, stage);
  }

  /**
   * 현재 단계의 EvolutionStage 객체 반환
   */
  public getStage(stageNum: number): EvolutionStage | undefined {
    return this.stageMap.get(stageNum);
  }

  /**
   * 진화 시작
   */
  public async startEvolution(character: any): Promise<boolean> {
    const currentStage = character.status.stage;
    const evolutionStage = this.getStage(currentStage);

    if (!evolutionStage) {
      console.error(`알 수 없는 진화 단계: ${currentStage}`);
      return false;
    }

    // 진화 조건 확인
    if (!evolutionStage.canEvolve(character)) {
      console.log("아직 진화 조건을 충족하지 않았습니다.");
      return false;
    }

    // 진화 시작 시간 설정
    const startTime = Date.now();
    evolutionStage.setEvolutionStartTime(character, startTime);

    // 이벤트 발행
    EventBus.publish(EventTypes.EVOLUTION_STARTED, {
      stage: currentStage,
      characterKey: character.key,
      startTime,
    });

    console.log(
      `${character.key} 진화 시작. 예상 완료 시간: ${new Date(
        startTime + evolutionStage.evolutionTime
      )}`
    );

    // 게임 데이터 저장
    const gameData = await GameDataManager.loadData();
    if (gameData) {
      await GameDataManager.saveData(gameData);
    }

    return true;
  }

  /**
   * 진화 체크 (인터벌마다 호출)
   */
  public async checkEvolution(
    character: any,
    currentTime: number
  ): Promise<boolean> {
    // 진화 중인지 확인
    const evolutionStart = character.evolution?.startTime;
    if (!evolutionStart) return false;

    const currentStage = character.status.stage;
    const evolutionStage = this.getStage(currentStage);

    if (!evolutionStage) {
      console.error(`알 수 없는 진화 단계: ${currentStage}`);
      return false;
    }

    // 진화 완료 시간 확인
    const evolutionEndTime = evolutionStage.getEvolutionEndTime(evolutionStart);

    if (currentTime >= evolutionEndTime) {
      // 진화 완료 처리
      const nextStage = evolutionStage.getNextStage();
      if (!nextStage) return false;

      // 캐릭터 상태 업데이트
      character.status.stage = nextStage.stage;
      character.key = nextStage.characterKey;
      character.evolution = null; // 진화 정보 초기화

      // 이벤트 발행
      EventBus.publish(EventTypes.CHARACTER_EVOLVED, {
        newStage: nextStage.stage,
        characterKey: nextStage.characterKey,
      });

      console.log(
        `진화 완료! ${evolutionStage.characterKey} -> ${nextStage.characterKey}`
      );
      return true;
    }

    return false;
  }
}

// 편의를 위한 싱글톤 인스턴스 export
export const evolutionManager = EvolutionManager.getInstance();
