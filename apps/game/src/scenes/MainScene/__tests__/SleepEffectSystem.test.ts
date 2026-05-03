import assert from "node:assert/strict";
import test from "node:test";
import * as PIXI from "pixi.js";
import { ObjectComp } from "../raw-components";
import {
  cleanupSleepEffectStateForTests,
  sleepEffectSystem,
} from "../systems/SleepEffectSystem";
import { CharacterState } from "../types";
import { MainSceneWorld } from "../world";
import {
  createTestCharacter,
  createTestWorld,
  type TestWorld,
  withMockedDateNow,
} from "../../../test-utils/mainSceneTestUtils";
import { getCharacterVerticalBounds } from "../systems/CharacterDisplayBounds";

type SleepEffectTestWorld = TestWorld & {
  stage: PIXI.Container;
  isSleepDebugEffectEnabled: () => boolean;
};

const EXPECTED_GRADIENT_COLORS = ["#1f4f8fff", "#7dcfffff"] as const;
const EXPECTED_MEDIUM_Z_FONT_SIZE = 16.2;
const EXPECTED_LARGE_Z_FONT_SIZE = 19.44;
const EXPECTED_SLEEP_OFFSET_X = -6;
const EXPECTED_SLEEP_OFFSET_Y = 4;
const EXPECTED_MEDIUM_Z_OFFSET_Y = -10;
const EXPECTED_LARGE_Z_OFFSET_Y = -24;

class MockCanvasRenderingContext2D {
  public canvas: HTMLCanvasElement | null = null;
  public font = "10px sans-serif";
  public textBaseline = "alphabetic";
  public lineJoin = "miter";
  public miterLimit = 10;
  public lineWidth = 1;
  public fillStyle: string | CanvasGradient | CanvasPattern = "#000000";
  public strokeStyle: string | CanvasGradient | CanvasPattern = "#000000";
  public globalCompositeOperation = "source-over";

  public save(): void {}
  public restore(): void {}
  public scale(_x: number, _y: number): void {}
  public translate(_x: number, _y: number): void {}
  public transform(
    _a: number,
    _b: number,
    _c: number,
    _d: number,
    _e: number,
    _f: number,
  ): void {}
  public setTransform(
    _a: number,
    _b: number,
    _c: number,
    _d: number,
    _e: number,
    _f: number,
  ): void {}
  public resetTransform(): void {}
  public clearRect(_x: number, _y: number, _w: number, _h: number): void {}
  public fillRect(_x: number, _y: number, _w: number, _h: number): void {}
  public strokeRect(_x: number, _y: number, _w: number, _h: number): void {}
  public beginPath(): void {}
  public closePath(): void {}
  public moveTo(_x: number, _y: number): void {}
  public lineTo(_x: number, _y: number): void {}
  public rect(_x: number, _y: number, _w: number, _h: number): void {}
  public clip(): void {}
  public fill(): void {}
  public stroke(): void {}
  public strokeText(_text: string, _x: number, _y: number): void {}
  public fillText(_text: string, _x: number, _y: number): void {}
  public setLineDash(_segments: number[]): void {}
  public createPattern(
    _image: unknown,
    _repetition: string | null,
  ): CanvasPattern | null {
    return null;
  }

  public createLinearGradient(
    _x0: number,
    _y0: number,
    _x1: number,
    _y1: number,
  ): CanvasGradient {
    return {
      addColorStop: (_offset: number, _color: string) => {},
    } as CanvasGradient;
  }

  public createRadialGradient(
    _x0: number,
    _y0: number,
    _r0: number,
    _x1: number,
    _y1: number,
    _r1: number,
  ): CanvasGradient {
    return {
      addColorStop: (_offset: number, _color: string) => {},
    } as CanvasGradient;
  }

  public measureText(text: string): TextMetrics {
    const fontSizeMatch = /(\d+(?:\.\d+)?)px/.exec(this.font);
    const fontSize = fontSizeMatch ? Number(fontSizeMatch[1]) : 10;

    return {
      width: text.length * fontSize * 0.7,
      actualBoundingBoxAscent: fontSize * 0.8,
      actualBoundingBoxDescent: fontSize * 0.2,
      fontBoundingBoxAscent: fontSize * 0.8,
      fontBoundingBoxDescent: fontSize * 0.2,
    } as TextMetrics;
  }
}

class MockCanvasElement {
  public width = 0;
  public height = 0;
  public style = {};
  private readonly context = new MockCanvasRenderingContext2D();

  public constructor() {
    this.context.canvas = this as unknown as HTMLCanvasElement;
  }

  public getContext(contextId: string): CanvasRenderingContext2D | null {
    if (contextId !== "2d") {
      return null;
    }

    return this.context as unknown as CanvasRenderingContext2D;
  }

  public toDataURL(): string {
    return "";
  }
}

function createMockCanvas(): HTMLCanvasElement {
  return new MockCanvasElement() as unknown as HTMLCanvasElement;
}

function withMockedCanvasDocument<T>(fn: () => T): T {
  const globalWithDocument = globalThis as typeof globalThis & {
    document?: Document;
    CanvasRenderingContext2D?: typeof CanvasRenderingContext2D;
    HTMLCanvasElement?: typeof HTMLCanvasElement;
  };
  const previousDocument = globalWithDocument.document;
  const previousCanvasRenderingContext2D =
    globalWithDocument.CanvasRenderingContext2D;
  const previousHTMLCanvasElement = globalWithDocument.HTMLCanvasElement;

  globalWithDocument.CanvasRenderingContext2D =
    MockCanvasRenderingContext2D as unknown as typeof CanvasRenderingContext2D;
  globalWithDocument.HTMLCanvasElement =
    MockCanvasElement as unknown as typeof HTMLCanvasElement;

  globalWithDocument.document = {
    createElement: (tagName: string) => {
      if (tagName === "canvas") {
        return createMockCanvas();
      }

      return {
        style: {},
      } as unknown as HTMLElement;
    },
  } as Document;

  try {
    return fn();
  } finally {
    if (previousDocument) {
      globalWithDocument.document = previousDocument;
    } else {
      delete globalWithDocument.document;
    }

    if (previousCanvasRenderingContext2D) {
      globalWithDocument.CanvasRenderingContext2D =
        previousCanvasRenderingContext2D;
    } else {
      delete globalWithDocument.CanvasRenderingContext2D;
    }

    if (previousHTMLCanvasElement) {
      globalWithDocument.HTMLCanvasElement = previousHTMLCanvasElement;
    } else {
      delete globalWithDocument.HTMLCanvasElement;
    }
  }
}

function createSleepEffectWorld(now = 0): SleepEffectTestWorld {
  const world = createTestWorld({ now }) as SleepEffectTestWorld;

  world.stage = new PIXI.Container();
  world.isSleepDebugEffectEnabled = () => true;

  return world;
}

function runSleepEffectSystem(world: SleepEffectTestWorld, now: number): void {
  withMockedDateNow(now, () => {
    sleepEffectSystem({
      world: world as unknown as MainSceneWorld,
      delta: 16,
      stage: world.stage,
    });
  });
}

function getSleepEffectContainer(world: SleepEffectTestWorld): PIXI.Container {
  assert.equal(world.stage.children.length, 1);

  const container = world.stage.children[0];

  assert.ok(container instanceof PIXI.Container);
  return container;
}

function getRenderedSleepLetters(world: SleepEffectTestWorld): PIXI.Text[] {
  const container = getSleepEffectContainer(world);

  return container.children.map((child) => {
    assert.ok(child instanceof PIXI.Text);
    return child;
  });
}

function getRenderedSleepLetterPositions(
  world: SleepEffectTestWorld,
): Array<{ x: number; y: number }> {
  const container = getSleepEffectContainer(world);

  return getRenderedSleepLetters(world).map((letter) => ({
    x: container.x + letter.x,
    y: container.y + letter.y,
  }));
}

function assertSleepLetterStyle(letter: PIXI.Text): void {
  assert.equal(letter.text, "Z");
  assert.ok(letter.style.fill instanceof PIXI.FillGradient);
  assert.equal(letter.style.fill.type, "linear");
  assert.deepEqual(
    letter.style.fill.colorStops.map((stop) => stop.color),
    EXPECTED_GRADIENT_COLORS,
  );
  assert.equal(letter.style.stroke?.color, 0x000000);
  assert.equal(letter.style.stroke?.width, 1);
}

function assertRenderedLetterOffsetYs(
  letters: PIXI.Text[],
  expectedOffsetYs: number[],
): void {
  const expectedMaxBottom = Math.max(
    ...letters.map(
      (letter, index) => expectedOffsetYs[index] + letter.height,
    ),
  );

  expectedOffsetYs.forEach((expectedOffsetY, index) => {
    assert.equal(letters[index].y, expectedOffsetY - expectedMaxBottom);
  });
}

function withSleepEffectWorld(fn: (world: SleepEffectTestWorld) => void): void {
  cleanupSleepEffectStateForTests();

  try {
    withMockedCanvasDocument(() => {
      fn(createSleepEffectWorld());
    });
  } finally {
    cleanupSleepEffectStateForTests();
  }
}

test("수면 이펙트는 대문자 Z를 1개, 2개, 3개, 0개 순서로 반복 렌더링한다", () => {
  withSleepEffectWorld((world) => {
    const eid = createTestCharacter(world, {
      state: CharacterState.SLEEPING,
      x: 120,
      y: 100,
    });

    runSleepEffectSystem(world, 0);
    assert.equal(getRenderedSleepLetters(world).length, 1);
    getRenderedSleepLetters(world).forEach(assertSleepLetterStyle);
    const oneLetterPositions = getRenderedSleepLetterPositions(world);
    const sleepContainer = getSleepEffectContainer(world);
    const { topY } = getCharacterVerticalBounds(eid);

    assert.equal(sleepContainer.x, 120 + EXPECTED_SLEEP_OFFSET_X);
    assert.equal(sleepContainer.y, topY + EXPECTED_SLEEP_OFFSET_Y);

    runSleepEffectSystem(world, 1000);
    const twoLetters = getRenderedSleepLetters(world);
    assert.equal(twoLetters.length, 2);
    twoLetters.forEach(assertSleepLetterStyle);
    assert.equal(twoLetters[1].style.fontSize, EXPECTED_MEDIUM_Z_FONT_SIZE);
    assertRenderedLetterOffsetYs(twoLetters, [0, EXPECTED_MEDIUM_Z_OFFSET_Y]);
    const twoLetterPositions = getRenderedSleepLetterPositions(world);
    assert.deepEqual(twoLetterPositions[0], oneLetterPositions[0]);

    runSleepEffectSystem(world, 2000);
    const threeLetters = getRenderedSleepLetters(world);
    assert.equal(threeLetters.length, 3);
    threeLetters.forEach(assertSleepLetterStyle);
    assert.equal(threeLetters[1].style.fontSize, EXPECTED_MEDIUM_Z_FONT_SIZE);
    assert.equal(threeLetters[2].style.fontSize, EXPECTED_LARGE_Z_FONT_SIZE);
    assertRenderedLetterOffsetYs(threeLetters, [
      0,
      EXPECTED_MEDIUM_Z_OFFSET_Y,
      EXPECTED_LARGE_Z_OFFSET_Y,
    ]);
    const threeLetterPositions = getRenderedSleepLetterPositions(world);
    assert.deepEqual(threeLetterPositions[0], oneLetterPositions[0]);
    assert.deepEqual(threeLetterPositions[1], twoLetterPositions[1]);

    runSleepEffectSystem(world, 3000);
    assert.equal(getRenderedSleepLetters(world).length, 0);

    runSleepEffectSystem(world, 4000);
    assert.equal(getRenderedSleepLetters(world).length, 1);
    getRenderedSleepLetters(world).forEach(assertSleepLetterStyle);
  });
});

test("수면 상태가 끝나면 수면 이펙트 컨테이너를 제거한다", () => {
  withSleepEffectWorld((world) => {
    const eid = createTestCharacter(world, {
      state: CharacterState.SLEEPING,
      x: 120,
      y: 100,
    });

    runSleepEffectSystem(world, 0);
    assert.equal(world.stage.children.length, 1);

    ObjectComp.state[eid] = CharacterState.IDLE;
    runSleepEffectSystem(world, 1000);

    assert.equal(world.stage.children.length, 0);
  });
});