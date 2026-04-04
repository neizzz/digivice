export interface GameSettings {
  vibrationEnabled: boolean;
  notificationEnabled: boolean;
}

const STORAGE_KEYS = {
  vibrationEnabled: "game.settings.vibrationEnabled",
  notificationEnabled: "game.settings.notificationEnabled",
} as const;

const DEFAULT_SETTINGS: GameSettings = {
  vibrationEnabled: true,
  notificationEnabled: true,
};

function getBooleanSetting(
  key: string,
  defaultValue: boolean,
): boolean {
  if (typeof window === "undefined") {
    return defaultValue;
  }

  const value = window.localStorage.getItem(key);
  if (value === null) {
    return defaultValue;
  }

  return value === "true";
}

export function getGameSettings(): GameSettings {
  return {
    vibrationEnabled: getBooleanSetting(
      STORAGE_KEYS.vibrationEnabled,
      DEFAULT_SETTINGS.vibrationEnabled,
    ),
    notificationEnabled: getBooleanSetting(
      STORAGE_KEYS.notificationEnabled,
      DEFAULT_SETTINGS.notificationEnabled,
    ),
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
      STORAGE_KEYS.notificationEnabled,
      String(nextSettings.notificationEnabled),
    );
  }

  return nextSettings;
}

export function isVibrationEnabled(): boolean {
  return getGameSettings().vibrationEnabled;
}
