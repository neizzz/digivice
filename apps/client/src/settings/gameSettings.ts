import {
  DEFAULT_LOCALE,
  type LocaleCode,
  normalizeLocale,
} from "@shared/i18n";

export interface GameSettings {
  vibrationEnabled: boolean;
  locale: LocaleCode;
}

const STORAGE_KEYS = {
  vibrationEnabled: "game.settings.vibrationEnabled",
  locale: "game.settings.locale",
} as const;

const DEFAULT_SETTINGS: GameSettings = {
  vibrationEnabled: true,
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
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS.locale;
  }

  return normalizeLocale(window.localStorage.getItem(STORAGE_KEYS.locale));
}

export function getGameSettings(): GameSettings {
  return {
    vibrationEnabled: getBooleanSetting(
      STORAGE_KEYS.vibrationEnabled,
      DEFAULT_SETTINGS.vibrationEnabled,
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
    window.localStorage.setItem(STORAGE_KEYS.locale, nextSettings.locale);
  }

  return nextSettings;
}

export function isVibrationEnabled(): boolean {
  return getGameSettings().vibrationEnabled;
}
