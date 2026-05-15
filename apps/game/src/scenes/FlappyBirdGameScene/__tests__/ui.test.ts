import assert from "node:assert/strict";
import test from "node:test";
import * as PIXI from "pixi.js";
import { ScoreUI } from "../ui";

function getScoreUIFontFamilies(scoreUI: ScoreUI): string[][] {
  const textNodes = scoreUI
    .getDisplayObject()
    .children.filter((child): child is PIXI.Text => child instanceof PIXI.Text);

  return textNodes.map((text) => {
    const { fontFamily } = text.style;
    return Array.isArray(fontFamily) ? [...fontFamily] : [fontFamily];
  });
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
    restoreDocumentFonts();
  }
});
