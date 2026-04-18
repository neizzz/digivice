import assert from "node:assert/strict";
import test from "node:test";
import { CharacterStatusComp } from "../raw-components";
import { characterManagerSystem } from "../systems/CharacterManageSystem";
import { GAME_CONSTANTS } from "../config";
import { CharacterState } from "../types";
import {
  createTestCharacter,
  createTestWorld,
  withMockedDateNow,
} from "../../../test-utils/mainSceneTestUtils";

test("깨어있는 캐릭터의 스테미나는 현재 interval 기준으로 감소한다", () => {
  const world = createTestWorld({ now: 10_000 });

  const awakeEid = withMockedDateNow(10_000, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 5,
      x: 80,
      y: 80,
    }),
  );

  characterManagerSystem({
    world: world as any,
    delta: GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL,
  });

  assert.equal(CharacterStatusComp.stamina[awakeEid], 4);
});
