import {
  DEFAULT_LOCALE,
  type LocaleCode,
  type TranslationKey,
  type TranslationParams,
  translate,
} from "@shared/i18n";
import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getGameSettings, updateGameSettings } from "./settings/gameSettings";

type I18nContextValue = {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [locale, setLocaleState] = useState<LocaleCode>(
    () => getGameSettings().locale ?? DEFAULT_LOCALE,
  );

  const setLocale = useCallback((nextLocale: LocaleCode) => {
    updateGameSettings({ locale: nextLocale });
    setLocaleState(nextLocale);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) =>
      translate(locale, key, params),
    [locale],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);

  if (!context) {
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (key, params) => translate(DEFAULT_LOCALE, key, params),
    };
  }

  return context;
}
