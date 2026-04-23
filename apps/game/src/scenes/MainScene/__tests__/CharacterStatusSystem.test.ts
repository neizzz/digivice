import assert from "node:assert/strict";
import test from "node:test";
import { hasComponent } from "bitecs";
import {
  AnimationRenderComp,
  CharacterStatusComp,
  ObjectComp,
  RenderComp,
  SpeedComp,
  VitalityComp,
} from "../raw-components";
import { characterStatusSystem } from "../systems/CharacterStatusSystem";
import {
  getUrgentDeathDelayMsByCharacterKey,
} from "../config";
import {
  CharacterKeyECS,
  CharacterState,
  CharacterStatus,
  TextureKey,
} from "../types";
import {
  createTestCharacter,
  createTestWorld,
  withMockedDateNow,
} from "../../../test-utils/mainSceneTestUtils";

test("스테미나 0은 URGENT와 deathTime을 만들고 deathTime을 넘기면 tomb 상태가 된다", () => {
  const world = createTestWorld({ now: 5_000 });
  const eid = withMockedDateNow(5_000, () =>
    createTestCharacter(world, {
      state: CharacterState.IDLE,
      stamina: 5,
    }),
  );

  CharacterStatusComp.stamina[eid] = 0;

  characterStatusSystem({
    world: world as any,
    currentTime: 5_000,
  });

  assert.ok(Array.from(CharacterStatusComp.statuses[eid]).includes(CharacterStatus.URGENT));
  assert.equal(VitalityComp.urgentStartTime[eid], 5_000);
  assert.equal(
    VitalityComp.deathTime[eid],
    5_000 + getUrgentDeathDelayMsByCharacterKey(CharacterKeyECS.TestGreenSlimeA1),
  );

  characterStatusSystem({
    world: world as any,
    currentTime:
      5_000 +
      getUrgentDeathDelayMsByCharacterKey(CharacterKeyECS.TestGreenSlimeA1),
  });

  assert.equal(ObjectComp.state[eid], CharacterState.DEAD);
  assert.equal(VitalityComp.isDead[eid], 1);
  assert.equal(RenderComp.textureKey[eid], TextureKey.TOMB);
  assert.equal(SpeedComp.value[eid], 0);
  assert.equal(hasComponent(world, AnimationRenderComp, eid), false);
});

test("캐릭터 class가 높을수록 urgent death delay가 길어진다", () => {
  const world = createTestWorld({ now: 10_000 });
  const characterKeys = [
    CharacterKeyECS.TestGreenSlimeA1,
    CharacterKeyECS.TestGreenSlimeB1,
    CharacterKeyECS.TestGreenSlimeC1,
    CharacterKeyECS.TestGreenSlimeD1,
  ] as const;

  const eids = characterKeys.map((characterKey, index) =>
    withMockedDateNow(10_000 + index, () =>
      createTestCharacter(world, {
        state: CharacterState.IDLE,
        stamina: 0,
        x: 100 + index * 40,
        y: 100,
        characterKey,
      }),
    ),
  );

  characterStatusSystem({
    world: world as any,
    currentTime: 10_000,
  });

  eids.forEach((eid, index) => {
    assert.equal(
      VitalityComp.deathTime[eid],
      10_000 + getUrgentDeathDelayMsByCharacterKey(characterKeys[index]),
    );
  });
});

test("잠자는 동안에는 urgent death countdown이 진행되지 않는다", () => {
  const world = createTestWorld({ now: 1_000 });
  const eid = withMockedDateNow(1_000, () =>
    createTestCharacter(world, {
      state: CharacterState.SLEEPING,
      stamina: 0,
      characterKey: CharacterKeyECS.TestGreenSlimeA1,
    }),
  );

  characterStatusSystem({
    world: world as any,
    currentTime: 1_000,
  });

  const initialDeathTime = VitalityComp.deathTime[eid];

  characterStatusSystem({
    world: world as any,
    currentTime: 4_000,
  });

  assert.equal(VitalityComp.deathTime[eid], initialDeathTime + 3_000);
  assert.equal(ObjectComp.state[eid], CharacterState.SLEEPING);

  ObjectComp.state[eid] = CharacterState.IDLE;

  characterStatusSystem({
    world: world as any,
    currentTime: 4_000,
  });

  characterStatusSystem({
    world: world as any,
    currentTime: initialDeathTime + 3_000,
  });

  assert.equal(ObjectComp.state[eid], CharacterState.DEAD);
});
