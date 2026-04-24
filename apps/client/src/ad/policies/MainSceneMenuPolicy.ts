import type { AdContext, AdDisplayPolicy } from "../AdDisplayPolicy";
import { CooldownCondition } from "../conditions/CooldownCondition";

const DEFAULT_MAIN_SCENE_MENU_COOLDOWN_MS = 5 * 60 * 1000;

function resolveCooldownMs(metadata: Record<string, unknown> | undefined) {
  const cooldownMs = metadata?.cooldownMs;

  if (
    typeof cooldownMs === "number" &&
    Number.isFinite(cooldownMs) &&
    cooldownMs > 0
  ) {
    return cooldownMs;
  }

  return DEFAULT_MAIN_SCENE_MENU_COOLDOWN_MS;
}

/**
 * MainScene 메뉴 사용 기반 전면광고 정책
 * 메뉴 사용 카운트와 액션별 안전 노출 시점은 게임 쪽에서 관리하고,
 * 클라이언트에서는 트리거/쿨다운만 최종 확인한다.
 */
export class MainSceneMenuPolicy implements AdDisplayPolicy {
  name = "main_scene_menu";

  async shouldShow(context: AdContext): Promise<boolean> {
    if (context.trigger !== "main_scene_menu") {
      return false;
    }

    const cooldownMs = resolveCooldownMs(context.metadata);
    const isCooldownSatisfied = await new CooldownCondition(cooldownMs).check(
      context,
    );

    if (!isCooldownSatisfied) {
      console.log("[MainSceneMenuPolicy] Ad blocked by cooldown", {
        cooldownMs,
        metadata: context.metadata,
      });
    }

    return isCooldownSatisfied;
  }

  getPriority(): number {
    return 8;
  }
}
