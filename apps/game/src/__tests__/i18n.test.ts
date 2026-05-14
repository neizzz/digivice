import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTranslationParity,
  DEFAULT_LOCALE,
  normalizeLocale,
  translate,
} from "@shared/i18n";

test("i18n dictionaries keep the same key set", () => {
  assert.doesNotThrow(() => assertTranslationParity());
});

test("i18n locale normalization falls back to default locale", () => {
  assert.equal(DEFAULT_LOCALE, "en");
  assert.equal(normalizeLocale("ko"), "ko");
  assert.equal(normalizeLocale("zh-CN"), "en");
  assert.equal(normalizeLocale(undefined), "en");
});

test("i18n interpolation uses locale dictionary text", () => {
  assert.equal(translate("en", "flappy.score", { score: 7 }), "Score: 7");
  assert.equal(translate("pt-BR", "flappy.score", { score: 7 }), "Pontuação: 7");
});
