import { CharacterKey } from "../../types/Character";
import { EvolutionStage } from "../EvolutionStage";
import { CHARACTER_EVOLUTION } from "../../config";
import { AStage } from "./AStage";

/**
 * 알 단계 (Stage 0) 구현
 */
export class EggStage extends EvolutionStage {
  readonly stage: number = 0;
  readonly characterKey: CharacterKey = CharacterKey.EGG;
  readonly evolutionTime: number = CHARACTER_EVOLUTION.EGG_END_TIME;

  /**
   * 다음 단계인 A 단계(유년기) 반환
   */
  getNextStage(): EvolutionStage {
    return new AStage();
  }

  /**
   * 알이 부화할 수 있는 조건 확인 (간단하게 항상 true 반환)
   */
  canEvolve(character: any): boolean {
    return true; // 알은 항상 부화 가능
  }
}
