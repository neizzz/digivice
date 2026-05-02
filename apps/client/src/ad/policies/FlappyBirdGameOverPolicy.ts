import type { AdContext, AdDisplayPolicy } from "../AdDisplayPolicy";

/**
 * FlappyBird 게임오버 기반 전면광고 정책
 * 실제 노출 주기와 지연은 GameContainer에서 관리하고,
 * 여기서는 해당 트리거만 허용한다.
 */
export class FlappyBirdGameOverPolicy implements AdDisplayPolicy {
  name = "flappy_bird_game_over";

  async shouldShow(context: AdContext): Promise<boolean> {
    return context.trigger === "flappy_bird_game_over";
  }

  getPriority(): number {
    return 9;
  }
}