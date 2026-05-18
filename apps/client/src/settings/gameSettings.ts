import {
  DEFAULT_LOCALE,
  type LocaleCode,
  resolveLocaleFromLanguageTags,
} from "@shared/i18n";

export interface GameSettings {
  vibrationEnabled: boolean;
  sfxEnabled: boolean;
  locale: LocaleCode;
}

const STORAGE_KEYS = {
  vibrationEnabled: "game.settings.vibrationEnabled",
  sfxEnabled: "game.settings.sfxEnabled",
  locale: "game.settings.locale",
} as const;

const DEFAULT_SETTINGS: GameSettings = {
  vibrationEnabled: true,
  sfxEnabled: true,
  locale: DEFAULT_LOCALE,
};

function getBooleanSetting(key: string, defaultValue: boolean): boolean {
  if (typeof window === "undefined") {
    return defaultValue;
  }

  const value = window.localStorage.getItem(key);
  if (value === null) {
    return defaultValue;
  }

  return value === "true";
}

function getLocaleSetting(): LocaleCode {
  if (typeof navigator === "undefined") {
    return DEFAULT_SETTINGS.locale;
  }

  return resolveLocaleFromLanguageTags([
    ...Array.from(navigator.languages ?? []),
    navigator.language,
  ]);
}

export function getGameSettings(): GameSettings {
  return {
    vibrationEnabled: getBooleanSetting(
      STORAGE_KEYS.vibrationEnabled,
      DEFAULT_SETTINGS.vibrationEnabled,
    ),
    sfxEnabled: getBooleanSetting(
      STORAGE_KEYS.sfxEnabled,
      DEFAULT_SETTINGS.sfxEnabled,
    ),
    locale: getLocaleSetting(),
  };
}

export function updateGameSettings(
  partialSettings: Partial<GameSettings>,
): GameSettings {
  const nextSettings = {
    ...getGameSettings(),
    ...partialSettings,
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      STORAGE_KEYS.vibrationEnabled,
      String(nextSettings.vibrationEnabled),
    );
    window.localStorage.setItem(
      STORAGE_KEYS.sfxEnabled,
      String(nextSettings.sfxEnabled),
    );
    window.localStorage.setItem(STORAGE_KEYS.locale, nextSettings.locale);
  }

  return nextSettings;
}

export function isVibrationEnabled(): boolean {
  return getGameSettings().vibrationEnabled;
}

export function isSfxEnabled(): boolean {
  return getGameSettings().sfxEnabled;
}
