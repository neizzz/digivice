import assert from "node:assert/strict";
import test from "node:test";
import * as PIXI from "pixi.js";
import {
  MainSceneWorld,
  MissingInitialGameDataError,
  type InitialGameData,
} from "../world";

type TestableMainSceneWorld = MainSceneWorld & {
  _requireInitialGameData: (
    initialGameData?: InitialGameData,
  ) => InitialGameData;
};

function createMainSceneWorld(): TestableMainSceneWorld {
  return new MainSceneWorld({
    stage: new PIXI.Container(),
    positionBoundary: {
      x: 0,
      y: 0,
      width: 320,
      height: 320,
    },
  }) as TestableMainSceneWorld;
}

test("초기 세팅 데이터가 없으면 setup 없이 기본 월드를 만들지 않는다", () => {
  const world = createMainSceneWorld();

  assert.throws(() => world._requireInitialGameData(), MissingInitialGameDataError);
  assert.throws(
    () =>
      world._requireInitialGameData({
        name: "   ",
        useLocalTime: true,
      }),
    MissingInitialGameDataError,
  );
});

test("초기 세팅 데이터 이름은 정리된 값으로 사용한다", () => {
  const world = createMainSceneWorld();

  assert.deepEqual(
    world._requireInitialGameData({
      name: "  Toto  ",
      useLocalTime: false,
      cachedSunTimes: null,
    }),
    {
      name: "Toto",
      useLocalTime: false,
      cachedSunTimes: null,
    },
  );
});