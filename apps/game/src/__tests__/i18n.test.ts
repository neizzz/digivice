import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTranslationParity,
  DEFAULT_LOCALE,
  normalizeLocale,
  resolveLocaleFromLanguageTags,
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

test("i18n resolves browser language tags to supported locales", () => {
  assert.equal(resolveLocaleFromLanguageTags(["ko-KR"]), "ko");
  assert.equal(resolveLocaleFromLanguageTags(["en-US"]), "en");
  assert.equal(resolveLocaleFromLanguageTags(["pt-BR"]), "pt-BR");
  assert.equal(resolveLocaleFromLanguageTags(["zh-Hant-TW"]), "zh-TW");
  assert.equal(resolveLocaleFromLanguageTags(["zh-MO"]), "zh-HK");
  assert.equal(resolveLocaleFromLanguageTags(["zh-CN"]), "en");
  assert.equal(resolveLocaleFromLanguageTags(["fr-FR"]), "en");
});

test("i18n checks browser language tags in priority order", () => {
  assert.equal(resolveLocaleFromLanguageTags(["fr-FR", "ja-JP"]), "ja");
});

test("i18n interpolation uses locale dictionary text", () => {
  assert.equal(translate("en", "flappy.score", { score: 7 }), "Score: 7");
  assert.equal(translate("pt-BR", "flappy.score", { score: 7 }), "Pontuação: 7");
});
