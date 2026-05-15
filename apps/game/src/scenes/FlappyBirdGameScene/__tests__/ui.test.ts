import assert from "node:assert/strict";
import test from "node:test";
import * as PIXI from "pixi.js";
import {
  CountdownUI,
  preloadFlappyBirdRetroFont,
  resetFlappyBirdRetroFontLoadStateForTest,
  ScoreUI,
} from "../ui";

function getScoreUIFontFamilies(scoreUI: ScoreUI): string[][] {
  const textNodes = scoreUI
    .getDisplayObject()
    .children.filter((child): child is PIXI.Text => child instanceof PIXI.Text);

  return textNodes.map((text) => {
    const { fontFamily } = text.style;
    return Array.isArray(fontFamily) ? [...fontFamily] : [fontFamily];
  });
}

function getTextFontFamilies(text: PIXI.Text): string[] {
  const { fontFamily } = text.style;
  return Array.isArray(fontFamily) ? [...fontFamily] : [fontFamily];
}

function installMockDocumentFonts(params: {
  isLoaded: () => boolean;
  load: () => Promise<unknown>;
}): () => void {
  const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "document",
  );

  Object.defineProperty(globalThis, "document", {
    value: {
      fonts: {
        check: params.isLoaded,
        load: params.load,
      },
    },
    configurable: true,
  });

  return () => {
    if (originalDocumentDescriptor) {
      Object.defineProperty(globalThis, "document", originalDocumentDescriptor);
      return;
    }

    delete (globalThis as { document?: Document }).document;
  };
}

test("ScoreUI는 NeoDunggeunmo 로드 전에는 best와 score 모두 fallback 폰트를 유지한다", () => {
  const restoreDocumentFonts = installMockDocumentFonts({
    isLoaded: () => false,
    load: () => new Promise(() => undefined),
  });

  try {
    const scoreUI = new ScoreUI(12);
    scoreUI.addScore(1);

    const [bestFontFamilies, scoreFontFamilies] =
      getScoreUIFontFamilies(scoreUI);

    assert.deepEqual(bestFontFamilies, scoreFontFamilies);
    assert.notEqual(bestFontFamilies[0], "NeoDunggeunmo Pro");
  } finally {
    resetFlappyBirdRetroFontLoadStateForTest();
    restoreDocumentFonts();
  }
});

test("ScoreUI는 NeoDunggeunmo 로드 후 best와 score를 함께 전환한다", async () => {
  let loaded = false;
  let resolveLoad: (() => void) | null = null;
  const restoreDocumentFonts = installMockDocumentFonts({
    isLoaded: () => loaded,
    load: () =>
      new Promise((resolve) => {
        resolveLoad = () => {
          loaded = true;
          resolve([]);
        };
      }),
  });

  try {
    const scoreUI = new ScoreUI(12);
    scoreUI.addScore(1);

    resolveLoad?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const [bestFontFamilies, scoreFontFamilies] =
      getScoreUIFontFamilies(scoreUI);

    assert.deepEqual(bestFontFamilies, scoreFontFamilies);
    assert.equal(bestFontFamilies[0], "NeoDunggeunmo Pro");
  } finally {
    resetFlappyBirdRetroFontLoadStateForTest();
    restoreDocumentFonts();
  }
});

test("CountdownUI는 NeoDunggeunmo 로드 전에는 fallback 폰트로 시작한다", () => {
  const restoreDocumentFonts = installMockDocumentFonts({
    isLoaded: () => false,
    load: () => new Promise(() => undefined),
  });

  try {
    const countdownUI = new CountdownUI();
    countdownUI.start(2);

    const fontFamilies = getTextFontFamilies(countdownUI.getDisplayObject());

    assert.notEqual(fontFamilies[0], "NeoDunggeunmo Pro");
  } finally {
    resetFlappyBirdRetroFontLoadStateForTest();
    restoreDocumentFonts();
  }
});

test("CountdownUI는 active countdown 중 폰트가 로드되어도 숫자 폰트를 바꾸지 않는다", async () => {
  let loaded = false;
  let resolveLoad: (() => void) | null = null;
  const restoreDocumentFonts = installMockDocumentFonts({
    isLoaded: () => loaded,
    load: () =>
      new Promise((resolve) => {
        resolveLoad = () => {
          loaded = true;
          resolve([]);
        };
      }),
  });

  try {
    const countdownUI = new CountdownUI();
    countdownUI.start(2);
    const fallbackFontFamilies = getTextFontFamilies(
      countdownUI.getDisplayObject(),
    );

    resolveLoad?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    countdownUI.update(1000);
    const activeFontFamilies = getTextFontFamilies(
      countdownUI.getDisplayObject(),
    );

    assert.deepEqual(activeFontFamilies, fallbackFontFamilies);

    countdownUI.hide();
    const nextFontFamilies = getTextFontFamilies(countdownUI.getDisplayObject());

    assert.equal(nextFontFamilies[0], "NeoDunggeunmo Pro");
  } finally {
    resetFlappyBirdRetroFontLoadStateForTest();
    restoreDocumentFonts();
  }
});

test("CountdownUI는 start 시점에 NeoDunggeunmo가 로드되어 있으면 retro 폰트를 사용한다", () => {
  const restoreDocumentFonts = installMockDocumentFonts({
    isLoaded: () => true,
    load: async () => [],
  });

  try {
    const countdownUI = new CountdownUI();
    countdownUI.start(2);

    const fontFamilies = getTextFontFamilies(countdownUI.getDisplayObject());

    assert.equal(fontFamilies[0], "NeoDunggeunmo Pro");
  } finally {
    resetFlappyBirdRetroFontLoadStateForTest();
    restoreDocumentFonts();
  }
});

test("preloadFlappyBirdRetroFont는 timeout이 지나면 fallback 진행 신호를 반환한다", async () => {
  const restoreDocumentFonts = installMockDocumentFonts({
    isLoaded: () => false,
    load: () => new Promise(() => undefined),
  });

  try {
    const isLoaded = await preloadFlappyBirdRetroFont({ timeoutMs: 1 });

    assert.equal(isLoaded, false);
  } finally {
    resetFlappyBirdRetroFontLoadStateForTest();
    restoreDocumentFonts();
  }
});
