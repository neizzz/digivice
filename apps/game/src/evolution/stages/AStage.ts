import { CharacterKey } from "../../types/Character";
import { EvolutionStage } from "../EvolutionStage";
import { CHARACTER_EVOLUTION } from "../../config";

/**
 * A 단계 (유년기, Stage 1) 구현
 */
export class AStage extends EvolutionStage {
  readonly stage: number = 1;
  readonly characterKey: CharacterKey = CharacterKey.BABY;
  readonly evolutionTime: number = CHARACTER_EVOLUTION.BABY_END_TIME;

  /**
   * 다음 단계인 B 단계 반환 (현재는 미구현)
   */
  getNextStage(): EvolutionStage | null {
    // 현재는 A -> B 진화는 구현하지 않음
    return null;
  }

  /**
   * A 단계에서 다음 단계로 진화 가능 여부 확인
   */
  canEvolve(character: any): boolean {
    // 현재는 A 단계에서의 진화는 구현하지 않음
    return false;
  }
}
